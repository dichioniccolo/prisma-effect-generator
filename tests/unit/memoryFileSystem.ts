import { Effect, FileSystem } from "effect";
import { systemError } from "effect/PlatformError";

/**
 * An in-memory FileSystem implementing only the three calls the generator
 * makes. Every other method is a no-op stub from FileSystem.layerNoop.
 */
export const memoryFileSystem = (
  options: { readonly denyWrite?: (path: string) => boolean } = {},
) => {
  const files = new Map<string, string>();
  const operations: Array<string> = [];

  const layer = FileSystem.layerNoop({
    remove: (path) =>
      Effect.sync(() => {
        operations.push(`remove ${path}`);
        for (const file of [...files.keys()]) {
          if (file.startsWith(`${path}/`)) files.delete(file);
        }
      }),
    makeDirectory: (path) =>
      Effect.sync(() => {
        operations.push(`mkdir ${path}`);
      }),
    writeFileString: (path, data) =>
      options.denyWrite?.(path)
        ? Effect.fail(
            systemError({
              _tag: "PermissionDenied",
              module: "FileSystem",
              method: "writeFileString",
              pathOrDescriptor: path,
            }),
          )
        : Effect.sync(() => {
            operations.push(`write ${path}`);
            files.set(path, data);
          }),
  });

  return { files, operations, layer };
};
