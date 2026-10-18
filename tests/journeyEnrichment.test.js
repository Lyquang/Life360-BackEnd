const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { buildDayJourney } = require('../src/domain/journey');
const { startTestServer } = require('./helpers/testServer');
const LocationHistory = require('../src/infrastructure/database/models/LocationHistory');

function point(index, seconds, eastDegrees = index * 0.001) {
  return {
    id: `point-${index}`,
    latitude: 0,
    longitude: eastDegrees,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)),
    accuracy: 5,
  };
}

function pointMeters(index, seconds, eastMeters) {
  return point(index, seconds, eastMeters / ((Math.PI * 6371000) / 180));
}

describe('journey geometry enrichment', () => {
  it('keeps the legacy moving shape unchanged unless geometry is requested', () => {
    const moving = buildDayJourney([point(0, 0), point(1, 30)]).journey[0];
    assert.deepEqual(Object.keys(moving), [
      'type',
      'fromLatitude',
      'fromLongitude',
      'toLatitude',
      'toLongitude',
      'startTime',
      'endTime',
      'durationMinutes',
      'durationFormatted',
      'path',
    ]);
  });

  it('adds stable real points, distance, thinning and gap metadata', () => {
    const input = [point(0, 0), point(1, 30), point(2, 60), point(3, 360), point(4, 390)];
    const options = {
      geometry: true,
      gapThresholdSeconds: 180,
      maxPointsPerSegment: 4,
      simplifyToleranceMeters: 8,
    };
    const first = buildDayJourney(input, options);
    const second = buildDayJourney([...input].reverse(), options);
    const moving = first.journey[0];

    assert.equal(moving.segmentId, second.journey[0].segmentId);
    assert.equal(moving.originalPointCount, 5);
    assert.equal(moving.pointCount, 4);
    assert.equal(moving.thinned, true);
    assert.equal(moving.gaps.length, 1);
    assert.deepEqual(moving.gaps[0], {
      fromIndex: 1,
      toIndex: 2,
      seconds: 300,
      meters: moving.gaps[0].meters,
    });
    assert.equal(moving.maxGapSeconds, 300);
    assert.equal(moving.observedMovingSeconds, 90);
    assert.equal(first.summary.observedMovingSeconds, 90);
    assert.equal(first.summary.observedStaySeconds, 0);
    assert.equal(first.summary.unobservedSeconds, 300);
    assert.ok(moving.distanceMeters > 0);
    assert.ok(moving.points.every((entry) => entry.recordedAt && entry.accuracy === 5));
  });

  it('keeps same-place silence as one inferred stay instead of a route gap', () => {
    const lastFix = pointMeters(2, 7200, 20);
    const input = [
      pointMeters(0, 0, 0),
      pointMeters(1, 300, 10),
      lastFix,
    ];
    const options = {
      geometry: true,
      gapThresholdSeconds: 180,
      stayRadiusMeters: 80,
      minStayMinutes: 5,
    };
    const result = buildDayJourney(input, options);
    const repeated = buildDayJourney([...input].reverse(), options);

    assert.equal(result.journey.length, 1);
    const stay = result.journey[0];
    assert.equal(stay.type, 'stay');
    assert.match(stay.segmentId, /^v1_/);
    assert.equal(stay.segmentId, repeated.journey[0].segmentId);
    assert.equal(stay.confidence, 'inferred');
    assert.equal(stay.containsDataGap, true);
    assert.equal(stay.maxGapSeconds, 6900);
    assert.equal(stay.leftAt, lastFix.timestamp.toISOString());
    assert.equal(result.summary.observedStaySeconds, 0);
    assert.equal(result.summary.unobservedSeconds, 7200);
    assert.equal(result.journey.some((segment) => segment.gaps?.length), false);
  });

  it('marks a continuously observed stay and counts its observed duration', () => {
    const result = buildDayJourney([
      pointMeters(0, 0, 0),
      pointMeters(1, 120, 10),
      pointMeters(2, 300, 20),
    ], {
      geometry: true,
      gapThresholdSeconds: 180,
      stayRadiusMeters: 80,
      minStayMinutes: 5,
    });

    const stay = result.journey[0];
    assert.equal(stay.type, 'stay');
    assert.equal(stay.confidence, 'observed');
    assert.equal(stay.containsDataGap, false);
    assert.equal(stay.maxGapSeconds, 180);
    assert.equal(result.summary.observedStaySeconds, 300);
    assert.equal(result.summary.unobservedSeconds, 0);
  });

  it('does not infer a stay across a long-distance signal loss', () => {
    const result = buildDayJourney([
      pointMeters(0, 0, 0),
      pointMeters(1, 30, 40),
      pointMeters(2, 7230, 1000),
      pointMeters(3, 7260, 1040),
    ], {
      geometry: true,
      gapThresholdSeconds: 180,
      stayRadiusMeters: 80,
      minStayMinutes: 5,
    });

    assert.equal(result.summary.stayPointCount, 0);
    assert.equal(result.journey.length, 1);
    assert.equal(result.journey[0].type, 'moving');
    assert.equal(result.journey[0].gaps.length, 1);
    assert.equal(result.journey[0].gaps[0].seconds, 7200);
    assert.equal(result.summary.unobservedSeconds, 7200);
  });

  it('uses the last in-radius fix as leftAt after silence before movement', () => {
    const silentFix = pointMeters(1, 7200, 15);
    const result = buildDayJourney([
      pointMeters(0, 0, 0),
      silentFix,
      pointMeters(2, 7230, 200),
      pointMeters(3, 7260, 240),
    ], {
      geometry: true,
      gapThresholdSeconds: 180,
      stayRadiusMeters: 80,
      minStayMinutes: 5,
    });

    const stay = result.journey.find((segment) => segment.type === 'stay');
    assert.ok(stay);
    assert.equal(stay.leftAt, silentFix.timestamp.toISOString());
    assert.equal(stay.durationMinutes, 120);
    assert.equal(stay.confidence, 'inferred');
  });

  it('keeps legacy stay and summary shapes unchanged', () => {
    const legacy = buildDayJourney([
      pointMeters(0, 0, 0),
      pointMeters(1, 600, 10),
    ]);
    assert.deepEqual(Object.keys(legacy.journey[0]), [
      'type',
      'latitude',
      'longitude',
      'arrivedAt',
      'leftAt',
      'durationMinutes',
      'durationFormatted',
      'pointCount',
    ]);
    assert.equal(legacy.journey[0].segmentId, undefined);
    assert.equal(legacy.journey[0].confidence, undefined);
    assert.equal(legacy.summary.observedStaySeconds, undefined);
    assert.equal(legacy.summary.unobservedSeconds, undefined);
  });

  it('processes a synthetic 50k-point route within a bounded smoke-test budget', () => {
    const points = Array.from({ length: 50000 }, (_, index) => point(index, index * 15));
    const startedAt = performance.now();
    const result = buildDayJourney(points, {
      geometry: true,
      gapThresholdSeconds: 180,
      maxPointsPerSegment: 1000,
      simplifyToleranceMeters: 8,
    });
    const elapsedMs = performance.now() - startedAt;
    assert.equal(result.summary.totalPoints, 50000);
    assert.ok(elapsedMs < 5000, `geometry build took ${elapsedMs.toFixed(1)} ms`);
  });
});

