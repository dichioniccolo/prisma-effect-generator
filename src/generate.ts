import type { GeneratorConfig } from "@prisma/generator-helper";
import { Effect, Option, Path, Schema } from "effect";
import { CodeFormatter } from "./formatter.js";
import {
  decodeGeneratorSettings,
  ErrorImport,
  type GeneratorSettings,
} from "./options.js";
import { GeneratedFile, OutputWriter } from "./output.js";
import { type Model, renderService } from "./templates.js";

/**
 * The parts of Prisma's `GeneratorOptions` the generator reads. Prisma's own
 * type satisfies it; tests can build one without a full DMMF.
 */
// crispen: kept as an interface — Prisma builds and types this object in
// process; decoding the DMMF through a schema would re-validate trusted data.
export interface GenerateInput {
  readonly generator: Pick<GeneratorConfig, "name" | "output" | "config">;
  readonly schemaPath: string;
  readonly datasources?: ReadonlyArray<{ readonly provider: string }>;
  readonly dmmf: {
    readonly datamodel: { readonly models: ReadonlyArray<Model> };
  };
}

/**
 * Datasources that support createManyAndReturn/updateManyAndReturn. Others
 * would get operations that fail to type-check.
 */
const ManyAndReturnProvider = Schema.Literals([
  "postgresql",
  "postgres",
  "prisma+postgres",
  "cockroachdb",
  "sqlite",
]);

/**
 * Rewrites a schema-relative error module so it can be imported from the
 * output directory. Package imports are left untouched. Pure: `path` only
 * computes, it never touches the disk.
 */
export const resolveErrorImport = (
  path: Path.Path,
  schemaDir: string,
  { errorImportPath, output, importFileExtension }: GeneratorSettings,
): Option.Option<ErrorImport> =>
  Option.map(errorImportPath, ({ module, exportName }) => {
    if (!module.startsWith(".")) return new ErrorImport({ module, exportName });

    const relative = path.relative(output, path.resolve(schemaDir, module));
    const normalized = relative.startsWith(".") ? relative : `./${relative}`;
    return new ErrorImport({
      module:
        importFileExtension && !path.extname(normalized)
          ? `${normalized}.${importFileExtension}`
          : normalized,
      exportName,
    });
  });

/** Everything the generator emits for a schema. Pure. */
export const renderFiles = (
  models: ReadonlyArray<Model>,
  settings: GeneratorSettings,
  customError: Option.Option<ErrorImport>,
  provider: string | undefined,
): ReadonlyArray<GeneratedFile> => [
  new GeneratedFile({
    path: "index.ts",
    content: renderService(models, {
      clientImportPath: settings.clientImportPath,
      customError,
      enableTelemetry: settings.enableTelemetry,
      supportsManyAndReturn: Schema.is(ManyAndReturnProvider)(provider),
    }),
  }),
];

/** Formats each file, downgrading failures to warnings as before. */
const formatFiles = Effect.fn("formatFiles")(function* (
  files: ReadonlyArray<string>,
) {
  const formatter = yield* CodeFormatter;
  yield* Effect.forEach(
    files,
    (file) =>
      formatter
        .format(file)
        .pipe(
          Effect.catchTag("FormatError", (error) =>
            Effect.logWarning(
              `Failed to format generated code with Biome: ${error.reason}`,
            ).pipe(Effect.annotateLogs("file", error.path)),
          ),
        ),
    { discard: true },
  );
});

/** The whole of `prisma generate` for this generator. */
export const generate = Effect.fn("generate")(function* (
  options: GenerateInput,
) {
  const path = yield* Path.Path;
  const settings = yield* decodeGeneratorSettings(options.generator);

  const files = renderFiles(
    options.dmmf.datamodel.models,
    settings,
    resolveErrorImport(path, path.dirname(options.schemaPath), settings),
    options.datasources?.[0]?.provider,
  );

  const writer = yield* OutputWriter;
  const written = yield* writer.write(settings.output, files);
  yield* formatFiles(written);

  yield* Effect.logInfo(
    `generated ${options.dmmf.datamodel.models.length} models into ${settings.output}`,
  );
}, Effect.withLogSpan("generate"));
