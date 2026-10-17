const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers/testServer');
const LocationHistory = require('../src/infrastructure/database/models/LocationHistory');

describe('GET /api/v1/history/:userId range pagination', { timeout: 120000 }, () => {
  let t;
  let owner;
  let member;
  let outsider;
  let from;
  let to;

  before(async () => {
    t = await startTestServer({
      env: {
        HISTORY_RANGE_DEFAULT_LIMIT: '2',
        HISTORY_RANGE_MAX_LIMIT: '3',
        HISTORY_RANGE_MAX_DAYS: '7',
      },
    });
    owner = await t.registerUser('RangeOwner');
    member = await t.registerUser('RangeMember');
    outsider = await t.registerUser('RangeOutsider');
    const group = await t.createGroup(owner, 'Range History');
    await t.joinGroup(member, group);

    const start = new Date();
    start.setHours(10, 0, 0, 0);
    from = new Date(start.getTime() - 60000);
    to = new Date(start.getTime() + 10 * 60000);
    await LocationHistory.create(
      [0, 0, 0, 30, 60].map((offsetSeconds, index) => ({
        userId: member.id,
        pointId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        location: { type: 'Point', coordinates: [index * 0.001, 0] },
        timestamp: new Date(start.getTime() + offsetSeconds * 1000),
        accuracy: index + 1,
      }))
    );
  });

  after(() => t.stop());

  function rangePath(extra = {}) {
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      ...extra,
    });
    return `/api/v1/history/${member.id}?${query}`;
  }

  it('returns every point once across pages, including equal timestamps', async () => {
    const ids = [];
    let cursor;
    do {
      const response = await t.api('GET', rangePath(cursor ? { cursor } : {}), { token: owner.token });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.ok(response.body.data.length <= 2);
      ids.push(...response.body.data.map((entry) => entry.id));
      cursor = response.body.nextCursor;
    } while (cursor);

    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5);
    const expected = await LocationHistory.find({ userId: member.id })
      .sort({ timestamp: 1, _id: 1 })
      .select('_id')
      .lean();
    assert.deepEqual(ids, expected.map((entry) => String(entry._id)));
  });

  it('validates cursors, limits and maximum range', async () => {
    assert.equal((await t.api('GET', rangePath({ cursor: 'broken' }), { token: owner.token })).status, 400);
    assert.equal((await t.api('GET', rangePath({ limit: '4' }), { token: owner.token })).status, 400);

    const tooWide = new URLSearchParams({
      from: from.toISOString(),
      to: new Date(from.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(
      (await t.api('GET', `/api/v1/history/${member.id}?${tooWide}`, { token: owner.token })).status,
      400
    );
    assert.equal(
      (await t.api('GET', `/api/v1/history/${member.id}?limit=2`, { token: owner.token })).status,
      400
    );
  });

  it('keeps authorization and the no-query legacy response intact', async () => {
    assert.equal((await t.api('GET', rangePath(), { token: outsider.token })).status, 403);
    assert.equal((await t.api('GET', rangePath())).status, 401);

    const legacy = await t.api('GET', `/api/v1/history/${member.id}`, { token: owner.token });
    assert.equal(legacy.status, 200);
    assert.ok(Array.isArray(legacy.body.data));
    assert.equal(typeof legacy.body.date, 'string');
    assert.equal(legacy.body.nextCursor, undefined);
    assert.equal(legacy.body.range, undefined);
  });

  it('infers a bounded range when only one endpoint is supplied', async () => {
    const query = new URLSearchParams({ from: from.toISOString() });
    const response = await t.api('GET', `/api/v1/history/${member.id}?${query}`, { token: owner.token });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.range.from, from.toISOString());
    assert.ok(new Date(response.body.range.to) > from);
  });
});
