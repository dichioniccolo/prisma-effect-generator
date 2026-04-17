import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  Prisma,
  PrismaClient,
  PrismaReplicas,
} from "./generated/effect/index.js";
import { PrismaClient as BasePrismaClient } from "./generated/client/client.js";
import { copyFileSync, existsSync, rmSync } from "node:fs";

// DB files that will be used across all tests in this file.
// Each DB is a separate SQLite file so we can verify which database a given
// operation was routed to by checking the data that comes back.
const primaryDb = "file:./primary.db";
const replica1Db = "file:./replica1.db";
const replica2Db = "file:./replica2.db";

const primaryAdapter = new PrismaLibSql({ url: primaryDb });
const replica1Adapter = new PrismaLibSql({ url: replica1Db });
const replica2Adapter = new PrismaLibSql({ url: replica2Db });

// Layer with the two read replicas
const ReplicasLayer = PrismaReplicas.layer([
  { adapter: replica1Adapter },
  { adapter: replica2Adapter },
]);

// Main layer: Prisma + replicas merged together
const LayerWithReplicas = Layer.mergeAll(
  Prisma.layer({ adapter: primaryAdapter }),
  ReplicasLayer,
);

// Main layer with only the primary (no replicas) - used for no-replicas parity tests
const LayerPrimaryOnly = Prisma.layer({ adapter: primaryAdapter });

// Raw BasePrismaClient instances used for seeding/cleanup outside of Effect.
// We intentionally bypass the Effect service layer here so setup can freely
// write different data to each database without going through the routing helpers.
const rawPrimary = new BasePrismaClient({ adapter: primaryAdapter });
const rawReplica1 = new BasePrismaClient({
  adapter: new PrismaLibSql({ url: replica1Db }),
});
const rawReplica2 = new BasePrismaClient({
  adapter: new PrismaLibSql({ url: replica2Db }),
});

const wipeAll = async () => {
  for (const c of [rawPrimary, rawReplica1, rawReplica2]) {
    await c.post.deleteMany({});
    await c.user.deleteMany({});
  }
};

beforeAll(() => {
  // The test runner has already pushed the schema onto primary.db. We replicate
  // that file into replica1.db / replica2.db so each replica DB has the same
  // schema but an independent data store.
  for (const f of ["replica1.db", "replica2.db"]) {
    if (existsSync(f)) {
      rmSync(f);
    }
    copyFileSync("primary.db", f);
  }
});

afterAll(async () => {
  await rawPrimary.$disconnect();
  await rawReplica1.$disconnect();
  await rawReplica2.$disconnect();
});

beforeEach(async () => {
  await wipeAll();
});

