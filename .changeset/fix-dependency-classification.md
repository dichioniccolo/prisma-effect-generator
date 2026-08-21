---
"prisma-generator-effect": patch
---

Fix dependency classification. `vitest`, `@effect/vitest` and `@effect/platform-node` were declared as runtime dependencies but are not imported anywhere in the generator, and `typescript` is only needed to build it. Installing this package therefore pulled a full test runner and compiler — along with `vite`, `postcss`, `nanoid` and `esbuild`, and every advisory open against them — into consumers' dependency trees. They are now dev-only, and production dependencies audit clean.

`effect` moves the other way: the generator imports it and so does the code it emits, but it was only a devDependency, so it was never actually declared as required.
