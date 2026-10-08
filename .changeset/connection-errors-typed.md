---
"prisma-generator-effect": patch
---

Map connection-level failures to `PrismaConnectionError` instead of defects.

Driver adapters report a lost database link with codes the mappers did not
handle: P1001 (server unreachable), P1008 (socket timeout), P1017 (connection
closed), P2036 (adapter-side failure) and P2037 (too many connections). Those
errors were rethrown inside `Effect.tryPromise` and became defects, so
`Effect.catchTag` and `Effect.retry` never saw them. Every mapper now turns
them, along with P2024, into `PrismaConnectionError`.

Raw queries wrap every adapter error in P2010. For those, the mapper reads the
adapter error kind from `meta.driverAdapterError` and only maps the connection
kinds; other raw query failures are still defects.
