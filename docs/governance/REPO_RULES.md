# Repo Rules

These rules apply to every human contributor and every agent working in this repository.

They exist to preserve project truth, prevent stale documentation, and keep work recoverable.

## Rule 1: Docs Must Be Findable

When an agent is told to work on the project, the important documents must be easy to locate immediately.

Required behavior:

- keep [docs/README.md](../README.md) current as the docs index
- keep top-level project docs linked from `README.md`, `CONTRIBUTING.md`, and `AGENTS.md`
- avoid creating important one-off docs with no inbound links

## Rule 2: Documents Must Be Updated During the Work

Documentation is not a cleanup step that happens later.

Required behavior:

- update affected docs in the same work pass as the code or workflow change
- if the implementation changes contract, behavior, operations, or scope, sync the docs before calling the task complete
- if a document is now stale and cannot be fully updated in the same pass, say so explicitly and record the gap in the deferred-work register

## Rule 3: Agents Must Be Truthful

No fake completions, no invented verification, and no claiming a result that was not actually checked.

Required behavior:

- distinguish clearly between `done`, `partially done`, `deferred`, `blocked`, and `untested`
- do not imply a command, test, deploy, or build succeeded if it was not run
- do not present guesses as facts

## Rule 4: No Silent Step-Skipping

If a requested step was not done, that must be reported directly.

Required behavior:

- do not quietly skip verification, docs, cleanup, deployment checks, or follow-up tasks
- if a step is omitted, state why
- if a step cannot be done safely, stop and surface the reason

## Rule 5: Audits Must Use Code, Docs, and Prior Audits

An audit is not a surface-level opinion.

Required behavior:

- base every audit on current code inspection
- compare findings with current docs
- read relevant previous audits before producing a new one
- call out where earlier findings are still true, fixed, or now outdated

## Rule 6: Every Audit Must Be Saved Using the Naming Convention

Audit artifacts must be recoverable and sortable.

Required filename format:

`DD.MM.YYYY<AgentName><Scope>Audit.md`

Example:

`17.07.2026CodexGeneralAudit.md`

Required behavior:

- include the date
- include the agent name
- include the scope
- use a concise but meaningful scope label

## Rule 7: Audit Files Must Stay Private by Default

Audit working files should be saved in the repo workspace without being exposed publicly by accident.

Required behavior:

- save private audit files under `audits/`
- keep the ignore rules for `audits/` in place
- if an audit must become public, promote it intentionally into `docs/` and mention that decision in the commit/report

## Rule 8: Do Not Assume Material Facts

If a fact affects implementation, verification, safety, or release confidence, verify it.

Required behavior:

- inspect code, docs, config, and current repo state before concluding
- ask when ambiguity remains material after inspection
- do not choose a risky interpretation silently

Note:

- this rule does not forbid reasonable implementation progress
- it forbids unsupported claims and risky guesses

## Rule 9: Commit and Push Regularly

Work should be recoverable, reviewable, and not left sitting locally for long periods.

Required behavior:

- avoid long-lived piles of uncommitted changes
- commit in coherent increments
- push after a few commits or after any meaningful milestone
- if something is intentionally left uncommitted, say what and why

## Rule 10: Monitor Applicable Delivery Logs

Agents should not ignore the actual delivery surface.

Required behavior:

- check GitHub Actions, deployment logs, or other applicable build/deploy surfaces when the task touches them
- report failures and successes truthfully
- do not declare a release or CI fix complete without checking the relevant result

Examples:

- GitHub Actions
- Railway
- Vercel
- Expo/EAS
- platform-specific CI or hosting logs

## Rule 11: Do Not Walk Past Pre-Existing Bugs

If an agent encounters a real pre-existing bug or error, it should not be silently ignored just because it predates the current task.

Required behavior:

- assess whether the issue is safe and reasonable to fix in the current pass
- if yes, fix it and report it as pre-existing
- if not, record it in the deferred-work register and mention it in the report

This rule does not require reckless scope expansion. It requires visibility and responsible handling.

## Rule 12: Deferred Work Must Be Recorded

Deferred work must survive the session.

Required behavior:

- record deferred items in [docs/governance/DEFERRED_WORK.md](./DEFERRED_WORK.md)
- include enough detail for a future agent to resume intelligently
- do not leave “we should do this later” only in chat

## Rule 13: Keep the Repo Stable and Clean

A working repo is more valuable than a large diff.

Required behavior:

- prefer incremental safe changes
- keep docs, scripts, and contracts in sync
- run relevant verification before claiming completion
- avoid introducing avoidable churn or dead files

## Rule 14: No File Deletion Without Direct Shayan Approval

File deletion is prohibited unless Shayan explicitly approves it.

Required behavior:

- do not delete files or folders without direct approval from Shayan
- ask first, even if the file looks obsolete
- if removal seems necessary, propose it and wait for approval

This rule is strict.

## Added Rule 15: Source-of-Truth Hierarchy Must Be Preserved

Conflicting documents create drift.

Required behavior:

- treat code, current architecture docs, current governance docs, and the latest sync note as higher priority than historical planning files
- when an older document becomes misleading, mark it historical or superseded instead of letting it silently compete with current truth

## Added Rule 16: Every Completion Report Must Separate Facts by Status

Reports become unreliable when completed work and future work are mixed together.

Required behavior:

- separate `completed`, `deferred`, `blocked`, and `pre-existing`
- include verification status
- include any known residual risk

## Added Rule 17: Verification Must Match the Change Surface

“Tests passed” is not enough if the change was docs-only, CI-only, mobile-only, or deployment-only.

Required behavior:

- choose verification that matches what changed
- if only docs changed, verify links, references, and consistency
- if CI or deployment behavior changed, verify the relevant external status where possible

## Added Rule 18: Protect Existing User Changes

This repo may contain user-owned local changes.

Required behavior:

- do not overwrite, revert, or clean unrelated existing changes without explicit approval
- call out unexpected conflicting changes before forcing through them
- preserve uncommitted user work unless directly told otherwise
