import { describe, expect, it } from "@effect/vitest";
import { Cause, Data, Effect, Exit } from "effect";

// Error types for testing
class AcquireError extends Data.TaggedError("AcquireError")<{
  message: string;
}> {}
class UseError extends Data.TaggedError("UseError")<{ message: string }> {}
class ReleaseError extends Data.TaggedError("ReleaseError")<{
  message: string;
}> {}

/**
 * Like Effect.acquireUseRelease, but allows the release function to fail.
 * Release errors are surfaced in the error channel instead of becoming defects.
 *
 * Key properties:
 * - The release function is always called, even if use fails
 * - The release function is uninterruptible to ensure cleanup completes
 * - Release errors are surfaced in the error channel, not as defects
 */
const acquireUseReleaseWithErrors = <A, E, R, A2, E2, R2, X, E3, R3>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Effect.Effect<A2, E2, R2>,
  release: (a: A, exit: Exit.Exit<A2, E2>) => Effect.Effect<X, E3, R3>,
): Effect.Effect<A2, E | E2 | E3, R | R2 | R3> =>
  Effect.uninterruptibleMask((restore) =>
    Effect.flatMap(acquire, (a) =>
      Effect.flatMap(Effect.exit(restore(use(a))), (exit) =>
        Effect.flatMap(
          // Make release uninterruptible to ensure cleanup always completes
          Effect.exit(Effect.uninterruptible(release(a, exit))),
          (releaseExit) => {
            if (Exit.isFailure(releaseExit)) {
              // Release failed - surface the release error
              return releaseExit as any;
            }
            // Release succeeded - return the original use result
            return exit as any;
          },
        ),
      ),
    ),
  );

