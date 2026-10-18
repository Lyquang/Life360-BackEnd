const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { buildLiveTrailGaps, localDateFor } = require('../src/domain/liveTrail');
const { startTestServer } = require('./helpers/testServer');

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function point(recordedAt, eastMeters, overrides = {}) {
  const metersPerLongitudeDegree = ((Math.PI * 6371000) / 180) * Math.cos(10.7 * Math.PI / 180);
  return {
    pointId: randomUUID(),
    latitude: 10.7,
    longitude: 106.6 + eastMeters / metersPerLongitudeDegree,
    recordedAt,
    accuracy: 5,
    motionState: 'walking',
    ...overrides,
  };
}

describe('live trail stable gaps', () => {
  it('uses chronological neighbors with seq boundaries and ignores same-region silence', () => {
    const points = [
      { seq: 1, ...point(new Date('2026-10-18T05:00:00.000Z'), 0) },
      { seq: 2, ...point(new Date('2026-10-18T05:06:40.000Z'), 500) },
      { seq: 3, ...point(new Date('2026-10-18T05:03:20.000Z'), 20) },
    ];
    const gaps = buildLiveTrailGaps(points, {
      gapThresholdSeconds: 180,
      stayRadiusMeters: 80,
    });

    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].fromSeq, 3);
    assert.equal(gaps[0].toSeq, 2);
    assert.equal(gaps[0].seconds, 200);
    assert.ok(gaps[0].meters > 400);
  });
});

describe('GET live trail snapshot and catch-up', { timeout: 120000 }, () => {
  let t;
  let target;
  let viewer;
  let outsider;
  let date;

  before(async () => {
    t = await startTestServer({
      env: {
        LIVE_TRAIL_ENABLED: 'true',
        LIVE_TRAIL_READ_RATE_LIMIT: '100',
      },
    });
    target = await t.registerUser('TrailReadTarget');
    viewer = await t.registerUser('TrailReadViewer');
    outsider = await t.registerUser('TrailReadOutsider');
    const group = await t.createGroup(target, 'Trail Read Group');
    await t.joinGroup(viewer, group);

    const projection = t.instance.container.services.liveTrailProjection;
    const firstAt = new Date('2026-10-18T05:00:00.000Z');
    date = localDateFor(firstAt, TIME_ZONE);
    await projection.project({
      userId: target.id,
      points: [
        point(firstAt, 0),
        point(new Date('2026-10-18T05:06:40.000Z'), 500),
      ],
    });
    await projection.project({
      userId: target.id,
      points: [point(new Date('2026-10-18T05:03:20.000Z'), 20)],
    });
  });

  after(() => t.stop());

  it('paginates by insertion seq and exposes chronological stable gaps', async () => {
    const first = await t.api(
      'GET',
      `/api/v1/history/${target.id}/journey/trail?date=${date}&limit=2&revision=2`,
      { token: viewer.token }
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.userId, target.id);
    assert.equal(first.body.date, date);
    assert.equal(first.body.timeZone, TIME_ZONE);
    assert.equal(first.body.revision, 2);
    assert.equal(first.body.lastSeq, 3);
    assert.deepEqual(first.body.points.map((entry) => entry.seq), [1, 2]);
    assert.equal(first.body.hasMore, true);
    assert.equal(first.body.nextAfterSeq, 2);
    assert.deepEqual(
      first.body.gaps.map(({ fromSeq, toSeq, seconds }) => ({ fromSeq, toSeq, seconds })),
      [{ fromSeq: 3, toSeq: 2, seconds: 200 }]
    );
    assert.deepEqual(first.body.matched, []);

    const second = await t.api(
      'GET',
      `/api/v1/history/${target.id}/journey/trail?date=${date}&afterSeq=2&revision=2&limit=2`,
      { token: viewer.token }
    );
    assert.equal(second.status, 200);
    assert.deepEqual(second.body.points.map((entry) => entry.seq), [3]);
    assert.equal(second.body.hasMore, false);
    assert.equal(second.body.nextAfterSeq, null);

    const pathOrder = [...first.body.points, ...second.body.points]
      .sort((left, right) =>
        new Date(left.recordedAt) - new Date(right.recordedAt) || left.seq - right.seq
      )
      .map((entry) => entry.seq);
    assert.deepEqual(pathOrder, [1, 3, 2]);
  });

  it('returns a structured revision conflict and validates catch-up cursors', async () => {
    const conflict = await t.api(
      'GET',
      `/api/v1/history/${target.id}/journey/trail?date=${date}&afterSeq=1&revision=1`,
      { token: viewer.token }
    );
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'TRAIL_REVISION_CHANGED');
    assert.equal(conflict.body.data.currentRevision, 2);
    assert.equal(conflict.body.data.lastSeq, 3);
    assert.ok(conflict.body.data.trailId);

    const missingRevision = await t.api(
      'GET',
      `/api/v1/history/${target.id}/journey/trail?date=${date}&afterSeq=1`,
      { token: viewer.token }
    );
    assert.equal(missingRevision.status, 400);
    assert.equal(missingRevision.body.code, 'VALIDATION_ERROR');
  });

  it('enforces authentication, circle authorization, missing-trail and feature gates', async () => {
    const path = `/api/v1/history/${target.id}/journey/trail?date=${date}`;
    assert.equal((await t.api('GET', path)).status, 401);
    assert.equal((await t.api('GET', path, { token: outsider.token })).status, 403);
    assert.equal(
      (await t.api(
        'GET',
        `/api/v1/history/${target.id}/journey/trail?date=2026-10-19`,
        { token: viewer.token }
      )).status,
      404
    );

    const policy = t.instance.container.services.liveTrailPolicy;
    policy.enabled = false;
    try {
      const disabled = await t.api('GET', path, { token: viewer.token });
      assert.equal(disabled.status, 503);
      assert.equal(disabled.body.code, 'SERVICE_UNAVAILABLE');
    } finally {
      policy.enabled = true;
    }
  });
});

describe('live trail read rate limit', { timeout: 120000 }, () => {
  let t;

  before(async () => {
    t = await startTestServer({
      env: {
        LIVE_TRAIL_ENABLED: 'true',
        LIVE_TRAIL_READ_RATE_LIMIT: '1',
      },
    });
  });

  after(() => t.stop());

  it('limits by authenticated requester and sends Retry-After', async () => {
    const user = await t.registerUser('TrailReadRateUser');
    const at = new Date();
    await t.instance.container.services.liveTrailProjection.project({
      userId: user.id,
      points: [point(at, 0)],
    });
    const date = localDateFor(at, TIME_ZONE);
    const url = `${t.baseUrl}/api/v1/history/${user.id}/journey/trail?date=${date}`;
    const headers = { Authorization: `Bearer ${user.token}` };

    const first = await fetch(url, { headers });
    assert.equal(first.status, 200);
    const second = await fetch(url, { headers });
    assert.equal(second.status, 429);
    assert.ok(Number(second.headers.get('retry-after')) >= 1);
    assert.equal((await second.json()).code, 'RATE_LIMITED');
  });
});
