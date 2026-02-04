# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **API Paywall Cookbook** - a collection of production-ready examples demonstrating how to monetize APIs using the [x402 protocol](https://github.com/coinbase/x402) and the [Kobaru gateway](https://kobaru.io). Each example in this repository is deployed to production as a real-world test case for the Kobaru gateway.

## Repository Structure

The project follows a monorepo structure organized by language and example:

- `examples/nodejs/` - Node.js/TypeScript examples
  - `deep-thought-api/` - Reference implementation (Hono + x402)
  - `extract-wisdom-api/` - Advanced example with Clean Architecture (DDD)
- `examples/bun/` - Bun runtime examples
  - `socratic-mentor-api/` - Advanced patterns (mini-ledger, optimistic flow, dynamic pricing)
- `examples/go/` - Go examples
  - `vulcan-logic-api/` - Production Go with Gin framework
- `examples/rust/` - Rust examples
  - `oracle-of-babel/` - Complex deterministic algorithm (Borges library)
- `examples/no-code/` - Zero-code integration examples (transparent proxy)
- `tools/` - Development and testing utilities
  - `007-test-agent/` - Universal x402 API testing tool
- `helpers/` - Shared utility libraries
  - `typescript/` - Discovery/bazaar helpers for TypeScript

## Development Commands

### Deep Thought API (examples/nodejs/deep-thought-api)

The main reference implementation uses Hono (lightweight web framework) with x402 payment middleware.

**Development:**
```bash
cd examples/nodejs/deep-thought-api
npm install
npm run dev              # Node.js development server (uses tsx watch)
npm run dev:node         # Explicit Node.js dev server
npm run dev:cloudflare   # Cloudflare Workers dev server
```

**Building & Type Checking:**
```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type check without emitting files
```

**Deployment:**
```bash
npm run deploy:cloudflare  # Deploy to Cloudflare Workers
npm run docker:build       # Build Docker image
npm run docker:run         # Run Docker container
```

