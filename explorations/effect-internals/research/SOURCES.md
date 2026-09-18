# Effect inside the generator — Sources & Provenance

- **Cluster / origin:** a written PR plan (eleven files, Italian) and a recon
  of this repository and its installed dependencies on 2026-09-18.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md),
  [`../DECISIONS.md`](../DECISIONS.md).

## 3. External research sources

No URLs. The claims about Prisma and Effect come from the installed packages,
recorded in `RESEARCH.md` § External Landscape:

- `node_modules/@prisma/generator-helper/dist` (7.9.1): JSON-RPC over stdin
  and stderr, error propagation.
- `node_modules/effect/dist` (4.0.0-rc.111): `Schema`, `FileSystem`, `Path`,
  `Logger`, `Match`, `unstable/process`.
- `node_modules/@effect/platform-node` and `platform-node-shared`: Node
  layers, child process spawner options.

## 4. In-repo capability references

| Path | Role | Disposition |
| --- | --- | --- |
| `src/index.ts` | handler, options, I/O and templates in one file | split |
| templating part of `src/index.ts` | pure render | reuse unchanged |
| `scripts/runTests.ts` | integration runner | extend (unit tests first) |
| `tests/*/` | integration suites | reuse unchanged |
| `src/options.ts`, `src/errors.ts`, services, `tests/unit/` | | NET-NEW |

## 5. Cross-links & provenance

- Goal: [`goals/effect-internals`](../../../goals/effect-internals/).
- Decisions: [`../DECISIONS.md`](../DECISIONS.md).
