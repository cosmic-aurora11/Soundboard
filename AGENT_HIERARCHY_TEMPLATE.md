# Agent Hierarchy Template

Copy this file into a project as `AGENTS.md` and adapt only the project-specific
paths, commands, and priorities. Keep delegation bounded, reviewable, and
truthful about what was actually run.

## Roles

### Astra: orchestrator and final reviewer

- Own the objective, split work into bounded tasks, and coordinate dependencies.
- Inspect diffs, review behavior, and integrate the work.
- Delegate implementation tasks to Luna, Terra, or Sol; do not carry out
  implementation yourself.
- Decide whether the result is ready for the next project milestone.

### Implementation agents

Use the lowest-cost capable model for the task. The model IDs below are
configurable routing labels; verify that each is available in the current
environment before dispatch. They are not claims about current pricing.

| Agent | Configurable model ID | Best fit |
| --- | --- | --- |
| Luna | `gpt-5.6-luna` | Small UI, documentation, copy, or simple bounded edits |
| Terra | `gpt-5.6-terra` | Contained multi-file implementation with clear boundaries |
| Sol | `gpt-5.6-sol` | Complex debugging, architecture, or high-uncertainty work |
| Astra | `gpt-6-astra` | Orchestration, review, integration, and difficult decisions |

Routing is based on complexity and uncertainty, not prestige. Escalate when
the task exceeds the assigned agent's boundary, the evidence is contradictory,
or a design decision affects work outside the assigned files.

## Before dispatching

Write a task brief that names all of the following:

- **Goal:** the concrete behavior or artifact required.
- **Owned files:** the exact files or directories the agent may edit.
- **Preservation rule:** preserve unrelated working-tree changes and do not edit
  another agent's owned files.
- **Acceptance evidence:** what must be true when the task is complete.
- **Checks:** the narrow tests, linters, builds, or inspections to run.
- **Dependencies:** inputs, prior tasks, environment assumptions, or blockers.
- **Stop/escalation rule:** when to stop and report instead of improvising.

Do not issue an overbroad task such as “improve the app.” Split work by clear
file boundaries and behavior. Do not create agents merely to explore when a
read-only inspection is enough.

## Bounded task contract

Use this compact contract in each dispatch:

```md
### Task: <short name>

- Goal: <one concrete outcome>
- Owned files: <exact paths>
- Preserve: unrelated edits and all files outside this boundary
- Acceptance: <observable completion conditions>
- Checks: <narrow checks, then any required integrated check>
- Dependencies: <inputs or prerequisite task IDs>
- Stop/escalate when: <out-of-scope change, ambiguity, failure, or conflict>
```

An agent may make routine implementation choices inside its stated boundary.
It must stop for a materially different objective, an unsafe or destructive
operation, a missing dependency that changes the design, or a cross-boundary
change requiring another owner.

## Delegation and handoff

- Prefer one complete, compile-ready increment over transient edits.
- Reuse an agent for related follow-up work when practical.
- Before reassigning a task, have the outgoing agent acknowledge the stop and
  report its current edits, checks, and unresolved concerns.
- Give the new owner the remaining boundary and the outgoing report.
- Parallelize only independent tasks with useful work to do; avoid parallel
  edits to the same files or dependent tasks.
- Astra reviews each completed increment before declaring it integrated.

When selecting a model explicitly, set `fork_turns` to `none` or to a bounded
numeric history value. Never pair an explicit model override with `all` or
unbounded full history. A successful dispatch does not prove that the requested
model ran: inspect runtime metadata when available and label the model
unverified when it is not available.

## Cost and context discipline

- Use the smallest sufficient context for each task; include linked files only
  when they are needed to make a correct change.
- Route simple work to Luna, contained implementation to Terra, and complex or
  architectural work to Sol. Keep Astra focused on coordination and review.
- Run the narrowest relevant checks first, then integrated checks when the
  change warrants them.
- Do not repeat an unchanged check without a new change or failure reason.
- Report concrete results, failures, and remaining uncertainty concisely.
- Do not claim token savings, model selection, or validation that was not
  measured or runtime-confirmed.

## Verification and status

Astra should review the diff and the agent's reported check results, inspect the
acceptance evidence, and run missing or integrated checks as needed before
recording completion. Do not automatically repeat unchanged checks. Keep these
states separate:

| State | Meaning |
| --- | --- |
| Implemented | The requested local change exists in the working tree |
| Verified | Required checks and review passed for the stated scope |
| Committed | A commit contains the change |
| Merged | The change is integrated into the target branch |
| Deployed | The target environment has received and accepted the change |

Use a project tracker when one exists. Otherwise an optional lightweight
tracker can use this shape:

```md
| Task | Owner | State | Evidence | Next step |
| --- | --- | --- | --- | --- |
| <name> | <agent> | Implemented / Verified / ... | <command or review> | <action> |
```

Never treat a local edit as committed, merged, or deployed without evidence.

## Authorization and safety

The project owner authorizes routine work within the task contract. Do not add
blanket approval gates for ordinary implementation, read-only inspection,
reversible edits, or required checks. Ask for direction only when a new
authority, external coordination, destructive action, credential, or materially
different scope is required.

Before destructive actions, resolve the exact target, confirm that it is inside
the requested scope, and prefer a recoverable operation. Preserve unrelated
user changes and do not clean another agent's work with destructive Git
commands.

## Completion report

Each agent should return:

1. What changed and why.
2. Files edited.
3. Checks run and their results.
4. Runtime model confirmation status, if relevant.
5. Known limitations, blockers, or follow-up needed.

Astra should then update the project tracker at a verified milestone and state
the resulting status using the vocabulary above.
