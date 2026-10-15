// Offline unit tests: API mapping, location derivation, the client-side --jobage
// filter, slug parsing, the detail-page parser against a fixture modeled on the
// live markup (verified 2026-10-15), and detail's PARSE_ERROR on non-job pages.
// No network: fetch is mocked where used.
import { afterEach, describe, expect, test } from "bun:test";
import {
  JobParseError,
  apiGet,
  decodeHtmlEntities,
  deriveLocation,
  epochToDate,
  htmlToText,
  normalizeSlug,
  parseJobDetail,
  realCountries,
  removeWatermarks,
  toResult,
  type GobJob,
} from "../src/helpers";
import { buildUrl, filterByAge, runSearch } from "../src/commands/search";
import { runDetail } from "../src/commands/detail";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
});

function captureStream(stream: "stdout" | "stderr"): () => string {
  let out = "";
  process[stream].write = ((chunk: string | Uint8Array) => {
    out += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  return () => out;
}

const NOW_S = 1_760_500_000; // fixed "now" (epoch seconds) for age filtering

function apiJob(id: string, overrides: Partial<GobJob["attributes"]> = {}): GobJob {
  return {
    id,
    type: "job",
    links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
    attributes: {
      title: "Senior React Developer",
      published_at: NOW_S - 86400,
      remote: true,
      remote_modality: "remote_local",
      countries: ["Remote"],
      min_salary: 3000,
      max_salary: 4000,
      category_name: "Programming",
      lang: "en",
      applications_count: 42,
      seniority: { data: { id: "4", type: "seniority", attributes: { name: "Senior" } } },
      modality: { data: { id: "1", type: "modality", attributes: { name: "Full time" } } },
      company: { data: { id: 1, type: "company", attributes: { name: "Acme", country: "CL" } } },
      ...overrides,
    },
  };
}

describe("toResult", () => {
  test("maps an expanded API job into the contract shape", () => {
    const r = toResult(apiJob("senior-react-developer-acme-remote"));
    expect(r).toEqual({
      id: "senior-react-developer-acme-remote",
      title: "Senior React Developer",
      company: "Acme",
      location: "Remote (local)",
      date: epochToDate(NOW_S - 86400),
      url: "https://www.getonbrd.com/jobs/senior-react-developer-acme-remote",
      remote_modality: "remote_local",
      countries: [],
      salary_min: 3000,
      salary_max: 4000,
      seniority: "Senior",
      employment_type: "Full time",
      category: "Programming",
      lang: "en",
      company_country: "CL",
      applications: 42,
    });
  });

  test("missing values are null (never omitted) and unexpanded refs fall back to known names", () => {
    const r = toResult({
      id: "x",
      attributes: {
        published_at: null,
        lang: "lang_not_specified",
        seniority: { data: { id: 2, type: "seniority" } },
        modality: { data: { id: 3, type: "modality" } },
        company: { data: { id: 9, type: "company" } },
      },
    });
    expect(r.title).toBe("(untitled)");
    expect(r.company).toBeNull();
    expect(r.date).toBeNull();
    expect(r.location).toBeNull();
    expect(r.salary_min).toBeNull();
    expect(r.lang).toBeNull();
    expect(r.seniority).toBe("Junior");
    expect(r.employment_type).toBe("Freelance");
    expect(r.url).toBe("https://www.getonbrd.com/jobs/x");
  });
});

describe("location derivation", () => {
  test("drops the localized remote pseudo-country", () => {
    expect(realCountries(["Remote"])).toEqual([]);
    expect(realCountries(["Remoto"])).toEqual([]);
    expect(realCountries(["Chile", "Peru"])).toEqual(["Chile", "Peru"]);
  });

  test("maps each remote_modality to a readable location", () => {
    expect(deriveLocation("fully_remote", [])).toBe("Remote (fully)");
    expect(deriveLocation("remote_local", [])).toBe("Remote (local)");
    expect(deriveLocation("hybrid", ["Chile", "Peru"])).toBe("Hybrid - Chile, Peru");
    expect(deriveLocation("hybrid", [])).toBe("Hybrid");
    expect(deriveLocation("no_remote", ["Argentina"])).toBe("On-site - Argentina");
    expect(deriveLocation(null, ["Mexico"])).toBe("Mexico");
    expect(deriveLocation(null, [], true)).toBe("Remote");
    expect(deriveLocation(null, [])).toBeNull();
  });
});

describe("search request + client-side filters", () => {
  test("buildUrl maps flags to API params", () => {
    const url = new URL(buildUrl({ query: "react native", page: 2, format: "json", remote: true, country: "AR", lang: "es" }));
    expect(url.pathname).toBe("/api/v0/search/jobs");
    expect(url.searchParams.get("query")).toBe("react native");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("per_page")).toBe("50");
    expect(url.searchParams.get("remote")).toBe("true");
    expect(url.searchParams.get("country_code")).toBe("AR");
    expect(url.searchParams.get("lang")).toBe("es");
    expect(JSON.parse(url.searchParams.get("expand")!)).toEqual(["company", "seniority", "modality"]);
  });

  test("buildUrl omits unset filters", () => {
    const url = new URL(buildUrl({ page: 1, format: "json" }));
    for (const p of ["query", "remote", "country_code", "lang"]) expect(url.searchParams.has(p)).toBe(false);
  });

  test("filterByAge checks every row (country-filtered results are not strictly date-sorted)", () => {
    const jobs = [
      apiJob("new", { published_at: NOW_S - 2 * 86400 }),
      apiJob("old", { published_at: NOW_S - 30 * 86400 }),
      apiJob("newer-after-old", { published_at: NOW_S - 86400 }),
      apiJob("undated", { published_at: null }),
    ];
    expect(filterByAge(jobs, 14, NOW_S * 1000).map((j) => j.id)).toEqual(["new", "newer-after-old"]);
    expect(filterByAge(jobs, undefined, NOW_S * 1000)).toHaveLength(4);
  });

  test("runSearch applies --jobage then --limit and reports fetched rows in meta", async () => {
    const data = [
      apiJob("a", { published_at: NOW_S - 86400 }),
      apiJob("b", { published_at: NOW_S - 40 * 86400 }),
      apiJob("c", { published_at: NOW_S - 2 * 86400 }),
      apiJob("d", { published_at: NOW_S - 3 * 86400 }),
    ];
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data, meta: { page: 1, per_page: 50, total_pages: 3 } }))) as unknown as typeof fetch;
    const out = captureStream("stdout");
    const code = await runSearch({ page: 1, format: "json", jobage: 7, limit: 2, now: NOW_S * 1000 });
    expect(code).toBe(0);
    const parsed = JSON.parse(out());
    expect(parsed.meta).toEqual({ count: 2, page: 1, total_pages: 3, per_page: 50, fetched: 4 });
    expect(parsed.results.map((r: { id: string }) => r.id)).toEqual(["a", "c"]);
  });

  test("runSearch reports a 404 from the search endpoint as an error, not empty results", async () => {
    globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const err = captureStream("stderr");
    captureStream("stdout");
    const code = await runSearch({ page: 1, format: "json" });
    expect(code).toBe(1);
    expect(JSON.parse(err()).code).toBe("SEARCH_FAILED");
  });
});

