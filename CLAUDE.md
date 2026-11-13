# Claude / AI Agent Entry Point — Family Tracker Backend

Read [AGENTS.md](AGENTS.md) first. It is the canonical agent operating guide for
this backend; this file deliberately does not maintain a second rulebook or an
API/model/config catalog.

Then read [specs/README.md](specs/README.md), choose the owning feature and consult
its current spec, contracts/model, decisions/questions and plan/tasks as relevant.
Code/tests describe current behavior; accepted specs describe approved intent.
Surface discrepancies and resolve the missing product decision before changing behavior.

For a new feature: read → ask focused requirement questions in rounds → agree
requirements with human confirmation → native plan/tasks/analyze → AWAITING_APPROVAL
→ explicit implementation approval → implement → verify/docs → native converge
→ update specs, api-docs, Study and PROGRESS. Read the
[Spec Kit integration guide](codex/spec-kit/README.md); Codex skills and the optional
workflow engine are installed, not a second custom framework. Reuse existing answers and
valid approvals; do not ask again to start work already approved. Follow the full
approval, safety, architecture and navigation rules in AGENTS.md.

- [Feature templates](specs/README.md#templates-và-đầu-ra)
- [Frontend/mobile API handoff](api-docs/README.md)
- [Human learning notes](Study/README.md)
- [Progress and validation history](PROGRESS.md)

`Guide.md` is historical product input. Existing Study/integration documents may
contain proposals or historical evidence; their presence does not approve future
behavior. Use the feature's current status and source evidence.
