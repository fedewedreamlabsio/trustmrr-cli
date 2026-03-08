# trustmrr-cli

TypeScript CLI for browsing the TrustMRR verified startup revenue database from your terminal.

## Install

```bash
npm install -g trustmrr-cli
```

Node 18+ is required.

## Authentication

The CLI reads your API key from:

1. `TRUSTMRR_API_KEY`
2. macOS Keychain via `security find-generic-password -s trustmrr -a api-key -w`

Export the env var if you want a predictable non-interactive setup:

```bash
export TRUSTMRR_API_KEY=your_token_here
```

## Quick Start

```bash
trustmrr top
trustmrr top 5 --country US
trustmrr trending 10
trustmrr search "creator economy"
trustmrr startup stan
trustmrr compare stan beehiiv
trustmrr acquisitions 8
trustmrr categories
trustmrr countries
```

Example output:

```text
Name    Category           Country      MRR  Revenue  Growth
------  -----------------  -------  -------  -------  -------
Stan    Content Creation   US        $3.5M    $3.0M   +10.0%
```

## Commands

```text
trustmrr top [count]                    Leaderboard by MRR (default 10)
trustmrr search <query>                 Search startups by name or description
trustmrr startup <slug>                 Full details for one startup
trustmrr compare <slug1> <slug2>        Side-by-side comparison table
trustmrr trending [count]               Fastest growing by MoM % (default 10)
trustmrr category <name> [count]        Filter by category
trustmrr acquisitions [count]           For-sale listings with financials
trustmrr countries                      List available countries
trustmrr categories                     List available categories
```

## Global Flags

```text
--json          Output JSON for scripts and agents
--limit <n>     Override default count
--country <cc>  Filter list commands by 2-letter country code
--min-mrr <n>   Minimum MRR filter
--max-mrr <n>   Maximum MRR filter
```

## Agent Integration

For agent workflows, `--json` returns machine-friendly output:

```bash
trustmrr search "billing" --json
trustmrr startup stan --json
trustmrr compare stan beehiiv --json
```

Example agent prompt:

```text
Use trustmrr-cli to find three B2B startups over $10k MRR in the US and compare their growth.
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
