# 🖖 Vulcan Logic API

> "Fascinating. Deep Thought was... inefficient. I provide logic immediately."

> [!IMPORTANT]
> **DISCLAIMER: EDUCATIONAL USE ONLY**
> This project is an open-source demonstration of the **x402 protocol** and is **NOT** affiliated with, endorsed by, or connected to **CBS Studios Inc.** or **Paramount Pictures**.
>
> **"Spock"** and **"Star Trek"** are registered trademarks of their respective owners. This project is a non-commercial homage to one of the greatest characters in entertainment history.
>
> **No real money is exchanged.** This application is designed exclusively for the **Base Sepolia (Devnet)** test network. The "payments" are made with testnet USDC which has no real-world value—because as we all know, *there is no money in the future of Star Trek*. One day, we'll get there...

A **production-ready** Go implementation that demonstrates the logical application of the **x402 payment protocol**. You will learn how to monetize API endpoints with blockchain micro-payments while maintaining the efficiency and reliability required for real-world deployment.

**What you will accomplish:**
- Build a paywalled AI service using Go and the Gin framework
- Integrate x402 payment verification through the Kobaru facilitator gateway
- Deploy the same codebase to multiple platforms (standalone server, Docker, Cloudflare Workers)
- Implement production-grade features: graceful shutdown, request timeouts, CORS support

This implementation charges **$0.001 USDC** per request on **Base Sepolia** testnet. The logic is sound. The architecture is efficient.

**Why Go?** Aiming for efficiency is only logical. Go's concurrent goroutines, low memory footprint, and fast compilation make it the optimal choice for production API services. Where Node.js requires a runtime and Python sacrifices performance for simplicity, Go compiles to a single binary with no dependencies. The result: faster startup, lower resource consumption, and predictable performance under load. For a payment-gated API where every millisecond and megabyte matters, Go is the rational selection.

---

## ✨ Key characteristics

- **Spock Persona**: Powered by **Google Gemini 2.5 Flash**, providing logical advice in character
- **Micro-payments**: x402 protocol charges **$0.001 USDC** per `/advice` request on Base blockchain
- **Platform Agnostic**: Clean separation between application logic (`src/app.go`) and platform adapters (`deploy/`)
- **Production Ready**: Graceful shutdown, request timeouts (25s for AI, 30s write), CORS middleware
- **Lightweight Framework**: Built with Gin for optimal performance

---

## 🛠️ Prerequisites

