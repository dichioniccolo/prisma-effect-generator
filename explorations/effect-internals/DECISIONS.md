# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-09-18 — node-runtime-dependency

**Question:** The generator needs a Node implementation of `FileSystem` and
`Path` at runtime. Where does it come from?

**Answer:** Move `@effect/platform-node` (same version, already a
devDependency) to `dependencies`.

**Rationale:** Official and nothing to maintain. The alternative, a hand
written layer over `node:fs/promises`, saves a dependency by copying part of
Effect. Recommended option, accepted.

## 2026-09-18 — validation-strictness

**Question:** How strict should validation be about values that were
accepted silently until now?

**Answer:** Reject only what already produced broken code or ignored the
user: empty `clientImportPath`, an extension with a dot or punctuation, a
malformed `errorImportPath`, any `enableTelemetry` other than
`"true"`/`"false"`. Keep `"mjs"`, `"cjs"` and an empty `errorImportPath`.

**Rationale:** A strict whitelist from the README (`js`, `ts`, `""`) would
break working configs. Recommended option, accepted.

## 2026-09-18 — logging-channel

**Question:** The generator prints nothing of its own today. Where do logs
go?

**Answer:** Plain logfmt on stderr, never JSON. Prisma shows it only with
`DEBUG=prisma:GeneratorProcess`.

**Rationale:** No new output in a normal `prisma generate`, no new env var.
An info line on stdout would change what users see. Recommended option,
accepted.

## 2026-09-18 — delivery-shape

**Question:** One PR, or an options-only PR first?

**Answer:** One PR on `refactor/effect-internals`, atomic commits, each green.

**Rationale:** The estimated diff (+600/-200, half tests) reads in ten
minutes. Recommended option, accepted.

## 2026-09-18 — write-concurrency

**Question:** The plan asks for bounded, configurable write concurrency.

**Answer:** Dropped. Writes stay sequential and the PR says why.

**Rationale:** The generator writes one file.