**Environment Variables:**
- `RESOURCE_WALLET_ADDRESS` - Your wallet address to receive payments (required)
- `FACILITATOR_URL` - Kobaru gateway URL (defaults to https://gateway.kobaru.io)
- `PORT` - Server port (defaults to 3000)

### 007 Test Agent (tools/007-test-agent)

Universal testing tool for ANY x402-enabled API. Tests local development APIs, remote production APIs, or third-party paywalled endpoints.

```bash
cd tools/007-test-agent
npm install
npm start [URL]  # URL is optional, defaults to http://localhost:3000/answer
```

**Usage Examples:**
```bash
npm start                                    # Test default (localhost:3000/answer)
npm start http://localhost:3000/answer       # Test local API
npm start https://api.example.com/endpoint   # Test remote API
```

**Environment Variables:**
- `SVM_PRIVATE_KEY` - Base58-encoded Solana private key for making payments (required)

## Architecture Patterns

### Multi-Platform App Pattern

The Deep Thought API demonstrates platform-agnostic architecture:

1. **Core Application** (`src/app.ts`):
   - Factory function `createApp(config)` that returns a Hono app
   - Platform-agnostic configuration interface
   - No direct dependency on Node.js or Cloudflare APIs

2. **Platform Adapters** (`deploy/`):
   - `deploy/node/server.ts` - Node.js adapter using @hono/node-server
   - `deploy/cloudflare/index.ts` - Cloudflare Workers adapter
   - Each adapter handles environment-specific concerns (env vars, server setup)

This pattern allows the same application code to run on Node.js, Cloudflare Workers, Docker, etc.

### x402 Payment Flow

The x402 protocol implements HTTP 402 "Payment Required":

1. **Middleware Setup**:
   - `x402ResourceServer` - Server-side payment verification
   - `HTTPFacilitatorClient` - Communicates with Kobaru gateway
   - `paymentMiddleware` - Guards endpoints and handles 402 responses

2. **Payment Schemes**:
   - `ExactSvmScheme` - Exact payment amount on Solana
   - Schemes are registered per network (CAIP-2 format: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")

3. **Route Configuration**:
   - Define payment requirements per endpoint
   - Multiple payment options supported (different networks/assets)
   - Metadata describes what the user is purchasing

4. **Request Flow**:
   - First request → 402 Payment Required response with payment options
   - Client creates payment signature
   - Retry request with `Authorization: 402 <token>` header
   - Middleware verifies payment via facilitator
   - If valid → pass to handler, if invalid → 403 Forbidden

### Client Payment Flow

The test client demonstrates the full payment lifecycle:

1. Initialize `x402Client` with payment scheme registration
2. Wrap `fetch` with `wrapFetchWithPayment()`
3. Automatic handling of 402 responses:
   - Detects payment required
   - Creates payment signature
   - Retries request with payment header

## Key Dependencies

### Server-Side (Deep Thought API)
- `hono` - Lightweight web framework (works on Node.js, Cloudflare, Deno, Bun)
- `@x402/core` - Core x402 protocol implementation
- `@x402/hono` - Hono integration middleware
- `@x402/svm` - Solana blockchain payment scheme
- `@hono/node-server` - Node.js adapter for Hono
- `wrangler` - Cloudflare Workers CLI

### Client-Side (007 Test Agent)
- `@x402/fetch` - Fetch wrapper with automatic payment handling
- `@x402/svm` - Solana client payment scheme
- `@solana/web3.js` v2 - Solana blockchain interaction
- `@solana/signers` - Transaction signing utilities

## Important Notes

### Network Configuration

The codebase includes constants for blockchain networks:

- **Development**: Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)
- **Production**: Solana Mainnet Beta (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)

Currently configured for **MAINNET** in `src/app.ts`. Check the `NETWORK_ID` and `ASSET_ADDRESS` constants before deploying.

### Payment Verification

- All payment verification happens via the facilitator (Kobaru gateway)
- The resource server never directly interacts with the blockchain
- Settlement is handled asynchronously by the facilitator

### Security

- Never commit `.env` files or private keys
- Wallet addresses are public (safe to log)
- Private keys must remain secret (used only in client)

## Common Workflows

### Adding a New Paywalled Endpoint

1. Define route in the `routes` object in `src/app.ts`
2. Specify `accepts` array with payment options (scheme, price, network, asset, payTo)
3. Add endpoint handler below the middleware (no payment logic needed in handler)
4. Middleware automatically enforces payment before handler executes

### Testing Payment Flow End-to-End

1. Start the server: `cd examples/nodejs/deep-thought-api && npm run dev`
2. In another terminal, run test agent: `cd tools/007-test-agent && npm start`
3. The agent will automatically handle the 402 response and pay for access

**Testing Remote APIs:**
- `cd tools/007-test-agent && npm start https://any-x402-api.com/endpoint`
- Works with any x402-compliant API, not just local examples

### Changing Blockchain Networks

1. Update `NETWORK_ID` constant in `src/app.ts`
2. Update `ASSET_ADDRESS` for the corresponding token on that network
3. Ensure your wallet and client are configured for the same network

---

## Creating New Examples: Mandatory Patterns

When creating a new x402 API example in ANY programming language, you MUST follow these architectural patterns to maintain consistency across the cookbook:

### 1. Directory Structure Pattern (REQUIRED)

Every example must follow this structure:

```
examples/[language]/[api-name]/
├── src/
│   ├── app.[ext]              # Core application (platform-agnostic factory)
│   └── [business-logic]/      # Additional modules as needed
├── deploy/
│   ├── standalone/            # Standalone binary/server entry point
│   │   └── main.[ext]         # Platform adapter
│   ├── docker/                # Docker deployment
│   │   ├── Dockerfile         # Multi-stage build
│   │   └── docker-compose.yml # Optional compose file
│   └── cloudflare/            # (Optional) Edge deployment
│       └── [worker-files]
├── test/                      # Unit and integration tests
├── .env.example               # Environment template (required)
├── README.md                  # Example documentation
└── [build-config]             # package.json, go.mod, Cargo.toml, etc.
```

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/` (src/app.ts:1, deploy/node/server.ts:1)
- Go: `examples/go/vulcan-logic-api/` (src/app.go:1, deploy/standalone/main.go:1)
- Rust: `examples/rust/oracle-of-babel/` (src/lib.rs:1, deploy/standalone/main.rs:1)

### 2. Factory Pattern for Platform-Agnostic Core (REQUIRED)

The core application MUST be platform-agnostic:

**Pattern:**
1. Create a factory function/method in `src/app.[ext]`
2. Accept configuration as parameter (not environment-dependent)
3. Return framework instance (Hono, Gin, Actix, etc.)
4. No direct environment access in core app

**TypeScript/Node.js Example:**
```typescript
// src/app.ts
export interface AppConfig {
  solanaWalletAddress?: string
  baseWalletAddress?: string
  facilitatorUrl: string
}

export async function createApp(config: AppConfig): Promise<Hono> {
  // Platform-agnostic application logic
  const app = new Hono()
  // ... setup x402 middleware, routes, etc.
  return app
}
```

**Go Example:**
```go
// src/app.go
type AppConfig struct {
    BaseWalletAddress string
    FacilitatorURL    string
    GeminiAPIKey      string
}

func CreateApp(config AppConfig) *gin.Engine {
    r := gin.Default()
    // ... setup x402 middleware, routes, etc.
    return r
}
```

**Rust Example:**
```rust
// src/api/mod.rs
pub fn create_app() -> App<
    impl ServiceFactory</* ... */>,
> {
    App::new()
        // ... setup routes
}
```

**Platform adapters** (`deploy/standalone/main.*`, `deploy/node/server.ts`) then:
1. Load environment variables
2. Build config struct/object
3. Call factory function
4. Start HTTP server

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/src/app.ts:156-344`
- Go: `examples/go/vulcan-logic-api/src/app.go:72-206`
- Rust: `examples/rust/oracle-of-babel/src/api/mod.rs:127-144`

### 3. Environment Configuration Pattern (REQUIRED)

Every example MUST:

1. **Provide `.env.example`** with all required and optional variables documented
2. **Use consistent variable names** across examples:
   - `SOLANA_WALLET_ADDRESS` - Solana payment destination
   - `BASE_WALLET_ADDRESS` - Base/EVM payment destination
   - `FACILITATOR_URL` - Kobaru gateway (default: `https://gateway.kobaru.io`)
   - `PORT` - HTTP server port (default: `3000`)
3. **Fail fast** on missing required variables (validate on startup)
4. **Provide sensible defaults** where applicable

**Required .env.example template:**
```bash
# Blockchain Wallet Addresses (at least one required)
SOLANA_WALLET_ADDRESS=
BASE_WALLET_ADDRESS=

# x402 Configuration
FACILITATOR_URL=https://gateway.kobaru.io

# Server Configuration
PORT=3000

# [Additional example-specific variables]
```

**Validation example (startup check):**
```typescript
// deploy/node/server.ts
if (!config.solanaWalletAddress && !config.baseWalletAddress) {
  console.error("❌ At least one wallet address is required")
  process.exit(1)
}
```

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/.env.example`, `deploy/node/server.ts:25-29`
- Go: `examples/go/vulcan-logic-api/.env.example`, `deploy/standalone/main.go:26-28`
- Rust: `examples/rust/oracle-of-babel/.env.example`

### 4. x402 Payment Integration Pattern (REQUIRED)

Every example must implement this payment flow:

**Step 1: Initialize Facilitator Client**
```typescript
const facilitatorClient = new HTTPFacilitatorClient({
  url: config.facilitatorUrl
})
```

**Step 2: Create Resource Server**
```typescript
const resourceServer = new x402ResourceServer(facilitatorClient)
```

**Step 3: Register Payment Schemes** (per network)
```typescript
// Solana
resourceServer.register(SOLANA_NETWORK_ID, new ExactSvmScheme())

// Base/EVM
resourceServer.register(BASE_NETWORK_ID, new ExactEvmScheme())
```

**Step 4: Define Route Configuration**
```typescript
const routes = {
  "GET /endpoint": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.001",  // or atomic units
        network: NETWORK_ID,
        asset: ASSET_ADDRESS,
        payTo: walletAddress,
        name: "Asset Name",    // For EIP-712 (EVM)
        version: "2",          // For EIP-712 (EVM)
      }
    ],
    description: "What the user is purchasing",
    mimeType: "application/json",
  }
}
```

**Step 5: Apply Payment Middleware**
```typescript
app.use("*", paymentMiddleware(routes, resourceServer))
```

**Step 6: Define Handlers** (payment already verified by middleware)
```typescript
app.get("/endpoint", async (c) => {
  // No payment logic needed here
  // Middleware already verified payment
  return c.json({ result: "..." })
})
```

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/src/app.ts:156-300`
- Go: `examples/go/vulcan-logic-api/src/app.go:111-168`
- Rust: `examples/rust/oracle-of-babel/src/x402/middleware.rs:99-273`

