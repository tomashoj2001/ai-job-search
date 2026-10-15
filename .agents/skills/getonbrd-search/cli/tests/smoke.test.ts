// Live smoke tests against getonbrd.com (add-portal.md Step 3 contract).
// Kept to three network requests: one search, one detail, one 404 detail.
import { describe, expect, test } from "bun:test";
import { parseJSON, runCLI } from "./helpers";

interface SearchOutput {
  meta: { count: number; page: number; total_pages: number | null };
  results: Array<{
    id: string | null;
    title: string | null;
    company: string | null;
    location: string | null;
    date: string | null;
    url: string | null;
  }>;
}

interface DetailOutput {
  id: string;
  title: string;
  remote_policy: string | null;
  description: string | null;
}

describe("live search + detail", () => {
  let firstId: string | null = null;

  test('search -q "react" returns real results in the contract shape', async () => {
    const out = parseJSON<SearchOutput>(await runCLI(["search", "-q", "react", "--limit", "5"]));
    expect(out.meta.page).toBe(1);
    expect(out.meta.count).toBe(out.results.length);
    expect(out.results.length).toBeGreaterThanOrEqual(1);
    for (const r of out.results) {
      // Every contract key is present (missing values are null, never omitted).
      for (const key of ["id", "title", "company", "location", "date", "url"]) {
        expect(r).toHaveProperty(key);
      }
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.url).toMatch(/^https:\/\/www\.getonbrd\.com\/jobs\//);
      if (r.date !== null) expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    firstId = out.results[0].id;
  });

  test("detail on a slug from the live search returns a readable description", async () => {
    expect(firstId).toBeTruthy();
    const job = parseJSON<DetailOutput>(await runCLI(["detail", firstId!]));
    expect(job.id).toBe(firstId!);
    expect(job.title).not.toBe("(untitled)");
    expect(job.description).toBeTruthy();
    expect(job.description!.length).toBeGreaterThan(100);
    // Tags stripped, entities decoded, hidden watermarks removed.
    expect(job.description).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(job.description).not.toMatch(/&(amp|quot|lt|gt|nbsp|#\d+);/);
    expect(job.description).not.toMatch(/GETONBRD Job ID/);
    // The eligibility rule (who may apply) is always present on a live posting.
    expect(job.remote_policy).toBeTruthy();
  });

  test("detail on an unknown slug exits 1 with NOT_FOUND (no crash)", async () => {
    const result = await runCLI(["detail", "this-job-does-not-exist-zzz-123"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("NOT_FOUND");
  });
});
