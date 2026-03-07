import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Effect } from "effect";
import { Prisma, MyPrismaError } from "./generated/effect";
import { PrismaClient } from "./generated/client/client";
import * as fs from "fs";
import * as path from "path";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Test that the generated code has the correct import with .js extension
describe("Import File Extension", () => {
  describe("Generated import statements", () => {
    it("should generate error import with .js extension", () => {
      const generatedFile = fs.readFileSync(
        path.join(__dirname, "generated/effect/index.ts"),
        "utf-8",
      );

      // The import should have .js extension added by importFileExtension config
      // Path is ../../errors.js because generated/effect/ is 2 levels deep from root
      expect(generatedFile).toContain('from "../../errors.js"');
    });

    it("should not double-add extension if already present", () => {
      const generatedFile = fs.readFileSync(
        path.join(__dirname, "generated/effect/index.ts"),
        "utf-8",
      );

      // Should not have double extensions like .js.js
      expect(generatedFile).not.toContain(".js.js");
      expect(generatedFile).not.toContain(".ts.js");
    });
  });

  describe("Runtime functionality", () => {
    let prismaClient: PrismaClient;

    beforeAll(async () => {
      prismaClient = new PrismaClient({
        adapter: new PrismaLibSql({ url: "file:./dev.db" }),
      });
      await prismaClient.$connect();
    });

    afterAll(async () => {
      await prismaClient.user.deleteMany();
      await prismaClient.$disconnect();
    });

    it("should use the custom error type from the imported module", async () => {
      const program = Effect.gen(function* () {
        const prisma = yield* Prisma;

        // Create a user
        yield* prisma.user.create({
          data: { email: "test@example.com", name: "Test" },
        });

        // Try to create duplicate - should fail with MyPrismaError
        yield* prisma.user.create({
          data: { email: "test@example.com", name: "Duplicate" },
        });
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(
            Prisma.layer({
              adapter: new PrismaLibSql({ url: "file:./dev.db" }),
            }),
          ),
          Effect.as("success"),
          Effect.catchIf(
            () => true,
            (error) =>
              Effect.succeed(
                (error as { _tag?: string })._tag ?? "unknown-error-tag",
              ),
          ),
        ),
      );

      expect(result).toBe("MyPrismaError");
    });
  });
});
