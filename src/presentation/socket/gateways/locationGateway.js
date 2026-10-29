const { updateLocationPayload, sosPayload } = require('../../dto/location.schemas');
const { formatIssues } = require('../../dto/common');
const { AppError } = require('../../../domain/errors');
const { outcomeForError } = require('../socketMetrics');

function registerLocationGateway(socket, { location, logger = console, withEventContext = (event, callback) => callback() }) {
  const user = socket.data.user;

  socket.on('update_location', (payload) => withEventContext('update_location', async (mark = () => {}) => {
    const parsed = updateLocationPayload.safeParse(payload);
    if (!parsed.success) {
      mark('rejected');
      return socket.emit('error', { message: 'Invalid location payload.', errors: formatIssues(parsed.error) });
    }
    try {
      await location.updateLocation({
        userId: user.id,
        userName: user.name,
        socketId: socket.id,
        fallbackBatteryLevel: user.batteryLevel,
        ...parsed.data,
      });
      if (parsed.data.batteryLevel !== undefined) user.batteryLevel = parsed.data.batteryLevel;
    } catch (error) {
      mark(outcomeForError(error));
      if (error instanceof AppError) {
        return socket.emit('error', { code: error.code, message: error.message });
      }
      logger.error('LOCATION_UPDATE_FAILED');
      socket.emit('error', { message: 'Failed to update location' });
    }
  }));

  socket.on('sos_alert', (payload) => withEventContext('sos_alert', async (mark = () => {}) => {
    const parsed = sosPayload.safeParse(payload);
    if (!parsed.success) {
      mark('rejected');
      return socket.emit('error', { message: 'Invalid SOS payload.', errors: formatIssues(parsed.error) });
    }
    try {
      logger.log('SOS_ALERT_REQUESTED');
      const result = await location.sendSos({ userId: user.id, userName: user.name, ...parsed.data });
      socket.emit('sos_confirmed', { message: 'SOS alert sent to all your groups.', ...result });
    } catch (error) {
      mark(outcomeForError(error));
      if (error instanceof AppError) return socket.emit('error', { code: error.code, message: error.message });
      logger.error('SOS_ALERT_FAILED');
      socket.emit('error', { message: 'Failed to send SOS alert' });
    }
  }));
}

module.exports = { registerLocationGateway };
