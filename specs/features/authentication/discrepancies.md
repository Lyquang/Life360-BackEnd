# Xác thực và phiên đăng nhập — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-01 | `CLAUDE.md` describes User `passwordHash`; `models/User.js` stores `password` (hash), `userRepository.create` maps `passwordHash` input to that field; serialization removes it. | Schema summary stale. Backend model doc records actual storage field; agent guide retained as evidence. |
| D-03 | `CLAUDE.md` shows JWT `7d`; `config/env.js` prefers `JWT_ACCESS_EXPIRES_IN`, then legacy `JWT_EXPIRES_IN`, then `15m`. | Do not infer deployed token lifetime from old docs; record precedence. |
| D-04 | Social DTO/Swagger enum includes Google/Apple/Facebook; OAuth factory only wires Google. | Apple/Facebook pass DTO then return 400 unsupported; Google without client ID returns 503. Do not advertise three working providers. |

## Questions

| ID | Current evidence | Decision / status |
|---|---|---|
| Q-03 | Redis blacklist checks fail open if disabled/unavailable; refresh revocation persists in MongoDB. Socket auth is checked at handshake, with explicit disconnect effects for revocation. | Is access JWT validity until expiry during Redis outage accepted for the intended deployment? No stronger revocation guarantee inferred. |
