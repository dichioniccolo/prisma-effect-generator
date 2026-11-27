---
"prisma-generator-effect": minor
---

The generated files are no longer formatted. `prisma generate` used to run `npx @biomejs/biome format --write` on every file it wrote, which cost an npx lookup on each run (about 3 s) and a full Biome download in a clean environment such as a Docker build. The generator now writes the files as rendered and starts no child process. The code itself is the same; only its layout changes (indentation, line breaks, quotes, semicolons and trailing commas). If you want the output formatted, run your own formatter on the output directory.
