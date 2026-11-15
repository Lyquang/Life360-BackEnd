const { AppError, Errors } = require('../../domain/errors');

function createRoutingUseCases({ provider }) {
  return {
    async preview({ origin, destination, travelMode }) {
      if (!provider) throw new AppError(503, 'ROUTE_UNAVAILABLE', 'Routing is not configured.');
      try {
        const routes = await provider.calculate({ origin, destination, travelMode });
        return {
          provider: 'tomtom-v1',
          travelMode,
          fetchedAt: new Date().toISOString(),
          routes,
          ...(routes.length === 0 && { reason: 'no_route' }),
        };
      } catch (error) {
        if (error?.kind === 'quota') {
          throw new AppError(429, 'ROUTE_QUOTA_EXCEEDED', 'Routing provider quota is unavailable.');
        }
        if (error?.kind === 'no_route') {
          return { provider: 'tomtom-v1', travelMode, fetchedAt: new Date().toISOString(),
            routes: [], reason: 'no_route' };
        }
        if (error?.kind === 'unavailable') {
          throw new AppError(503, 'ROUTE_UNAVAILABLE', 'Routing provider is unavailable.');
        }
        if (error instanceof AppError) throw error;
        throw Errors.serviceUnavailable('Routing provider is unavailable.');
      }
    },
  };
}

module.exports = { createRoutingUseCases };
