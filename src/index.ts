#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DMMF,
  GeneratorOptions,
  generatorHandler,
} from "@prisma/generator-helper";
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
    const outputDir = options.generator.output?.value;
    const schemaDir = path.dirname(options.schemaPath);

    const configPath = options.generator.config.clientImportPath;
    const clientImportPath = Array.isArray(configPath)
      ? configPath[0]
      : (configPath ?? "@prisma/client");

    // Custom error configuration: "path/to/module#ErrorClassName"
    // Path is relative to schema.prisma, e.g., "./errors#PrismaError"
    // The module must export:
    //   - The error class (e.g., `export class PrismaError extends ...`)
    //   - A mapper function named `mapPrismaError` with signature:
    //     `(error: unknown, operation: string, model: string) => YourErrorType`
    const errorConfigRaw = options.generator.config.errorImportPath;
    const errorImportPathRaw = Array.isArray(errorConfigRaw)
      ? errorConfigRaw[0]
      : errorConfigRaw;

    // Import file extension for generated imports (e.g., "js", "ts", or "" for no extension)
    // Useful for ESM compatibility where imports need explicit extensions
    const importExtConfigRaw = options.generator.config.importFileExtension;
    const importFileExtension = Array.isArray(importExtConfigRaw)
      ? importExtConfigRaw[0]
      : (importExtConfigRaw ?? "");

    // Telemetry configuration: enable Effect.fn tracing for all operations
    // Set to "true" to wrap operations with Effect.fn (adds operation names to traces)
    // Set to "false" to use Effect.fnUntraced (no telemetry overhead)
    const telemetryConfigRaw = options.generator.config.enableTelemetry;
    const enableTelemetry = Array.isArray(telemetryConfigRaw)
      ? telemetryConfigRaw[0] === "true"
      : telemetryConfigRaw === "true";

    if (!outputDir) {
      throw new Error("No output directory specified");
    }

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
      if (!importFileExtension) return filePath;
      // Don't add extension if path already has one
      const ext = path.extname(filePath);
      if (ext) return filePath;
      return `${filePath}.${importFileExtension}`;
    };

    // Convert errorImportPath from schema-relative to output-relative
    let errorImportPath: string | undefined;
    if (errorImportPathRaw) {
      const [modulePath, className] = errorImportPathRaw.split("#");
      if (!modulePath || !className) {
        throw new Error(
          `Invalid errorImportPath format: "${errorImportPathRaw}". Expected "path/to/module#ErrorClassName"`,
        );
      }

      // If it's a relative path, convert from schema-relative to output-relative
      if (modulePath.startsWith(".")) {
        const absoluteErrorPath = path.resolve(schemaDir, modulePath);
        const relativeToOutput = path.relative(outputDir, absoluteErrorPath);
        // Ensure it starts with ./ or ../
        const normalizedPath = relativeToOutput.startsWith(".")
          ? relativeToOutput
          : `./${relativeToOutput}`;
        // Add file extension if configured
        const pathWithExtension = addExtension(normalizedPath);
        errorImportPath = `${pathWithExtension}#${className}`;
      } else {
        // Package import (e.g., "@myorg/errors#PrismaError"), use as-is
        errorImportPath = errorImportPathRaw;
      }
    }

    // Clean output directory
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Generate unified index file with PrismaService
    await generateUnifiedService(
      [...models],
      outputDir,
      clientImportPath,
      errorImportPath,
      enableTelemetry,
      supportsManyAndReturn,
    );
  },
});

// Parse error import path like "./errors#PrismaError" into { path, className }
function parseErrorImportPath(
  errorImportPath: string | undefined,
): { path: string; className: string } | null {
  if (!errorImportPath) return null;
  const [path, className] = errorImportPath.split("#");
  if (!path || !className) {
    throw new Error(
      `Invalid errorImportPath format: "${errorImportPath}". Expected "path/to/module#ErrorClassName"`,
    );
  }
  return { path, className };
}

async function generateUnifiedService(
  models: DMMF.Model[],
  outputDir: string,
  clientImportPath: string,
  errorImportPath: string | undefined,
  enableTelemetry: boolean,
  supportsManyAndReturn: boolean,
) {
  const serviceContent = renderService(models, {
    clientImportPath,
    customError: parseErrorImportPath(errorImportPath),
    enableTelemetry,
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
    console.warn("Warning: Failed to format generated code with Biome:", error);
  }
}
