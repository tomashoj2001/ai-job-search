// Flag validation exits before any request is made, so these tests are network-free.
import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

function stderrJSON(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr);
  } catch {
    return {};
  }
}

async function expectError(args: string[], code: string, mention?: RegExp): Promise<void> {
  const result = await runCLI(args);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  const err = stderrJSON(result.stderr);
  expect(err.code).toBe(code);
  if (mention) expect(err.error).toMatch(mention);
}

describe("unknown flags and commands", () => {
  test("a bogus flag exits 1 with UNKNOWN_FLAG JSON on stderr", async () => {
    await expectError(["search", "-q", "react", "--bogus-flag", "xyz"], "UNKNOWN_FLAG", /--bogus-flag/);
  });

  test("linkedin-style --location is rejected, not silently ignored", async () => {
    await expectError(["search", "-q", "react", "--location", "Remote"], "UNKNOWN_FLAG", /--location/);
  });

  test("an unknown command exits 1 with BAD_CMD", async () => {
    await expectError(["searhc"], "BAD_CMD");
  });

  test("detail without an id exits 1 with NO_ID", async () => {
    await expectError(["detail"], "NO_ID");
  });

  test("detail with an unparseable id exits 1 with BAD_ID", async () => {
    await expectError(["detail", "https://example.com/not-a-job"], "BAD_ID");
  });
});

describe("numeric flags", () => {
  for (const name of ["jobage", "page", "limit"]) {
    test(`--${name} non-numeric exits 1 with BAD_ARG`, async () => {
      await expectError(["search", "-q", "react", `--${name}`, "abc"], "BAD_ARG", new RegExp(name));
    });
    test(`--${name} fractional is rejected, not truncated`, async () => {
      await expectError(["search", "-q", "react", `--${name}`, "1.5"], "BAD_ARG", new RegExp(name));
    });
    test(`--${name} 0 exits 1 with BAD_ARG`, async () => {
      await expectError(["search", "-q", "react", `--${name}`, "0"], "BAD_ARG", new RegExp(name));
    });
  }
});

describe("value flags", () => {
  test("--country must be ISO-3166 alpha-2", async () => {
    await expectError(["search", "--country", "Argentina"], "BAD_ARG", /--country/);
  });

  test("--lang must be en|es|pt", async () => {
    await expectError(["search", "--lang", "fr"], "BAD_ARG", /--lang/);
  });

  test("--remote rejects a stray value such as linkedin-search's 'remote'", async () => {
    await expectError(["search", "--remote", "remote"], "BAD_ARG", /--remote/);
  });

  test("--format must be json|table|plain", async () => {
    await expectError(["search", "-q", "react", "--format", "csv"], "BAD_ARG", /--format/);
  });

  test("--query with no value exits 1 with BAD_ARG", async () => {
    await expectError(["search", "-q"], "BAD_ARG", /--query/);
  });

  test("a positional keyword is rejected with a pointer to --query", async () => {
    await expectError(["search", "react"], "BAD_ARG", /--query/);
  });
});

describe("help", () => {
  test("search --help prints usage and exits 0", async () => {
    const result = await runCLI(["search", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE");
    expect(result.stdout).toContain("CLIENT-SIDE");
  });
});
