# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape

2026-09-18. Checked against the installed packages, not from memory.

- `@prisma/generator-helper` 7.9.1 (`node_modules/@prisma/generator-helper/dist`).
  `generatorHandler` reads JSON-RPC requests from stdin and writes responses
  to **stderr**. Prisma spawns the generator with stdio
  `["pipe", "inherit", "pipe"]` and parses every stderr line as JSON; a line
  that fails to parse goes to its debug log (`prisma:GeneratorProcess`) and,
  only if the process exits non-zero, into the error message. A thrown error
  reaches the user as `e.message`; the stack travels in `data` and is not
  printed.
- Effect `4.0.0-rc.111`. `FileSystem`, `Path` and `Schema` live in `effect`
  itself; the Node implementations are in `@effect/platform-node`
  (`NodeServices`, `NodeFileSystem`, `NodePath`). `FileSystem.makeNoop` /
  `layerNoop` exist, so a test file system can override just the methods it
  needs. `effect/unstable/process` has `ChildProcess` with `shell`,
  `stdin`/`stdout`/`stderr` options; its Node spawner defaults
  `detached: true` off Windows. `Effect.runPromise` rejects with the original
  failure or defect, not a wrapper.
- `effect` is ESM-only. `dist/` compiles to CommonJS and relies on
  `require(esm)`, which every Node version Prisma 7 supports
  (`^20.19 || ^22.12 || >=24`) enables by default.

## In-Repo Capability Inventory

- `src/index.ts` (2338 lines): handler, option parsing, path math and I/O in
  lines 1-131 and 828-902; pure string templating everywhere else. Throws at
  lines 65, 95 and 834 (the last one unreachable). Effect is not imported.
- The templates read only `model.name` from the DMMF.
- Output: a single file, `index.ts`, then `npx @biomejs/biome format --write`
  through `execSync` with inherited stdio; failures become `console.warn`.
- Tests: five integration projects under `tests/*/`, each running
  `prisma generate`, a strict `tsc` of the output and its own vitest.
  `scripts/runTests.ts` drives them. No unit tests, no output snapshot.
  `tests/read-replicas/generated/` is committed and acts as an accidental
  snapshot. `tests/acquireUseReleaseWithErrors.test.ts` is not run by
  anything.
- Baseline: `pnpm install`, `pnpm build` and `pnpm test` green; 145 tests.
- NOT FOUND: any schema, service or layer in the generator itself.

## Constraints Discovered

- Biome comes from `npx` with no pinned version: about 6s per generate, needs
  the network, and the formatted output depends on the downloaded version.
  Invariance has to be proven on the raw output as well as the formatted one.
- Only one file is generated, so bounded write concurrency buys nothing.
- Values accepted silently today: `importFileExtension = "mjs"` (works),
  `clientImportPath = ""` (emits `from ""`), `enableTelemetry = "yes"`
  (turns telemetry off), `errorImportPath = ""` (means built-in errors).
- `dist/` is tracked and already stale on `main`.
