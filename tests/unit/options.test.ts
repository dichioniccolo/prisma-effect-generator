import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import type { GeneratorConfig } from "@prisma/generator-helper";
import { formatGeneratorError } from "../../src/errors.js";
import {
  decodeGeneratorSettings,
  ErrorImport,
  GeneratorSettings,
} from "../../src/options.js";

const generator = (
  config: GeneratorConfig["config"],
): Pick<GeneratorConfig, "name" | "output" | "config"> => ({
  name: "effect",
  output: { value: "/project/generated/effect", fromEnvVar: null },
  config,
});

const decode = (config: GeneratorConfig["config"]) =>
  decodeGeneratorSettings(generator(config));

/** The message `prisma generate` would print for this config. */
const failure = (config: GeneratorConfig["config"]) =>
  decode(config).pipe(Effect.flip, Effect.map(formatGeneratorError));

describe("decodeGeneratorSettings", () => {
  it.effect("applies the documented defaults", () =>
    Effect.gen(function* () {
      expect(yield* decode({})).toStrictEqual(
        new GeneratorSettings({
          output: "/project/generated/effect",
          clientImportPath: "@prisma/client",
          errorImportPath: Option.none(),
          importFileExtension: "",
          enableTelemetry: false,
        }),
      );
    }),
  );

  it.effect("decodes every option", () =>
    Effect.gen(function* () {
      expect(
        yield* decode({
          clientImportPath: "../client/client.js",
          errorImportPath: "./errors#MyPrismaError",
          importFileExtension: "js",
          enableTelemetry: "true",
        }),
      ).toStrictEqual(
        new GeneratorSettings({
          output: "/project/generated/effect",
          clientImportPath: "../client/client.js",
          errorImportPath: Option.some(
            new ErrorImport({
              module: "./errors",
              exportName: "MyPrismaError",
            }),
          ),
          importFileExtension: "js",
          enableTelemetry: true,
        }),
      );
    }),
  );

  it.effect("encodes back to the values it decoded", () =>
    Effect.gen(function* () {
      const config = {
        clientImportPath: "../client/client.js",
        errorImportPath: "./errors#MyPrismaError",
        importFileExtension: "js",
        enableTelemetry: "true",
      };
      const settings = yield* decode(config);
      expect(
        yield* Schema.encodeEffect(GeneratorSettings)(settings),
      ).toStrictEqual({ ...config, output: "/project/generated/effect" });
    }),
  );

  it.effect("keeps the first entry of a list value", () =>
    Effect.gen(function* () {
      const settings = yield* decode({ clientImportPath: ["./a", "./b"] });
      expect(settings.clientImportPath).toBe("./a");
    }),
  );

  it.effect("still accepts values earlier releases accepted", () =>
    Effect.gen(function* () {
      const settings = yield* decode({
        errorImportPath: "",
        importFileExtension: "mjs",
      });
      expect(settings.errorImportPath).toStrictEqual(Option.none());
      expect(settings.importFileExtension).toBe("mjs");
    }),
  );

  it.effect("accepts a package as the error module", () =>
    Effect.gen(function* () {
      const settings = yield* decode({
        errorImportPath: "@acme/errors#DbError",
      });
      expect(settings.errorImportPath).toStrictEqual(
        Option.some(
          new ErrorImport({ module: "@acme/errors", exportName: "DbError" }),
        ),
      );
    }),
  );

  it.effect("rejects an error module without an export name", () =>
    Effect.gen(function* () {
      expect(yield* failure({ errorImportPath: "./errors" }))
        .toMatchInlineSnapshot(`
        "Invalid options in generator "effect":
          - errorImportPath = "./errors"
            Expected "<module>#<ExportName>" with a single "#", e.g. "./errors#MyPrismaError""
      `);
    }),
  );

  it.effect("rejects an export name that is not an identifier", () =>
    Effect.gen(function* () {
      expect(
        yield* failure({ errorImportPath: "./errors#My-Error" }),
      ).toContain(`errorImportPath = "./errors#My-Error"`);
      expect(yield* failure({ errorImportPath: "./a#B#C" })).toContain(
        `errorImportPath = "./a#B#C"`,
      );
    }),
  );

  it.effect("reports every invalid option at once", () =>
    Effect.gen(function* () {
      expect(
        yield* failure({
          clientImportPath: "",
          importFileExtension: ".js",
          enableTelemetry: "yes",
        }),
      ).toMatchInlineSnapshot(`
        "Invalid options in generator "effect":
          - clientImportPath = ""
            Expected a non-empty module specifier, e.g. "@prisma/client"
          - importFileExtension = ".js"
            Expected a file extension without the leading dot, e.g. "js" or "ts", or "" for none
          - enableTelemetry = "yes"
            Expected "true" | "false""
      `);
    }),
  );
});
