# Shared Socket.IO authentication, rooms and presence lifecycle

Status: **Current behavior**, 2026-11-11; accepted intent is tracked in [governance decisions](decisions.md). Socket.IO uses its default path `/socket.io/` on the HTTP origin, not raw WebSocket framing. Supply `auth:{token:accessToken}`; missing/invalid token produces generic `connect_error` message `Authentication error`. User identity comes from authentication; client cannot select arbitrary rooms.

Server joins `user:<id>` and optional `session:<familyId>` immediately and registers handlers synchronously; initialization resolves Circle/conversation IDs and joins `group:<id>`/`conversation:<id>`. `session:ready` carries `{groupIds,conversationIds}`. Trail watches additionally join `journey:trail:<trailId>` only after access check. Revocation disconnects sessions/users via these rooms; auth is not re-run on every socket event or at JWT expiry. Reconnect requires a new handshake. Rooms/runtime trackers use one process's state; no distributed Socket.IO adapter is wired.

`session:ready` is owned here. Payloads for location/presence, Circle membership, chat, trail and SOS are owned by their [feature contracts](../README.md). No event alone proves offline delivery/read receipt; use explicit application semantics.

[Authentication](../features/authentication/spec.md) owns token/family revocation; [location-sharing](../features/location-sharing/contracts.md) owns member_online/member_offline payloads. [Configuration](configuration.md) owns common limits.
