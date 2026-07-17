# RemoteCliControl Agent Rules

This file is the first-stop instruction set for any agent working in this repository.

## Mandatory Read Order

Before planning, editing, auditing, or reporting completion, every agent must read:

1. [README.md](./README.md)
2. [CONTRIBUTING.md](./CONTRIBUTING.md)
3. [docs/README.md](./docs/README.md)
4. [docs/governance/REPO_RULES.md](./docs/governance/REPO_RULES.md)
5. [docs/governance/DEFERRED_WORK.md](./docs/governance/DEFERRED_WORK.md)
6. the latest implementation sync note in `docs/`

If the task is an audit, also read:

1. prior audit files referenced from [docs/README.md](./docs/README.md)
2. the most recent implementation sync note
3. the relevant code paths before writing conclusions

## Repo Rules

The authoritative repo rules live in [docs/governance/REPO_RULES.md](./docs/governance/REPO_RULES.md).

Agents must follow them strictly. In particular:

- keep docs findable and current while work is in progress
- do not claim completion without verification
- do not silently skip requested steps
- record deferred work in the deferred-work register
- do not delete files without direct approval from Shayan
- keep the repo stable, review existing failures, and report what was pre-existing

## Audit Storage

Private audit working files belong in `audits/` and should follow the naming rule from the repo rules document.

Do not publish private audit notes accidentally. Use the ignore rules already configured for that folder.

## Completion Standard

An agent must not mark work complete until all of the following are true:

- code or docs changes are actually applied
- affected docs are updated in the same pass
- verification was run or a concrete blocker was reported
- deferred items, if any, were written into [docs/governance/DEFERRED_WORK.md](./docs/governance/DEFERRED_WORK.md)
- the final report distinguishes completed work, deferred work, and pre-existing issues
