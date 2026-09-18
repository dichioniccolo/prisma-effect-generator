#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { generatorHandler } from "@prisma/generator-helper";
import { Effect, Layer, Logger, References } from "effect";
import { formatGeneratorError } from "./errors.js";
import { CodeFormatter } from "./formatter.js";
import { generate } from "./generate.js";
import { OutputWriter } from "./output.js";

/**
 * Prisma speaks JSON-RPC over the generator's stderr and parses every line
 * written there, so logs go to stderr as plain logfmt: never JSON. Prisma
 * only shows them with DEBUG=prisma:GeneratorProcess, so debug logs can stay
 * on without adding noise to `prisma generate`.
 */
const StderrLogger = Layer.mergeAll(
  Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)]),
  Layer.succeed(References.MinimumLogLevel, "Debug"),
);

const GeneratorLive = Layer.mergeAll(
  OutputWriter.layer,
  CodeFormatter.biome,
  StderrLogger,
).pipe(Layer.provideMerge(NodeServices.layer));

generatorHandler({
  onManifest() {
    return {
      defaultOutput: "../generated/effect",
      prettyName: "Prisma Effect Generator",
      // No engines required - we only read the DMMF schema
      requiresEngines: [],
    };
  },

  // The only place Effect is run. Expected failures become a plain Error
  // whose message Prisma prints as is; defects are rethrown untouched, stack
  // and all, because they are bugs in this generator.
  onGenerate: (options) =>
    generate(options).pipe(
      Effect.mapError((error) => new Error(formatGeneratorError(error))),
      Effect.annotateLogs("generator", options.generator.name),
      Effect.provide(GeneratorLive),
      Effect.runPromise,
    ),
});