### 5. Multi-Network Support Pattern (REQUIRED)

All examples MUST support at least ONE blockchain network and SHOULD support multiple networks:

**Network Constants (CAIP-2 format):**
```typescript
// Solana
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"

// Base (EVM)
const BASE_SEPOLIA = "eip155:84532"
const BASE_MAINNET = "eip155:8453"

// Token Addresses
const USDC_SOLANA_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
const USDC_SOLANA_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

**Provide multiple payment options:**
```typescript
accepts: [
  // Solana option
  {
    scheme: "exact",
    network: SOLANA_NETWORK_ID,
    asset: SOLANA_USDC_ADDRESS,
    payTo: config.solanaWalletAddress,
    price: "$0.001",
  },
  // Base option
  {
    scheme: "exact",
    network: BASE_NETWORK_ID,
    asset: BASE_USDC_ADDRESS,
    payTo: config.baseWalletAddress,
    price: "$0.001",
    name: "USD Coin",
    version: "2",
  }
]
```

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/src/app.ts:40-67`
- Go: `examples/go/vulcan-logic-api/src/app.go:27-34`

### 6. Standard Endpoints Pattern (REQUIRED)

Every example MUST provide:

1. **Root endpoint** (`GET /`) - API introduction (free, no payment)
2. **Health check** (`GET /health`) - Liveness probe (free, no payment)
3. **Business logic endpoints** - Paywalled with x402

