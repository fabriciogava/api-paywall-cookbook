# CLAUDE.md — AI Behavioral Control

API Paywall Cookbook: production examples monetizing APIs via x402 protocol and Kobaru gateway.

## P0: SDK Rules

### Languages WITH official SDKs (TypeScript, Go, Python)

For these languages, NEVER implement x402 protocol manually. ALWAYS use official SDKs. AI agents consistently attempt to "handle the protocol headers themselves" — this ALWAYS fails.

| Language | SDK packages | Reference example |
|----------|-------------|-------------------|
| TypeScript/Node.js/Bun | `@x402/core`, `@x402/hono`, `@x402/svm`, `@x402/evm` | `examples/nodejs/deep-thought-api/` |
| Go | `github.com/coinbase/x402/go` | `examples/go/vulcan-logic-api/` |
| Python | `x402` (`x402[fastapi,evm]`) | `examples/python/photo-restoration-api/` |

NEVER (when an SDK exists for the language):
- Implement x402 HTTP headers, 402 responses, or `Authorization: 402` parsing manually
- Write custom facilitator communication or payment verification logic
- Implement cryptographic signature verification or blockchain interaction code
- Create custom middleware instead of using SDK middleware
- Start from scratch instead of copying reference examples
- Use deprecated x402 v1 SDKs or patterns

### Languages WITHOUT official SDKs (Rust, C, Zig, Java, PHP, etc.)

Manual protocol implementation is REQUIRED. You MUST:
1. Study the Rust reference implementation at `examples/rust/oracle-of-babel/src/x402/` (files: `mod.rs`, `types.rs`, `config.rs`, `http.rs`, `middleware.rs`)
2. Strictly follow the official x402 v2 specification: https://raw.githubusercontent.com/coinbase/x402/refs/heads/main/specs/x402-specification-v2.md
3. Implement the same middleware pattern as the Rust example (facilitator verification, 402 response format, header parsing)

NEVER invent your own protocol behavior — every header name, response format, and verification flow MUST match the v2 spec exactly.

## P0: Correct Import Paths

AI agents MUST use these exact imports. Wrong imports produce code that compiles but fails at runtime.

### TypeScript (verified against `examples/nodejs/deep-thought-api/src/app.ts`)

CORRECT:
```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/hono"
import { ExactSvmScheme } from "@x402/svm/exact/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { HTTPFacilitatorClient } from "@x402/core/server"
```

WRONG (will fail):
```typescript
import { x402ResourceServer } from "@x402/core"        // WRONG subpath
import { HTTPFacilitatorClient } from "@x402/core"      // WRONG subpath
import { ExactSvmScheme } from "@x402/svm"              // WRONG subpath
import { ExactEvmScheme } from "@x402/evm"              // WRONG subpath
import { paymentMiddleware } from "@x402/core"           // WRONG package
```

### Go (verified against `examples/go/vulcan-logic-api/src/app.go`)

CORRECT:
```go
import (
    x402 "github.com/coinbase/x402/go"
    x402http "github.com/coinbase/x402/go/http"
    x402gin "github.com/coinbase/x402/go/http/gin"
    x402evm "github.com/coinbase/x402/go/mechanisms/evm/exact/server"
)
```

WRONG (will fail):
```go
import "github.com/coinbase/x402/go/pkg/x402"           // WRONG path
import "github.com/coinbase/x402/go/pkg/schemes/svm"    // WRONG path
import "github.com/coinbase/x402/go/pkg/schemes/evm"    // WRONG path
```

Go middleware API — use `x402gin.X402Payment(x402gin.Config{...})`, NOT `x402gin.PaymentMiddleware(routes, server)`.

### Python (verified against `examples/python/photo-restoration-api/src/app.py`)

CORRECT:
```python
from x402.http import HTTPFacilitatorClient, FacilitatorConfig, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.server import x402ResourceServer
from x402.mechanisms.evm.exact import ExactEvmServerScheme
```

WRONG (will fail):
```python
from x402 import X402ResourceServer               # WRONG path
from x402 import HTTPFacilitatorClient             # WRONG path
from x402 import payment_middleware                 # WRONG name
from x402 import ExactEvmScheme                    # WRONG name
```

Python middleware class is `PaymentMiddlewareASGI`, NOT `payment_middleware`.
Python scheme class is `ExactEvmServerScheme`, NOT `ExactEvmScheme`.

### Rust / Other languages without SDK

