import { Match, Schema } from "effect";
import { PlatformError } from "effect/PlatformError";

/** One invalid entry in the `generator` block of schema.prisma. */
export const OptionProblem = Schema.Struct({
  option: Schema.String,
  /** The value exactly as Prisma passed it to the generator. */
  received: Schema.Unknown,
  expected: Schema.String,
});

export type OptionProblem = typeof OptionProblem.Type;

/** The generator block contains values the generator cannot work with. */
export class InvalidGeneratorConfig extends Schema.TaggedError<InvalidGeneratorConfig>()(
  "InvalidGeneratorConfig",
  {
    generator: Schema.String,
    problems: Schema.Array(OptionProblem),
  },
) {}

/** The output directory could not be cleaned or created. */
export class OutputDirectoryError extends Schema.TaggedError<OutputDirectoryError>()(
  "OutputDirectoryError",
  {
    path: Schema.String,
    operation: Schema.Literals(["clean", "create"]),
    cause: Schema.instanceOf(PlatformError),
  },
) {}

/** A generated file could not be written. */
export class FileWriteError extends Schema.TaggedError<FileWriteError>()(
  "FileWriteError",
  {
    path: Schema.String,
    cause: Schema.instanceOf(PlatformError),
  },
) {}

/**
 * The generated code could not be formatted. Never fatal: the generator
 * leaves the file unformatted and logs a warning.
 */
export class FormatError extends Schema.TaggedError<FormatError>()(
  "FormatError",
  {
    path: Schema.String,
    reason: Schema.String,
  },
) {}

/** Every expected way `prisma generate` can fail because of this generator. */
export type GeneratorError =
  InvalidGeneratorConfig | OutputDirectoryError | FileWriteError;

/**
 * Renders an expected failure as the message `prisma generate` shows the
 * user. Exhaustive: adding a new error to {@link GeneratorError} is a type
 * error until it has a message here.
 */
export const formatGeneratorError = (error: GeneratorError): string =>
  Match.valueTags(error, {
    InvalidGeneratorConfig: ({ generator, problems }) =>
      [
        `Invalid options in generator "${generator}":`,
        // Mirrors the `option = value` syntax of schema.prisma.
        ...problems.flatMap(({ option, received, expected }) => [
          `  - ${option} = ${JSON.stringify(received)}`,
          `    ${expected}`,
        ]),
      ].join("\n"),
    OutputDirectoryError: ({ path, operation, cause }) =>
      `Could not ${operation} the output directory ${path}: ${cause.message}`,
    FileWriteError: ({ path, cause }) =>
      `Could not write ${path}: ${cause.message}`,
  });
