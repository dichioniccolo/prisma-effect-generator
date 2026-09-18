# GOAL: run the generator on Effect without changing its output

Repo root: the current working directory — the checkout you are running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the generator decodes its options with `Schema`, fails with typed
errors, reaches the disk and Biome only through services provided at the
entry point, and emits byte-identical code; all of it shipped as one PR
driven to mergeable.

This is a compact goal launcher. Treat the packet files as the detailed
contract:

- `goals/effect-internals/README.md`
- `goals/effect-internals/SPEC.md`
- `goals/effect-internals/PLAN.md`
- `goals/effect-internals/ops/manifest.json`

Read those first, then read `CLAUDE.md` and the effect-first and
schema-first skills. Higher-priority repo standards outrank packet prose when
they conflict.

Scope:

- In: `src/`, `tests/unit/`, `scripts/runTests.ts`, root `package.json`
  scripts and dev dependencies, `README.md` options table, `.changeset/`.
- Out: the generated code, the templating logic, `tests/*/` suites and their
  assertions, `dist/`, new generator options or features.

Workflow:

1. Capture the output baseline before touching `src/` (SPEC, Invariance).
2. Make the smallest change that satisfies `SPEC.md`, one green commit per
   PLAN phase.
3. Compare against the baseline after every commit.
4. Preserve unrelated user/worktree changes.
5. Keep decisions tied to evidence from files, tests, docs, or command output.
6. At P7 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
pnpm build && pnpm test
test "$(wc -m < goals/effect-internals/GOAL.md)" -le 4000
jq . goals/effect-internals/ops/manifest.json
git diff --check -- goals/effect-internals
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
