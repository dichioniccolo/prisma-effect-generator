# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-09-18

Written PR plan, eleven files, summarized here:

- One readable PR that brings Effect *inside* the generator. Today Effect is
  only in the generated code. Behaviour must not change. The PR may stay open;
  merging is a later call.
- The PR doubles as a technical showcase. What counts: quality, presentation,
  motivation, technical choices, "surprise us". Size does not count; a small
  flawless PR beats a rewrite.
- Goals: options decoded and validated with `Schema` and readable errors; I/O
  behind `Layer` so the generator is testable without a disk; typed errors
  instead of `throw` for expected cases; orchestration with `Effect`,
  including bounded-concurrency file writes; output identical to before.
- The only acceptable behaviour change: better messages for invalid config,
  declared in the PR. Bugs found on the way go to a follow-up list, not into
  this PR.
- Non-goals: new features, changes to the generated code, build system or
  package manager changes, unneeded dependency bumps, rewriting the
  templating in Effect, mass reformatting.
- Effect at the edges, pure core. DMMF in, source strings out: that part
  stays pure. Naming helpers, path math and templates stay plain functions.
- Options to cover: `output`, `clientImportPath`, `errorImportPath`
  (`path#Export`, decoded into a structure, never re-parsed), and
  `importFileExtension`. Snapshot the error *message*, not only the failure.
- FileSystem/Path from Effect instead of `node:fs`/`node:path`; the real
  layer only at the entry point; an in-memory file system in tests, hand
  written if the platform has none.
- Errors: `InvalidGeneratorOption`, `FileWriteError`,
  `DirectoryCreateError`, maybe `UnsupportedModelFeature`. Defects stay
  defects. One formatting point at the boundary.
- Logging with Effect and annotations. Check the logs cannot land on the
  channel Prisma uses for JSON-RPC.
- Prove invariance: baseline the output before touching anything, show an
  empty diff after. New tests: options, generation without disk, I/O errors,
  a snapshot of a reference schema.
- Suggested commits: baseline, errors and boundary, options, FileSystem,
  logging, new tests, docs. Changeset as a patch. Do not touch `dist/`.
- Phase 0 ends with a recon report and waits for user confirmation.
