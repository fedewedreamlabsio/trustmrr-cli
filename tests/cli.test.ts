import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { buildProgram } from "../src/index.js";
import { makeListResponse, makeStartup } from "./fixtures.js";

function createCaptureStream() {
  let data = "";

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      data += String(chunk);
      callback();
    },
  });

  return {
    stream,
    get value() {
      return data;
    },
  };
}

function withMrr(mrr: number | null) {
  return {
    last30Days: mrr,
    mrr,
    total: mrr,
  };
}

describe("CLI parsing", () => {
  it("routes unfiltered top command arguments to the API client", async () => {
    const stdout = createCaptureStream();
    const stderr = createCaptureStream();
    const client = {
      listStartups: vi.fn().mockResolvedValue(makeListResponse(makeStartup())),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn(),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    await program.parseAsync(["node", "trustmrr", "top", "3"], { from: "node" });

    expect(client.listStartups).toHaveBeenCalledWith({
      limit: 3,
      sort: "mrr",
      order: "desc",
    });
    expect(stdout.value).toContain("Stan");
    expect(stderr.value).toBe("");
  });

  it("prints raw json when requested", async () => {
    const stdout = createCaptureStream();
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: [makeStartup()],
        total: 1,
        isPartial: false,
      }),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: createCaptureStream().stream,
    });

    await program.parseAsync(["node", "trustmrr", "--json", "search", "creator"], {
      from: "node",
    });

    expect(stdout.value).toContain('"slug": "stan"');
  });

  it("applies global filters for top client-side", async () => {
    const stdout = createCaptureStream();
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: [
          makeStartup({
            name: "Stan",
            slug: "stan",
            country: "US",
            revenue: withMrr(4_000),
          }),
          makeStartup({
            name: "Beehiiv",
            slug: "beehiiv",
            country: "CA",
            revenue: withMrr(6_000),
          }),
          makeStartup({
            name: "Loops",
            slug: "loops",
            country: "US",
            revenue: withMrr(2_000),
          }),
        ],
        total: 3,
        isPartial: false,
      }),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: createCaptureStream().stream,
    });

    await program.parseAsync(
      ["node", "trustmrr", "--json", "--country", "us", "--min-mrr", "3000", "top", "3"],
      { from: "node" },
    );

    expect(client.listStartups).not.toHaveBeenCalled();
    expect(client.scanStartups).toHaveBeenCalledWith(200);
    expect(JSON.parse(stdout.value)).toMatchObject({
      data: [{ slug: "stan" }],
      meta: { total: 1, page: 1, limit: 3, hasMore: false },
    });
  });

  it("sorts trending client-side and excludes null growth", async () => {
    const stdout = createCaptureStream();
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: [
          makeStartup({ slug: "mailmuse", growth30d: 8, revenue: withMrr(5_000) }),
          makeStartup({ slug: "docuflow", growth30d: null, revenue: withMrr(3_000) }),
          makeStartup({ slug: "builderkit", growth30d: 25, revenue: withMrr(4_000) }),
        ],
        total: 600,
        isPartial: true,
      }),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: createCaptureStream().stream,
    });

    await program.parseAsync(["node", "trustmrr", "--json", "trending", "2"], { from: "node" });

    expect(client.scanStartups).toHaveBeenCalledWith(200);
    expect(JSON.parse(stdout.value)).toMatchObject({
      data: [{ slug: "builderkit" }, { slug: "mailmuse" }],
      meta: { total: 2, page: 1, limit: 2, hasMore: false },
    });
  });

  it("filters category matches client-side using case-insensitive partial matching", async () => {
    const stdout = createCaptureStream();
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: [
          makeStartup({
            slug: "builderkit",
            category: "Developer Tooling",
            revenue: withMrr(7_000),
          }),
          makeStartup({
            slug: "docuflow",
            category: "Developer Tools",
            revenue: withMrr(3_000),
          }),
          makeStartup({
            slug: "mailmuse",
            category: "Marketing",
            revenue: withMrr(9_000),
          }),
        ],
        total: 3,
        isPartial: false,
      }),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: createCaptureStream().stream,
    });

    await program.parseAsync(["node", "trustmrr", "--json", "category", "developer tool", "5"], {
      from: "node",
    });

    expect(JSON.parse(stdout.value)).toMatchObject({
      data: [{ slug: "builderkit" }, { slug: "docuflow" }],
      meta: { total: 2, page: 1, limit: 5, hasMore: false },
    });
  });

  it("filters search results client-side across names and descriptions", async () => {
    const stdout = createCaptureStream();
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: [
          makeStartup({
            slug: "seobot",
            name: "SEO Bot",
            description: "Automated content optimization",
            revenue: withMrr(6_000),
          }),
          makeStartup({
            slug: "rankwatch",
            name: "RankWatch",
            description: "SEO analytics for growing teams",
            revenue: withMrr(4_000),
          }),
          makeStartup({
            slug: "mailmuse",
            name: "MailMuse",
            description: "Email for creators",
            revenue: withMrr(8_000),
          }),
        ],
        total: 3,
        isPartial: false,
      }),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: createCaptureStream().stream,
    });

    await program.parseAsync(["node", "trustmrr", "--json", "search", "seo"], {
      from: "node",
    });

    expect(JSON.parse(stdout.value)).toMatchObject({
      data: [{ slug: "seobot" }, { slug: "rankwatch" }],
      meta: { total: 2, page: 1, limit: 10, hasMore: false },
    });
  });

  it("lists categories and countries as unique simple values", async () => {
    const categoryStdout = createCaptureStream();
    const countryStdout = createCaptureStream();
    const dataset = [
      makeStartup({ category: "Developer Tools", country: "US", revenue: withMrr(5_000) }),
      makeStartup({ category: "Marketing", country: "CA", revenue: withMrr(4_000) }),
      makeStartup({ category: "Developer Tools", country: "US", revenue: withMrr(3_000) }),
    ];
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: dataset,
        total: dataset.length,
        isPartial: false,
      }),
    };
    const categoriesProgram = buildProgram({
      client: client as never,
      stdout: categoryStdout.stream,
      stderr: createCaptureStream().stream,
    });
    const countriesProgram = buildProgram({
      client: client as never,
      stdout: countryStdout.stream,
      stderr: createCaptureStream().stream,
    });

    await categoriesProgram.parseAsync(["node", "trustmrr", "categories"], { from: "node" });
    await countriesProgram.parseAsync(["node", "trustmrr", "countries"], { from: "node" });

    expect(categoryStdout.value).toBe("Developer Tools\nMarketing\n");
    expect(countryStdout.value).toBe("CA\nUS\n");
  });

  it("prints a partial-scan note for text output and honors --scan", async () => {
    const stdout = createCaptureStream();
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn().mockResolvedValue({
        data: [makeStartup({ slug: "builderkit", growth30d: 25, revenue: withMrr(4_000) })],
        total: 4_975,
        isPartial: true,
      }),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: createCaptureStream().stream,
    });

    await program.parseAsync(["node", "trustmrr", "--scan", "250", "trending", "1"], {
      from: "node",
    });

    expect(client.scanStartups).toHaveBeenCalledWith(250);
    expect(stdout.value).toContain("(showing results from top 250 by revenue)");
  });

  it("rejects an invalid positional count", async () => {
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn(),
    };
    const program = buildProgram({
      client: client as never,
      stdout: createCaptureStream().stream,
      stderr: createCaptureStream().stream,
    });

    await expect(
      program.parseAsync(["node", "trustmrr", "top", "abc"], { from: "node" }),
    ).rejects.toThrow("Invalid count value: abc. Expected a positive integer.");
    expect(client.listStartups).not.toHaveBeenCalled();
  });

  it("rejects an invalid country code", async () => {
    const client = {
      listStartups: vi.fn(),
      getStartup: vi.fn(),
      getAllStartups: vi.fn(),
      scanStartups: vi.fn(),
    };
    const program = buildProgram({
      client: client as never,
      stdout: createCaptureStream().stream,
      stderr: createCaptureStream().stream,
    });

    await expect(
      program.parseAsync(["node", "trustmrr", "--country", "usa", "top", "3"], {
        from: "node",
      }),
    ).rejects.toThrow("Invalid country code: usa");
    expect(client.listStartups).not.toHaveBeenCalled();
  });
});
