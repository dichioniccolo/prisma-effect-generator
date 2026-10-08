---
"prisma-generator-effect": patch
---

Map connection-level failures to `PrismaConnectionError` instead of defects.

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
