# Effect inside the generator Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Recon | complete | Map the code, run the baseline suite, report, confirm scope. | Report accepted; decisions logged in the exploration. |
| P1 Baseline | pending | Capture output hashes; split the pure render out; snapshot it. | Snapshots equal the pre-refactor raw output. |
| P2 Options | pending | `Schema` for the generator block, typed errors, one boundary. | Option tests with message snapshots green. |
| P3 Services | pending | Output and formatter services over `FileSystem`/`Path`; Node layers only at the edge. | In-memory generation tests green; no `node:*` in logic. |
| P4 Logging | pending | Structured logs on stderr. | Verified with `DEBUG=prisma:GeneratorProcess`. |
| P5 Verify | pending | Full suite, invariance, docs, changeset. | All checks green, 20/20 identical. |
| P6 PR to mergeable | pending | Open the PR and drive it to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P7 Close | pending | Closeout reflection, packet state. | Reflection exists; manifest and README updated. |

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
