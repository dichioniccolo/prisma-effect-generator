import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Console,
  Data,
  Effect,
  FileSystem,
  Option,
  Ref,
  Result,
  Stream,
} from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { availableParallelism } from "node:os";

class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string;
  readonly cwd: string | undefined;
  readonly exitCode: number;
}> {
  get message(): string {
    const where = this.cwd === undefined ? "" : ` in ${this.cwd}`;
    return `\`${this.command}\`${where} failed with exit code ${this.exitCode}`;
  }
}

class SuiteError extends Data.TaggedError("SuiteError")<{
  readonly suite: string;
  readonly reason: string;
}> {
  get message(): string {
    return `${this.suite}: ${this.reason}`;
  }
}

/** Appends a line to a suite's output, either live or into its buffer. */
type Logger = (line: string) => Effect.Effect<void>;

const runCommand = (
  cmd: string,
  args: ReadonlyArray<string>,
  cwd: string | undefined,
  log: Logger,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const line = `${cmd} ${args.join(" ")}`;

    yield* log(`${cwd === undefined ? "" : `[${cwd}] `}${line}`);

    const handle = yield* spawner.spawn(
      ChildProcess.make(cmd, [...args], {
        ...(cwd === undefined ? {} : { cwd }),
        extendEnv: true,
      }),
    );

    // Interleave stdout and stderr so the output reads like a terminal session.
    yield* handle.all.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.runForEach(log),
    );

    const exitCode = yield* handle.exitCode;

    if (exitCode !== ChildProcessSpawner.ExitCode(0)) {
      return yield* new CommandError({ command: line, cwd, exitCode });
    }
  }).pipe(Effect.scoped);

const typecheckGenerated = (dir: string, log: Logger) =>
  runCommand(
    "npx",
    [
      "tsc",
      "--noEmit",
      "--strict",
      "--exactOptionalPropertyTypes",
      "--noUncheckedIndexedAccess",
      "--noImplicitReturns",
      "--noFallthroughCasesInSwitch",
      "--noUnusedLocals",
      "--noUnusedParameters",
      "--moduleResolution",
      "NodeNext",
      "--module",
      "NodeNext",
      "--target",
      "ES2022",
      "--skipLibCheck",
      "--ignoreConfig",
      "generated/effect/index.ts",
    ],
    dir,
    log,
  );

interface Suite {
  readonly name: string;
  readonly dir: string;
  readonly banner: string;
  /** Whether the suite needs `prisma db push` before generating. */
  readonly dbPush: boolean;
  /** Extra database files to remove after the suite, relative to `dir`. */
  readonly extraDbFiles?: ReadonlyArray<string>;
}

const suites: ReadonlyArray<Suite> = [
  {
    name: "prisma7",
    dir: "tests/prisma7",
    banner: "Running Prisma 7 Tests",
    dbPush: true,
  },
  {
    name: "custom-error",
    dir: "tests/custom-error",
    banner: "Running Custom Error Tests",
    dbPush: true,
  },
  {
    name: "import-extension",
    dir: "tests/import-extension",
    banner: "Running Import Extension Tests",
    dbPush: true,
  },
  {
    name: "supports-many-and-return",
    dir: "tests/supports-many-and-return",
    banner: "Running supports-many-and-return tests",
    dbPush: false,
  },
  {
    name: "read-replicas",
    dir: "tests/read-replicas",
    banner: "Running Read Replicas tests",
    dbPush: true,
    extraDbFiles: [
      "primary.db",
      "replica1.db",
      "replica2.db",
      "replica-lifecycle.db",
    ],
  },
];

const suiteNames = suites.map((s) => s.name) as [string, ...Array<string>];

const runSuite = (suite: Suite, keepDb: boolean, log: Logger) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    yield* log(`\n=== ${suite.banner} ===\n`);

    yield* runCommand("pnpm", ["install"], suite.dir, log);

    if (suite.dbPush) {
      yield* runCommand(
        "pnpm",
        ["exec", "prisma", "db", "push"],
        suite.dir,
        log,
      );
    }
    yield* runCommand("pnpm", ["exec", "prisma", "generate"], suite.dir, log);

    yield* typecheckGenerated(suite.dir, log);
    yield* runCommand("pnpm", ["test"], suite.dir, log);

    if (!keepDb) {
      const dbFiles = ["dev.db", ...(suite.extraDbFiles ?? [])];
      yield* Effect.forEach(dbFiles, (file) =>
        fs.remove(`${suite.dir}/${file}`, { recursive: true, force: true }),
      );
    }
  }).pipe(
    Effect.mapError(
      (error) => new SuiteError({ suite: suite.dir, reason: error.message }),
    ),
  );

