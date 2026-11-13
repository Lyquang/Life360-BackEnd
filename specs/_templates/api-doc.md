# <Feature> — frontend/mobile integration

Output: `api-docs/<chosen-file>.md` (not the feature's normative contract owner).
Status: Draft / Implemented locally / Verified in <environment> | Updated: <date>
Feature spec/accepted contract: <links> | Source revision/evidence: <...>

## What the client can do

<User flow, prerequisites, supported rollout flags/environment. Separate implemented
behavior from proposed work. Do not imply deployed because tests passed locally.>

## Authentication and access

<Base/version, auth/handshake, roles, Circle/membership/privacy/ownership checks,
token refresh implications and operational keys only where applicable. No real credentials.>

## Interfaces

| Method/path or event/direction | Request | Response/ack | Permission and errors |
|---|---|---|---|
| <verified interface> | <exact DTO> | <exact envelope/status> | <stable codes and conditions> |

<Define required/optional/nullable fields, units, coordinates, timezones/date formats,
IDs, limits and ordering relevant to this feature. Link shared conventions. For
Socket.IO specify ack/fire-and-forget, readiness/rooms/reconnect and recovery if used.>

## End-to-end client flow

<Sequence of real calls/events, local state and empty/loading/error behavior. Include
pagination/cursors/revisions, retry/backoff/idempotency/duplicates, offline and access
revocation where applicable. No backend-internal design details unless client needs them.>

## Examples

<Synthetic request/response/error/event examples checked against source/tests.
No production GPS, profiles, keys, token values or unimplemented endpoints.>

## Compatibility and integration checklist

<Old/new client compatibility, feature flag disabled behavior, required client changes,
known limits, example tests/manual checks and actual verification status.>

## Changes

<Date, relevant contract revision and behavior change. If there is no client-facing
interface, do not create a fake API document: record N/A at the feature plan/delivery.>
