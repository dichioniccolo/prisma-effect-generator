---
"prisma-generator-effect": patch
---

Run the generator itself on Effect. The generated code is unchanged; what changes is how it is produced.

- Generator options are decoded with `Schema`. Invalid values now fail before anything is written, with one message listing every offending option, the value received and what was expected. Values that previously produced broken code or were silently ignored are now rejected: an empty `clientImportPath`, an `importFileExtension` with a leading dot, an `errorImportPath` with more than one `#` or an export name that is not an identifier, and an `enableTelemetry` other than `"true"`/`"false"`.
- File system access, path handling and Biome formatting sit behind services provided at the entry point, so the generator can be tested without touching the disk.
- Debug logs are written to stderr as logfmt and shown by `DEBUG=prisma:GeneratorProcess prisma generate`.

`@effect/platform-node` is a runtime dependency again: the generator now imports it to run on Node.
