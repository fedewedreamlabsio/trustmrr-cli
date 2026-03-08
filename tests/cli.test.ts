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

describe("CLI parsing", () => {
  it("routes top command arguments and global filters to the client", async () => {
    const stdout = createCaptureStream();
    const stderr = createCaptureStream();
    const client = {
      listStartups: vi.fn().mockResolvedValue(makeListResponse(makeStartup())),
      getStartup: vi.fn(),
    };
    const program = buildProgram({
      client: client as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    await program.parseAsync(
      ["node", "trustmrr", "--country", "us", "--min-mrr", "1000", "top", "3"],
      { from: "node" },
    );

    expect(client.listStartups).toHaveBeenCalledWith({
      country: "US",
      minMrr: 1000,
      maxMrr: undefined,
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
      listStartups: vi.fn().mockResolvedValue(makeListResponse(makeStartup())),
      getStartup: vi.fn(),
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
});