/**
 * Runs a suite, buffering its output when suites run concurrently so that
 * interleaved child process output stays readable.
 */
const runSuiteBuffered = (suite: Suite, keepDb: boolean, buffered: boolean) =>
  Effect.gen(function* () {
    if (!buffered) {
      return yield* runSuite(suite, keepDb, (line) => Console.log(line)).pipe(
        Effect.result,
      );
    }

    const output = yield* Ref.make<Array<string>>([]);
    const log: Logger = (line) =>
      Ref.update(output, (lines) => [...lines, line]);

    const result = yield* runSuite(suite, keepDb, log).pipe(Effect.result);

    yield* Effect.forEach(yield* Ref.get(output), (line) => Console.log(line));

    return result;
  });

const resolveConcurrency = (
  requested: Option.Option<number>,
  suiteCount: number,
): number =>
  Option.match(requested, {
    onSome: (n) => Math.max(1, n),
    onNone: () => Math.max(1, Math.min(suiteCount, availableParallelism())),
  });

const runTests = Command.make(
  "run-tests",
  {
    suite: Flag.choice("suite", suiteNames).pipe(
      Flag.withDescription(
        "Suite to run; repeat to select several (default: all)",
      ),
      Flag.atLeast(0),
    ),
    clean: Flag.boolean("clean").pipe(
      Flag.withDescription("Rebuild the generator and typecheck the scripts"),
      Flag.withDefault(false),
    ),
    keepDb: Flag.boolean("keep-db").pipe(
      Flag.withDescription("Keep the SQLite databases created by the suites"),
      Flag.withDefault(false),
    ),
    concurrency: Flag.integer("concurrency").pipe(
      Flag.withAlias("c"),
      Flag.withDescription(
        "How many suites to run at once (default: one per CPU, capped at the suite count)",
      ),
      Flag.optional,
    ),
  },
  Effect.fn(function* ({ clean, concurrency, keepDb, suite }) {
    const fs = yield* FileSystem.FileSystem;

    const selected =
      suite.length === 0
        ? suites
        : suites.filter((s) => suite.includes(s.name));

    if (clean || !(yield* fs.exists("dist"))) {
      yield* runCommand("pnpm", ["build"], undefined, Console.log);
    }

    if (clean) {
      yield* runCommand(
        "npx",
        ["tsc", "--noEmit", "--project", "tsconfig.test.json"],
        undefined,
        Console.log,
      );
    }

    const parallelism = resolveConcurrency(concurrency, selected.length);
    const buffered = parallelism > 1;

    if (buffered) {
      yield* Console.log(
        `Running ${selected.length} suites with concurrency ${parallelism}`,
      );
    }

    const results = yield* Effect.forEach(
      selected,
      (s) => runSuiteBuffered(s, keepDb, buffered),
      { concurrency: parallelism },
    );

    // Every suite runs to completion, so a failure reports all of them at once.
    const failures = results.flatMap((result) =>
      Result.isFailure(result) ? [result.failure] : [],
    );

    if (failures.length > 0) {
      yield* Console.error(`\n${failures.length} suite(s) failed:`);
      yield* Effect.forEach(failures, (error) =>
        Console.error(`  - ${error.message}`),
      );
      yield* Effect.sync(() => {
        process.exitCode = 1;
      });
    }
  }),
).pipe(Command.withDescription("Run the generator's integration test suites"));

const list = Command.make(
  "list",
  {},
  Effect.fn(function* () {
    yield* Effect.forEach(suites, (s) =>
      Console.log(`${s.name.padEnd(26)}${s.dir}`),
    );
  }),
).pipe(Command.withDescription("List the available test suites"));

runTests.pipe(
  Command.withSubcommands([list]),
  Command.run({ version: "2.0.0-rc.1" }),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
