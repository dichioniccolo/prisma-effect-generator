import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("supportsManyAndReturn flag (SQL Server)", () => {
  it("generated effect client should not have createManyAndReturn method", () => {
    const generatedPath = path.join(
      __dirname,
      "generated/effect/index.ts",
    );
    const generated = fs.readFileSync(generatedPath, "utf-8");
    expect(generated).not.toMatch(/createManyAndReturn\s*:/);
  });

  it("generated effect client should not have updateManyAndReturn method", () => {
    const generatedPath = path.join(
      __dirname,
      "generated/effect/index.ts",
    );
    const generated = fs.readFileSync(generatedPath, "utf-8");
    expect(generated).not.toMatch(/updateManyAndReturn\s*:/);
  });
});
