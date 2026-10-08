# prisma-generator-effect

## 2.1.1

### Patch Changes

- [#34](https://github.com/dichioniccolo/prisma-effect-generator/pull/34) [`b2d2a76`](https://github.com/dichioniccolo/prisma-effect-generator/commit/b2d2a769569c9a97144a76b21f6408fbfcbaf0c1) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Map connection-level failures to `PrismaConnectionError` instead of defects.
  
  Driver adapters report a lost database link with codes the mappers did not
  handle: P1001 (server unreachable), P1008 (socket timeout), P1017 (connection
  closed) and P2037 (too many connections). They also report P2036 for any
  error they do not classify. Those errors were rethrown inside
  `Effect.tryPromise` and became defects, so `Effect.catchTag` and
  `Effect.retry` never saw them. Every mapper now turns them, along with P2024,
  into `PrismaConnectionError`. Since P2036 can also be an adapter bug, check
  the code before retrying on it.
  
  Two paths needed extra handling. Raw queries wrap every adapter error in
  P2010, so the mapper reads the adapter error kind from
  `meta.driverAdapterError.cause.kind` and maps only the connection kinds;
  other raw query failures are still defects. Prisma rethrows adapter errors
  from a transaction commit without wrapping them, so the mapper turns the
  connection ones into a `PrismaClientKnownRequestError` with the matching code.
  A write conflict at commit now fails with `PrismaTransactionConflictError`
  for the same reason.
  
  `PrismaClientInitializationError` and `PrismaClientUnknownRequestError` are
  still defects.

## 2.1.0

### Minor Changes

- [#32](https://github.com/dichioniccolo/prisma-effect-generator/pull/32) [`8b63eff`](https://github.com/dichioniccolo/prisma-effect-generator/commit/8b63effce782bc7c4506c7d242ce2de6b1424bfb) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Reject unknown keys in model operation arguments at compile time. The generated service typed each argument as a bare `A extends Args`, so a key Prisma doesn't accept (`where: { id: 1, typo: 1 }`, an extra field in `data`, a missing relation in `select`) compiled and then failed at runtime with a Prisma validation error. Arguments now go through `Prisma.Exact` at every depth, and `select` combined with `include` or `omit` is a compile error.
  
  Code that forwards a generic `<A extends Prisma.UserFindManyArgs>(args: A)` into the service no longer compiles. Type the wrapper's parameter as `Prisma.UserFindManyArgs` instead. See "Argument checking" in the README.

### Patch Changes

- [#30](https://github.com/dichioniccolo/prisma-effect-generator/pull/30) [`abae47c`](https://github.com/dichioniccolo/prisma-effect-generator/commit/abae47c4193c2caee559e828a8fa3b35819f66ef) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Fail `$transaction` with a typed error when the transaction cannot be opened (for example, when the database is down). The generated client used to leave the effect hanging and crash Node with an unhandled promise rejection. Errors the mapper does not recognize become defects, like other operations.

## 2.0.0

### Patch Changes

- [#28](https://github.com/dichioniccolo/prisma-effect-generator/pull/28) [`ce8cc8e`](https://github.com/dichioniccolo/prisma-effect-generator/commit/ce8cc8e56a0aaa8ef423f229d0a2d1b22b9b58a7) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Upgrade `effect` and `@effect/platform-node` to the stable `4.0.0` release. The generated code is unchanged; projects using it need `effect` `4.0.0` or later.

- [#27](https://github.com/dichioniccolo/prisma-effect-generator/pull/27) [`af4651a`](https://github.com/dichioniccolo/prisma-effect-generator/commit/af4651a68c8b4f5be100399a432fad9be8a3ba14) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Run the generator itself on Effect. The generated code is unchanged; what changes is how it is produced.
  
  - Generator options are decoded with `Schema`. Invalid values now fail before anything is written, with one message listing every offending option, the value received and what was expected. Values that previously produced broken code or were silently ignored are now rejected: an empty `clientImportPath`, an `importFileExtension` with a leading dot, an `errorImportPath` with more than one `#` or an export name that is not an identifier, and an `enableTelemetry` other than `"true"`/`"false"`.
  - File system access, path handling and Biome formatting sit behind services provided at the entry point, so the generator can be tested without touching the disk.
  - Debug logs are written to stderr as logfmt and shown by `DEBUG=prisma:GeneratorProcess prisma generate`.
  
  `@effect/platform-node` is a runtime dependency again: the generator now imports it to run on Node.

- [#27](https://github.com/dichioniccolo/prisma-effect-generator/pull/27) [`270ab05`](https://github.com/dichioniccolo/prisma-effect-generator/commit/270ab05f6c040b29cb304806637906949efb78ef) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Upgrade `effect` and `@effect/platform-node` to `4.0.0-rc.115`. The generated code is unchanged.

- [`6d56bc5`](https://github.com/dichioniccolo/prisma-effect-generator/commit/6d56bc56d9c27f225a93658ea615333e913c07ac) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Upgrade to Effect v4 RC (`effect`, `@effect/platform-node`, `@effect/vitest` at `4.0.0-rc.111`) and switch release tooling from release-please to Changesets.

- [`c30b277`](https://github.com/dichioniccolo/prisma-effect-generator/commit/c30b277def02777fe48f3488636909150b8c91c6) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Fix dependency classification. `vitest`, `@effect/vitest` and `@effect/platform-node` were declared as runtime dependencies but are not imported anywhere in the generator, and `typescript` is only needed to build it. Installing this package therefore pulled a full test runner and compiler — along with `vite`, `postcss`, `nanoid` and `esbuild`, and every advisory open against them — into consumers' dependency trees. They are now dev-only, and production dependencies audit clean.
  
  `effect` moves the other way: the generator imports it and so does the code it emits, but it was only a devDependency, so it was never actually declared as required.

## 2.0.0-rc.2

### Patch Changes

- [#27](https://github.com/dichioniccolo/prisma-effect-generator/pull/27) [`af4651a`](https://github.com/dichioniccolo/prisma-effect-generator/commit/af4651a68c8b4f5be100399a432fad9be8a3ba14) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Run the generator itself on Effect. The generated code is unchanged; what changes is how it is produced.
  
  - Generator options are decoded with `Schema`. Invalid values now fail before anything is written, with one message listing every offending option, the value received and what was expected. Values that previously produced broken code or were silently ignored are now rejected: an empty `clientImportPath`, an `importFileExtension` with a leading dot, an `errorImportPath` with more than one `#` or an export name that is not an identifier, and an `enableTelemetry` other than `"true"`/`"false"`.
  - File system access, path handling and Biome formatting sit behind services provided at the entry point, so the generator can be tested without touching the disk.
  - Debug logs are written to stderr as logfmt and shown by `DEBUG=prisma:GeneratorProcess prisma generate`.
  
  `@effect/platform-node` is a runtime dependency again: the generator now imports it to run on Node.

- [#27](https://github.com/dichioniccolo/prisma-effect-generator/pull/27) [`270ab05`](https://github.com/dichioniccolo/prisma-effect-generator/commit/270ab05f6c040b29cb304806637906949efb78ef) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Upgrade `effect` and `@effect/platform-node` to `4.0.0-rc.115`. The generated code is unchanged.

- [`c30b277`](https://github.com/dichioniccolo/prisma-effect-generator/commit/c30b277def02777fe48f3488636909150b8c91c6) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Fix dependency classification. `vitest`, `@effect/vitest` and `@effect/platform-node` were declared as runtime dependencies but are not imported anywhere in the generator, and `typescript` is only needed to build it. Installing this package therefore pulled a full test runner and compiler — along with `vite`, `postcss`, `nanoid` and `esbuild`, and every advisory open against them — into consumers' dependency trees. They are now dev-only, and production dependencies audit clean.
  
  `effect` moves the other way: the generator imports it and so does the code it emits, but it was only a devDependency, so it was never actually declared as required.

## 2.0.0-rc.1

### Patch Changes

- [`6d56bc5`](https://github.com/dichioniccolo/prisma-effect-generator/commit/6d56bc56d9c27f225a93658ea615333e913c07ac) Thanks [@dichioniccolo](https://github.com/dichioniccolo)! - Upgrade to Effect v4 RC (`effect`, `@effect/platform-node`, `@effect/vitest` at `4.0.0-rc.111`) and switch release tooling from release-please to Changesets.

## [2.0.0-beta.2](https://github.com/dichioniccolo/prisma-effect-generator/compare/v1.1.3-beta.2...v2.0.0-beta.2) (2026-07-17)


### ⚠ BREAKING CHANGES

* Prisma 6 (`prisma-client-js` provider) is no longer supported; use Prisma 7 with the `prisma-client` generator provider.

### Features

* drop Prisma 6 support ([86d8d9a](https://github.com/dichioniccolo/prisma-effect-generator/commit/86d8d9a241af0c58513c9e68351e529356648de8))

## [1.1.3-beta.2](https://github.com/dichioniccolo/prisma-effect-generator/compare/v1.1.3-beta.1...v1.1.3-beta.2) (2026-04-19)


### Bug Fixes

* use prerelease versioning strategy for beta releases ([1319649](https://github.com/dichioniccolo/prisma-effect-generator/commit/13196490cc25bee310790f95731a7cccb9dbccf7))
* use prerelease versioning strategy to correctly increment beta version numbers (Vibe Kanban) ([16a345d](https://github.com/dichioniccolo/prisma-effect-generator/commit/16a345d4293cff5a0241d71b4a53df7ad04a8b70))

## [1.1.3-beta.1](https://github.com/dichioniccolo/prisma-effect-generator/compare/v1.1.2-beta.1...v1.1.3-beta.1) (2026-04-17)


### Features

* add support for read replicas in Prisma generator ([c96897b](https://github.com/dichioniccolo/prisma-effect-generator/commit/c96897bdfc86b3afc590b07425956284d59620e8))

## [1.1.2-beta.1](https://github.com/dichioniccolo/prisma-effect-generator/compare/v1.1.1-beta.1...v1.1.2-beta.1) (2026-04-17)


### Bug Fixes

* ci ([21c4895](https://github.com/dichioniccolo/prisma-effect-generator/commit/21c48955866d3237c14352435c938b11475347a4))

## [1.1.1-beta.1](https://github.com/dichioniccolo/prisma-effect-generator/compare/v1.1.0-beta.1...v1.1.1-beta.1) (2026-04-17)


### Features

* add repository to package.json ([4e41cc3](https://github.com/dichioniccolo/prisma-effect-generator/commit/4e41cc3da412d23ea84cc0d448854aab564a4a2a))
* add skills ([7363672](https://github.com/dichioniccolo/prisma-effect-generator/commit/7363672e1929c5decd484fbbda33a28cb4306a75))
* add supports many and return test ([5f7c42f](https://github.com/dichioniccolo/prisma-effect-generator/commit/5f7c42fcd9e76c3cb82dbfe4ef76be30ec7c06f5))
* change project scope for publishing ([0497c87](https://github.com/dichioniccolo/prisma-effect-generator/commit/0497c873b985c3f026e56962298fe28da481714c))
* update effect to 4 beta and prisma to latest ([627fead](https://github.com/dichioniccolo/prisma-effect-generator/commit/627feade1f2f8a5671792e22a08286e462b0d207))
* update to prisma 7.4 ([5104ce4](https://github.com/dichioniccolo/prisma-effect-generator/commit/5104ce43b9b3559cd8d1a387b2d5a2c8a3b8ae78))


### Bug Fixes

* release please for beta ([972f910](https://github.com/dichioniccolo/prisma-effect-generator/commit/972f91086a28a49871c70fc5eb1d730cf4a967a1))
* release please workflow ([cb6eee9](https://github.com/dichioniccolo/prisma-effect-generator/commit/cb6eee9db5d842d662a5dbeb734e274765bf0895))

## [1.2.0-beta.1](https://github.com/dichioniccolo/prisma-effect-generator/compare/v1.1.0-beta.1...v1.2.0-beta.1) (2026-04-17)


### Features

* add repository to package.json ([4e41cc3](https://github.com/dichioniccolo/prisma-effect-generator/commit/4e41cc3da412d23ea84cc0d448854aab564a4a2a))
* add skills ([7363672](https://github.com/dichioniccolo/prisma-effect-generator/commit/7363672e1929c5decd484fbbda33a28cb4306a75))
* add supports many and return test ([5f7c42f](https://github.com/dichioniccolo/prisma-effect-generator/commit/5f7c42fcd9e76c3cb82dbfe4ef76be30ec7c06f5))
* change project scope for publishing ([0497c87](https://github.com/dichioniccolo/prisma-effect-generator/commit/0497c873b985c3f026e56962298fe28da481714c))
* update effect to 4 beta and prisma to latest ([627fead](https://github.com/dichioniccolo/prisma-effect-generator/commit/627feade1f2f8a5671792e22a08286e462b0d207))
* update to prisma 7.4 ([5104ce4](https://github.com/dichioniccolo/prisma-effect-generator/commit/5104ce43b9b3559cd8d1a387b2d5a2c8a3b8ae78))


### Bug Fixes

* release please workflow ([cb6eee9](https://github.com/dichioniccolo/prisma-effect-generator/commit/cb6eee9db5d842d662a5dbeb734e274765bf0895))

## 1.1.0-beta.0

### Minor Changes

- 640be88: Beta release for Prisma 7 / Effect 4 compatibility

## 1.0.0

### Major Changes

- ec9f795: release 1.0.0

## 0.0.4

### Patch Changes

- a5db90a: Rename package to prisma-generator-effect

## 0.0.3

### Patch Changes

- 0497c87: Change project scope

## 0.0.2

### Patch Changes

- e3cc33d: First release

## 0.2.1

### Patch Changes

- 1273f54: Change publishing name

## 0.2.0

### Minor Changes

- e2b3ed9: Bump first release
