# prisma-generator-effect

A Prisma generator that emits an Effect-based client: a `Prisma` service,
layers, typed errors and transactions that carry the transactional client
through `Context`. The generator itself also runs on Effect.

Node (see `.nvmrc`) and pnpm. Effect v4 (`effect`, `@effect/platform-node`,
`@effect/vitest`), pinned to the same RC version.

## Commands

- Build: `pnpm build` (writes `dist/`; never commit build output).
- Type check: `pnpm check` (sources, then unit tests and scripts).
- Unit tests: `pnpm test:unit`; target files with `pnpm test:unit <path>`.
- Full suite: `pnpm test`. Runs the unit tests, then each project under
  `tests/*/` through `prisma generate`, a strict `tsc` of the generated code
  and its own vitest run. Pick suites with `pnpm test --suite <name>`.
- Release notes: add a changeset (`pnpm changeset`). The repo is in
  Changesets pre-release mode (`rc`).

## Layout

- `src/index.ts`: the `generatorHandler`, option parsing, file I/O and
  Biome.
- `src/templates.ts`: the pure templating. Strings in, strings out; keep it
  free of Effect.
- `tests/unit/`: unit tests, with file snapshots of the rendered service.
- `tests/<suite>/`: integration projects, each with its own lockfile.

## Invariants

- The generated code is the product. Any change to it must show up in
  `tests/unit/__snapshots__/` and be deliberate. Never update snapshots just
  to make a test pass.
- Prisma speaks JSON-RPC over the generator's stderr and parses every line
  written there. Never write JSON lines to stderr.

## Effect Agent Setup

Agent rules, skills, and docs for Effect v4, using
plain `effect/Schema` and `Context.Service` (no helper packages).

- Effect-first code laws: `.claude/skills/effect-first-development/SKILL.md`
  (full standard: `standards/effect-first-development.md`, `standards/effect-laws-v1.md`).
- Schema work: `.claude/skills/schema-first-development/SKILL.md`
  (session template: `standards/schema-first-development-prompt.md`).
- Patterns: `.patterns/` (error handling, testing, module organization, JSDoc, library dev).
- Agents in `.claude/agents/`: effect-first-developer, schema-first-developer,
  code-patterns-strategist, crispener, jsdoc-annotation-specialist,
  modularization-analyst, architecture-guardian.
- Idea → work pipeline: `/explore` skill with `explorations/` packets that
  graduate into `goals/` packets; `/reflect` writes goal closeout reflections.

### Code Laws

- Use schema-first domain models; prefer typed errors and tagged unions.
- Prefer effect helper modules (`String`, `Equal`, ...) over native helpers;
  keep root `effect` imports for core combinators.
- Prefer match helpers over conditional chains; prefer service composition
  over global state; keep service boundaries explicit.
- Prefer the tersest equivalent helper form when behavior is unchanged.
- Before recreating a helper, schema, or service, search existing source first.

### Touch → Skill

| Touch | Load |
| --- | --- |
| Domain models / schemas | schema-first-development skill |
| Effect service / Layer | effect-first-development skill |
| Shrinking helper walls into schemas | crispen skill |
| JSDoc on exports | `.patterns/jsdoc-documentation.md`, jsdoc-annotation-specialist skill |
| Fuzzy idea / new initiative | explore skill |
| Stress-testing a plan | grilling skill (`grill-me`) |
| Closing an initiative | quality-review-fix-loop skill, then reflect |
| Human-facing prose (docs, PRs, commits) | unslop skill |
| A bug or regression | diagnosing-bugs skill |

### Effect reference source

Validate Effect v4 APIs against real source, not training-data priors. Run
`bash scripts/setup-effect-ref.sh` once to link `.repos/effect` (gitignored).
The checkout tracks Effect's main branch; when it disagrees with the pinned
version, the types in `node_modules/effect` win.

### Verification

- Type check: `pnpm check`.
- Tests: `pnpm test:unit` while iterating, `pnpm test` before handing work
  back.
