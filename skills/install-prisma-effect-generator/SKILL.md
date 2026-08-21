---
name: install-prisma-effect-generator
description: Install and configure prisma-generator-effect in a project so Prisma Client operations return Effects instead of Promises. Use when adding the generator to a repo, wiring the generated Prisma layer into an Effect app, switching an existing Prisma codebase to Effect, or fixing generator config errors (wrong clientImportPath, missing extensions, errorImportPath format).
---

# Installing prisma-generator-effect

`prisma-generator-effect` is a Prisma generator. It reads the same DMMF as
`prisma-client` and emits a single `index.ts` exposing a `Prisma` Effect service
whose methods return `Effect<Success, PrismaError, Requirements>` instead of
Promises.

It generates code only. It does not run at runtime, so it belongs in
`devDependencies`. The generated file imports from the Prisma Client output and
from `effect`, so both must be runtime dependencies of the consuming project.

## When to use

- Adding the generator to a project for the first time.
- Wiring `Prisma.Live` / `Prisma.layer` into an Effect application.
- Diagnosing generation or typecheck failures caused by generator config.

## Prerequisites

Confirm before touching anything:

1. Prisma 7 or later, using the `prisma-client` generator provider. The legacy
   `prisma-client-js` provider emits a different client shape and is not
   supported.
2. `effect` v4 (`4.0.0-rc.111` or later) in `dependencies`. The generated code
   uses `Context.Service`, which does not exist in Effect v3.
3. TypeScript with `strict: true`. The generated types assume it.

Check with:

```bash
cat package.json
ls prisma/ 2>/dev/null || find . -name "schema.prisma" -not -path "*/node_modules/*"
```

## Steps

### 1. Install

Use the project's existing package manager (check for `pnpm-lock.yaml`,
`yarn.lock`, `package-lock.json`, `bun.lockb`).

```bash
pnpm add -D prisma-generator-effect
pnpm add effect @prisma/client
```

### 2. Add the generator block

Edit `schema.prisma`. Keep the existing `client` generator; add `effect` after
it:

```prisma
generator client {
  provider = "prisma-client"
  output   = "./generated/client"
}

generator effect {
  provider         = "prisma-generator-effect"
  output           = "./generated/effect"
  clientImportPath = "../client/client"
}
```

`clientImportPath` is resolved **relative to the effect `output` directory**, not
to the schema. It must point at the module that exports `PrismaClient` — with
the `prisma-client` provider that is `client.ts` inside the client output
directory, not the directory itself. `"../client"` only works if that directory
has an index module.

### 3. Set `importFileExtension` for ESM

If the consuming project is ESM (`"type": "module"`, or `moduleResolution` is
`NodeNext`/`Node16`), relative imports need explicit extensions:

```prisma
generator effect {
  provider            = "prisma-generator-effect"
  output              = "./generated/effect"
  clientImportPath    = "../client/client.js"
  importFileExtension = "js"
}
```

`importFileExtension` makes the generator append the extension to relative
imports it emits. `clientImportPath` is written verbatim, so add the extension
there yourself.

### 4. Generate

```bash
pnpm exec prisma generate
```

Then typecheck the generated file — it is the fastest way to catch a wrong
`clientImportPath`:

```bash
pnpm exec tsc --noEmit
```

### 5. Wire the layer

```typescript
import { Effect } from "effect";
import { Prisma } from "./prisma/generated/effect";

const program = Effect.gen(function* () {
  const prisma = yield* Prisma;
  return yield* prisma.user.findMany({ where: { active: true } });
});

Effect.runPromise(program.pipe(Effect.provide(Prisma.Live)));
```

Layer constructors, in order of preference:

| Constructor | Use when |
|---|---|
| `Prisma.Live` | No client options needed |
| `Prisma.layer(opts)` | Static `PrismaClient` options (`datasourceUrl`, `log`, …) |
| `Prisma.layerEffect(effect)` | Options come from an Effect — config service, driver adapter, connection pool |

Provide the layer **once** at the application entry point. It is scoped and calls
`$disconnect` when the scope closes; constructing it per request opens a new
connection pool each time.

### 6. Optional: path alias

If the project uses path aliases, add one so generated imports stay short:

```json
{
  "compilerOptions": {
    "paths": { "@prisma/*": ["./prisma/generated/*"] }
  }
}
```

Then `import { Prisma } from "@prisma/effect"`.

## Configuration reference

| Option | Relative to | Default | Notes |
|---|---|---|---|
| `output` | `schema.prisma` | `../generated/effect` | Directory; the generator writes `index.ts` into it |
| `clientImportPath` | `output` | `@prisma/client` | Must resolve to the module exporting `PrismaClient` |
| `errorImportPath` | `schema.prisma` | – | Format `path/to/module#ErrorClassName`; rewritten to be output-relative by the generator |
| `importFileExtension` | – | `""` | `js`, `ts`, or empty. Applied to relative imports only |
| `enableTelemetry` | – | `false` | `"true"` wraps operations in `Effect.fn` so spans carry operation names; otherwise `Effect.fnUntraced` |

## Custom error type

By default every operation fails with a tagged error from the `PrismaError`
union (`PrismaUniqueConstraintError`, `PrismaRecordNotFoundError`, …). To collapse
them into one project error type, point `errorImportPath` at a module exporting
both the class and a `mapPrismaError` function:

```prisma
errorImportPath = "./errors#MyPrismaError"
```

```typescript
// errors.ts — sits next to schema.prisma
import { Data } from "effect";

export class MyPrismaError extends Data.TaggedError("MyPrismaError")<{
  cause: unknown;
  operation: string;
  model: string;
}> {}

export const mapPrismaError = (
  cause: unknown,
  operation: string,
  model: string,
): MyPrismaError => new MyPrismaError({ cause, operation, model });
```

Both exports are required; a missing `mapPrismaError` fails at typecheck, not at
generation. The `#ClassName` suffix is mandatory — the generator throws on a
path without it.

## Verification

The install is done when all three pass:

```bash
pnpm exec prisma generate    # emits generated/effect/index.ts
pnpm exec tsc --noEmit       # generated file typechecks against the client
```

and a query runs end to end against the real database.

Do not hand-edit the generated file. It is overwritten on every
`prisma generate`; commit it or gitignore it, but change it only through
generator options or the schema.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '../client'` in generated file | `clientImportPath` points at a directory with no index module | Point it at `../client/client` |
| `Relative import paths need explicit file extensions` | ESM project without `importFileExtension` | Set `importFileExtension = "js"` and add `.js` to `clientImportPath` |
| `Invalid errorImportPath format` thrown during generate | Missing `#ClassName` | Use `./errors#MyPrismaError` |
| `Property 'createManyAndReturn' does not exist` | Datasource provider does not support it | Expected — the generator omits `createManyAndReturn` / `updateManyAndReturn` for providers other than PostgreSQL, CockroachDB, and SQLite |
| `Context.Service is not a function` | Effect v3 installed | Upgrade to `effect` v4 |
| Reads hit the primary despite replicas | `PrismaReplicas` layer not provided, or the call is inside `$transaction` | Merge `PrismaReplicas.layer([...])` into the app layer; transactions always use the primary |

Full API — transactions, nested transaction semantics, read replicas,
`$primary()` / `$replica()` — is documented in the package README.
