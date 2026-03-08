import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrustMrrClient, TrustMrrError } from "../src/client.js";
import { makeListResponse, makeStartup } from "./fixtures.js";

describe("TrustMrrClient", () => {
  const originalApiKey = process.env.TRUSTMRR_API_KEY;

  beforeEach(() => {
    process.env.TRUSTMRR_API_KEY = "env-token";
  });

  afterEach(() => {
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

  it("maps a 429 into a useful error", async () => {
    const client = new TrustMrrClient({
      fetchFn: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "slow down" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
      minIntervalMs: 0,
    });

    await expect(client.listStartups()).rejects.toMatchObject({
      status: 429,
      message: "Rate limit exceeded. TrustMRR allows 20 requests per minute.",
    });
  });
});
