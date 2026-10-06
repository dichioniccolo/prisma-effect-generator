---
"prisma-generator-effect": minor
---

Reject unknown keys in model operation arguments at compile time. The generated service typed each argument as a bare `A extends Args`, so a key Prisma doesn't accept (`where: { id: 1, typo: 1 }`, an extra field in `data`, a missing relation in `select`) compiled and then failed at runtime with a Prisma validation error. Arguments now go through `Prisma.Exact` at every depth, and `select` combined with `include` or `omit` is a compile error.

Code that forwards a generic `<A extends Prisma.UserFindManyArgs>(args: A)` into the service no longer compiles. Type the wrapper's parameter as `Prisma.UserFindManyArgs` instead. See "Argument checking" in the README.