**Example:**
```typescript
// Free endpoints
app.get("/", (c) => c.json({
  name: "My API",
  description: "...",
  endpoints: { /* ... */ }
}))

app.get("/health", (c) => c.json({ status: "ok" }))

// Apply payment middleware AFTER free endpoints
app.use("*", paymentMiddleware(routes, resourceServer))

// Paywalled endpoints
app.get("/paid-endpoint", (c) => { /* ... */ })
```

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/src/app.ts:304-341`
- Go: `examples/go/vulcan-logic-api/src/app.go:171-203`
- Rust: `examples/rust/oracle-of-babel/src/api/mod.rs:38-131`

### 7. Docker Deployment Pattern (REQUIRED)

Every example MUST provide Docker deployment using multi-stage builds:

**Dockerfile Pattern:**
```dockerfile
# Stage 1: Builder
FROM [language-base] AS builder
WORKDIR /build
COPY [source-files] .
RUN [build-commands]

# Stage 2: Runner
FROM [minimal-base]
WORKDIR /app
COPY --from=builder /build/[artifacts] .
EXPOSE 3000
CMD ["/app/binary"]
```

**Optional: docker-compose.yml** for local development:
```yaml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: deploy/docker/Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env
```

**Evidence:**
- Node.js: `examples/nodejs/deep-thought-api/deploy/docker/Dockerfile`
- Rust: `examples/rust/oracle-of-babel/deploy/docker/Dockerfile`

### 8. Documentation Pattern (REQUIRED)

Every example MUST include a `README.md` with:

1. **Title + Tagline** (thematic, memorable)
2. **What is this?** (2-3 paragraph overview)
3. **Key Features** (bullet list with what makes this example unique)
4. **Prerequisites** (Node.js version, Go version, Rust, Docker, etc.)
5. **Getting Started** (numbered steps):
   - Step 1: Clone and navigate
   - Step 2: Install dependencies
   - Step 3: Configure environment (`.env.example` → `.env`)
   - Step 4: Run development server
   - Step 5: Test with 007 agent
6. **API Endpoints** (table format with columns: Endpoint, Method, Payment, Description)
7. **Deployment Options** (Local, Docker, Cloudflare, etc.)
8. **Project Structure** (ASCII tree showing key files)
9. **Architecture** (explain patterns used)
10. **Troubleshooting** (common issues + solutions)
11. **Related Resources** (links to x402 docs, Kobaru, etc.)

**Evidence:**
- All examples follow this pattern with varying depth
- Simple examples: ~150 lines (Deep Thought)
- Complex examples: ~400+ lines (Socratic Mentor, Oracle of Babel)

### 9. Testing Pattern (REQUIRED)

Every example MUST be testable with the 007 test agent:

1. **Document test command** in README:
   ```bash
   # Terminal 1: Start API
   npm run dev  # or cargo run, go run, etc.

   # Terminal 2: Test with agent
   cd ../../tools/007-test-agent
   npm start http://localhost:3000/endpoint --network solana
   ```

2. **Provide example test output** or link to testing section

3. **(Optional but recommended)** Include unit tests for:
   - Business logic (independent of x402)
   - Configuration validation
   - Route handler logic

**Evidence:**
- All examples document testing with 007 agent
- Some examples include unit tests (e.g., `test/app.test.ts`)

### 10. Network Configuration Table (RECOMMENDED)

For clarity, include a network configuration reference in your example:

**Table Format:**
| Network | Chain ID (CAIP-2) | USDC Address | Type |
|---------|-------------------|--------------|------|
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | Testnet |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Mainnet |
| Base Sepolia | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Testnet |
| Base Mainnet | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Mainnet |

---

## Advanced Patterns (OPTIONAL)

These patterns are demonstrated in advanced examples and may be adopted for complex use cases:

### Clean Architecture / Domain-Driven Design

**Example:** `examples/nodejs/extract-wisdom-api/`

**Structure:**
```
src/
├── core/                    # Domain Layer
│   ├── entities/            # Business models
│   ├── ports/               # Interface definitions
│   └── usecases/            # Business logic
├── infra/                   # Infrastructure Layer
│   ├── adapters/            # External service implementations
│   └── config/              # Configuration
└── presentation/            # Presentation Layer
    └── http/                # HTTP handlers + x402 integration
