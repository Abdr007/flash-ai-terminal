# Flash AI Terminal

**Real-time CLI trading intelligence system for [Flash Trade](https://www.flash.trade/) perpetuals on Solana.**

Flash AI Terminal combines market scanning, strategy signals, regime detection, portfolio management, and risk controls into a single terminal interface. It connects to live blockchain data, runs quantitative analysis, and presents actionable trading intelligence — all from the command line.

```
  ⚡ FLASH AI TERMINAL ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━

  SIMULATION MODE

  Balance: $10,000.00

  Market Intelligence
  ─────────────────────────────────────────

  Regime:    TRENDING
  Markets:   9 scanned

  Top Opportunities
    1. SOL    LONG   72%
    2. BTC    SHORT  65%
    3. JUP    LONG   58%

  Type "help" for commands, "scan" for opportunities.

flash [sim] >
```

---

## Features

### Market Intelligence
- **Market scanner** — scans all Flash Trade markets with composite opportunity scoring
- **Regime detection** — classifies markets as trending, ranging, high-volatility, low-liquidity, or whale-dominated
- **Intelligence screen** — shows market regime, top opportunities, and portfolio status at startup
- **Real-time data** from CoinGecko, Pyth oracles, fstats.io, and on-chain state

### Trading Strategies
- **Momentum** — price direction + volume trend confirmation
- **Mean reversion** — detects OI skew and overextended price moves
- **Whale follow** — tracks large on-chain positions and follows smart money

### Portfolio Engine
- **Position sizing** — Kelly-criterion-inspired allocation with capital limits
- **Exposure controls** — max 20% per position, 30% per market, 60% directional
- **Correlation tracking** — prevents overconcentration in correlated assets
- **Rebalancing analysis** — identifies portfolio imbalances and suggests actions

### Risk Management
- **Liquidation monitoring** — tracks distance to liquidation for all positions
- **Leverage limits** — enforced per-trade and at portfolio level
- **Directional exposure caps** — prevents excessive long or short bias
- **Numeric safety** — NaN/Infinity guards throughout all calculations

### Automation
- **Autopilot engine** — automated scan → signal → allocate → execute loop (simulation only)
- **Cooldown protection** — 60s minimum between trades
- **Duplicate prevention** — won't open positions in markets already held
- **Risk gating** — every autopilot trade passes allocation + risk checks

### Infrastructure
- **CLI terminal** with readline history, fast dispatch, and command timeout protection
- **AI command interpreter** — natural language via Claude, with local regex fallback
- **Two-tier caching** — 30s market data, 60s analytics (no redundant RPC calls)
- **Simulation mode** — full paper trading with live market prices
- **Strict data integrity** — never trades on fabricated, stale, or missing data

---

## Architecture

```
                    ┌─────────────────┐
                    │   CLI Terminal   │
                    │  (readline REPL) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  AI Interpreter  │
                    │ (regex + Claude) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Tool Engine    │
                    │  (dispatch hub)  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
  ┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
  │ Market Scanner │ │   Portfolio   │ │   Autopilot   │
  │               │ │    Engine     │ │    Engine     │
  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
          │                  │                  │
  ┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
  │  3 Strategy   │ │ Risk Engine   │ │  Allocation   │
  │   Signals     │ │ + Exposure    │ │   + Risk      │
  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Solana Inspector │
                    │  (cached data)  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
    │  Flash Trade  │ │  CoinGecko  │ │    fstats    │
    │  (on-chain)   │ │  (prices)   │ │  (analytics) │
    └──────────────┘ └─────────────┘ └──────────────┘
```

**How data flows:** User input is parsed into structured intents, dispatched to the appropriate tool, which queries cached on-chain and off-chain data, runs strategy and risk computations, and returns formatted results to the terminal.

### Component Overview

| Component | Location | Purpose |
|---|---|---|
| **CLI Terminal** | `src/cli/` | Interactive REPL with readline history, fast dispatch, and mode selection |
| **AI Interpreter** | `src/ai/` | Converts natural language to structured intents (local regex + Claude API) |
| **Tool Engine** | `src/tools/` | Routes parsed intents to the correct handler |
| **Market Scanner** | `src/scanner/` | Scans all markets, runs strategies, ranks opportunities by composite score |
| **Strategy Engine** | `src/strategies/` | Three signal generators: momentum, mean reversion, whale follow |
| **Regime Detector** | `src/regime/` | Classifies market conditions (trending, ranging, volatile, etc.) |
| **Portfolio Engine** | `src/portfolio/` | Capital allocation, exposure tracking, rebalancing analysis |
| **Risk Engine** | `src/risk/` | Liquidation monitoring, exposure analysis, concentration risk |
| **Autopilot** | `src/automation/` | Automated trading loop with risk gating (simulation only) |
| **Solana Inspector** | `src/clawd/` | Cached data aggregator wrapping all external data sources |
| **Flash Client** | `src/client/` | On-chain trading client + simulation client |
| **Wallet Manager** | `src/wallet/` | Secure wallet storage, import, and connection |
| **Data Layer** | `src/data/` | CoinGecko price service, fstats.io analytics client |

---

## Command Flow

```
User Input
     │
     ▼
Fast Dispatch Table ──────── Known command? ──── yes ──→ Tool Engine
     │                                                        │
     no                                                       │
     │                                                        ▼
     ▼                                                   Execute Tool
Regex Parser ──── Match? ──── yes ──→ Tool Engine             │
     │                                                        │
     no                                                       ▼
     │                                                  Format Result
     ▼                                                        │
Claude AI ──── Parse ──→ Tool Engine                          ▼
                                                        Display Output
```

1. **Fast dispatch** — single-token commands like `scan`, `dashboard`, `positions` skip the interpreter entirely
2. **Regex parser** — pattern matching for structured commands like `open 5x long SOL $500`
3. **Claude AI** — natural language fallback for ambiguous inputs (requires API key)
4. **Tool engine** — executes the parsed intent and returns formatted results

---

## Installation

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A Solana wallet keypair (for live trading only)

### Setup

```bash
git clone https://github.com/Abdr007/flash-ai-terminal.git
cd flash-ai-terminal
npm install
npm run build
```

### Run

```bash
npm start
```

### Global Install

```bash
npm link

# Now available globally:
flash
```

### Quick Start

No wallet or API keys needed. Select simulation mode and start exploring:

```bash
flash
```

The terminal opens with a mode selection screen. Choose **Simulation** to start with a $10,000 paper balance using live market prices.

---

## Starting the Terminal

When you run `flash`, the terminal presents an interactive mode selection:

```
  ⚡ FLASH AI TERMINAL ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━

  Modes Available

    1) LIVE TRADING
       Execute real transactions on Flash Trade.

    2) SIMULATION
       Test strategies using paper trading.

  Select mode:

    1 → Live Trading
    2 → Simulation
    3 → Exit
```

After selecting a mode, the **Flash Intelligence Screen** loads automatically:

- **Market Regime** — the dominant market condition across scanned assets
- **Top Opportunities** — the 3 highest-scoring trade signals with direction and confidence
- **Market Coverage** — number of markets scanned
- **Portfolio Summary** — open positions and unrealized PnL (if any)

This screen uses cached data and loads within seconds. All values are real-time — no synthetic or placeholder data.

---

## Basic Usage

```
flash

  Select mode:
    2 → Simulation

flash [sim] > scan

  Market Opportunities
  ─────────────────────────────────────────

  Rank  Asset   Direction  Confidence  Strategy
  ───── ─────── ───────── ──────────── ─────────
  1     SOL     LONG       72%         Momentum
  2     BTC     SHORT      65%         Mean Reversion
  3     JUP     LONG       58%         Whale Follow

flash [sim] > analyze SOL

  SOL Market Analysis
  ─────────────────────────────────────────

  Market Regime
  TRENDING

  Price
  $148.32  +3.42%

  Strategy Signals

  Momentum → BULLISH
  Strong upward price movement with increasing volume.

  Mean Reversion → NEUTRAL
  Open interest balanced, no significant skew.

  Whale Follow → BULLISH
  Large positions accumulating on the long side.

  Overall: BULLISH  Confidence: 68%

flash [sim] > open 3x long SOL $500

  Confirm: LONG SOL $500 @ 3x leverage? (yes/no) yes

  Position opened.
  Entry: $148.32  Size: $1,500.00  Liq: $98.88

flash [sim] > dashboard
```

---

## Core Commands

### Market Intelligence

| Command | Description |
|---|---|
| `scan` | Scan all markets for ranked trade opportunities |
| `analyze <asset>` | Deep market analysis with 3 strategy signals and regime detection |
| `suggest trade` | AI-powered trade suggestion with reasoning (Claude API key required) |
| `dashboard` | Combined market, portfolio, and risk overview |
| `whale activity` | Recent large on-chain positions |
| `markets` | List all available Flash Trade markets |

### Trading

| Command | Description |
|---|---|
| `open 5x long SOL $500` | Open a leveraged position |
| `long SOL $500 5x` | Alternate syntax |
| `close SOL long` | Close a position |
| `add $200 to SOL long` | Add collateral to a position |
| `remove $100 from ETH long` | Remove collateral |

### Portfolio & Risk

| Command | Description |
|---|---|
| `portfolio` | Portfolio summary with balance and positions |
| `positions` | Open positions with unrealized PnL |
| `portfolio state` | Capital allocation breakdown |
| `exposure` | Exposure by market and direction |
| `rebalance` | Portfolio balance analysis with suggested actions |
| `risk` | Liquidation risk assessment and exposure summary |

### Market Data

| Command | Description |
|---|---|
| `volume` | Trading volume data |
| `open interest` / `oi` | Open interest across markets |
| `leaderboard` | Top traders by PnL |
| `fees` | Protocol fee data |

### Autopilot (Simulation Only)

| Command | Description |
|---|---|
| `autopilot start` | Start automated trading loop |
| `autopilot stop` | Stop autopilot |
| `autopilot status` | Show autopilot state and recent signals |

### Wallet Management

| Command | Description |
|---|---|
| `wallet` | Show wallet connection status |
| `wallet list` | List all stored wallets |
| `wallet address` | Show connected wallet address |
| `wallet balance` | Show SOL balance |
| `wallet tokens` | Show all token balances |

---

## Configuration

Create a `.env` file in the project root or at `~/.flash/.env`:

| Variable | Description | Default |
|---|---|---|
| `RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `ANTHROPIC_API_KEY` | Claude API key for AI features | _(empty — local parsing only)_ |
| `DEFAULT_POOL` | Flash Trade pool | `Crypto.1` |
| `NETWORK` | Solana network | `mainnet-beta` |
| `DEFAULT_SLIPPAGE_BPS` | Slippage tolerance (basis points) | `150` |
| `COMPUTE_UNIT_LIMIT` | Transaction compute budget | `600000` |
| `COMPUTE_UNIT_PRICE` | Priority fee (microLamports) | `50000` |
| `LOG_FILE` | Log file path | _(none)_ |

**AI features are optional.** All commands work without an API key using local regex parsing. The Claude interpreter adds natural language understanding for ambiguous inputs.

---

## Available Markets

| Pool | Markets |
|---|---|
| **Crypto.1** | SOL, BTC, ETH, ZEC, BNB |
| **Virtual.1** | XAG, XAU, CRUDEOIL, EUR, GBP, USDJPY, USDCNH |
| **Governance.1** | JTO, JUP, PYTH, RAY, HYPE, MET, KMNO |
| **Community.1** | PUMP, BONK, PENGU |
| **Community.2** | WIF |
| **Trump.1** | FARTCOIN |
| **Ore.1** | ORE |
| **Remora.1** | TSLAr, MSTRr, CRCLr, NVDAr, SPYr |

---

## Data Sources

All market data is live and real-time. No hardcoded prices or fabricated values.

| Source | Data |
|---|---|
| **CoinGecko API** | Primary price feed for all markets |
| **Pyth Network** | Oracle prices for on-chain execution |
| **Flash Trade** | On-chain positions, pool data, protocol state |
| **fstats.io** | Volume, open interest, leaderboard, whale activity |
| **Solana RPC** | Wallet balances, transaction submission |

---

## Data Integrity Policy

Flash AI Terminal enforces a strict real-data policy:

- **No fallback prices.** If price data is unavailable for a market, that market is excluded from scanning and trading. The system will never substitute a hardcoded or estimated price.
- **No fabricated signals.** Strategy signals are computed from live market data. If upstream data is missing, the signal returns neutral rather than guessing.
- **No synthetic balances.** Portfolio and wallet balances reflect actual state. Simulation mode uses a tracked paper balance — never an invented number.
- **Graceful degradation.** When a data source fails, the system continues with reduced coverage rather than generating fake data. Affected sections display "Data unavailable" instead of zeros or estimates.

This policy exists because traders make financial decisions based on system output. Showing fabricated data, even as a fallback, can lead to real losses.

---

## Security

### Wallet Protection
- Private key input is hidden during import (no terminal echo)
- Keys are zeroed from memory immediately after use
- Wallet files stored at `~/.flash/wallets/` with `0600` permissions (owner-only read/write)
- Path traversal protection with symlink resolution on all file operations

### Mode Safety
- Mode is locked for the entire session after selection — no runtime switching
- Live trading requires explicit mode selection + wallet connection
- Autopilot is blocked in live mode at multiple enforcement layers

### Network Security
- RPC and API connections use HTTPS
- URL path parameters are encoded to prevent injection
- User-provided file paths are validated and resolved before access

### Trading Safety
- All trades validated against leverage limits, balance checks, and position sizing rules
- Confirmation prompt before every trade execution
- 30-second command timeout prevents hung operations
- Division-by-zero and NaN guards on all financial calculations

---

## Project Structure

```
src/
├── cli/            Terminal interface (readline REPL, mode selection, intelligence screen)
├── ai/             Intent parser (local regex + Claude API fallback)
├── tools/          Tool engine, tool definitions, and dispatch registry
├── scanner/        Market opportunity scanner with composite scoring
├── strategies/     Trading signals (momentum, mean-reversion, whale-follow)
├── regime/         Market regime detection (trend, volatility, liquidity, whale activity)
├── portfolio/      Portfolio manager, allocation engine, correlation tracking, rebalancing
├── risk/           Liquidation risk assessment, exposure analysis
├── automation/     Autopilot trading loop with risk gating
├── clawd/          AI agent tools and Solana data inspector (cached aggregator)
├── client/         Flash Trade protocol client + simulation client
├── wallet/         Wallet manager, secure wallet store (~/.flash/wallets/)
├── config/         Configuration loader, pool/market definitions, risk parameters
├── data/           CoinGecko price service, fstats.io analytics client
├── types/          TypeScript types, Zod schemas, domain interfaces
└── utils/          Formatting, logging, retry utilities
```

---

## Design Philosophy

Flash AI Terminal follows these principles:

**Real data over estimates.** Every number displayed comes from a live data source. If data is unavailable, the system says so rather than guessing.

**Transparency over black boxes.** Every trade suggestion includes the strategy signals, confidence scores, and reasoning that produced it. Traders see exactly why the system recommends an action.

**Safety by default.** Simulation mode is the starting point. Live trading requires deliberate setup. Autopilot is restricted to simulation. Every trade requires confirmation.

**Simple workflows.** One command to scan markets. One command to analyze an asset. One command to see your risk. No configuration files to study before getting started.

**Developer-friendly architecture.** Pure functions for strategy computation. Clean interfaces between layers. Cached data access to minimize RPC load. Type safety throughout.

---

## Development

```bash
# Build
npm run build

# Development mode (tsx, no build step)
npm run dev

# Type check
npx tsc --noEmit

# Run tests
npm test
```

### Adding a New Strategy

Strategies are pure functions in `src/strategies/`. Each takes market data and returns a `StrategySignal`:

```typescript
import { StrategySignal } from '../types/index.js';

export function computeMySignal(data: { market: MarketData; volume: VolumeData }): StrategySignal {
  return {
    name: 'My Strategy',
    signal: 'bullish',       // 'bullish' | 'bearish' | 'neutral'
    confidence: 0.65,        // 0.0 to 1.0
    reasoning: 'Explanation of why this signal was generated.',
  };
}
```

Register it in `src/scanner/market-scanner.ts` to include it in the scan pipeline.

### Adding a New Command

1. Add an `ActionType` enum value in `src/types/index.ts`
2. Add a Zod schema for the intent
3. Add a regex pattern in `src/ai/interpreter.ts`
4. Create a tool definition in `src/tools/` or `src/clawd/`
5. Add a dispatch case in `src/tools/engine.ts`
6. Optionally add to `FAST_DISPATCH` in `src/cli/terminal.ts` for single-token commands

---

## Tech Stack

| Technology | Role |
|---|---|
| **TypeScript** | Strict mode, ESM modules |
| **Solana web3.js** | Blockchain interaction |
| **Flash SDK** | Flash Trade protocol integration |
| **Anchor** | Solana program framework |
| **Pyth Client** | Oracle price feeds |
| **Anthropic SDK** | Claude AI for natural language parsing |
| **Zod** | Runtime schema validation |
| **Commander** | CLI framework |
| **Chalk** | Terminal styling |

---

## Contributing

Contributions are welcome.

- **Report bugs** — open an issue with steps to reproduce
- **Suggest features** — describe the use case and expected behavior
- **Submit pull requests** — fork the repo, make changes, and open a PR against `main`

When contributing code:
- Run `npm run build` and `npm test` before submitting
- Follow the existing code style (strict TypeScript, ESM imports, pure functions where possible)
- Do not add synthetic data or hardcoded fallback values

---

## Disclaimer

> **This software is experimental. Use at your own risk.**
>
> Flash AI Terminal is a research and trading tool. It does not constitute financial advice. Trading perpetual futures involves significant risk of loss. Always start with simulation mode, use dedicated wallets with limited funds, and never trade more than you can afford to lose.

---

## License

[MIT](LICENSE)

---

> Built for traders who want to understand what their system is doing, not just watch it run.