describe("acquireUseReleaseWithErrors", () => {
  it.effect("should return use result when all succeed", () =>
    Effect.gen(function* () {
      let acquired = false;
      let used = false;
      let released = false;

      const result = yield* acquireUseReleaseWithErrors(
        Effect.sync(() => {
          acquired = true;
          return "resource";
        }),
        (resource) =>
          Effect.sync(() => {
            used = true;
            expect(resource).toBe("resource");
            return "use-result";
          }),
        (resource, exit) =>
          Effect.sync(() => {
            released = true;
            expect(resource).toBe("resource");
            expect(Exit.isSuccess(exit)).toBe(true);
          }),
      );

      expect(result).toBe("use-result");
      expect(acquired).toBe(true);
      expect(used).toBe(true);
      expect(released).toBe(true);
    }),
  );

  it.effect("should return use error when use fails and release succeeds", () =>
    Effect.gen(function* () {
      let released = false;
      let releaseExitWasFailure = false;

      const error = yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.fail(new UseError({ message: "use failed" })),
        (_resource, exit) =>
          Effect.sync(() => {
            released = true;
            releaseExitWasFailure = Exit.isFailure(exit);
          }),
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(UseError);
      expect(error.message).toBe("use failed");
      expect(released).toBe(true);
      expect(releaseExitWasFailure).toBe(true);
    }),
  );

  it.effect(
    "should return release error when use succeeds but release fails",
    () =>
      Effect.gen(function* () {
        let used = false;

        const error = yield* acquireUseReleaseWithErrors(
          Effect.succeed("resource"),
          () =>
            Effect.sync(() => {
              used = true;
              return "use-result";
            }),
          () => Effect.fail(new ReleaseError({ message: "release failed" })),
        ).pipe(Effect.flip);

        expect(error).toBeInstanceOf(ReleaseError);
        expect(error.message).toBe("release failed");
        expect(used).toBe(true);
      }),
  );

  it.effect("should return release error when both use and release fail", () =>
    Effect.gen(function* () {
      let releaseExitWasFailure = false;

      const error = yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.fail(new UseError({ message: "use failed" })),
        (_resource, exit) => {
          releaseExitWasFailure = Exit.isFailure(exit);
          return Effect.fail(new ReleaseError({ message: "release failed" }));
        },
      ).pipe(Effect.flip);

      // Release error takes precedence when both fail
      expect(error).toBeInstanceOf(ReleaseError);
      expect(error.message).toBe("release failed");
      expect(releaseExitWasFailure).toBe(true);
    }),
  );

  it.effect("should return acquire error when acquire fails", () =>
    Effect.gen(function* () {
      let useCalled = false;
      let releaseCalled = false;

      const error = yield* acquireUseReleaseWithErrors(
        Effect.fail(new AcquireError({ message: "acquire failed" })),
        () =>
          Effect.sync(() => {
            useCalled = true;
            return "use-result";
          }),
        () =>
          Effect.sync(() => {
            releaseCalled = true;
          }),
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(AcquireError);
      expect(error.message).toBe("acquire failed");
      expect(useCalled).toBe(false);
      expect(releaseCalled).toBe(false);
    }),
  );

  it.effect("should pass the acquired resource to use and release", () =>
    Effect.gen(function* () {
      const resource = { id: 123, name: "test-resource" };
      let useReceivedResource: any = null;
      let releaseReceivedResource: any = null;

      yield* acquireUseReleaseWithErrors(
        Effect.succeed(resource),
        (r) =>
          Effect.sync(() => {
            useReceivedResource = r;
            return "result";
          }),
        (r) =>
          Effect.sync(() => {
            releaseReceivedResource = r;
          }),
      );

      expect(useReceivedResource).toBe(resource);
      expect(releaseReceivedResource).toBe(resource);
    }),
  );

  it.effect("should provide exit info to release (success case)", () =>
    Effect.gen(function* () {
      let releaseExit: Exit.Exit<string, UseError> | null = null;

      yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.succeed("use-success"),
        (_resource, exit) =>
          Effect.sync(() => {
            releaseExit = exit;
          }),
      );

      expect(releaseExit).not.toBeNull();
      expect(Exit.isSuccess(releaseExit!)).toBe(true);
      const successValue = Exit.match(releaseExit!, {
        onSuccess: (value) => value,
        onFailure: () => null,
      });
      expect(successValue).toBe("use-success");
    }),
  );

  it.effect("should provide exit info to release (failure case)", () =>
    Effect.gen(function* () {
      let releaseExit: Exit.Exit<string, UseError> | null = null;

      yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.fail(new UseError({ message: "use failed" })),
        (_resource, exit) =>
          Effect.sync(() => {
            releaseExit = exit;
          }),
      ).pipe(Effect.flip);

      expect(releaseExit).not.toBeNull();
      expect(Exit.isFailure(releaseExit!)).toBe(true);
    }),
  );

  it.effect("should always call release even if use fails", () =>
    Effect.gen(function* () {
      let releaseCalled = false;

      yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.fail(new UseError({ message: "use failed" })),
        () =>
          Effect.sync(() => {
            releaseCalled = true;
          }),
      ).pipe(Effect.flip);

      expect(releaseCalled).toBe(true);
    }),
  );

  it.effect("should handle complex error types", () =>
    Effect.gen(function* () {
      class ComplexError extends Data.TaggedError("ComplexError")<{
        code: string;
        details: { foo: number };
      }> {}

      const error = yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.succeed("result"),
        () =>
          Effect.fail(
            new ComplexError({ code: "ERR123", details: { foo: 42 } }),
          ),
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ComplexError);
      if (error instanceof ComplexError) {
        expect(error.code).toBe("ERR123");
        expect(error.details.foo).toBe(42);
      }
    }),
  );

  it.effect("should compose with other Effect operations", () =>
    Effect.gen(function* () {
      const result = yield* acquireUseReleaseWithErrors(
        Effect.succeed(10),
        (n) => Effect.succeed(n * 2),
        () => Effect.succeed(undefined),
      ).pipe(
        Effect.map((x) => x + 5),
        Effect.flatMap((x) => Effect.succeed(x.toString())),
      );

      expect(result).toBe("25");
    }),
  );

  it.effect("should handle catching release errors", () =>
    Effect.gen(function* () {
      const result = yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.succeed("use-result"),
        () => Effect.fail(new ReleaseError({ message: "release failed" })),
      ).pipe(
        Effect.catchTag("ReleaseError", () => Effect.succeed("recovered")),
      );

      expect(result).toBe("recovered");
    }),
  );

  it.effect("should maintain error channel type safety", () =>
    Effect.gen(function* () {
      const program = acquireUseReleaseWithErrors(
        Effect.fail(new AcquireError({ message: "acquire" })),
        () => Effect.fail(new UseError({ message: "use" })),
        () => Effect.fail(new ReleaseError({ message: "release" })),
      );

      // Should be able to catch all error types
      const result = yield* program.pipe(
        Effect.catchTags({
          AcquireError: () => Effect.succeed("caught-acquire"),
          UseError: () => Effect.succeed("caught-use"),
          ReleaseError: () => Effect.succeed("caught-release"),
        }),
      );

      expect(result).toBe("caught-acquire");
    }),
  );

  it.effect("should handle defects in use (not release errors)", () =>
    Effect.gen(function* () {
      let releaseCalled = false;

      // Defects should still propagate as defects, not be caught
      const exit = yield* acquireUseReleaseWithErrors(
        Effect.succeed("resource"),
        () => Effect.die(new Error("unexpected defect")),
        () =>
          Effect.sync(() => {
            releaseCalled = true;
          }),
      ).pipe(Effect.exit);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        // It's a defect (Die), not a regular failure
        expect(exit.cause.reasons.some(Cause.isDieReason)).toBe(true);
      }
      expect(releaseCalled).toBe(true);
    }),
  );
});
