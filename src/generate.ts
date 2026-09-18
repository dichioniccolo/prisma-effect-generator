import type { GeneratorConfig } from "@prisma/generator-helper";
import { Effect, Path } from "effect";
import { CodeFormatter } from "./formatter.js";
import {
  decodeGeneratorSettings,
  type ErrorImport,
  type GeneratorSettings,
} from "./options.js";
import { type GeneratedFile, OutputWriter } from "./output.js";
import {
  type CustomErrorConfig,
  type Model,
  renderService,
} from "./templates.js";

/**
 * The parts of Prisma's `GeneratorOptions` the generator reads. Prisma's own
 * type satisfies it; tests can build one without a full DMMF.
 */
export interface GenerateInput {
  readonly generator: Pick<GeneratorConfig, "name" | "output" | "config">;
  readonly schemaPath: string;
  readonly datasources?: ReadonlyArray<{ readonly provider: string }>;
  readonly dmmf: {
    readonly datamodel: { readonly models: ReadonlyArray<Model> };
  };
}

/**
 * Whether the datasource supports createManyAndReturn/updateManyAndReturn.
 * Providers that don't would get operations that fail to type-check.
 */
export const supportsManyAndReturn = (provider: string | undefined): boolean =>
  provider === "postgresql" ||
  provider === "postgres" ||
  provider === "prisma+postgres" ||
  provider === "cockroachdb" ||
  provider === "sqlite";

/**
 * Rewrites a schema-relative error module so it can be imported from the
 * output directory. Package imports are left untouched. Pure: `path` only
 * computes, it never touches the disk.
 */
export const resolveErrorImport = (
  path: Path.Path,
  { module, exportName }: ErrorImport,
  {
    schemaDir,
    outputDir,
    importFileExtension,
  }: {
    readonly schemaDir: string;
    readonly outputDir: string;
    readonly importFileExtension: string;
  },
): NonNullable<CustomErrorConfig> => {
  if (!module.startsWith(".")) return { path: module, className: exportName };

  const relative = path.relative(outputDir, path.resolve(schemaDir, module));
  const normalized = relative.startsWith(".") ? relative : `./${relative}`;
  const withExtension =
    importFileExtension && !path.extname(normalized)
      ? `${normalized}.${importFileExtension}`
      : normalized;
  return { path: withExtension, className: exportName };
};

/** Everything the generator emits for a schema. Pure. */
export const renderFiles = (
  models: ReadonlyArray<Model>,
  settings: GeneratorSettings,
  customError: CustomErrorConfig,
  provider: string | undefined,
): ReadonlyArray<GeneratedFile> => [
  {
    path: "index.ts",
    content: renderService(models, {
      clientImportPath: settings.clientImportPath,
      customError,
      enableTelemetry: settings.enableTelemetry,
      supportsManyAndReturn: supportsManyAndReturn(provider),
    }),
  },
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

  const customError =
    settings.errorImportPath === undefined
      ? null
      : resolveErrorImport(path, settings.errorImportPath, {
          schemaDir: path.dirname(options.schemaPath),
          outputDir: settings.output,
          importFileExtension: settings.importFileExtension,
        });

  const files = renderFiles(
    options.dmmf.datamodel.models,
    settings,
    customError,
    options.datasources?.[0]?.provider,
  );

  const writer = yield* OutputWriter;
  const written = yield* writer.write(settings.output, files);
  yield* formatFiles(written);

  yield* Effect.logInfo(
    `generated ${options.dmmf.datamodel.models.length} models into ${settings.output}`,
  );
}, Effect.withLogSpan("generate"));
