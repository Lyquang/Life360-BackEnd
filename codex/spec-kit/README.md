# Spec Kit trong Family Tracker Backend

Setup được user yêu cầu ngày 2026-11-12. **Official Specify CLI 1.4.0**, Codex
integration và native workflow `speckit` 1.0.1 đã cài; không triển khai feature app.
[Discovery và validation](../../specs/system/spec-kit-setup.md) phân biệt kết quả
đã kiểm tra với phần chưa chạy. [AGENTS.md](../../AGENTS.md) là hướng dẫn vận hành;
[constitution](../../.specify/memory/constitution.md) là project checks của Spec Kit.

## Bắt đầu một feature

Bạn chỉ cần nói: “Tôi muốn thêm …”. Agent phải tự đọc specs, tìm owner và hỏi các
câu thực sự còn thiếu. Có thể gọi skill rõ ràng trong **chat Codex**:

```text
$speckit-specify Tôi muốn thêm ... vào Backend. Chỉ discovery/spec trước.
$speckit-clarify Làm rõ các điểm còn thiếu, ghi Q-IDs và hỏi tôi từng vòng.
```

Feature mới dùng native `specs/NNN-name/`; helper tự chọn số kế tiếp. Đăng ký tại
[specs index](../../specs/README.md#native-spec-kit-features). Với bug/enhancement,
ưu tiên owner `specs/features/<name>/` hiện có, không tạo một folder cho mỗi bug.
Không dùng skill specify để tạo bản sao requirements của owner đã có.

Clarify native hỏi tối đa năm câu mỗi lần; gọi tiếp khi còn khoảng trống, không có
giới hạn năm câu cho toàn bộ feature. Dùng `interview.md` làm record câu hỏi/đáp án
Q-001… theo vòng; spec giữ kết luận được xác nhận và liên kết Q-ID. Không hỏi lại
đáp án đã có, không hỏi để đủ quota. Những câu chưa trả lời vẫn Open. Nếu native
clarify đề nghị plan nhưng còn blockers, tiếp tục clarify thay vì tự đi tiếp.

Agent gửi spec/interview và hỏi xác nhận requirements. Sau câu trả lời thật, ghi
confirmation và revision trong `progress.md`, rồi mới gọi:

```text
$speckit-plan Lập thiết kế từ requirements đã xác nhận, theo kiến trúc Backend.
$speckit-tasks Chia các lát có thể kiểm chứng, kèm API docs/Study khi phù hợp.
$speckit-analyze Đối chiếu spec, plan, tasks và constitution; chỉ đọc.
```

Agent ghi summary của analysis **ở bước riêng**, trình review packet có links,
risks, verification và hashes spec/plan/task scope, chuyển **AWAITING_APPROVAL**.
Bạn đọc và duyệt implementation của revision cụ thể; đồng ý requirements trước
đó chưa phải đồng ý code. Có critical finding thì sửa tài liệu đúng phạm vi,
analyze lại và review; không tự đổi yêu cầu sản phẩm. Sau approval hợp lệ:

```text
$speckit-implement Thực hiện đúng phạm vi đã duyệt trong progress.md.
```

Agent kiểm chứng theo acceptance, ghi `verification.md`, cập nhật api-docs và
Vietnamese Study, rồi dùng `$speckit-converge`. Converge native chỉ append unmet
tasks; không sửa spec/plan/code. Còn việc thuộc scope đã duyệt thì thực hiện và
kiểm chứng tiếp; scope thay đổi phải quay lại hỏi/duyệt. Không đánh COMPLETED chỉ
vì hết một lượt agent. Small fix giữ accepted behavior dùng workflow nhẹ theo
AGENTS; không bắt làm full bộ artifact hoặc questionnaire.

## Native và tùy biến của repo

| Phần | Nguồn và cách duy trì |
|---|---|
| Official CLI | `.specify/.venv/bin/specify`, ignored; `scripts/specify` chỉ là launcher local |
| 9 Codex skills | `.agents/skills/speckit-*/SKILL.md`, native init + preset materialization |
| Core scripts/templates/workflow | `.specify/scripts/bash/`, `.specify/templates/`, `.specify/workflows/speckit/`; giữ native |
| Project constitution | `.specify/memory/constitution.md`, accepted operating principles, không ratify toàn bộ legacy behavior |
| Preset source | `codex/spec-kit/backend-policy/`; prepend project policy vào native commands, append sections vào native spec/plan/tasks |
| Installed preset | `.specify/presets/backend-policy/`, native-generated copy/composition; chỉnh source rồi refresh |
| Overlay source | `codex/spec-kit/backend-sdd.yml`; compose native `speckit`, không sửa bundled workflow |
| Installed overlay | `.specify/workflows/overlays/speckit/backend-sdd.yml`, native CLI quản lý |
| Supplemental records | `specs/_templates/interview.md`, `verification.md`, `progress.md`; project artifacts, không phải native commands |
| Legacy docs/templates | `specs/features/`, `specs/system/`, `specs/_templates/`; giữ owner/IDs, không mass migrate |

Không có `/backend.approve`, `specify interview`, `specify study` hay lệnh native
tự đặt. Dotted `speckit.plan` là native command ID trong workflow; `$speckit-plan`
là cách gọi skill trong chat, không phải lệnh terminal. Template append giữ native
story/task syntax; supplementary records chỉ tạo khi có nội dung thật.

Ví dụ cấu trúc **feature tương lai**, không phải feature đã được tạo:

```text
specs/NNN-name/
  spec.md              # requirement authority, scenarios, acceptance
  interview.md         # actual questions/answers, not copied into every artifact
  plan.md              # design after requirements confirmation
  tasks.md             # native checkbox/task IDs and implementation progress
  progress.md          # stage + both human approvals + reviewed revisions
  verification.md      # actual criteria/checks/evidence/limits
  study.md             # useful summary/link to canonical Study/<owner>.md
  research.md          # only when research is needed
  data-model.md        # only when data design is relevant
  contracts/           # only actual/proposed interfaces, clearly labelled
  quickstart.md        # only useful runnable integration/verification instructions
  checklists/          # native generated quality checklists when useful
```

Existing contract/model owner remains authoritative for an existing feature; new
change documents link to it and update it within approved scope. `api-docs/` is the
implemented frontend/mobile handoff, synchronized with Swagger/socket descriptions.
`Study/` teaches in Vietnamese using English technical terms and real code pointers;
feature `study.md` links there rather than maintaining duplicate lessons. Internal
changes with no API say N/A and why. Root PROGRESS summarizes the work; feature
progress owns approvals. Native run checkpoints are operational state, not a second
product approval register.

## Tool environment và chọn owner

Run from Backend root. Project-local venv avoids changing system Python/Node deps.
After cloning, install the exact reviewed official version if the venv is missing:

```sh
python3 -m venv .specify/.venv
.specify/.venv/bin/python -m pip install 'specify-cli @ git+https://github.com/github/spec-kit.git@v1.4.0'
scripts/specify version
```

These install tool dependencies and require public network access; they do not
install application packages. Initial official init was previewed in a temporary
directory before `--here --force`; it had zero existing-file collisions. Do not
blindly repeat force init/update over local customizations or dirty work. Pin/version
review and preview again for an upgrade. No Git extension/auto-commit is installed.

Native Bash helpers need PyYAML to compose presets. Supply the supported override
on **each helper call** in an agent tool environment (exports may not persist between
tool calls). The launcher sets this automatically for CLI subprocesses:

```sh
SPECKIT_PYTHON_EXECUTABLE="$PWD/.specify/.venv/bin/python" \
SPECIFY_FEATURE_DIRECTORY=specs/features/chat SPECIFY_FEATURE_NO_PERSIST=1 \
bash .specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

Check the resulting FEATURE_DIR before writes. `SPECIFY_FEATURE_DIRECTORY` chooses
the folder; `SPECIFY_FEATURE` is just a label, not folder selection. Native helpers
can accept paths outside the repo, so agent policy must enforce the authorized
Backend boundary. `SPECIFY_FEATURE_NO_PERSIST=1` avoids updating the machine-local
`.specify/feature.json` during read-only checks. Use explicit selection for concurrent
tasks. The pointer, workflow run logs, venv and regenerable `.composed/` intermediates
are ignored; native preset refresh recreates the latter. Do not put secrets in
workflow input, interview, shell output or committed records.

Refresh reviewed project customizations with official CLI:

```sh
scripts/specify preset update backend-policy --dev codex/spec-kit/backend-policy --priority 10
scripts/specify workflow overlay add codex/spec-kit/backend-sdd.yml --priority 10
scripts/specify artifact info spec-template --json
scripts/specify workflow resolve speckit
```

Never hand-edit the generated skills/composed files to change policy. Native
manifests track layers; CLI regeneration keeps the native command body. For
upgrades compare core template/command changes and revalidate all local additions.

## Workflow engine tùy chọn

Interactive chat above is the default for interviews; it lets the user answer
multiple rounds. Native workflow composition is also installed and validated:

```sh
scripts/specify workflow resolve speckit
scripts/specify workflow run speckit --input 'spec=Your actual feature description' --input integration=codex
scripts/specify workflow status
scripts/specify workflow status RUN_ID --json
scripts/specify workflow resume RUN_ID
```

`run` dispatches real `codex exec` calls through the configured integration; it is
**not a dry-run command**. Use only for real authorized work with an interactive
human reviewer. A noninteractive clarify subprocess cannot finish an interview
by itself; continue questions in chat, update the actual records and return to
the requirements gate. The gate is never evidence that unanswered questions were
resolved. Without TTY a gate pauses; resume from a human terminal to choose. This
installed base workflow/overlay does not declare noninteractive verdict inputs:
do not invent `--approve` or pass undocumented approval input names. Agents must
not simulate keypresses or answer a gate for the user.

Order: specify → clarify → requirements gate/record → plan → tasks → analyze →
review packet → implementation gate/record → implement → verify → document →
converge → outcome. Reject aborts the native run. Fix only authorized artifacts,
analyze/review again and continue at the proper stage in chat or start a new
reviewed run; do not blindly replay creation against an existing owner. After
converge, repeated implementation/verification is explicit follow-up, not an
automatic unconditional engine loop. No extra orchestrator service/database exists.

## Lifecycle và recovery

These names are project conceptual stages, not native CLI state names. Only feature
`progress.md` owns this stage; native runs separately report paused/aborted/completed.

| Stage / entry | Exit evidence and next stage | Failure / recovery |
|---|---|---|
| DISCOVERY — new request | Owner, scope and repo evidence → SPECIFYING | Missing access/context → BLOCKED |
| SPECIFYING — owner selected | Real draft scenarios/requirements → CLARIFYING | Record unknowns, no invented contracts |
| CLARIFYING — relevant gaps | Answered Q-IDs, no blockers → REQUIREMENTS_REVIEW | More rounds; pending answers remain here |
| REQUIREMENTS_REVIEW — spec ready | Explicit human confirmation + spec revision → PLANNING | Rejected/changed intent → CLARIFYING |
| PLANNING — requirements confirmed | Concrete plan, constitution/design checks → TASK_GENERATION | New product choice → CLARIFYING |
| TASK_GENERATION — design concrete | Verifiable native tasks, coverage → ANALYZING | Missing design → PLANNING |
| ANALYZING — spec/plan/tasks present | Consistent artifacts + review packet → AWAITING_APPROVAL | Fix critical findings, analyze again; intent change needs user |
| AWAITING_APPROVAL — exact revisions presented | Actual scoped human approval + matching hashes → IMPLEMENTING | Silence stays here; changed plan returns to review |
| IMPLEMENTING — current approval verified | Approved tasks implemented → VERIFYING | Engineering gap stays here; material change reopens review |
| VERIFYING — implementation exists | Actual criteria/check evidence → DOCUMENTING | FAIL → fix within scope; critical external blocker → BLOCKED |
| DOCUMENTING — evidence known | Owner specs, API handoff, Study or justified N/A → CONVERGING | Missing docs stay here; no fictional endpoints/results |
| CONVERGING — code/evidence/docs available | Native append-only assessment, no critical gaps → COMPLETED | Approved gaps → IMPLEMENTING/VERIFYING; new scope → CLARIFYING |
| COMPLETED — accepted criteria + required docs/checks done | Final outcome, evidence and explicit rollout limits | Later bug uses same owner; no retroactive evidence rewrite |
| BLOCKED — concrete external/decision dependency | Record cause, owner, resume condition, previous stage | Resume that stage when resolved; no fake completion |

Normal task checkbox updates do not invalidate approval. Material changes to
requirements, design, permissions/contracts, provider cost or new task scope do.
Recompute real SHA-256 (`shasum -a 256 <actual-file>`) at review; retain previous
decision as history and record supersession, not a forged replacement. Logical
orchestrator/analyst/architect/developer/QA/documentation roles run sequentially in
one session unless actual delegation is authorized. Both native gates and direct
skill guards remain workflow controls, not an unbypassable security mechanism.

## Validation và giới hạn

See [setup evidence](../../specs/system/spec-kit-setup.md). Official init, integration,
preset composition, new/legacy selection, temporary scaffold and native gate
pause/reject/approve-only continuation were exercised without a model or app call.
Codex's local app-server `skills/list` also discovered all nine installed skills
with zero project skill errors, without a model/thread/turn call. The IDE picker
and an end-to-end model-driven feature run were not observed. Open/reload a Codex session
from Backend if the new skills are not shown; do not claim UI discovery from file
existence alone. No API docs are needed for this tooling-only setup. Existing
[workflow Study](../../Study/SPEC_DRIVEN_WORKFLOW.md) explains the useful distinctions.