```

**Use when:**
- Complex business logic requiring testability
- Multiple external service integrations
- Need for clear separation of concerns

**Evidence:** `examples/nodejs/extract-wisdom-api/src/` directory structure

### Dynamic Pricing

**Example:** `examples/bun/socratic-mentor-api/`

**Pattern:**
```typescript
// Calculate price based on request characteristics
function calculatePrice(request: Request): string {
  const estimatedTokens = estimateTokenUsage(request.body)
  const basePrice = 0.001
  const tokenMultiplier = estimatedTokens / 1000
  return `$${(basePrice * tokenMultiplier).toFixed(6)}`
}

// In route configuration
accepts: [{
  price: calculatePrice(c.req),  // Dynamic
  // ... other fields
}]
```

**Evidence:** `examples/bun/socratic-mentor-api/src/lib/pricing.ts`

### Mini-Ledger Pattern

**Example:** `examples/bun/socratic-mentor-api/`

**Pattern:**
- Track payment history and user state
- Support session-based interactions
- Optimistic payment flow (trust-then-verify)

**Use when:**
- Multi-turn conversations requiring context
- Usage quotas or rate limiting
- Session management needed

**Evidence:** `examples/bun/socratic-mentor-api/src/lib/state.ts`

### Service Discovery (Bazaar Extension)

**Example:** `examples/nodejs/extract-wisdom-api/`

**Pattern:**
```typescript
// Provide machine-readable service description
app.get("/.well-known/bazaar", (c) => c.json({
  provider: {
    name: "Service Name",
    description: "...",
    url: "https://example.com"
  },
  endpoints: {
    "/endpoint": {
      description: "...",
      inputSchema: { /* JSON schema */ },
      outputSchema: { /* JSON schema */ }
    }
  }
}))
```

**Evidence:** `examples/nodejs/extract-wisdom-api/` (mentioned in README)

### Anti-Fraud Protection

**Example:** `examples/nodejs/extract-wisdom-api/`

**Pattern:**
- Bind payment price to request URL/parameters
- Prevent bait-and-switch attacks
- Validate payment amount matches actual computation cost

**Evidence:** Documented in Extract Wisdom README

---

## Language-Specific Implementation Notes

### TypeScript/Node.js

- **Framework:** Hono (works on Node.js, Cloudflare, Deno, Bun)
- **x402 SDK:** `@x402/core`, `@x402/hono`, `@x402/svm`, `@x402/evm`
- **Build:** TypeScript → JavaScript (via `tsc` or `tsx`)
- **Deployment:** Node.js, Cloudflare Workers, Docker
- **Evidence:** `examples/nodejs/deep-thought-api/`, `examples/nodejs/extract-wisdom-api/`

### Bun

- **Framework:** Hono (Bun-native support)
- **x402 SDK:** Same as Node.js
- **Build:** Native Bun execution (faster than Node.js)
- **Deployment:** Bun runtime, Docker
- **Evidence:** `examples/bun/socratic-mentor-api/`

### Go

- **Framework:** Gin
- **x402 SDK:** `github.com/coinbase/x402/go` with Gin middleware
- **Build:** `go build` or `Makefile`
- **Deployment:** Standalone binary, Cloudflare Workers (via `syumai/workers`), Docker
- **Evidence:** `examples/go/vulcan-logic-api/`

### Rust

- **Framework:** Actix-web
- **x402 SDK:** Manual integration (no official Rust SDK, implement HTTP protocol directly)
- **Build:** `cargo build --release`
- **Deployment:** Standalone binary, Docker
- **Note:** Rust requires manual x402 protocol implementation (facilitator verification, middleware)
- **Evidence:** `examples/rust/oracle-of-babel/`

---

## Quality Checklist for New Examples

Before submitting a new example, verify:

- [ ] Directory structure matches pattern (src/, deploy/, test/, .env.example, README.md)
- [ ] Core app uses factory pattern (platform-agnostic)
- [ ] Platform adapters in `deploy/` directory (standalone, docker, optional cloudflare)
- [ ] `.env.example` provided with all variables documented
- [ ] Startup validation fails fast on missing required config
- [ ] x402 payment flow implemented (facilitator → resource server → middleware → routes)
- [ ] Multi-network support (at least Solana OR Base, ideally both)
- [ ] Standard endpoints present (/, /health, paywalled endpoints)
- [ ] Multi-stage Dockerfile provided
- [ ] README.md follows documentation pattern (12+ sections)
- [ ] Testable with 007 test agent (documented in README)
- [ ] Network configuration constants use CAIP-2 format
- [ ] No secrets in repository (only .env.example)
- [ ] Code compiles/runs successfully
- [ ] Payment flow tested end-to-end with 007 agent

---

## Common Pitfalls to Avoid

1. **Environment coupling in core app** - Core app should not read `process.env` or `os.Getenv` directly
2. **Missing .env.example** - Always provide template
3. **Hardcoded network IDs** - Use constants, make configurable
4. **Payment logic in handlers** - Middleware handles payment, handlers focus on business logic
5. **Skipping health endpoint** - Required for container orchestration
6. **Missing startup validation** - Fail fast on invalid config
7. **Inconsistent variable names** - Use `SOLANA_WALLET_ADDRESS`, not `WALLET_SOL` or `SOL_ADDRESS`
8. **Deploying with devnet config** - Always review network constants before production
9. **Inadequate documentation** - README should enable zero-context developers to run the example
10. **No Docker support** - Docker deployment is mandatory for production examples
