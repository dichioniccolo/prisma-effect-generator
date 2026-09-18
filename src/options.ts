import type { GeneratorConfig } from "@prisma/generator-helper";
import { Effect, Schema, SchemaGetter, SchemaIssue } from "effect";
import { InvalidGeneratorConfig, type OptionProblem } from "./errors.js";

/**
 * Prisma passes every option as a string, or as an array of strings when the
 * value is written as a list. Only the first entry has ever been honoured.
 */
const FirstValue = Schema.Union([
  Schema.String,
  Schema.NonEmptyArray(Schema.String),
]).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) =>
      typeof value === "string" ? value : value[0],
    ),
    encode: SchemaGetter.transform((value) => value),
  }),
);

const ClientImportPath = Schema.NonEmptyString.annotate({
  expected: 'a non-empty module specifier, e.g. "@prisma/client"',
});

/** A custom error module, as `"<module>#<ExportName>"` in the schema. */
export interface ErrorImport {
  /** Relative to schema.prisma when it starts with ".", else a package. */
  readonly module: string;
  readonly exportName: string;
}

// An empty value has always meant "use the built-in errors".
const ErrorImport = Schema.String.check(
  Schema.isPattern(/^$|^[^#]+#[\p{L}_$][\p{L}\p{N}_$]*$/u, {
    expected:
      '"<module>#<ExportName>" with a single "#", e.g. "./errors#MyPrismaError"',
  }),
).pipe(
  Schema.decodeTo(
    Schema.UndefinedOr(
      Schema.Struct({ module: Schema.String, exportName: Schema.String }),
    ),
    {
      decode: SchemaGetter.transform((value): ErrorImport | undefined => {
        if (value === "") return undefined;
        const [module = "", exportName = ""] = value.split("#");
        return { module, exportName };
      }),
      encode: SchemaGetter.transform((value) =>
        value === undefined ? "" : `${value.module}#${value.exportName}`,
      ),
    },
  ),
);

const ImportFileExtension = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9]*$/, {
    expected:
      'a file extension without the leading dot, e.g. "js" or "ts", or "" for none',
  }),
);

const EnableTelemetry = Schema.Literals(["true", "false"]).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform((value) => value === "true"),
    encode: SchemaGetter.transform((value) => (value ? "true" : "false")),
  }),
);

/**
 * The generator's options, validated. Defaults match the README and the
 * behaviour of every previous release.
 */
export const GeneratorSettings = Schema.Struct({
  /** Absolute; Prisma resolves it, falling back to the manifest default. */
  output: Schema.NonEmptyString.annotate({ expected: "an output directory" }),
  clientImportPath: FirstValue.pipe(
    Schema.decodeTo(ClientImportPath),
    Schema.withDecodingDefault(Effect.succeed("@prisma/client")),
  ),
  errorImportPath: Schema.optional(
    FirstValue.pipe(Schema.decodeTo(ErrorImport)),
  ),
  importFileExtension: FirstValue.pipe(
    Schema.decodeTo(ImportFileExtension),
    Schema.withDecodingDefault(Effect.succeed("")),
  ),
  enableTelemetry: FirstValue.pipe(
    Schema.decodeTo(EnableTelemetry),
    Schema.withDecodingDefault(Effect.succeed("false")),
  ),
});

export type GeneratorSettings = typeof GeneratorSettings.Type;

const formatIssue = SchemaIssue.makeFormatterDefault();

/** Flattens a decoding failure into one problem per offending option. */
const toProblems = (
  issue: SchemaIssue.Issue,
  input: Readonly<Record<string, unknown>>,
): ReadonlyArray<OptionProblem> => {
  switch (issue._tag) {
    case "Composite":
      return issue.issues.flatMap((inner) => toProblems(inner, input));
    case "Pointer": {
      const option = String(issue.path[0]);
      return [
        { option, received: input[option], expected: formatIssue(issue.issue) },
      ];
    }
    default:
      return [
        { option: "generator", received: input, expected: formatIssue(issue) },
      ];
  }
};

/**
 * Decodes the `generator` block of schema.prisma, reporting every invalid
 * option at once rather than stopping at the first.
 */
export const decodeGeneratorSettings = (
  generator: Pick<GeneratorConfig, "name" | "output" | "config">,
): Effect.Effect<GeneratorSettings, InvalidGeneratorConfig> => {
  const input = { ...generator.config, output: generator.output?.value };
  return Schema.decodeUnknownEffect(GeneratorSettings)(input, {
    errors: "all",
  }).pipe(
    Effect.mapError(
      (error) =>
        new InvalidGeneratorConfig({
          generator: generator.name,
          problems: toProblems(error.issue, input),
        }),
    ),
  );
};
