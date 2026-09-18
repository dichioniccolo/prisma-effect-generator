# Effect inside the generator — Sources & Provenance

- **Source exploration:** `explorations/effect-internals` — primary ledger:
  `explorations/effect-internals/research/SOURCES.md`.
- **Provenance:** the exploration's `RESEARCH.md` and `DECISIONS.md`.

## 3. External research sources

No URLs. Prisma generator protocol and Effect v4 APIs were read from the
installed packages; see `explorations/effect-internals/RESEARCH.md`
§ External Landscape.

## 4. In-repo capability references

| Path | Role | Disposition |
| --- | --- | --- |
| `src/index.ts` | handler, options, I/O, templates | split |
| templating part of `src/index.ts` | pure render | reuse unchanged |
| `scripts/runTests.ts` | integration runner | extend |
| `tests/*/` | integration suites | reuse unchanged |
| options, errors, services, `tests/unit/` | | NET-NEW |

## 5. Cross-links & provenance

- Exploration: [`explorations/effect-internals`](../../../explorations/effect-internals/).
- Decisions: `explorations/effect-internals/DECISIONS.md`.