You will need:
- **Go 1.23+** installed on your system
- **Base Sepolia wallet address** to receive payments (testnet)
- **Google AI Studio API key** ([obtain here](https://aistudio.google.com/))
- **Docker** (optional, for containerized deployment)

> **Tip:** For testing payment flows, use the [007 Test Agent](../../../tools/007-test-agent) included in this repository. It handles x402 payment negotiation automatically.

---

## 🚀 Getting started

### Step 1: Configure your environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
BASE_WALLET_ADDRESS=0x1234...  # Your Base Sepolia wallet address
GEMINI_API_KEY=AIza...         # Your Google AI Studio API key
FACILITATOR_URL=https://gateway.kobaru.io  # Optional, this is the default
PORT=3000                       # Optional, defaults to 3000
```

> **Note:** The `.env` file is excluded from version control via `.gitignore`. Your credentials remain secure.

### Step 2: Run the standalone server

```bash
go run deploy/standalone/main.go
```

You will see:
```
🖖 Vulcan Logic API running on port 3000
💰 Price: $0.001 (USDC on Base Sepolia)
📝 Wallet: 0x1234...
```

The server is now operational at `http://localhost:3000`.

### Step 3: Verify the deployment

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status": "functional", "logic_levels": "optimal"}
```

### Step 4: Test the payment flow

Request advice without payment:
```bash
curl -i -X POST http://localhost:3000/advice \
  -H "Content-Type: application/json" \
  -d '{"question": "Is it logical to work late?"}'
```

You will receive `402 Payment Required` with payment options. This is the expected behavior.

To complete the payment flow, use an x402-compatible client or the [007 Test Agent](../../../tools/007-test-agent):
```bash
cd ../../../tools/007-test-agent
npm install
npm start http://localhost:3000/advice
```

The agent handles payment negotiation automatically and displays Spock's response.

---

## 📡 API endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/` | GET | Free | API introduction and endpoint discovery |
| `/advice` | POST | $0.001 | Ask a question, receive logical advice |
| `/health` | GET | Free | Server health status |

### Making paid requests

The `/advice` endpoint requires payment via the x402 protocol. The flow is:

1. **First request** (without payment) → `402 Payment Required` response with payment options
2. **Client creates payment** → Signs transaction with Base Sepolia USDC
3. **Second request** (with payment token) → `200 OK` with advice

**Example request with payment:**
```bash
curl -X POST http://localhost:3000/advice \
  -H "Content-Type: application/json" \
  -H "Authorization: 402 <payment_token>" \
  -d '{"question": "How do I deal with human emotions?"}'
```

**Response:**
```json
{
  "advice": "Human emotions are volatile and often counter-productive. However, suppressing them entirely can lead to psychological instability in your species. Logical processing suggests acknowledging their existence, analyzing their source, and then proceeding with the most rational course of action."
}
```

> **Tip:** The x402 protocol is blockchain-agnostic. This implementation uses Base, but the pattern applies to any EVM-compatible chain.

---

## 🐳 Deployment options

### Docker deployment

Build and run with Docker Compose:
```bash
cd deploy/docker
docker-compose up --build
```

The containerized server includes:
- Multi-stage build for minimal image size
- Environment variable configuration
- Port mapping to 3000

### Cloudflare Workers deployment

Deploy to Cloudflare's edge network using TinyGo:

```bash
# Verify TinyGo installation
tinygo version

# Configure wrangler.toml with your account details
# Set environment variables in Cloudflare dashboard

# Deploy
npx wrangler deploy
```

> **Note:** Cloudflare Workers require environment variables to be configured through the dashboard or `wrangler secret put` command.

### Production deployment checklist

Before deploying to production:

- [ ] Set `BASE_WALLET_ADDRESS` environment variable
- [ ] Set `GEMINI_API_KEY` environment variable
- [ ] Optional: Set `FACILITATOR_URL` (defaults to Kobaru gateway)
- [ ] Optional: Set `PORT` (defaults to 3000)
- [ ] Optional: Set `GIN_MODE=debug` for troubleshooting (defaults to release mode)
- [ ] For mainnet: Update `BaseNetworkID` and `BaseAssetAddress` in `src/app.go`
- [ ] Verify graceful shutdown works with your orchestrator (Kubernetes, Cloud Run, etc.)

---

## 🏗️ Project structure

```
vulcan-logic-api/
├── src/
│   ├── app.go              # Core application (Gin + x402 + Gemini)
│   ├── prompt.go           # Spock system prompt
│   └── app_test.go         # Test suite
├── deploy/
│   ├── standalone/         # Standalone server with graceful shutdown
│   │   └── main.go
│   ├── docker/             # Docker configuration
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── cloudflare/         # Cloudflare Workers adapter
│       └── worker.go
├── go.mod
├── go.sum
└── README.md
```

**Architecture pattern:** Multi-platform factory

- `src/app.go` exports `CreateApp(config)` - a platform-agnostic factory function
- Platform adapters in `deploy/` handle environment-specific concerns
- The same application logic runs on standalone servers, Docker, and Cloudflare Workers

This separation is logical and maintainable.

---

## 🧪 Running tests

The test suite verifies:
- Health endpoint functionality
- Root endpoint metadata
- Payment protection (402 response for unpaid requests)

Run tests:
```bash
go test -v ./src/...
```

Expected output:
```
=== RUN   TestHealthEndpoint
--- PASS: TestHealthEndpoint
=== RUN   TestRootEndpoint
--- PASS: TestRootEndpoint
=== RUN   TestPaymentRequired
--- PASS: TestPaymentRequired
PASS
```

> **Note:** Tests use a dummy Gemini API key and do not make real external API calls.

---

## 🔧 Troubleshooting

### Server fails to start

**Problem:** `Failed to create Gemini client: API key not valid`

**Solution:** Verify your `GEMINI_API_KEY` in the `.env` file. Obtain a valid key from [Google AI Studio](https://aistudio.google.com/).

---

**Problem:** `Missing required environment variables: BASE_WALLET_ADDRESS, GEMINI_API_KEY`

**Solution:** Ensure your `.env` file exists and contains both required variables. Run `cp .env.example .env` if you haven't created it yet.

---

### Payment verification fails

**Problem:** `403 Forbidden` after providing payment token

**Solution:**
- Verify the facilitator gateway is reachable: `curl https://gateway.kobaru.io/health`
- Check that your payment token is valid and not expired
- Ensure you're using Base Sepolia testnet USDC (not mainnet)

---

**Problem:** `402 Payment Required` doesn't include payment options

**Solution:** The x402 middleware may not be initialized correctly. Check logs for errors during startup. Verify `SyncFacilitatorOnStart: false` is set in `src/app.go:97`.

---

### Gemini API timeouts

**Problem:** `context deadline exceeded` when requesting advice

**Solution:** The Gemini API has a 25-second timeout. If responses consistently timeout:
- Check your network connectivity to Google's AI services
- Reduce question complexity for faster responses
- Increase timeout in `src/app.go:172` if necessary (not recommended)

---

### Docker build fails

**Problem:** `Cannot find module` during Docker build

**Solution:** Run `go mod download` locally first, then rebuild:
```bash
go mod download
cd deploy/docker
docker-compose up --build
```

---

## 🔗 Related documentation

- [x402 Protocol Specification](https://github.com/coinbase/x402) - Core protocol details
- [Kobaru Gateway Documentation](https://kobaru.io/docs) - Facilitator integration guide
- [API Paywall Cookbook](../../../README.md) - Additional examples and patterns
- [007 Test Agent](../../../tools/007-test-agent) - Universal x402 testing tool

---

## 🎯 Next steps

Now that you have a working x402-paywalled API, consider:

1. **Explore the codebase:** Read `src/app.go` to understand x402 middleware integration
2. **Test with 007 Agent:** Use the automated testing tool to verify payment flows
3. **Compare implementations:** Review the [Node.js Deep Thought API](../../nodejs/deep-thought-api) for alternative patterns
4. **Customize pricing:** Modify `AdvicePrice` in `src/app.go:30` to experiment with different amounts
5. **Add your own endpoints:** Follow the pattern in `src/app.go:86-98` to create additional paywalled routes

**For production deployment:**
- Migrate to Base mainnet by updating `BaseNetworkID` and `BaseAssetAddress`
- Implement rate limiting to prevent quota exhaustion
- Add structured logging for observability
- Configure monitoring and alerting

Live long and prosper. 🖖

---

## In Memoriam

This project is dedicated to the memory of **Gene Roddenberry**, who graced us with the Star Trek universe and its vision of a future built on logic, exploration, and the best of humanity. And to **Leonard Nimoy**, who gave life—and human sentiment—to one of the most beloved characters in entertainment history: Spock.

Through Spock, we learned that logic and emotion need not be adversaries. That being different is not a weakness. That the needs of the many outweigh the needs of the few, or the one.

"The miracle is this: the more we share, the more we have." — Leonard Nimoy

Thank you for showing us what it means to be human by portraying someone who was not.