describe("apiGet backoff", () => {
  test("retries a 429 and then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return calls === 1
        ? new Response("", { status: 429 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await apiGet<{ ok: boolean }>("https://www.getonbrd.com/api/v0/search/jobs")).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  test("returns null on 404", async () => {
    globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    expect(await apiGet("https://www.getonbrd.com/api/v0/search/jobs")).toBeNull();
  });
});

describe("normalizeSlug", () => {
  const slug = "senior-full-stack-engineer-worthy-remote";
  test("accepts a bare slug and every job URL shape", () => {
    expect(normalizeSlug(slug)).toBe(slug);
    expect(normalizeSlug(`https://www.getonbrd.com/jobs/${slug}`)).toBe(slug);
    expect(normalizeSlug(`https://www.getonbrd.com/jobs/programming/${slug}`)).toBe(slug);
    expect(normalizeSlug(`https://www.getonbrd.com/jobs/${slug}/applications/new`)).toBe(slug);
    expect(normalizeSlug(`https://www.getonbrd.com/jobs/${slug}?utm_source=x#apply`)).toBe(slug);
  });
  test("rejects non-job input", () => {
    expect(normalizeSlug("")).toBeNull();
    expect(normalizeSlug("https://example.com/foo")).toBeNull();
    expect(normalizeSlug("not a slug")).toBeNull();
  });
});

describe("text helpers", () => {
  test("decodes named, decimal and hex entities", () => {
    expect(decodeHtmlEntities("a &amp; b &mdash; &aacute;rea &#233; &#x1F600; &unknown;")).toBe("a & b — área é 😀 &unknown;");
  });

  test("htmlToText keeps paragraphs and turns list items into tight bullets", () => {
    expect(htmlToText("<p>Intro</p><ul><li><p>One</p></li><li><p>Two</p></li></ul><p>End&nbsp;&amp; done</p>")).toBe(
      "Intro\n\n- One\n- Two\n\nEnd & done",
    );
  });

  test("removeWatermarks drops paragraphs hidden by the page's style rule", () => {
    const page = `<style>\n  .u8c81c00d, .x37fd5835 {\n    position: fixed;\n    top: 100%;\n  }\n</style>`;
    const body = `<p>Real text</p><p class="u8c81c00d">Apply without intermediaries through Get on Board.</p><p class="x37fd5835">GETONBRD Job ID: 64054</p><p class="size0">Kept</p>`;
    expect(removeWatermarks(body, page)).toBe("<p>Real text</p><p class=\"size0\">Kept</p>");
  });
});

// Trimmed from a live job page (structure, attributes and nesting preserved).
const DETAIL_FIXTURE = `<!DOCTYPE html><html lang="en"><head><title>Senior Full-Stack Engineer at Worthy - Mexico | Get on Board</title></head><body>
<div class="my2 flex items-center" itemprop="hiringOrganization" itemscope itemtype="http://schema.org/Organization">
<div><h3 class="size1 m0"><a class="tooltipster" title="About" href="https://www.getonbrd.com/companies/worthy"><strong itemprop="name">Worthy</strong>
</a><span class="hide" itemprop="url">https://www.getonbrd.com/companies/worthy</span></h3></div></div>
<div class="fake-hidden">
<time datetime="2026-10-03T20:50:24+00:00" itemprop="datePosted"></time>
</div>
<h1 class="gb-landing-cover__title size5 mb1">
<span itemprop="title">
Senior Full-Stack Engineer
</span>
<span class="fake-hidden size-3">in Worthy</span>
</h1>
<div class="m0">
<span class="hide" itemprop="employmentType">FULL_TIME</span>
<h2 class="size1 mb-3 font-normal lh3 mb-3">
<span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
<span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
<span class="location">
<span class="tooltipster" title="Position is 100% remote, but candidates must reside in Mexico.">
<i class="icon icon-wifi"></i>
Remote
(Mexico)
</span>
</span>
</span>
</span>
<span class="mx-3">|</span>
<span itemprop="qualifications">
Senior
</span>
<span class="mx-3">|</span>
Full time
<span class="mx-3">|</span>
<a class="color-inherit" href="/jobs/programming">Programming</a>
</h2>
</div>
<h3 class="size1 mb-3 mt-3">
<span itemprop="baseSalary" itemscope itemtype="http://schema.org/MonetaryAmount">
<span><strong>$6000 - 8000</strong> USD/month</span>
<span itemprop="value" itemscope itemtype="http://schema.org/QuantitativeValue">
<span content="6000" itemprop="minValue"></span>
<span content="8000" itemprop="maxValue"></span>
<span content="MONTH" itemprop="unitText"></span>
</span>
<span content="USD" itemprop="currency"></span>
</span>
</h3>
<div class="size0 mt1">
<i class="icon mr-3 icon-fire"></i>
210
applications
</div>
<a class="gb-btn" id="apply_bottom" href="https://www.getonbrd.com/jobs/senior-full-stack-engineer-worthy-remote/applications/new">Apply now</a>
<div class="mt1">ⓘ <span class="size0">Requires applying in English</span></div>
<div id="job-body" itemprop="description">
<div class="gb-landing-section pb0">
<div class="gb-container gb-container--medium">
<div class="mb4">
<div class="gb-rich-txt y4a36b733">
<p>We&rsquo;re hiring a Senior Full Stack Engineer &mdash; end to end.</p>
<p class="u8c81c00d">Apply without intermediaries through Get on Board.</p>
</div>
</div>
<div class="mb4">
<h3 class="font-black mb2">Job functions</h3>
<div class="gb-rich-txt k5a6f8e15">
<ul><li>Ship features across the stack</li><li>Build agents &amp; tooling</li></ul>
</div>
</div>
<p class="x37fd5835">GETONBRD Job ID: 64054</p>
<h2>Remote work policy</h2>
<p>
<strong class="size1">
<i class="icon color-hierarchy2 icon-location"></i>
Locally remote only
</strong>
</p>
<p class="size0 font-normal block mt-3 color-hierarchy2">
Position is 100% remote, but candidates must reside in North America, South America or Central America.
</p>
</div>
</div>
</div>
<div class="gb-tags" itemprop="skills">
<a class="gb-tags__item" title="Jobs in React Native" href="/jobs/tag/react-native">React Native
</a><a class="gb-tags__item" title="Jobs in Next.js" href="/jobs/tag/next-js">Next.js
</a></div>
<style>
  .u8c81c00d, .x37fd5835 {
    position: fixed;
    top: 100%;
  }
</style>
</body></html>`;

describe("parseJobDetail", () => {
  const job = parseJobDetail(
    DETAIL_FIXTURE,
    "senior-full-stack-engineer-worthy-remote",
    "https://www.getonbrd.com/jobs/programming/senior-full-stack-engineer-worthy-remote",
  );

  test("extracts header fields from the schema.org microdata", () => {
    expect(job.title).toBe("Senior Full-Stack Engineer");
    expect(job.company).toBe("Worthy");
    expect(job.date).toBe("2026-10-03");
    expect(job.location).toBe("Remote (Mexico)");
    expect(job.seniority).toBe("Senior");
    expect(job.employment_type).toBe("Full time");
    expect(job.category).toBe("Programming");
    expect(job.url).toBe("https://www.getonbrd.com/jobs/programming/senior-full-stack-engineer-worthy-remote");
  });

  test("extracts salary, skills, applications and apply info", () => {
    expect(job.salary_min).toBe(6000);
    expect(job.salary_max).toBe(8000);
    expect(job.salary).toBe("USD 6000-8000/month");
    expect(job.skills).toEqual(["React Native", "Next.js"]);
    expect(job.applications).toBe(210);
    expect(job.application_language).toBe("English");
    expect(job.apply_url).toBe("https://www.getonbrd.com/jobs/senior-full-stack-engineer-worthy-remote/applications/new");
  });

  test("the remote policy section is authoritative over the header tooltip", () => {
    expect(job.remote_modality).toBe("remote_local");
    expect(job.remote_policy).toBe(
      "Locally remote only: Position is 100% remote, but candidates must reside in North America, South America or Central America.",
    );
  });

  test("description is readable text without watermarks or the policy section", () => {
    expect(job.description).toBe(
      "We’re hiring a Senior Full Stack Engineer — end to end.\n\nJob functions\n\n- Ship features across the stack\n- Build agents & tooling",
    );
  });

  test("a page without the policy section falls back to the header tooltip", () => {
    const noPolicy = DETAIL_FIXTURE.replace(/<h2>Remote work policy<\/h2>[\s\S]*?<\/p>\s*<p[^>]*>[\s\S]*?<\/p>/, "");
    const j = parseJobDetail(noPolicy, "x");
    expect(j.remote_policy).toBe("Position is 100% remote, but candidates must reside in Mexico.");
    expect(j.remote_modality).toBeNull();
  });
});

// A 200 page that is not a job posting: the jobs index (live <title> text, verified
// 2026-10-15). Its <title> matches the parser's title fallback, so it must not count.
const JOBS_INDEX_PAGE = `<!DOCTYPE html><html lang="en"><head><title>Curated tech jobs in Latin America | Get on Board</title></head><body>
<h1 class="size5">Curated tech jobs in Latin America</h1>
<ul class="sgb-results-list"><li><a href="/jobs/programming/senior-react-developer-acme-remote">Senior React Developer</a></li></ul>
</body></html>`;

// A bare page with neither a title nor any job markup (e.g. a login wall).
const BARE_PAGE = `<!DOCTYPE html><html lang="en"><head><title>Get on Board</title></head><body><form action="/users/sign_in"></form></body></html>`;

describe("parseJobDetail rejects pages that are not job postings", () => {
  for (const [name, html] of [["the jobs index", JOBS_INDEX_PAGE], ["a bare login-style page", BARE_PAGE]] as const) {
    test(`${name} throws JobParseError with code PARSE_ERROR`, () => {
      let caught: unknown;
      try {
        parseJobDetail(html, "senior-react-developer-acme-remote", "https://www.getonbrd.com/jobs");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(JobParseError);
      expect((caught as JobParseError).code).toBe("PARSE_ERROR");
      expect((caught as JobParseError).message).toContain("https://www.getonbrd.com/jobs");
    });
  }

  test("the valid job fixture still parses", () => {
    expect(() => parseJobDetail(DETAIL_FIXTURE, "senior-full-stack-engineer-worthy-remote")).not.toThrow();
  });

  test("a posting missing its job body still parses (the microdata title is enough)", () => {
    const noBody = DETAIL_FIXTURE.replace(/<div id="job-body"/, '<div id="removed-body"');
    const j = parseJobDetail(noBody, "x");
    expect(j.title).toBe("Senior Full-Stack Engineer");
    expect(j.description).toBeNull();
  });

  test("a posting missing its microdata title still parses (the job body is enough)", () => {
    const noTitle = DETAIL_FIXTURE.replace(/itemprop="title"/, 'data-x="title"');
    const j = parseJobDetail(noTitle, "x");
    expect(j.title).toBe("Senior Full-Stack Engineer");
    expect(j.description).toContain("Ship features across the stack");
  });
});

describe("runDetail", () => {
  function servePage(html: string): void {
    globalThis.fetch = (async () =>
      new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch;
  }

  test("a 200 non-job page exits 1 with PARSE_ERROR JSON on stderr and nothing on stdout", async () => {
    servePage(JOBS_INDEX_PAGE);
    const err = captureStream("stderr");
    const out = captureStream("stdout");
    const code = await runDetail({ id: "senior-react-developer-acme-remote", format: "json" });
    expect(code).toBe(1);
    expect(out()).toBe("");
    const parsed = JSON.parse(err());
    expect(Object.keys(parsed).sort()).toEqual(["code", "error"]);
    expect(parsed.code).toBe("PARSE_ERROR");
    expect(parsed.error).toMatch(/did not parse as a Get on Board job posting/);
  });

  test("a valid job page exits 0 with the parsed record on stdout", async () => {
    servePage(DETAIL_FIXTURE);
    const err = captureStream("stderr");
    const out = captureStream("stdout");
    const code = await runDetail({ id: "senior-full-stack-engineer-worthy-remote", format: "json" });
    expect(code).toBe(0);
    expect(err()).toBe("");
    const job = JSON.parse(out());
    expect(job.id).toBe("senior-full-stack-engineer-worthy-remote");
    expect(job.title).toBe("Senior Full-Stack Engineer");
    expect(job.company).toBe("Worthy");
  });
});