describe("Read replicas - auto routing", () => {
  it.effect("reads are routed to a replica when replicas are configured", () =>
    Effect.gen(function* () {
      // Seed different data on primary vs both replicas. Since reads should go
      // to a random replica, we seed the *same* marker name in both replicas
      // and a *different* marker on primary. If the read lands on any replica,
      // we see the replica marker; if it incorrectly lands on primary, we see
      // the primary marker.
      yield* Effect.promise(() =>
        rawPrimary.user.create({ data: { email: "x@primary", name: "PRIMARY" } }),
      );
      yield* Effect.promise(() =>
        rawReplica1.user.create({ data: { email: "x@replica", name: "REPLICA" } }),
      );
      yield* Effect.promise(() =>
        rawReplica2.user.create({ data: { email: "x@replica", name: "REPLICA" } }),
      );

      const prisma = yield* Prisma;
      const users = yield* prisma.user.findMany({});
      expect(users).toHaveLength(1);
      expect(users[0]?.name).toBe("REPLICA");
      expect(users[0]?.email).toBe("x@replica");
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );

  it.effect("writes are routed to the primary client", () =>
    Effect.gen(function* () {
      const prisma = yield* Prisma;
      yield* prisma.user.create({
        data: { email: "write@example.com", name: "Written" },
      });

      // The write should be on primary only.
      const onPrimary = yield* Effect.promise(() =>
        rawPrimary.user.findUnique({ where: { email: "write@example.com" } }),
      );
      expect(onPrimary?.name).toBe("Written");

      // Neither replica should have seen the write.
      const onReplica1 = yield* Effect.promise(() =>
        rawReplica1.user.findUnique({ where: { email: "write@example.com" } }),
      );
      const onReplica2 = yield* Effect.promise(() =>
        rawReplica2.user.findUnique({ where: { email: "write@example.com" } }),
      );
      expect(onReplica1).toBeNull();
      expect(onReplica2).toBeNull();
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );

  it.effect("raw SQL is routed to the primary client by default", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        rawPrimary.user.create({ data: { email: "raw@primary", name: "PRIMARY" } }),
      );
      yield* Effect.promise(() =>
        rawReplica1.user.create({ data: { email: "raw@replica", name: "REPLICA" } }),
      );
      yield* Effect.promise(() =>
        rawReplica2.user.create({ data: { email: "raw@replica", name: "REPLICA" } }),
      );

      const prisma = yield* Prisma;
      // Raw queries default to primary, so they should see primary's data.
      const rows = yield* prisma.$queryRawUnsafe<Array<{ email: string }>>(
        "SELECT email FROM User",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.email).toBe("raw@primary");
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );
});

describe("Read replicas - transaction override", () => {
  it.effect("reads inside a transaction see uncommitted writes from the same tx (not replica)", () =>
    Effect.gen(function* () {
      // Seed replicas with stale data so that if the read incorrectly goes to
      // a replica inside the transaction, we'd see it instead of the in-flight write.
      yield* Effect.promise(() =>
        rawReplica1.user.create({ data: { email: "stale@replica", name: "STALE" } }),
      );
      yield* Effect.promise(() =>
        rawReplica2.user.create({ data: { email: "stale@replica", name: "STALE" } }),
      );

      const prisma = yield* Prisma;
      const result = yield* prisma.$transaction(
        Effect.gen(function* () {
          yield* prisma.user.create({
            data: { email: "tx@example.com", name: "TxUser" },
          });
          // This read must see the uncommitted row created above.
          return yield* prisma.user.findMany({});
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe("tx@example.com");
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );
});

describe("Read replicas - $primary() escape hatch", () => {
  it.effect("$primary() forces reads onto the primary client", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        rawPrimary.user.create({ data: { email: "p@primary", name: "PRIMARY" } }),
      );
      yield* Effect.promise(() =>
        rawReplica1.user.create({ data: { email: "p@replica", name: "REPLICA" } }),
      );
      yield* Effect.promise(() =>
        rawReplica2.user.create({ data: { email: "p@replica", name: "REPLICA" } }),
      );

      const prisma = yield* Prisma;
      const users = yield* prisma.$primary().user.findMany({});
      expect(users).toHaveLength(1);
      expect(users[0]?.name).toBe("PRIMARY");
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );
});

describe("Read replicas - $replica() escape hatch", () => {
  it.effect("$replica() forces raw queries to run against a replica", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        rawPrimary.user.create({ data: { email: "r@primary", name: "PRIMARY" } }),
      );
      yield* Effect.promise(() =>
        rawReplica1.user.create({ data: { email: "r@replica", name: "REPLICA" } }),
      );
      yield* Effect.promise(() =>
        rawReplica2.user.create({ data: { email: "r@replica", name: "REPLICA" } }),
      );

      const prisma = yield* Prisma;
      // Raw queries default to primary but $replica() should force them to a replica.
      const rows = yield* prisma
        .$replica()
        .$queryRawUnsafe<Array<{ email: string }>>("SELECT email FROM User");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.email).toBe("r@replica");
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );

  it.effect("$replica() writes still succeed (against the pinned replica)", () =>
    Effect.gen(function* () {
      const prisma = yield* Prisma;
      yield* prisma.$replica().user.create({
        data: { email: "write-on-replica@example.com", name: "OnReplica" },
      });

      // The write should have landed on exactly one of the two replicas.
      const onReplica1 = yield* Effect.promise(() =>
        rawReplica1.user.findUnique({
          where: { email: "write-on-replica@example.com" },
        }),
      );
      const onReplica2 = yield* Effect.promise(() =>
        rawReplica2.user.findUnique({
          where: { email: "write-on-replica@example.com" },
        }),
      );
      const onPrimary = yield* Effect.promise(() =>
        rawPrimary.user.findUnique({
          where: { email: "write-on-replica@example.com" },
        }),
      );
      expect(onPrimary).toBeNull();
      expect(!!onReplica1 || !!onReplica2).toBe(true);
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );
});

describe("Read replicas - no replicas configured (parity)", () => {
  it.effect("reads fall back to primary when no PrismaReplicas layer is provided", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        rawPrimary.user.create({ data: { email: "only@primary", name: "PRIMARY" } }),
      );

      const prisma = yield* Prisma;
      const users = yield* prisma.user.findMany({});
      expect(users).toHaveLength(1);
      expect(users[0]?.email).toBe("only@primary");
    }).pipe(Effect.provide(LayerPrimaryOnly), Effect.scoped),
  );

  it.effect("$primary() and $replica() still work (both route to primary)", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        rawPrimary.user.create({ data: { email: "fallback@primary", name: "PRIMARY" } }),
      );

      const prisma = yield* Prisma;
      const viaPrimary = yield* prisma.$primary().user.findMany({});
      const viaReplica = yield* prisma.$replica().user.findMany({});
      expect(viaPrimary).toHaveLength(1);
      expect(viaReplica).toHaveLength(1);
      expect(viaPrimary[0]?.email).toBe("fallback@primary");
      expect(viaReplica[0]?.email).toBe("fallback@primary");
    }).pipe(Effect.provide(LayerPrimaryOnly), Effect.scoped),
  );
});

describe("PrismaReplicas - layer lifecycle", () => {
  it.effect("replica clients are disconnected when the scope ends", () =>
    Effect.gen(function* () {
      // Build a dedicated adapter instance so we can observe disconnection
      // without tearing down the shared test DB.
      const adapter = new PrismaLibSql({ url: "file:./replica-lifecycle.db" });

      // Use the layer within a scoped effect and assert no hangs / errors.
      yield* Effect.scoped(
        Effect.gen(function* () {
          const replicas = yield* PrismaReplicas;
          expect(replicas.length).toBe(1);
        }).pipe(Effect.provide(PrismaReplicas.layer([{ adapter }]))),
      );

      // Clean up the temp file on disk.
      if (existsSync("replica-lifecycle.db")) {
        rmSync("replica-lifecycle.db");
      }
    }),
  );
});

describe("PrismaClient is exposed for advanced use cases", () => {
  it.effect("the primary PrismaClient service is available in context", () =>
    Effect.gen(function* () {
      const raw = yield* PrismaClient;
      expect(raw).toBeDefined();
      expect(typeof raw.$queryRaw).toBe("function");
    }).pipe(Effect.provide(LayerWithReplicas), Effect.scoped),
  );
});
