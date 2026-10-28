const { Errors } = require('./errors');

const SOS_STATUSES = Object.freeze(['active', 'resolved', 'cancelled', 'expired']);
const CLOSED_SOS_STATUSES = Object.freeze(SOS_STATUSES.filter((status) => status !== 'active'));

function assertSosActive(incident) {
  if (!incident) throw Errors.notFound('SOS incident not found.');
  if (incident.status !== 'active') throw Errors.conflict('SOS incident is already closed.');
}

// Membership authorization belongs to the use case; these checks do not grant access.
function assertCanOfferAssistance(incident, responderId) {
  assertSosActive(incident);
  if (String(incident.ownerId) === String(responderId)) {
    throw Errors.badRequest('You cannot offer assistance to your own SOS.');
  }
}

function assertSosClosingStatus(status) {
  if (!CLOSED_SOS_STATUSES.includes(status)) {
    throw Errors.badRequest('Invalid SOS closing status.');
  }
}

module.exports = {
  SOS_STATUSES,
  CLOSED_SOS_STATUSES,
  assertSosActive,
  assertCanOfferAssistance,
  assertSosClosingStatus,
};
