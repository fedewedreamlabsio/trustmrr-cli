import { Chalk } from "chalk";
import { describe, expect, it } from "vitest";

import { formatCurrency, formatGrowth, formatPercentage } from "../src/formatters.js";

describe("formatters", () => {
  it("formats compact currency", () => {
    expect(formatCurrency(3_501_730.91)).toBe("$3.5M");
  });

  it("formats percentages with one decimal place", () => {
    expect(formatPercentage(10.02)).toBe("10.0%");
  });

  it("colors positive and negative growth", () => {
    const palette = new Chalk({ level: 1 });

    expect(formatGrowth(10.02, palette)).toContain("\u001B[32m+10.0%\u001B[39m");
    expect(formatGrowth(-2.4, palette)).toContain("\u001B[31m-2.4%\u001B[39m");
  });
});
