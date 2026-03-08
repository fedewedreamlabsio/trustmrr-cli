# trustmrr-cli

TypeScript CLI for exploring the TrustMRR verified startup revenue database from the terminal.

`trustmrr-cli` wraps the TrustMRR API with readable tables by default and raw JSON when you need machine-friendly output for scripts or agents.

## Install

```bash
npm install -g trustmrr-cli
```

Node 18+ is required.

## Authentication

The CLI resolves credentials in this order:

1. `TRUSTMRR_API_KEY`
2. macOS Keychain via `security find-generic-password -s trustmrr -a api-key -w`

For predictable local development:

```bash
export TRUSTMRR_API_KEY=your_token_here
```

## Quick Examples

Top startups by MRR:

```bash
trustmrr top 5
```

```text
Name       Category            Country      MRR  Revenue  Growth
---------  ------------------  -------  -------  -------  -------
Stan       Content Creation    US        $3.5M    $3.0M   +10.0%
beehiiv    Marketing           US        $2.1M    $1.9M    +7.4%
Loops      Productivity        US      $842.0K  $790.0K   +12.6%
```

Fastest-growing startups in the US above $10k MRR:

```bash
trustmrr --country US --min-mrr 10000 trending 10
```

Inspect a single company:

```bash
trustmrr startup stan
```

Compare two startups:

```bash
trustmrr compare stan beehiiv
```

Search for a theme:

```bash
trustmrr search "creator economy"
```

See active acquisition listings:

```bash
trustmrr acquisitions 8
```

## Commands

### `trustmrr top [count]`

Leaderboard sorted by monthly recurring revenue.

```bash
trustmrr top
trustmrr top 20
trustmrr --country US top 10
```

### `trustmrr search <query>`

Searches startup names and descriptions.

```bash
trustmrr search billing
trustmrr --limit 25 search "customer support"
```

### `trustmrr startup <slug>`

Shows the full detail card for one startup.

```bash
trustmrr startup stan
```

### `trustmrr compare <slug1> <slug2>`

Renders a side-by-side comparison table.

```bash
trustmrr compare stan beehiiv
```

### `trustmrr trending [count]`

Sorts by 30-day growth percentage.

```bash
trustmrr trending
trustmrr trending 15
```

### `trustmrr category <name> [count]`

Filters by category and sorts by MRR.

```bash
trustmrr category "Content Creation"
trustmrr category Fintech 20
```

### `trustmrr acquisitions [count]`

Shows for-sale startups with financials and asking price.

```bash
trustmrr acquisitions
trustmrr acquisitions 12
```

### `trustmrr countries`

Lists countries represented in the dataset, including counts.

```bash
trustmrr countries
trustmrr countries --json
```

### `trustmrr categories`

Lists categories represented in the dataset, including counts.

```bash
trustmrr categories
trustmrr categories --json
```

## Global Flags

```text
--json          Output JSON instead of formatted tables
--limit <n>     Override default count
--country <cc>  Filter list commands by 2-letter country code
--min-mrr <n>   Minimum MRR filter
--max-mrr <n>   Maximum MRR filter
```

## Agent Integration

Use `--json` when another program or agent needs the raw structured result:

```bash
trustmrr --json top 3
trustmrr --json search "billing"
trustmrr --json startup stan
trustmrr --json compare stan beehiiv
```

Example agent workflow:

```text
1. Run trustmrr --json search "creator economy"
2. Filter for US startups over $10k MRR
3. Run trustmrr --json compare <slug1> <slug2>
4. Summarize growth, revenue, and acquisition status
```

## Development

```bash
npm install
npm test
npm run build
npx tsx src/index.ts top 3
```

## Links

- TrustMRR: https://trustmrr.com
- Starkslab: https://starkslab.com
