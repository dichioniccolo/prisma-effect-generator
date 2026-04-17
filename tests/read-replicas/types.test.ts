import { describe, expectTypeOf, it } from "@effect/vitest";
import type { Effect as EffectType } from "effect/Effect";
import type { IPrismaService } from "./generated/effect/index.js";

// All assertions below operate purely on types - no runtime access is performed.
// We use type-argument form of `expectTypeOf<T>()` to avoid needing runtime values.

describe("$primary() / $replica() - type-level assertions", () => {
  it("$primary() returns IPrismaService", () => {
    expectTypeOf<
      ReturnType<IPrismaService["$primary"]>
    >().toEqualTypeOf<IPrismaService>();
  });

  it("$replica() returns IPrismaService", () => {
    expectTypeOf<
      ReturnType<IPrismaService["$replica"]>
    >().toEqualTypeOf<IPrismaService>();
  });

  it("sub-services expose $primary and $replica for chaining", () => {
    type Primary = ReturnType<IPrismaService["$primary"]>;
    type Replica = ReturnType<IPrismaService["$replica"]>;
    expectTypeOf<Primary["$primary"]>().toEqualTypeOf<
      IPrismaService["$primary"]
    >();
    expectTypeOf<Primary["$replica"]>().toEqualTypeOf<
      IPrismaService["$replica"]
    >();
    expectTypeOf<Replica["$primary"]>().toEqualTypeOf<
      IPrismaService["$primary"]
    >();
    expectTypeOf<Replica["$replica"]>().toEqualTypeOf<
      IPrismaService["$replica"]
    >();

    expectTypeOf<
      ReturnType<Primary["$replica"]>
    >().toEqualTypeOf<IPrismaService>();
    expectTypeOf<
      ReturnType<Replica["$primary"]>
    >().toEqualTypeOf<IPrismaService>();
  });

  it("model method signatures are identical on main and pinned sub-services", () => {
    type Primary = ReturnType<IPrismaService["$primary"]>;
    type Replica = ReturnType<IPrismaService["$replica"]>;
    expectTypeOf<Primary["user"]["findMany"]>().toEqualTypeOf<
      IPrismaService["user"]["findMany"]
    >();
    expectTypeOf<Replica["user"]["findMany"]>().toEqualTypeOf<
      IPrismaService["user"]["findMany"]
    >();
    expectTypeOf<Primary["post"]["create"]>().toEqualTypeOf<
      IPrismaService["post"]["create"]
    >();
    expectTypeOf<Replica["post"]["create"]>().toEqualTypeOf<
      IPrismaService["post"]["create"]
    >();
  });

  it("$queryRawUnsafe returns an Effect on pinned sub-services", () => {
    type Primary = ReturnType<IPrismaService["$primary"]>;
    type Replica = ReturnType<IPrismaService["$replica"]>;
    expectTypeOf<
      ReturnType<Primary["$queryRawUnsafe"]>
    >().toMatchTypeOf<EffectType<unknown, any, any>>();
    expectTypeOf<
      ReturnType<Replica["$queryRawUnsafe"]>
    >().toMatchTypeOf<EffectType<unknown, any, any>>();
  });

  it("$transaction is available on pinned sub-services and has the same shape", () => {
    type Primary = ReturnType<IPrismaService["$primary"]>;
    type Replica = ReturnType<IPrismaService["$replica"]>;
    expectTypeOf<Primary["$transaction"]>().toEqualTypeOf<
      IPrismaService["$transaction"]
    >();
    expectTypeOf<Replica["$transaction"]>().toEqualTypeOf<
      IPrismaService["$transaction"]
    >();
  });

  it("the client field is preserved on pinned sub-services", () => {
    type Primary = ReturnType<IPrismaService["$primary"]>;
    type Replica = ReturnType<IPrismaService["$replica"]>;
    expectTypeOf<Primary["client"]>().toEqualTypeOf<IPrismaService["client"]>();
    expectTypeOf<Replica["client"]>().toEqualTypeOf<IPrismaService["client"]>();
  });
});
