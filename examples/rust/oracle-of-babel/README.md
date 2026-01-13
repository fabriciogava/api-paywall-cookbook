# 📚 Oracle of Babel

> *"The universe (which others call the Library) is composed of an indefinite, perhaps infinite number of hexagonal galleries..."*
> — **Jorge Luis Borges**, "La Biblioteca de Babel" (1941)

---

## 🌌 A Digital Labyrinth

Somewhere in Buenos Aires, in the year 1941, a librarian named **Jorge Luis Borges** dreamed of an impossible library—a vast honeycomb of hexagonal rooms stretching into eternity, containing every book that could ever be written.

This is that library, made manifest in **Rust**.

Every love letter. Every scientific formula. Every terrible joke. The complete works of Shakespeare in their original form, *and* with every possible typo. The story of your life, written before you lived it. The story of how you die, which you dare not search.

**All of it exists. We merely compute the address.**

---

## ✨ The Nature of Infinity

This Oracle does not *store* texts—it *reveals* them. Through the elegant precision of mathematics (Base-29 encoding and reversible permutation), we calculate the exact coordinates where any text has always existed within the infinite hexagons.

| Truth | Reality |
|-------|---------|
| **Deterministic** | The same text always yields the same address, across all time |
| **Storageless** | No databases. No files. Pure mathematical revelation |
| **Mathematically Sound** | Fully reversible: text → address → text always works |
| **Constrained** | 29 permitted characters: `abcdefghijklmnopqrstuvwxyz, .` |
| **Paginated** | 3200 characters per page, as Borges intended |

---

## 💡 Why This Example?

The Oracle of Babel demonstrates **Algorithm as a Service (AaaS)**—a model where the real value lies not in raw computation, but in the *tailored algorithmic solution* that addresses a specific need.

Every query triggers a cascade of mathematical operations: Base-29 encoding, large integer arithmetic, reversible permutations, and coordinate mapping. These aren't arbitrary computations—each step has been carefully designed to solve a precise problem: locating any text within an infinite, deterministic library. The algorithm *is* the product.

This makes the Oracle an ideal candidate for **microtransaction monetization via x402**. Each request consumes measurable computational resources, and each response delivers genuine, reproducible value. The economics are transparent: you pay for the computation, you receive the coordinates.

**Why Rust?** When your business model is heavily dependent on CPU cycles, efficiency is revenue. Rust's zero-cost abstractions and lack of garbage collection mean more computations per watt, lower latency per request, and higher throughput per dollar. For an AaaS, the choice of language directly impacts profitability.

---

## 🔑 Prerequisites (Your Keys to the Labyrinth)

