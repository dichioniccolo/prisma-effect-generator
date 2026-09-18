# Effect inside the generator

## Status

<!-- Keep in sync with ops/manifest.json on every stage/status change. -->
Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The code this library generates is idiomatic Effect. The generator that
writes it is not: it reads options by hand, throws, and writes files with
Promises. Make the inside match what the library preaches, without changing
a byte of its output.

## Next Open Question

None. Graduated into [`goals/effect-internals`](../../goals/effect-internals/).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4).

## Trail

- 2026-09-18: graduated into one goal packet, `effect-internals`.
- 2026-09-18: shaped and decomposed; the user confirmed scope after the
  recon report.
- 2026-09-18: packet opened from a written PR plan (captured in CAPTURE.md);
  recon of `src/index.ts`, the test suites and the Prisma generator protocol.