describe('GET journey geometry integration', { timeout: 120000 }, () => {
  let t;
  let owner;
  let member;
  let outsider;

  before(async () => {
    t = await startTestServer({
      env: {
        TZ: 'Asia/Ho_Chi_Minh',
        JOURNEY_GAP_THRESHOLD_SECONDS: '240',
      },
    });
    owner = await t.registerUser('JourneyOwner');
    member = await t.registerUser('JourneyMember');
    outsider = await t.registerUser('JourneyOutsider');
    const group = await t.createGroup(owner, 'Journey Geometry');
    await t.joinGroup(member, group);
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    await LocationHistory.create([
      { userId: member.id, location: { type: 'Point', coordinates: [0, 0] }, timestamp: start, accuracy: 4 },
      { userId: member.id, location: { type: 'Point', coordinates: [0.001, 0] }, timestamp: new Date(start.getTime() + 30000), accuracy: 5 },
    ]);
  });

  after(() => t.stop());

  it('returns additive geometry to circle members and keeps authorization unchanged', async () => {
    const legacy = await t.api('GET', `/api/v1/history/${member.id}/journey`, { token: owner.token });
    const enriched = await t.api('GET', `/api/v1/history/${member.id}/journey?detail=geometry`, { token: owner.token });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.journey[0].points, undefined);
    assert.equal(enriched.status, 200);
    assert.equal(enriched.body.journey[0].points.length, 2);
    assert.equal(enriched.body.journey[0].pointCount, 2);
    assert.equal(enriched.body.timeZone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual(enriched.body.geometryPolicy, {
      version: 2,
      gapThresholdSeconds: 240,
      gapIndexSpace: 'points',
      toBoundary: 'inclusive',
      stayRadiusMeters: 80,
      minStayMinutes: 5,
    });
    assert.equal(legacy.body.timeZone, undefined);
    assert.equal(legacy.body.geometryPolicy, undefined);
    assert.equal(
      (await t.api('GET', `/api/v1/history/${member.id}/journey?detail=geometry`, { token: outsider.token })).status,
      403
    );
  });
});