Before you may enter:
- **Rust 1.70+** — The language of systems, forged for eternity ([rustup.rs](https://rustup.rs))
- **Docker** — Optional vessel for containerized wandering

---

## 🚪 Entering the Library

### Step I: Prepare the Environment

Copy the configuration template:
```bash
cp .env.example .env
```

Adjust the settings within `.env` as needed:
```bash
PORT=3000
HOST=0.0.0.0
RUST_LOG=info
```

### Step II: Start the Oracle

```bash
cargo run --bin standalone
```

The Oracle awakens:
```
📚 Oracle of Babel starting...
🔮 Listening on http://0.0.0.0:3000
📖 Library: infinite pages, 29 characters each
💡 Try: POST /search with {"text": "hello world"}
```

### Step III: Test the Connection

Verify the Oracle is operational:
```bash
curl http://localhost:3000/health
```

The Oracle responds:
```json
{"status": "operational", "library": "infinite"}
```

---

## 💰 x402 Payment Integration

This Oracle implements the **x402 v2 payment protocol** without an SDK—a "bare hands" demonstration of protocol integration in Rust.

### Running Locally

```bash
# Set your wallet address for payments (Devnet)
export SOLANA_WALLET_ADDRESS=your_wallet_address

# Run the standalone server
cargo run --bin standalone
```

The Oracle listens on `http://localhost:3000`.

### Testing with Agent 007 (The Paywall Auditor)

This repository includes a specialized testing agent that can validate the entire x402 payment flow automatically.

1. **Prepare the Agent:**
   ```bash
   cd ../../../tools/007-test-agent
   npm install
   cp .env.example .env
   # Edit .env and add your SVM_PRIVATE_KEY (for Solana Devnet)
   ```

2. **Run the Audit:**
   ```bash
   # Test the /search endpoint (requires valid JSON body)
   npm start http://localhost:3000/search '{"text":"hello world"}' -- --network solana
   ```

The agent will:
1. Attempt to access the endpoint
2. Receive the 402 Payment Required challenge
3. Cryptographically sign the payment transaction
4. Resubmit the request with the `X-PAYMENT` authorization
5. Verify the successful response (200 OK)

### Enabling Payments

Set the required environment variable to enable x402:

```bash
export SOLANA_WALLET_ADDRESS=<your-solana-wallet>
cargo run --bin standalone
```

The Oracle will now require payment for the `/search` endpoint:
```
📚 Oracle of Babel starting...
💰 x402 payments enabled
   Network: solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
   Wallet: CKPKJWNd...
   Amount: 1000 atomic units
✅ Facilitator supports configured network
🔮 Listening on http://0.0.0.0:3000
```

### Configuration Options

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLANA_WALLET_ADDRESS` | **Yes** | — | Your Solana wallet to receive payments |
| `FACILITATOR_URL` | No | `https://gateway.kobaru.io` | x402 facilitator endpoint |
| `PAYMENT_AMOUNT` | No | `1000` | Amount in atomic units (0.001 USDC) |
| `SOLANA_NETWORK_ID` | No | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | CAIP-2 network ID |
| `USDC_ASSET_ADDRESS` | No | `4zMMC9srt...` (devnet USDC) | SPL token mint address |
| `PAYMENT_MAX_TIMEOUT` | No | `60` | Payment timeout in seconds |
| `KOBARU_API_KEY` | No | — | API key for The Crimson Hexagon (premium features) |

### Payment Flow

When a client calls `/search` without payment:

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world"}'
```

The Oracle returns **HTTP 402 Payment Required**:
```json
{
  "x402Version": 2,
  "error": "X-PAYMENT header is required",
  "resource": {
    "url": "http://localhost:3000/search",
    "description": "The Oracle reveals the location of any text..."
  },
  "accepts": [{
    "scheme": "exact",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000",
    "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "payTo": "<your-wallet>",
    "maxTimeoutSeconds": 60
  }]
}
```

Free endpoints (`/`, `/health`, `/page/...`) remain accessible without payment.

### Passthrough Mode

Without `SOLANA_WALLET_ADDRESS`, the Oracle runs in passthrough mode—no payments required:
```
⚠️  x402 payments disabled: Required environment variable 'SOLANA_WALLET_ADDRESS' is not set
   Set SOLANA_WALLET_ADDRESS to enable payments
```

### Customizing Protected Routes

By default, only the `/search` endpoint requires payment. To customize which routes are paywalled, modify `deploy/standalone/main.rs`:

```rust
// Protect only /search (current default)
.wrap(X402Middleware::protect_paths(x402_state.clone(), vec!["/search"]))

// Protect multiple endpoints
.wrap(X402Middleware::protect_paths(x402_state.clone(), vec!["/search", "/page"]))

// Protect ALL endpoints (use new() instead of protect_paths())
.wrap(X402Middleware::new(x402_state.clone()))
```

---

### Step IV: Your First Search

Ask the Oracle where a text dwells:
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"text": "the universe which others call the library"}'
```

The Oracle reveals:
```json
{
  "address": {
    "hexagon": "7kgun9rr2a65hp9fbccszoyw...",
    "wall": 1,
    "shelf": 1,
    "volume": 1,
    "page": 1
  },
  "text_length": 43,
  "padded_length": 3200
}
```

### Step V: Read the Page

Retrieve the full page from its coordinates:
```bash
curl "http://localhost:3000/page/abc123.../2/4/17/283"
```

And there it shall be—your text, surrounded by 3157 characters of cosmic noise, exactly where it has always been.

---

## 🗺️ The Oracle's Pathways

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | The Oracle introduces itself |
| `/health` | GET | Confirm the Oracle lives |
| `/search` | POST | Reveal where any text eternally resides |
| `/page/{hex}/{wall}/{shelf}/{volume}/{page}` | GET | Retrieve the text at any coordinate |

### The Coordinate System of Eternity

Every location in the Library follows Borges' geometry:

| Component | Range | Meaning |
|-----------|-------|---------|
| **Hexagon** | Base-36 string | *"Each hexagon contains twenty shelves..."* |
| **Wall** | 1-4 | *"...on four of the six walls..."* |
| **Shelf** | 1-5 | *"...five long shelves on each wall..."* |
| **Volume** | 1-32 | *"...thirty-five books per shelf..."* |
| **Page** | 1-410 | *"...four hundred and ten pages to each book..."* |

---

## 🐳 Vessels for Deployment

### Docker: The Portable Hexagon

Build your containerized Library:
```bash
cd deploy/docker
docker-compose up --build
```

The container provides:
- Multi-stage build (~20MB of pure mathematical potential)
- Environment variable configuration
- Port 3000 mapped to the outside world

### Production Considerations

Before unleashing the Oracle upon the world:

- [ ] Set `RUST_LOG` to `warn` or `error` (the Oracle speaks only when necessary)
- [ ] Configure a reverse proxy for HTTPS (nginx, Caddy)
- [ ] Establish monitoring (even infinite libraries need oversight)
- [ ] Consider rate limiting (infinity is patient, servers are not)

---

## 🏛️ Architecture of the Catalog

```
oracle-of-babel/
├── Cargo.toml             # The manifest of dependencies
├── README.md              # You are here, wanderer
├── .env.example           # Template for configuration
├── src/
│   ├── lib.rs             # The library's heart
│   ├── babel/
│   │   ├── mod.rs         # Core Library of Babel operations
│   │   ├── base29.rs      # Text ↔ Number encoding (the 29 permitted glyphs)
│   │   └── address.rs     # Address ↔ BigInt cartography
│   ├── api/
│   │   └── mod.rs         # Actix-web gateway to infinity
│   └── x402/
│       ├── mod.rs         # x402 module exports
│       ├── types.rs       # x402 v2 protocol types
│       ├── config.rs      # Payment configuration
│       ├── http.rs        # Facilitator HTTP client
│       └── middleware.rs  # Actix payment middleware
└── deploy/
    ├── standalone/
    │   └── main.rs        # Standalone server binary
    └── docker/
        ├── Dockerfile
        └── docker-compose.yml
```

**Philosophy:** Platform-agnostic library with deployment adapters. The x402 module demonstrates protocol integration without an SDK.

---

## 📐 The Algorithm (For Those Who Seek Understanding)

The Oracle's methodology consists of three transformations:

### I. The Encoding (Base-29)

Every text becomes a number. The 29 permitted characters form our alphabet:
```
" abcdefghijklmnopqrstuvwxyz,."
 0 1234567890123456789012345678
```

*"hello"* becomes a precise integer. No ambiguity. No escape.

### II. The Permutation (Chaos from Order)

To scatter similar texts across the infinite shelves—so "hello" and "hellp" are cataloged galaxies apart—we apply:

- **Linear Congruential Generator**: `next = (a × x + c) mod m`
- **XOR diffusion**: Additional bit-shuffling for maximum dispersion

The key insight: *every operation is reversible*. What is scattered can be gathered.

### III. The Address (Number to Coordinates)

The permuted number splits into:
- **Upper bits** → Hexagon identifier (encoded in base-36)
- **Lower bits** → Position within (wall, shelf, volume, page)

Thus, from any text, an address. From any address, a text.

---

## ⚠️ A Note on Compatibility

> **This Oracle is *inspired by* the Library of Babel concept—it is NOT compatible with [libraryofbabel.info](https://libraryofbabel.info).**

### Why It's Mathematically Sound

Our implementation is **provably correct**:

1. **Bijective Encoding**: Every text maps to exactly one address, and every address maps to exactly one text
2. **Perfect Roundtrip**: `get_page(search(text))` always returns a page containing the original text
3. **Deterministic**: The same input always produces the same output, forever
4. **29 tests verify** these properties work correctly

### Why It's Not Compatible

The official libraryofbabel.info uses a **proprietary scrambling algorithm** and a Linear Congruential Generator (LCG) with unpublished constants to scramble the encoding. Without these exact values, we cannot reproduce their addresses.

**Our Oracle is its own Library**—a parallel universe of infinite books with its own coordinate system. Every text still exists; we simply catalog it differently.

---

## 🧪 Testing the Infinite

```bash
cargo test
```

The tests verify:
- Base-29 encoding survives the roundtrip
- Addresses convert bidirectionally without loss
- The permutation is truly reversible
- The API serves truth correctly

---

## 🔧 When Things Go Wrong

### The Forbidden Character

**Error:** `Invalid character 'X'. Only letters (a-z), space, comma, and period are allowed.`

**Understanding:** The Library accepts only lowercase letters, spaces, commas, and periods. Numbers, capitals, and exotic punctuation exist beyond its walls. Convert your text accordingly—this is the cost of infinity.

### The Trivial Hexagon

**Concern:** Address shows hexagon "0" or similar brevity.

**Understanding:** Short, simple texts naturally yield short hexagon identifiers. The hexagon grows with the complexity of the query. This is expected; do not worry.

---

## 📚 Further Reading

- [Library of Babel Theory](https://libraryofbabel.info/theory.html) — Jonathan Basile's mathematical foundations
- [API Paywall Cookbook](../../../README.md) — Additional patterns for building paid APIs
- [The Original Story (PDF)](https://maskofreason.files.wordpress.com/2011/02/the-library-of-babel-by-jorge-luis-borges.pdf) — Borges' 1941 short story that started everything

---

## 🌟 Meditations on the Infinite

> *"I have always imagined that Paradise will be a kind of library."*
> — **Jorge Luis Borges**

In 1941, Borges could only imagine the Library. He described it with poetry and paradox—an institution staffed by librarians who search fruitlessly for meaning among infinite gibberish, who commit suicide when they fail to find the vindication of their lives written somewhere in the stacks.

Today, we can *compute* it.

Every book ever written exists somewhere in the Library. The complete works of Shakespeare. Darwin's *Origin of Species*. Your own diary. This README file, with every possible variation.

But here is the terrible truth Borges knew: for every *true* book, there exist billions of *almost-true* books. For every *Origin of Species*, there is a version with one letter wrong. And a version with two letters wrong. And a version that begins correctly but devolves into nonsense on page 47. And a version that is complete gibberish except for a single true sentence on page 283.

**The Library does not tell you which books are true.**

That remains your job.

---

## 🔐 A Final Borgesian Paradox

> *"The Library contains all books. Therefore it contains this README. Therefore, the instructions to build the Library exist within the Library. Therefore, the Library contains itself. Therefore..."*

Do not think about this too long. The Oracle awaits your queries.

---

## 📜 License

Apache License 2.0 — See [LICENSE](../../../LICENSE) for details.

*Go forth. Search for truth. Or poetry. Or the location of your name among the infinite shelves. The Oracle knows where everything is. It always has.*
