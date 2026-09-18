# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The generator is imperative code that emits Effect code. Bad options fail
late or not at all, nothing is testable without a disk and Prisma, and the
only errors are `throw new Error`. It is also the library's best showcase,
and today it contradicts the library.

## Appetite

One PR, readable in ten minutes. Most of the diff should be tests. If it
grows past that, split the options work out first.

## Solution Sketch

```text
stdin (JSON-RPC) -> src/index.ts: run one Effect, provide Node layers,
                                  format expected failures
                 -> options.ts:   Schema decode of the generator block
                 -> templates.ts: pure render (moved, untouched)
                 -> OutputWriter / CodeFormatter services -> disk, Biome
                 -> logfmt on stderr
```

Proof of invariance: capture the output of the real `prisma generate` for
every suite and a few extra configs, raw and formatted, before any change;
compare hashes after every commit. Pin the pure render with file snapshots
that must equal the pre-refactor raw output.

## Rabbit Holes

- Biome's unpinned version: compare raw output, not only formatted.
- Logs on the wrong stream would corrupt the JSON-RPC channel.
- Moving 2000 lines of templates shows up as a new file on GitHub; point
  reviewers at `git show -B -M`.
- `effect` is ESM-only and `dist/` is CommonJS.

## No-Gos

- Changes to the generated code.
- Templating rewritten in Effect.
- New options or features; fixing bugs found on the way.
- Transactional output directories, write concurrency.
