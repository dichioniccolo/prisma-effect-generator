import { Context, Effect, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { FormatError } from "./errors.js";

/** Formats a generated file in place. */
export class CodeFormatter extends Context.Service<
  CodeFormatter,
  { readonly format: (file: string) => Effect.Effect<void, FormatError> }
>()("CodeFormatter") {
  /**
   * Runs `npx @biomejs/biome format --write` through a shell, exactly as the
   * generator always has. The child's output goes straight to the terminal;
   * stdin is closed because the generator's own stdin carries Prisma's
   * JSON-RPC stream.
   */
  static readonly biome = Layer.effect(
    CodeFormatter,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return {
        format: (file) =>
          spawner
            .exitCode(
              ChildProcess.make(
                `npx @biomejs/biome format --write "${file}"`,
                [],
                {
                  shell: true,
                  detached: false,
                  stdin: "ignore",
                  stdout: "inherit",
                  stderr: "inherit",
                },
              ),
            )
            .pipe(
              Effect.mapError(
                (cause) =>
                  new FormatError({ path: file, reason: cause.message }),
              ),
              Effect.flatMap((exitCode) =>
                exitCode === 0
                  ? Effect.void
                  : Effect.fail(
                      new FormatError({
                        path: file,
                        reason: `biome exited with code ${exitCode}`,
                      }),
                    ),
              ),
            ),
      };
    }),
  );

  /** Leaves files untouched. */
  static readonly noop = Layer.succeed(CodeFormatter, {
    format: () => Effect.void,
  });
}
