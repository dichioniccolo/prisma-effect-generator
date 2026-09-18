import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { ErrorImport } from "../../src/options.js";
import { renderService } from "../../src/templates.js";

const models = [{ name: "User" }, { name: "Post" }];

// The rendered module is pure output of (models, options); these snapshots
// pin it down so any change to the generated code shows up in review.
describe("renderService", () => {
  it("renders the built-in tagged errors with telemetry", async () => {
    const source = renderService(models, {
      clientImportPath: "@prisma/client",
      customError: Option.none(),
      enableTelemetry: true,
      supportsManyAndReturn: true,
    });

    await expect(source).toMatchFileSnapshot(
      "__snapshots__/default-errors.ts.snap",
    );
  });

  it("renders a custom error module without telemetry", async () => {
    const source = renderService(models, {
      clientImportPath: "@prisma/client",
      customError: Option.some(
        new ErrorImport({ module: "../../errors.mjs", exportName: "E" }),
      ),
      enableTelemetry: false,
      supportsManyAndReturn: true,
    });

    await expect(source).toMatchFileSnapshot(
      "__snapshots__/custom-error.ts.snap",
    );
  });

  it("omits the *AndReturn operations when the provider lacks them", () => {
    const source = renderService(models, {
      clientImportPath: "@prisma/client",
      customError: Option.none(),
      enableTelemetry: false,
      supportsManyAndReturn: false,
    });

    expect(source).not.toContain("AndReturn");
  });
});
