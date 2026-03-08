import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrustMrrClient } from "../src/client.js";
import { makeListResponse, makeStartup } from "./fixtures.js";

describe("TrustMrrClient", () => {
  const originalApiKey = process.env.TRUSTMRR_API_KEY;

  beforeEach(() => {
    process.env.TRUSTMRR_API_KEY = "env-token";
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalApiKey === undefined) {
      delete process.env.TRUSTMRR_API_KEY;
      return;
    }

    process.env.TRUSTMRR_API_KEY = originalApiKey;
  });

  it("uses env auth and serializes query params", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeListResponse(makeStartup())), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new TrustMrrClient({ fetchFn, minIntervalMs: 0 });

    await client.listStartups({ limit: 3, sort: "mrr", order: "desc", country: "US" });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/startups?limit=3&sort=mrr&order=desc&country=US");
    expect(init.headers).toMatchObject({ Authorization: "Bearer env-token" });
  });

  it("falls back to keychain lookup when env is missing", async () => {
    delete process.env.TRUSTMRR_API_KEY;
    const keychainLookup = vi.fn().mockResolvedValue("keychain-token");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeListResponse(makeStartup())), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new TrustMrrClient({ fetchFn, keychainLookup, minIntervalMs: 0 });

    await client.listStartups();

    expect(keychainLookup).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer keychain-token",
    });
  });

  it("paginates when collecting all startups", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              makeStartup({ slug: "stan", name: "Stan" }),
              makeStartup({ slug: "beehiiv", name: "beehiiv" }),
            ],
            meta: {
              total: 3,
              page: 1,
              limit: 2,
              hasMore: true,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [makeStartup({ slug: "andla", name: "Andla" })],
            meta: {
              total: 3,
              page: 2,
              limit: 2,
              hasMore: false,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    const client = new TrustMrrClient({ fetchFn, minIntervalMs: 0 });

    const startups = await client.getAllStartups(2);

    expect(startups.map((startup) => startup.slug)).toEqual(["stan", "beehiiv", "andla"]);
    expect(String(fetchFn.mock.calls[0][0])).toContain("/startups?limit=2&page=1");
    expect(String(fetchFn.mock.calls[1][0])).toContain("/startups?limit=2&page=2");
  });

  it("caps pages at 50 items and stops when scan reaches the requested limit", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: Array.from({ length: 50 }, (_, index) =>
              makeStartup({ slug: `startup-${index + 1}` }),
            ),
            meta: {
              total: 120,
              page: 1,
              limit: 50,
              hasMore: true,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: Array.from({ length: 10 }, (_, index) =>
              makeStartup({ slug: `startup-${index + 51}` }),
            ),
            meta: {
              total: 120,
              page: 2,
              limit: 10,
              hasMore: true,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    const client = new TrustMrrClient({ fetchFn, minIntervalMs: 0 });

    const result = await client.scanStartups(60);

    expect(result).toMatchObject({
      total: 120,
      isPartial: true,
    });
    expect(result.data).toHaveLength(60);
    expect(String(fetchFn.mock.calls[0][0])).toContain("/startups?sort=mrr&order=desc&limit=50&page=1");
    expect(String(fetchFn.mock.calls[1][0])).toContain("/startups?sort=mrr&order=desc&limit=10&page=2");
  });

  it("caches all startups for the configured ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T10:00:00.000Z"));

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeListResponse(makeStartup())), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new TrustMrrClient({
      fetchFn,
      minIntervalMs: 0,
      allStartupsCacheTtlMs: 5 * 60_000,
    });

    const first = await client.getAllStartups();

    vi.setSystemTime(new Date("2026-03-08T10:04:59.000Z"));
    const second = await client.getAllStartups();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("refreshes the all-startups cache after the ttl expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T10:00:00.000Z"));

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makeListResponse(makeStartup({ slug: "stan" }))), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makeListResponse(makeStartup({ slug: "beehiiv" }))), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const client = new TrustMrrClient({
      fetchFn,
      minIntervalMs: 0,
      allStartupsCacheTtlMs: 5 * 60_000,
    });

    const first = await client.getAllStartups();

    vi.setSystemTime(new Date("2026-03-08T10:05:01.000Z"));
    const second = await client.getAllStartups();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(first.map((startup) => startup.slug)).toEqual(["stan"]);
    expect(second.map((startup) => startup.slug)).toEqual(["beehiiv"]);
  });

  it("maps a 401 into a useful error", async () => {
    const client = new TrustMrrClient({
      fetchFn: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "bad token" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
      minIntervalMs: 0,
    });

    await expect(client.listStartups()).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized. Set TRUSTMRR_API_KEY or store it in the macOS keychain.",
    });
  });

  it("maps a 404 into a useful error", async () => {
    const client = new TrustMrrClient({
      fetchFn: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "missing" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
      minIntervalMs: 0,
    });

    await expect(client.getStartup("missing")).rejects.toMatchObject({
      status: 404,
      message: "Resource not found.",
    });
  });

  it("retries a 429 using X-RateLimit-Reset before succeeding", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T10:00:00.000Z"));

    const resetAt = Math.floor(Date.now() / 1000) + 3;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const writeStderr = vi.fn();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "slow down" }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "X-RateLimit-Reset": String(resetAt),
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makeListResponse(makeStartup({ slug: "retried" }))), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const client = new TrustMrrClient({
      fetchFn,
      minIntervalMs: 0,
      sleep,
      writeStderr,
    });

    const response = await client.listStartups();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(writeStderr).toHaveBeenCalledWith("Rate limited, waiting 3s...\n");
    expect(response).toMatchObject({
      data: [{ slug: "retried" }],
    });
  });

  it("maps repeated 429 responses into a useful error after retrying twice", async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 1;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const writeStderr = vi.fn();
    const fetchFn = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ error: "slow down" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "X-RateLimit-Reset": String(resetAt),
        },
      });
    });
    const client = new TrustMrrClient({
      fetchFn,
      minIntervalMs: 0,
      sleep,
      writeStderr,
    });

    await expect(client.listStartups()).rejects.toMatchObject({
      status: 429,
      message: "Rate limit exceeded. Retry shortly.",
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(writeStderr).toHaveBeenCalledTimes(2);
  });
});
