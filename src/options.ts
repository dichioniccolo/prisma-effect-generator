import type { GeneratorConfig } from "@prisma/generator-helper";
import {
  Effect,
  Match,
  Option,
  Schema,
  SchemaGetter,
  SchemaIssue,
} from "effect";
import { InvalidGeneratorConfig, OptionProblem } from "./errors.js";

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

/** A custom error class and the module that exports it with `mapPrismaError`. */
export class ErrorImport extends Schema.Class<ErrorImport>("ErrorImport")(
  {
    /** Relative to schema.prisma when it starts with ".", else a package. */
    module: Schema.NonEmptyString,
    exportName: Schema.NonEmptyString,
  },
  { description: "A custom error module, written module#ExportName." },
) {}

/** `"<module>#<ExportName>"`, or `""` for the built-in errors. */
const ErrorImportPath = Schema.String.check(
  Schema.isPattern(/^$|^[^#]+#[\p{L}_$][\p{L}\p{N}_$]*$/u, {
    expected:
      '"<module>#<ExportName>" with a single "#", e.g. "./errors#MyPrismaError"',
  }),
).pipe(
  Schema.decodeTo(Schema.Option(ErrorImport), {
    decode: SchemaGetter.transform((value) => {
      const [module = "", exportName = ""] = value.split("#");
      return value === "" ? Option.none() : Option.some({ module, exportName });
    }),
    encode: SchemaGetter.transform(
      Option.match({
        onNone: () => "",
        onSome: ({ module, exportName }) => `${module}#${exportName}`,
      }),
    ),
  }),
);

const ImportFileExtension = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9]*$/, {
    expected:
      'a file extension without the leading dot, e.g. "js" or "ts", or "" for none',
  }),
);

const EnableTelemetry = Schema.Literals(["true", "false"]).transform([
  true,
  false,
]);

/**
 * The generator's options, validated. Defaults match the README and the
 * behaviour of every previous release.
 */
export class GeneratorSettings extends Schema.Class<GeneratorSettings>(
  "GeneratorSettings",
)(
  {
    /** Absolute; Prisma resolves it, falling back to the manifest default. */
    output: Schema.NonEmptyString.annotate({ expected: "an output directory" }),
    clientImportPath: FirstValue.pipe(
      Schema.decodeTo(ClientImportPath),
      Schema.withDecodingDefault(Effect.succeed("@prisma/client")),
    ),
    // An empty value has always meant "use the built-in errors".
    errorImportPath: FirstValue.pipe(
      Schema.decodeTo(ErrorImportPath),
      Schema.withDecodingDefault(Effect.succeed("")),
    ),
    importFileExtension: FirstValue.pipe(
      Schema.decodeTo(ImportFileExtension),
      Schema.withDecodingDefault(Effect.succeed("")),
    ),
    enableTelemetry: FirstValue.pipe(
      Schema.decodeTo(EnableTelemetry),
      Schema.withDecodingDefault(Effect.succeed("false")),
    ),
  },
  { description: "The generator block of schema.prisma, validated." },
) {}

const formatIssue = SchemaIssue.makeFormatterDefault();

/** Flattens a decoding failure into one problem per offending option. */
const toProblems = (
  issue: SchemaIssue.Issue,
  input: Readonly<Record<string, unknown>>,
): ReadonlyArray<OptionProblem> =>
  Match.value(issue).pipe(
    // Decoding a class wraps its fields' issues in an Encoding step.
    Match.tag("Encoding", ({ issue: inner }) => toProblems(inner, input)),
    Match.tag("Composite", ({ issues }) =>
      issues.flatMap((inner) => toProblems(inner, input)),
    ),
    Match.tag("Pointer", ({ path: [key], issue: inner }) => [
      new OptionProblem({
        option: String(key),
        received: input[String(key)],
        expected: formatIssue(inner),
      }),
    ]),
    Match.orElse((other) => [
      new OptionProblem({
        option: "generator",
        received: input,
        expected: formatIssue(other),
      }),
    ]),
  );

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
