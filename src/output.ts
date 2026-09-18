import { Context, Effect, FileSystem, Layer, Path } from "effect";
import { FileWriteError, OutputDirectoryError } from "./errors.js";

/** A file to emit, with its path relative to the output directory. */
export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/** Owns the output directory: the only code that writes to disk. */
export class OutputWriter extends Context.Service<OutputWriter>()(
  "OutputWriter",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      /**
       * Replaces the contents of `outputDir` with `files` and returns the
       * absolute paths written.
       *
       * Not transactional, as before: the directory is emptied first, so a
       * failed write leaves it partially populated. Files are written one at
       * a time; the generator emits a single file, so concurrency would buy
       * nothing.
       */
      const write = Effect.fn("OutputWriter.write")(function* (
        outputDir: string,
        files: ReadonlyArray<GeneratedFile>,
      ) {
        yield* fs.remove(outputDir, { recursive: true, force: true }).pipe(
          Effect.mapError(
            (cause) =>
              new OutputDirectoryError({
                path: outputDir,
                operation: "clean",
                cause,
              }),
          ),
        );
        yield* fs.makeDirectory(outputDir, { recursive: true }).pipe(
          Effect.mapError(
            (cause) =>
              new OutputDirectoryError({
                path: outputDir,
                operation: "create",
                cause,
              }),
          ),
        );

        return yield* Effect.forEach(files, (file) => {
          const target = path.join(outputDir, file.path);
          return fs.writeFileString(target, file.content).pipe(
            Effect.mapError(
              (cause) => new FileWriteError({ path: target, cause }),
            ),
            Effect.as(target),
            Effect.tap(() => Effect.logDebug("wrote file")),
            Effect.annotateLogs("file", target),
          );
        });
      });

      return { write };
    }),
  },
) {
  /** Writes through whichever FileSystem and Path are provided. */
  static readonly layer = Layer.effect(this, this.make);
}
