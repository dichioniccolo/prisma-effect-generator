# Effect inside the generator

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run the generator itself on Effect (Schema options, typed errors, services,
logs) while it keeps emitting byte-identical code, and ship it as one PR.

## Launch

Use this prompt for execution-capable sessions:

```text
follow the instructions in goals/effect-internals/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact goal launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research.
6. [`history/`](./history/) - evidence and closeouts.

## Current Phase

Closed. Every phase is complete; the PR stays open until the author decides
to merge.

## Latest Evidence

- PR from `refactor/effect-internals` into `main`: `mergeStateStatus`
  `CLEAN`, CI `test` green, no review threads.
- Invariance: 20 captured outputs (5 suites and 5 extra configs, raw and
  formatted) byte-identical after every commit.
- Tests: 17 unit tests and 145 integration tests green on Effect rc.115.
- Closeout reflection:
  [`history/reflections/2026-09-18-claude.md`](./history/reflections/2026-09-18-claude.md).

## Notes

- Biome is unpinned; compare raw output as well as formatted.
- Only one file is generated.
