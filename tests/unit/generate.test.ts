import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Path } from "effect";
import { FormatError } from "../../src/errors.js";
import { CodeFormatter } from "../../src/formatter.js";
import { type GenerateInput, generate } from "../../src/generate.js";
import { OutputWriter } from "../../src/output.js";
import { memoryFileSystem } from "./memoryFileSystem.js";

const output = "/project/prisma/generated/effect";

const input = (
  config: GenerateInput["generator"]["config"],
): GenerateInput => ({
  generator: {
    name: "effect",
    output: { value: output, fromEnvVar: null },
    config,
  },
  schemaPath: "/project/prisma/schema.prisma",
  datasources: [{ provider: "postgresql" }],
  dmmf: { datamodel: { models: [{ name: "User" }, { name: "Post" }] } },
});

// The real OutputWriter over an in-memory FileSystem. Path.layer is the
// POSIX implementation shipped with effect, so paths match on every OS.
const run = <A, E>(
  effect: Effect.Effect<A, E, OutputWriter | Path.Path | CodeFormatter>,
  fs: ReturnType<typeof memoryFileSystem>,
  formatter = CodeFormatter.noop,
) =>
  effect.pipe(
    Effect.provide(
      Layer.mergeAll(OutputWriter.layer, formatter).pipe(
        Layer.provideMerge(Layer.mergeAll(fs.layer, Path.layer)),
      ),
    ),
  );

describe("generate", () => {
  it.effect("writes the service without touching the disk", () =>
    Effect.gen(function* () {
      const fs = memoryFileSystem();
      yield* run(generate(input({ enableTelemetry: "true" })), fs);

      expect(fs.operations).toStrictEqual([
        `remove ${output}`,
        `mkdir ${output}`,
        `write ${output}/index.ts`,
      ]);
      // Same models and options as the snapshot in templates.test.ts.
      yield* Effect.promise(() =>
        expect(fs.files.get(`${output}/index.ts`)).toMatchFileSnapshot(
          "__snapshots__/default-errors.ts.snap",
        ),
      );
    }),
  );

  it.effect("imports the error module relative to the output directory", () =>
    Effect.gen(function* () {
      const fs = memoryFileSystem();
      yield* run(
        generate(
          input({
            errorImportPath: "./errors#MyError",
            importFileExtension: "js",
          }),
        ),
        fs,
      );

      expect(fs.files.get(`${output}/index.ts`)).toContain(
        `import { MyError, mapPrismaError } from "../../errors.js"`,
      );
    }),
  );

  it.effect("validates the options before touching the file system", () =>
    Effect.gen(function* () {
      const fs = memoryFileSystem();
      const error = yield* run(
        generate(input({ enableTelemetry: "yes" })),
        fs,
      ).pipe(Effect.flip);

      expect(error._tag).toBe("InvalidGeneratorConfig");
      expect(fs.operations).toStrictEqual([]);
    }),
  );

  it.effect("reports which file could not be written", () =>
    Effect.gen(function* () {
      const fs = memoryFileSystem({
        denyWrite: (path) => path.endsWith("index.ts"),
      });
      const error = yield* run(generate(input({})), fs).pipe(Effect.flip);

      expect(error._tag).toBe("FileWriteError");
      expect(error).toMatchObject({ path: `${output}/index.ts` });
    }),
  );

  it.effect("keeps the unformatted file when formatting fails", () =>
    Effect.gen(function* () {
      const fs = memoryFileSystem();
      const failingFormatter = Layer.succeed(CodeFormatter, {
        format: (path) =>
          Effect.fail(new FormatError({ path, reason: "offline" })),
      });

      yield* run(generate(input({})), fs, failingFormatter);

      expect(fs.files.has(`${output}/index.ts`)).toBe(true);
    }),
  );
});
