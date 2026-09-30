const { Errors } = require('../../domain/errors');
const { buildDayJourney } = require('../../domain/journey');
const { localDayRange, formatLocalDate } = require('../../domain/dates');
const { sameId } = require('../shared/policies');

function toPoint(entry) {
  return {
    latitude: entry.location.coordinates[1],
    longitude: entry.location.coordinates[0],
    timestamp: new Date(entry.timestamp),
  };
}

function createHistoryUseCases({ groupRepo, locationHistoryRepo }) {
  async function assertCanView(requesterId, targetUserId) {
    if (sameId(requesterId, targetUserId)) return;
    if (!(await groupRepo.usersShareGroup(requesterId, targetUserId))) {
      throw Errors.forbidden('You can only view history of yourself or members of your groups.');
    }
  }

  async function getTodayHistory({ requesterId, userId }) {
    await assertCanView(requesterId, userId);
    const { start, end } = localDayRange();
    const history = await locationHistoryRepo.listForUserBetween(userId, start, end);
    return {
      date: formatLocalDate(start),
      points: history.map((entry) => ({
        id: entry._id,
        latitude: entry.location.coordinates[1],
        longitude: entry.location.coordinates[0],
        timestamp: entry.timestamp,
      })),
    };
  }

  async function getDayJourney({ requesterId, userId, date }) {
    await assertCanView(requesterId, userId);
    const { start, end } = localDayRange(date);
    const history = await locationHistoryRepo.listForUserBetween(userId, start, end);
    return { date: formatLocalDate(start), userId, ...buildDayJourney(history.map(toPoint)) };
  }

  return { getTodayHistory, getDayJourney };
}

module.exports = { createHistoryUseCases };
