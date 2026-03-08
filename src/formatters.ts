import chalk from "chalk";

import type { StartupDetail, StartupSummary } from "./types.js";

export interface TableColumn<T> {
  header: string;
  value: (row: T) => string;
  align?: "left" | "right";
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 1 : 0,
  }).format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value.toFixed(1)}%`;
}

export function formatGrowth(
  value: number | null | undefined,
  palette: Pick<typeof chalk, "green" | "red" | "gray"> = chalk,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return palette.gray("n/a");
  }

  const formatted = `${value > 0 ? "+" : ""}${formatPercentage(value)}`;
  if (value > 0) {
    return palette.green(formatted);
  }

  if (value < 0) {
    return palette.red(formatted);
  }

  return palette.gray(formatted);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function renderTable<T>(rows: T[], columns: TableColumn<T>[]): string {
  if (rows.length === 0) {
    return "No results.";
  }

  const widths = columns.map((column) => {
    const values = rows.map((row) => stripAnsi(column.value(row)));
    return Math.max(stripAnsi(column.header).length, ...values.map((value) => value.length));
  });

  const header = columns
    .map((column, index) => padCell(column.header, widths[index], column.align))
    .join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => padCell(column.value(row), widths[index], column.align))
      .join("  "),
  );

  return [header, divider, ...body].join("\n");
}

export function renderStartupListTable(startups: StartupSummary[]): string {
  return renderTable(startups, [
    { header: "Name", value: (startup) => startup.name },
    { header: "Category", value: (startup) => startup.category ?? "n/a" },
    { header: "Country", value: (startup) => startup.country ?? "n/a" },
    {
      header: "MRR",
      value: (startup) => formatCurrency(startup.revenue.mrr),
      align: "right",
    },
    {
      header: "Revenue",
      value: (startup) => formatCurrency(startup.revenue.last30Days),
      align: "right",
    },
    {
      header: "Growth",
      value: (startup) => formatGrowth(startup.growth30d),
      align: "right",
    },
  ]);
}

export function renderDetailCard(startup: StartupDetail): string {
  const lines = [
    `${chalk.bold(startup.name)} (${startup.slug})`,
    startup.description ?? "No description provided.",
    "",
    `Website: ${startup.website ?? "n/a"}`,
    `TrustMRR: ${startup.url}`,
    `Category: ${startup.category ?? "n/a"}`,
    `Country: ${startup.country ?? "n/a"}`,
    `Founded: ${formatDate(startup.foundedDate)}`,
    `Target audience: ${startup.targetAudience ?? "n/a"}`,
    `Payment provider: ${startup.paymentProvider ?? "n/a"}`,
    `MRR: ${formatCurrency(startup.revenue.mrr)}`,
    `Revenue (30d): ${formatCurrency(startup.revenue.last30Days)}`,
    `Total revenue: ${formatCurrency(startup.revenue.total)}`,
    `Growth (30d): ${formatGrowth(startup.growth30d)}`,
    `Customers: ${formatCount(startup.customers)}`,
    `Active subscriptions: ${formatCount(startup.activeSubscriptions)}`,
    `Profit margin (30d): ${formatPercentage(startup.profitMarginLast30Days)}`,
    `Asking price: ${formatCurrency(startup.askingPrice)}`,
    `Multiple: ${startup.multiple === null ? "n/a" : startup.multiple.toFixed(2)}`,
    `On sale: ${startup.onSale ? "yes" : "no"}`,
    `First listed: ${formatDate(startup.firstListedForSaleAt)}`,
    `X handle: ${startup.xHandle ? `@${startup.xHandle}` : "n/a"}`,
    `X followers: ${formatCount(startup.xFollowerCount)}`,
    `Merchant of record: ${formatBoolean(startup.isMerchantOfRecord)}`,
    `Tech stack: ${startup.techStack.length > 0 ? startup.techStack.join(", ") : "n/a"}`,
    `Co-founders: ${startup.cofounders.length > 0 ? startup.cofounders.join(", ") : "n/a"}`,
  ];

  return lines.join("\n");
}

export function renderComparisonTable(left: StartupDetail, right: StartupDetail): string {
  const metrics = [
    ["MRR", formatCurrency(left.revenue.mrr), formatCurrency(right.revenue.mrr)],
    [
      "Revenue (30d)",
      formatCurrency(left.revenue.last30Days),
      formatCurrency(right.revenue.last30Days),
    ],
    ["Total revenue", formatCurrency(left.revenue.total), formatCurrency(right.revenue.total)],
    ["Growth (30d)", formatGrowth(left.growth30d), formatGrowth(right.growth30d)],
    ["Customers", formatCount(left.customers), formatCount(right.customers)],
    [
      "Active subscriptions",
      formatCount(left.activeSubscriptions),
      formatCount(right.activeSubscriptions),
    ],
    ["Category", left.category ?? "n/a", right.category ?? "n/a"],
    ["Country", left.country ?? "n/a", right.country ?? "n/a"],
    ["Asking price", formatCurrency(left.askingPrice), formatCurrency(right.askingPrice)],
    [
      "On sale",
      left.onSale ? "yes" : "no",
      right.onSale ? "yes" : "no",
    ],
  ];

  return renderTable(metrics, [
    { header: "Metric", value: (row) => row[0] },
    { header: left.name, value: (row) => row[1], align: "right" },
    { header: right.name, value: (row) => row[2], align: "right" },
  ]);
}

export function renderCountTable(
  counts: Array<{ name: string; count: number }>,
  label = "Value",
): string {
  return renderTable(counts, [
    { header: label, value: (row) => row.name },
    { header: "Count", value: (row) => String(row.count), align: "right" },
  ]);
}

export function countOccurrences(values: Array<string | null | undefined>) {
  const map = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    map.set(value, (map.get(value) ?? 0) + 1);
  }

  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return value ? "yes" : "no";
}

function padCell(value: string, width: number, align: TableColumn<unknown>["align"]): string {
  const visibleWidth = stripAnsi(value).length;
  const padding = " ".repeat(Math.max(0, width - visibleWidth));

  return align === "right" ? `${padding}${value}` : `${value}${padding}`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}
