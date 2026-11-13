## Backend review packet

- **Revision/date and requirements confirmation**: [progress.md link]
- **Requirements/acceptance IDs covered**: [traceability to spec]
- **Real paths to create/change**: [concrete owned files and independently useful slices]
- **Architecture flow and dependencies**: [transport → use case → repository/model; DI]
- **Alternatives and trade-offs**: [why chosen, compatibility, rollout/recovery]
- **Applicable design**: [data/index/transaction, API/socket DTO, authorization/privacy,
  concurrency/idempotency, errors/retries, retention; mark proposals accurately]
- **Verification strategy**: [acceptance → command/check; existing tests and limitations]
- **Client handoff**: [api-docs owner + affected Swagger/socket docs, or justified N/A]
- **Learning handoff**: [Study owner; Vietnamese with English technical terms, or N/A]
- **Dependencies/blockers**: [provider/account/cost/migration/deployment not implicitly authorized]
- **Review**: tasks and native analyze must complete before implementation approval;
  `progress.md` owns AWAITING_APPROVAL, artifact hashes and the human decision.

Adapt the native layout examples to this existing backend; do not create a new app
or framework. Supporting research/data-model/contracts/quickstart only when relevant.
