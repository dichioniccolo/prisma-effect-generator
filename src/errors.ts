import { Match, Schema } from "effect";

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

/** Every expected way `prisma generate` can fail because of this generator. */
export type GeneratorError = InvalidGeneratorConfig;

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
  });
