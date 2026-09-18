# Effect inside the generator Spec

## Objective

`prisma generate` with this generator produces exactly the bytes it produced
before, while the generator itself:

- decodes the `generator` block with one `Schema` and reports every invalid
  option at once, naming the option, the value and what was expected;
- fails with typed errors, formatted into a message at a single boundary;
- touches the disk and runs Biome only through services, so a test can run a
  whole generation over an in-memory file system;
- logs through Effect without disturbing Prisma's JSON-RPC channel.

## Non-Goals

- Any change to the generated code.
- Rewriting the templating in Effect. It stays a pure function.
- New options or features; fixing bugs found on the way (list them as
  follow-ups in the PR instead).
- Write concurrency (one file is generated) and a transactional output
  directory.
- Build system, package manager or unrelated dependency changes; committing
  `dist/`.

## Source Hierarchy

1. User objective: the written PR plan captured in
   `explorations/effect-internals/CAPTURE.md`.
2. `CLAUDE.md` and required skills.
3. Governing standards (`standards/`, `.patterns/`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `src/index.ts` becomes the edge; templating moves to `src/templates.ts`.
- New: `src/options.ts`, `src/errors.ts`, the output and formatter services,
  `src/generate.ts`.
- New: `tests/unit/`, root vitest config; `scripts/runTests.ts` runs unit
  tests first.
- `package.json`: `@effect/platform-node` to `dependencies`; root dev
  dependencies for vitest.
- `README.md` options table; a patch changeset.

## Constraints

- Invariance. Before any change, capture the output of the real
  `prisma generate` for the five suites and extra configs (telemetry, package
  error module, `ts`/`mjs` extensions, list values), raw (Biome disabled) and
  formatted. Every commit must reproduce all of them byte for byte.
- Validation rejects only values that produced broken code or were ignored;
  defaults stay identical (see exploration DECISIONS).
- `errorImportPath` is decoded once into a structure and never re-parsed.
- Expected failures use `Schema.TaggedError`; defects are not caught.
- Dependencies are `Context.Service`s provided with `Layer`s; only
  `src/index.ts` provides Node layers; nothing else imports `node:*`.
- Logs: plain logfmt on stderr, never JSON, nothing new on stdout.
- Effect APIs verified against the installed types.

## Acceptance Criteria

- [ ] Output byte-identical to the baseline after every commit.
- [ ] Existing suites green with their tests unchanged.
- [ ] No `throw` for expected errors on the main path.
- [ ] Options validated with `Schema`, defaults unchanged, error messages
      snapshotted.
- [ ] No direct `node:fs`/`node:path` import in the logic.
- [ ] Generation testable without touching the disk, including a failed
      write that reports its path.
- [ ] The pure render pinned by file snapshots equal to the pre-refactor raw
      output.
- [ ] Logs verified not to interfere with `prisma generate`.
- [ ] Patch changeset; PR description with proof of invariance, one
      before/after and follow-ups.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Types | `pnpm build` | Passes |
| Unit + integration | `pnpm test` | Passes |
| Invariance | baseline hash comparison, 20 files | No differences |
| Logs | `DEBUG=prisma:GeneratorProcess prisma generate` | logfmt lines only on the debug stream |
| Packet launcher size | `test "$(wc -m < goals/effect-internals/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-internals/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-internals` | Passes |

## Stop Conditions

- The output differs from the baseline and the cause is not understood.
- A step needs a change to the generated code.
- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Rejecting previously accepted invalid values | `src/options.ts` | author | the only behaviour change the plan allows; declared in the PR | none |
