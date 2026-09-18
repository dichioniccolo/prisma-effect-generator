# Effect inside the generator Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Recon | complete | Map the code, run the baseline suite, report, confirm scope. | Report accepted; decisions logged in the exploration. |
| P1 Baseline | complete | Capture output hashes; split the pure render out; snapshot it. | Snapshots equal the pre-refactor raw output. |
| P2 Options | complete | `Schema` for the generator block, typed errors, one boundary. | Option tests with message snapshots green. |
| P3 Services | complete | Output and formatter services over `FileSystem`/`Path`; Node layers only at the edge. | In-memory generation tests green; no `node:*` in logic. |
| P4 Logging | complete | Structured logs on stderr. | Verified with `DEBUG=prisma:GeneratorProcess`. |
| P5 Verify | complete | Full suite, invariance, docs, changeset. | All checks green, 20/20 identical. |
| P6 PR to mergeable | complete | Open the PR and drive it to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P7 Close | complete | Closeout reflection, packet state. | Reflection exists; manifest and README updated. |

## P7 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. This packet has `reflectionRequired: true`: a missing or incomplete
   reflection blocks closeout.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- One commit per phase, each green and invariant.
- Scope added during execution, each at the user's request and each in its
  own commit: `dist/` untracked; Effect 4.0.0-rc.115 (which pulled vitest 5
  and the renamed `effect/unstable/cli` `Flag` constructors in
  `scripts/runTests.ts`); a crispen pass that moved the remaining hand-written
  invariants into the schemas. The agent setup and this packet were moved to
  the start of the branch afterwards.
- Direction set mid-way by the user and folded into SPEC: `Schema.TaggedError`
  over `Data.TaggedError`, and `Context.Service` for every dependency
  (`OutputWriter`, `CodeFormatter`).
- Never commit `dist/`.
- Keep `SPEC.md` normative and update it only when the contract changes.

## Verification Commands

```sh
pnpm build && pnpm test
test "$(wc -m < goals/effect-internals/GOAL.md)" -le 4000
jq . goals/effect-internals/ops/manifest.json
rg -n "effect-internals|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-internals
git diff --check -- goals/effect-internals
```