No official SDK. Study the reference implementation at `examples/rust/oracle-of-babel/src/x402/` and the [x402 v2 spec](https://raw.githubusercontent.com/coinbase/x402/refs/heads/main/specs/x402-specification-v2.md). Replicate the same middleware pattern (facilitator verification, 402 response format, header parsing) in your target language.

## P1: Directory Structure

Every example MUST follow:
```
examples/[language]/[api-name]/
├── src/app.[ext]          # Core app — factory function, platform-agnostic
├── deploy/
│   ├── standalone/main.[ext]  # Platform adapter — loads env, calls factory
│   └── docker/Dockerfile      # Multi-stage build
├── .env.example           # All variables documented
└── README.md
```

## P1: Factory Pattern

Core app (`src/app.[ext]`) MUST:
- Export a factory function that accepts a config object and returns the framework instance
- NEVER read environment variables directly (`process.env`, `os.Getenv`, `os.getenv`)

Platform adapter (`deploy/standalone/main.[ext]`) MUST:
- Load environment variables
- Validate required config (fail fast with `exit(1)` on missing values)
- Build config object
- Call factory function
- Start HTTP server

TypeScript signature: `export async function createApp(config: AppConfig): Promise<Hono>`
Go signature: `func CreateApp(config AppConfig) *gin.Engine`
Python signature: `async def create_app(config: AppConfig) -> FastAPI`

## P1: Standard Endpoints

| Endpoint | Payment | Purpose |
|----------|---------|---------|
| `GET /` | Free | API introduction with endpoint list |
| `GET /health` | Free | Liveness probe for orchestration |
| Business endpoints | Paywalled | Core API functionality |

Free endpoints MUST be registered before payment middleware is applied.

## P1: x402 Integration Patterns

### TypeScript
```typescript
const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl })
const resourceServer = new x402ResourceServer(facilitatorClient)
resourceServer.register(NETWORK_ID, new ExactSvmScheme())
resourceServer.register(BASE_NETWORK_ID, new ExactEvmScheme())
app.use("*", paymentMiddleware(routes, resourceServer))
```

### Go
```go
facilitatorClient := x402http.NewHTTPFacilitatorClient(&x402http.FacilitatorConfig{
    URL: config.FacilitatorURL,
})
paymentMiddleware := x402gin.X402Payment(x402gin.Config{
    Routes:      routesConfig,
    Facilitator: facilitatorClient,
    Schemes: []x402gin.SchemeConfig{{
        Network: x402.Network(BaseNetworkID),
        Server:  x402evm.NewExactEvmScheme(),
    }},
})
r.Use(paymentMiddleware)
```

### Python
```python
facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=config.facilitator_url))
server = x402ResourceServer(facilitator)
server.register(config.network_id, ExactEvmServerScheme())
routes = {"POST /endpoint": RouteConfig(accepts=[PaymentOption(
    scheme="exact", pay_to=config.wallet_address,
    price=config.price, network=config.network_id,
)])}
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
```

## P2: Network Constants (CAIP-2)

| Network | ID | USDC Address |
|---------|----|-------------|
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Base Sepolia | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| SKALE Mainnet | `eip155:1187947933` | `0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20` |

## P2: Environment Variables

Env var names are network-specific per example. Each example defines its own wallet variable.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `SOLANA_WALLET_ADDRESS` | Per example | — | TS examples (Solana) |
| `BASE_WALLET_ADDRESS` | Per example | — | TS/Go examples (Base) |
| `SKALE_WALLET_ADDRESS` | Per example | — | Python example (SKALE) |
| `FACILITATOR_URL` | No | `https://gateway.kobaru.io` | All examples |
| `PORT` | No | `3000` | All examples |

Check each example's `.env.example` for the exact variable names it expects.

## P2: Docker & Testing

- Every example MUST have `deploy/docker/Dockerfile` using multi-stage build
- Every example MUST be testable with `tools/007-test-agent/`:
  ```bash
  cd tools/007-test-agent && npm start http://localhost:3000/endpoint
  ```
- 007-test-agent requires `SVM_PRIVATE_KEY` env var (Base58-encoded Solana private key)

## P2: Quality Checklist

- [ ] Official x402 v2 SDK used (not manual implementation)
- [ ] Pattern copied from reference example for the language
- [ ] Import paths match the "Correct Import Paths" section above exactly
- [ ] Directory structure: `src/`, `deploy/standalone/`, `deploy/docker/`, `.env.example`, `README.md`
- [ ] Factory pattern: core app takes config param, never reads env vars
- [ ] Platform adapter validates required config and fails fast
- [ ] Free endpoints (`/`, `/health`) registered before payment middleware
- [ ] Multi-stage Dockerfile in `deploy/docker/`
- [ ] README.md with: title, overview, prerequisites, getting started, API endpoints table, deployment, project structure
- [ ] Testable with 007-test-agent
- [ ] No secrets committed (only `.env.example`)
- [ ] Network IDs in CAIP-2 format
