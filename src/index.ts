#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { GeneratorOptions, generatorHandler } from "@prisma/generator-helper";
import { Effect } from "effect";
import { formatGeneratorError } from "./errors.js";
import { decodeGeneratorSettings } from "./options.js";
import { renderService } from "./templates.js";

generatorHandler({
  onManifest() {
    return {
      defaultOutput: "../generated/effect",
      prettyName: "Prisma Effect Generator",
      // No engines required - we only read the DMMF schema
      requiresEngines: [],
    };
  },

  async onGenerate(options: GeneratorOptions) {
    const models = options.dmmf.datamodel.models;
    const schemaDir = path.dirname(options.schemaPath);

    const settings = await decodeGeneratorSettings(options.generator).pipe(
      Effect.mapError((error) => new Error(formatGeneratorError(error))),
      Effect.runPromise,
    );
    const outputDir = settings.output;

    // Get datasource provider (e.g., "sqlite", "postgresql", "mysql", etc.)
    // Used to avoid generating createManyAndReturn/updateManyAndReturn when the DB doesn't support them
    const datasources = (
      options as { datasources?: Array<{ provider?: string }> }
    ).datasources;
    const provider = datasources?.[0]?.provider;
    const supportsManyAndReturn =
      provider === "postgresql" ||
      provider === "postgres" ||
      provider === "prisma+postgres" ||
      provider === "cockroachdb" ||
      provider === "sqlite";

    // Helper to add file extension to a path if configured
    const addExtension = (filePath: string): string => {
      if (!settings.importFileExtension) return filePath;
      // Don't add extension if path already has one
      const ext = path.extname(filePath);
      if (ext) return filePath;
      return `${filePath}.${settings.importFileExtension}`;
    };

    // Convert errorImportPath from schema-relative to output-relative
    let customError: { path: string; className: string } | null = null;
    if (settings.errorImportPath) {
      const { module, exportName } = settings.errorImportPath;

      // If it's a relative path, convert from schema-relative to output-relative
      if (module.startsWith(".")) {
        const absoluteErrorPath = path.resolve(schemaDir, module);
        const relativeToOutput = path.relative(outputDir, absoluteErrorPath);
        // Ensure it starts with ./ or ../
        const normalizedPath = relativeToOutput.startsWith(".")
          ? relativeToOutput
          : `./${relativeToOutput}`;
        // Add file extension if configured
        customError = {
          path: addExtension(normalizedPath),
          className: exportName,
        };
      } else {
        // Package import (e.g., "@myorg/errors#PrismaError"), use as-is
        customError = { path: module, className: exportName };
      }
    }

    // Clean output directory
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });

    const serviceContent = renderService(models, {
      clientImportPath: settings.clientImportPath,
      customError,
      enableTelemetry: settings.enableTelemetry,
      supportsManyAndReturn,
    });

    const outputPath = path.join(outputDir, "index.ts");
    await fs.writeFile(outputPath, serviceContent);

    // Format the generated file with Biome
    try {
      execSync(`npx @biomejs/biome format --write "${outputPath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (error) {
      console.warn(
        "Warning: Failed to format generated code with Biome:",
        error,
      );
    }
  },
});
