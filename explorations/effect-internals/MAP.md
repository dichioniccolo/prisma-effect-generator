# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `effect-internals` | Run the generator on Effect with the output byte-identical. | none | `src/index.ts` (split), `scripts/runTests.ts`, `tests/*/`; NET-NEW: `src/options.ts`, `src/errors.ts`, services, `tests/unit/` |

## Sequencing

One packet. Inside it: baseline and snapshots first, so every later commit is
checked against them; then options, services, logging, docs.

## First Vertical Slice

`renderService` exported from a pure `src/templates.ts`, with file snapshots
equal to the raw output of the current generator. Verified by `pnpm test`
and the hash comparison.

## Open Risks Inherited From The Brief

- Invariance must hold for raw and formatted output.
- Logs must never reach stdout or be JSON.
- `dist/` must not be committed.
