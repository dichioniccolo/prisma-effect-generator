import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Option } from "effect";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { Prisma, PrismaConnectionError } from "./generated/effect/index.js";
import { Prisma as PrismaNamespace } from "./generated/client/client.js";

// Prisma recognises driver adapter failures by shape: an error named
// "DriverAdapterError" whose `cause` carries the adapter error kind. It turns
// each kind into a request error code (ConnectionClosed is P1017, and so on).
class DriverAdapterError extends Error {
  override name = "DriverAdapterError";
  constructor(override readonly cause: Record<string, unknown>) {
    super(String(cause.kind));
  }
}

// Wraps `target` so that the methods named in `failing` throw `cause`, and
// does the same for the transactions it starts.
const breakMethods = <T extends object>(
  target: T,
  failing: ReadonlySet<PropertyKey>,
  cause: Record<string, unknown>,
): T =>
  new Proxy(target, {
    get(inner, key, receiver) {
      if (failing.has(key)) {
        return async () => {
          throw new DriverAdapterError(cause);
        };
      }
      const value = Reflect.get(inner, key, receiver);
      if (typeof value !== "function") return value;
      // Call through to the target: libSQL's classes use private fields.
      if (key !== "startTransaction") return value.bind(inner);
      return async (...args: Array<unknown>) =>
        breakMethods(await value.apply(inner, args), failing, cause);
    },
  });

// A libSQL adapter whose connection is gone: by default every query fails
// with `cause`.
const brokenAdapter = (
  cause: Record<string, unknown>,
  failing: ReadonlySet<PropertyKey> = new Set(["queryRaw", "executeRaw"]),
) => {
  // In memory: a transaction left open by a failed commit must not lock the
  // database the other test files share.
  const factory = new PrismaLibSql({ url: ":memory:" });
  return new Proxy(factory, {
    get(target, key, receiver) {
      if (key !== "connect") return Reflect.get(target, key, receiver);
      return async () => breakMethods(await target.connect(), failing, cause);
    },
  });
};

const cases = [
  { code: "P1001", cause: { kind: "DatabaseNotReachable" } },
  { code: "P1008", cause: { kind: "SocketTimeout" } },
  { code: "P1017", cause: { kind: "ConnectionClosed" } },
  { code: "P2036", cause: { kind: "GenericJs", id: 1 } },
  { code: "P2037", cause: { kind: "TooManyConnections", cause: "limit" } },
] as const;

const expectConnectionError = (
  exit: Exit.Exit<unknown, unknown>,
  code: string,
  operation: string,
) => {
  const error = Option.getOrUndefined(Exit.findErrorOption(exit));
  expect(error).toBeInstanceOf(PrismaConnectionError);
  expect((error as PrismaConnectionError).operation).toBe(operation);
  expect((error as PrismaConnectionError).cause.code).toBe(code);
};

describe("connection-level errors", () => {
  for (const { code, cause } of cases) {
    describe(`${cause.kind} (${code})`, () => {
      const layer = Prisma.layer({ adapter: brokenAdapter(cause) });

      it.effect("create fails with PrismaConnectionError", () =>
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          const exit = yield* Effect.exit(
            prisma.user.create({ data: { email: `${code}@example.com` } }),
          );
          expectConnectionError(exit, code, "create");
        }).pipe(Effect.provide(layer)),
      );

      it.effect("update fails with PrismaConnectionError", () =>
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          const exit = yield* Effect.exit(
            prisma.user.update({ where: { id: 1 }, data: { name: "x" } }),
          );
          expectConnectionError(exit, code, "update");
        }).pipe(Effect.provide(layer)),
      );

      it.effect("findMany fails with PrismaConnectionError", () =>
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          const exit = yield* Effect.exit(prisma.user.findMany());
          expectConnectionError(exit, code, "findMany");
        }).pipe(Effect.provide(layer)),
      );

      it.effect("$queryRaw fails with PrismaConnectionError", () =>
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          const exit = yield* Effect.exit(prisma.$queryRaw(PrismaNamespace.sql`SELECT 1`));
          // Raw queries wrap every adapter error in P2010
          expectConnectionError(exit, "P2010", "$queryRaw");
        }).pipe(Effect.provide(layer)),
      );
    });
  }

  // Every other mapper, with a single code.
  describe("other operations", () => {
    const layer = Prisma.layer({
      adapter: brokenAdapter({ kind: "ConnectionClosed" }),
    });
    const operations: Record<
      string,
      (prisma: Prisma["Service"]) => Effect.Effect<unknown, unknown>
    > = {
      findUniqueOrThrow: (prisma: Prisma["Service"]) =>
        prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
      upsert: (prisma: Prisma["Service"]) =>
        prisma.user.upsert({
          where: { id: 1 },
          create: { email: "upsert@example.com" },
          update: {},
        }),
      delete: (prisma: Prisma["Service"]) =>
        prisma.user.delete({ where: { id: 1 } }),
      deleteMany: (prisma: Prisma["Service"]) => prisma.user.deleteMany(),
      updateMany: (prisma: Prisma["Service"]) =>
        prisma.user.updateMany({ data: { name: "x" } }),
      $executeRaw: (prisma: Prisma["Service"]) =>
        prisma.$executeRaw(PrismaNamespace.sql`DELETE FROM User`),
    };

    for (const [operation, run] of Object.entries(operations)) {
      it.effect(`${operation} fails with PrismaConnectionError`, () =>
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          const exit = yield* Effect.exit(run(prisma));
          const code = operation === "$executeRaw" ? "P2010" : "P1017";
          expectConnectionError(exit, code, operation);
        }).pipe(Effect.provide(layer)),
      );
    }
  });

  it.effect("a link lost while opening a transaction fails typed", () =>
    Effect.gen(function* () {
      const adapter = brokenAdapter(
        { kind: "ConnectionClosed" },
        new Set(["startTransaction"]),
      );
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          return yield* prisma.$transaction(
            prisma.$queryRaw(PrismaNamespace.sql`SELECT 1`),
          );
        }).pipe(Effect.provide(Prisma.layer({ adapter }))),
      );
      expectConnectionError(exit, "P1017", "$transaction");
    }),
  );

  it.effect("a link lost while committing fails typed", () =>
    Effect.gen(function* () {
      const adapter = brokenAdapter(
        { kind: "ConnectionClosed" },
        new Set(["commit"]),
      );
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          return yield* prisma.$transaction(
            prisma.$queryRaw(PrismaNamespace.sql`SELECT 1`),
          );
        }).pipe(Effect.provide(Prisma.layer({ adapter }))),
      );
      expectConnectionError(exit, "P1017", "$commit");
    }),
  );

  it.effect("a raw query failing for another reason is still a defect", () =>
    Effect.gen(function* () {
      const adapter = brokenAdapter({
        kind: "sqlite",
        extendedCode: 1,
        message: "syntax error",
      });
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const prisma = yield* Prisma;
          return yield* prisma.$queryRaw(PrismaNamespace.sql`SELECT 1`);
        }).pipe(Effect.provide(Prisma.layer({ adapter }))),
      );
      expect(Option.isNone(Exit.findErrorOption(exit))).toBe(true);
      expect(Exit.hasDies(exit)).toBe(true);
    }),
  );
});
