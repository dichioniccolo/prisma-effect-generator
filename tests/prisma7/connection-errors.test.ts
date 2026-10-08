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

// A libSQL adapter whose connection is gone: every query fails with `cause`.
const brokenAdapter = (cause: Record<string, unknown>) => {
  const factory = new PrismaLibSql({ url: "file:./dev.db" });
  const fail = async () => {
    throw new DriverAdapterError(cause);
  };
  return new Proxy(factory, {
    get(target, key, receiver) {
      if (key !== "connect") return Reflect.get(target, key, receiver);
      return async () => {
        const adapter = await target.connect();
        return new Proxy(adapter, {
          get(inner, innerKey, innerReceiver) {
            return innerKey === "queryRaw" || innerKey === "executeRaw"
              ? fail
              : Reflect.get(inner, innerKey, innerReceiver);
          },
        });
      };
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
