# Effect inside the generator

## Status

Lifecycle: `active`

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

P1 Baseline: capture the output hashes, then move the templating into a pure
module and snapshot it.

## Latest Evidence

P0 recon on 2026-09-18: `pnpm test` green on `main` (5 suites, 145 tests).
See `explorations/effect-internals/RESEARCH.md`.

## Notes

- Biome is unpinned; compare raw output as well as formatted.
- Only one file is generated.
