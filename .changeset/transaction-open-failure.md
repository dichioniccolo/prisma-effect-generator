---
"prisma-generator-effect": patch
---

Fail `$transaction` with a typed error when the transaction cannot be opened (for example, when the database is down). The generated client used to leave the effect hanging and crash Node with an unhandled promise rejection. Errors the mapper does not recognize become defects, like other operations.
