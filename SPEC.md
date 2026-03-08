# trustmrr-cli — CLI for TrustMRR API

A TypeScript CLI that wraps the TrustMRR API (verified startup revenue database). Follows the same patterns as datafast-cli.

## API Reference

- **Base URL:** `https://trustmrr.com/api/v1`
- **Auth:** Bearer token via `TRUSTMRR_API_KEY` env var
- **Rate limit:** 20 req/min
- **Endpoints:**
  - `GET /startups` — list/filter startups
    - Query params: `limit`, `offset`, `sort` (mrr, revenue, growth30d, customers, askingPrice), `order` (asc, desc), `category`, `country`, `onSale` (true/false), `minMrr`, `maxMrr`, `minRevenue`, `maxRevenue`, `search`
  - `GET /startups/{slug}` — full details for one startup

## API Response Shape

### List response:
```json
{
  "data": [
    {
      "name": "Stan",
      "slug": "stan",
      "url": "https://trustmrr.com/startup/stan",
      "icon": "...",
      "description": "Stan enables people to make living...",
      "website": "https://stan.store",
      "country": "US",
      "foundedDate": "2023-04-19T18:51:28.000Z",
      "category": "Content Creation",
      "paymentProvider": "stripe",
      "targetAudience": "B2C",
      "revenue": {
        "last30Days": 3039307.93,
        "mrr": 3501730.91,
        "total": 72484789.21
      },
      "customers": 0,
      "activeSubscriptions": 99174,
      "askingPrice": null,
      "profitMarginLast30Days": null,
      "growth30d": 10.02,
      "multiple": null,
      "onSale": false,
      "firstListedForSaleAt": null,
      "xHandle": "vitddnv"
    }
  ],
  "meta": { "total": 840, "limit": 10, "offset": 0 }
}
```

### Detail response (additional fields):
```json
{
  "data": {
    "...same as above plus...",
    "xFollowerCount": 4567,
    "isMerchantOfRecord": false,
    "techStack": [],
    "cofounders": []
  }
}
```

## CLI Commands

```
trustmrr top [count]                    # Leaderboard by MRR (default 10)
trustmrr search <query>                 # Search startups by name/description
trustmrr startup <slug>                 # Full details for one startup
trustmrr compare <slug1> <slug2>        # Side-by-side comparison table
trustmrr trending [count]               # Fastest growing by MoM % (default 10)
trustmrr category <name> [count]        # Filter by category
trustmrr acquisitions [count]           # For-sale listings with financials
trustmrr countries                      # List available countries
trustmrr categories                     # List available categories
```

## Global Flags

```
--json          Output raw JSON (for piping / agent consumption)
--limit <n>     Override default count
--country <cc>  Filter by 2-letter country code
--min-mrr <n>   Minimum MRR filter
--max-mrr <n>   Maximum MRR filter
```

## Auth

Read API key from:
1. `TRUSTMRR_API_KEY` env var
2. macOS Keychain: `security find-generic-password -s trustmrr -a api-key -w` (fallback)

## Tech Stack

- TypeScript
- Commander.js for CLI parsing
- Native fetch (Node 18+)
- chalk for colors
- No heavy dependencies — keep it lean

## Output Style

Human-readable tables by default with formatted currency ($3.5M), percentages (10.0%), and colored growth indicators (green for positive, red for negative). `--json` flag outputs raw API response for agent consumption.

## Project Structure

```
src/
  index.ts          # CLI entry point + commander setup
  client.ts         # TrustMRR API client (typed, handles auth + rate limits)
  commands/         # One file per command
    top.ts
    search.ts
    startup.ts
    compare.ts
    trending.ts
    category.ts
    acquisitions.ts
  formatters.ts     # Currency, percentage, table formatting
  types.ts          # TypeScript interfaces for API responses
package.json
tsconfig.json
README.md
LICENSE             # MIT
```

## Tests

Use vitest. Test:
- API client (mock fetch)
- Formatters (currency, percentages, growth colors)
- CLI argument parsing
- Error handling (401, 404, 429)

## README

Include:
- What it is (one line)
- Install (`npm install -g trustmrr-cli`)
- Quick examples with real output
- Agent integration example (how an AI agent uses it)
- All commands documented
- Link to TrustMRR and Starkslab
