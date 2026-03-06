# Flash AI Terminal

AI-powered trading terminal for [Flash Trade](https://www.flash.trade/) perpetual futures on Solana.

Analyze markets, detect opportunities, manage risk, and execute trades directly from your terminal using live blockchain data.

```
  ⚡ FLASH AI TERMINAL ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━

  Market Intelligence
  ─────────────────────────────────────────

  Regime:    TRENDING
  Markets:   9 scanned

  Top Opportunities
    1. SOL    LONG   72%
    2. BTC    SHORT  65%
    3. JUP    LONG   58%

flash [sim] > _
```

---

## Key Features

- **Market Scanner** — Scans all Flash Trade markets and ranks opportunities by confidence score
- **Strategy Engine** — Momentum, mean-reversion, and whale-follow strategies with regime-weighted aggregation
- **Portfolio Intelligence** — Exposure analysis, directional bias detection, correlation-aware allocation
- **Risk Engine** — Liquidation risk assessment, position sizing constraints, rebalance suggestions
- **Regime Detection** — Classifies markets as trending, ranging, high-volatility, low-liquidity, or whale-dominated
- **Simulation Mode** — $10,000 paper balance with live market prices for risk-free testing
- **Live Trading** — Direct smart contract execution on Solana via Flash Trade SDK
- **AI Interpreter** — Natural language command parsing with Claude/Groq fallback (optional)
- **Autopilot** — Automated scan-and-trade loop in simulation mode

## Supported Markets

| Pool | Markets |
|------|---------|
| Crypto.1 | SOL, BTC, ETH, ZEC, BNB |
| Virtual.1 | XAG, XAU, CRUDEOIL, EUR, GBP, USDJPY, USDCNH |
| Governance.1 | JTO, JUP, PYTH, RAY, HYPE, MET, KMNO |
| Community.1 | PUMP, BONK, PENGU |
| Community.2 | WIF |
| Trump.1 | FARTCOIN |
| Ore.1 | ORE |
| Remora.1 | TSLAr, MSTRr, CRCLr, NVDAr, SPYr |

---

## Installation

```bash
git clone https://github.com/Abdr007/flash-ai-terminal.git
cd flash-ai-terminal
npm install
npm run build
npm link
```

Start the terminal:

```bash
flash
```

Verify your environment:

```bash
flash doctor
```

## Environment Configuration

Copy the example and fill in your values:

```bash
cp .env.example .env
```

**Required:**

```env
RPC_URL=https://api.mainnet-beta.solana.com
```

**Optional (AI features):**

```env
ANTHROPIC_API_KEY=sk-ant-...     # Claude — natural language command parsing
GROQ_API_KEY=gsk_...             # Groq — free AI fallback (console.groq.com)
```

**Trading defaults:**

```env
SIMULATION_MODE=true             # true = paper trading, false = real transactions
DEFAULT_POOL=Crypto.1
DEFAULT_SLIPPAGE_BPS=150         # 1.5%
COMPUTE_UNIT_PRICE=50000         # Priority fee in microLamports
```

All commands work without AI API keys. The built-in regex parser handles standard commands. AI keys add natural language support for complex or ambiguous inputs.

> Use a premium RPC provider (Helius, Triton, QuickNode) for reliable live trading.

---

## Usage

### Simulation vs Live Trading

When you run `flash`, you select a mode:

```
  1 → Live Trading     (real transactions, requires wallet)
  2 → Simulation       (paper trading, $10K balance)
  3 → Exit
```

**Simulation mode** uses live market prices but executes trades against a local paper balance. No wallet or SOL required.

**Live trading mode** signs and submits real transactions to the Solana blockchain through Flash Trade smart contracts. Requires a funded wallet with SOL and USDC.

The mode is locked for the entire session.

### Commands

| Command | Description |
|---------|-------------|
| `scan` | Scan all markets for trade opportunities |
| `analyze SOL` | Deep analysis of a specific market |
| `dashboard` | Combined market and portfolio overview |
| `portfolio` | Portfolio summary with capital allocation |
| `positions` | Open positions with unrealized PnL |
| `exposure` | Exposure breakdown by market and direction |
| `rebalance` | Portfolio rebalance suggestions |
| `risk` | Liquidation risk report |
| `suggest trade` | AI-powered trade suggestion |
| `whales` | Recent large on-chain positions |
| `volume` | Trading volume data |
| `open interest` | Open interest by market |
| `leaderboard` | Top traders by PnL or volume |
| `markets` | All available trading markets |
| `wallet` | Wallet connection status |
| `help` | Full command reference |

### Trading

```
open 2x long SOL $50
open 5x short BTC $200
close SOL long
add $100 to SOL long
remove $50 from ETH short
```

### Autopilot (Simulation Only)

```
autopilot start       Start automated scan-and-trade loop
autopilot stop        Stop autopilot
autopilot status      Current autopilot state and signals
```

---

## Wallet Management

Import a wallet:

```
wallet import main ~/.config/solana/id.json
```

Switch between wallets:

```
wallet list
wallet use main
```

Check balances:

```
wallet balance
wallet tokens
```

Wallet files are stored in `~/.flash/wallets/` with owner-only permissions (0600).

---

## Architecture

```
CLI Terminal (readline REPL)
     │
     ▼
AI Command Interpreter (Claude → Groq → Regex fallback)
     │
     ▼
Tool Engine (intent → tool dispatch)
     │
     ├── Market Scanner ──── Strategy Engine ──── Regime Detection
     │                        ├── Momentum
     │                        ├── Mean Reversion
     │                        └── Whale Follow
     │
     ├── Portfolio Engine ── Risk Analysis ── Allocation Constraints
     │
     └── Execution Client
              │
              ├── Simulation Client (paper trading)
              └── Flash Client (live trading)
                       │
                       ▼
                Flash Trade SDK → Solana RPC → Blockchain
```

See [docs/architecture.md](docs/architecture.md) for the complete system architecture.

## Transaction Pipeline

Live trades follow a hardened execution pipeline:

1. **Pre-trade checks** — SOL balance, USDC balance, leverage limits, duplicate position detection
2. **Trade mutex** — Per-market/side lock prevents concurrent conflicting trades
3. **Blockhash fetch** — Fresh blockhash with 2-attempt retry window (~90s total)
4. **Transaction build** — Flash SDK constructs the Solana transaction with priority fees
5. **Simulation** — `simulateTransaction` validates before submission
6. **Submission** — `sendRawTransaction` with `skipPreflight: true`
7. **Confirmation** — WebSocket + polling with 45s timeout per attempt
8. **Signature verification** — `isSignatureConfirmed()` called at 3 decision points

---

## Strategy Engine

Three independent strategies produce signals that are aggregated with regime-weighted scoring:

| Strategy | Detects | Data Source |
|----------|---------|-------------|
| Momentum | Strong directional moves | Price changes, volume trends |
| Mean Reversion | Oversold/overbought conditions | Price deviation, open interest |
| Whale Follow | Large position clustering | On-chain whale activity |

The market regime (trending, ranging, volatile, etc.) dynamically adjusts strategy weights. High-volatility regimes reduce leverage. Low-liquidity regimes reduce position sizes.

## Risk Engine

- **Liquidation distance** — Computed from leverage and entry price
- **Position limits** — Max 5 positions, 20% per position, 30% per market
- **Directional caps** — Max 60% exposure in one direction
- **Correlation checks** — Correlated markets share exposure limits
- **Regime-adjusted sizing** — Volatile/illiquid markets get smaller positions

---

## Security

- Private keys are never printed, logged, or transmitted
- Wallet files stored with `0600` permissions (owner-only read/write)
- Private key input is hidden during interactive import
- Keys are zeroed from memory after use
- API keys are scrubbed from log output
- RPC connections validate HTTPS
- Wallet paths restricted to home directory with symlink traversal prevention
- Wallet names sanitized to prevent path injection

See [SECURITY.md](SECURITY.md) for the complete security policy.

---

## Data Policy

Flash AI Terminal uses **live market data only**.

No hardcoded fallback prices. No synthetic signals. Markets without reliable live data are excluded from analysis. Trading decisions are never based on stale or fabricated data.

---

## Development

```bash
npm run dev          # Run with tsx (hot reload)
npm run build        # Compile TypeScript
npm run test         # Run test suite
npm run test:watch   # Watch mode
npm start            # Run compiled output
```

See [docs/project-structure.md](docs/project-structure.md) for module documentation and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## Project Status

Flash AI Terminal has completed a full architecture audit and system hardening phase:

- Transaction pipeline hardened with confirmation engine and retry logic
- Defensive arithmetic guards (`Number.isFinite`) across all computation paths
- Memory-safe bounded caches with TTL eviction on all data layers
- Input validation at every system boundary (CLI, API, SDK)
- Wallet security hardened with key zeroing and path traversal prevention
- Strategy engine stabilized with regime-weighted signal aggregation

The system is production-ready for simulation use and carefully guarded live trading.

---

## License

[MIT](LICENSE)
