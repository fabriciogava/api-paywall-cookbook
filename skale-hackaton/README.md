# 🎯 SKALE x402 Hackathon Toolkit

> **San Francisco Agentic Commerce x402 Hackathon Edition**

Welcome to the **SKALE Hackathon Toolkit** - a streamlined collection of tools to help you build payment-enabled APIs using the x402 protocol on SKALE networks.

## 🚀 What's Inside

This toolkit contains two essential tools, pre-configured for the hackathon:

### 📁 [`test-agent/`](./test-agent) - Your API Testing Companion

**What it does:** A command-line tool (Agent 007) that tests x402-enabled paywalled APIs by automatically handling payment flows.

**Perfect for:**
- ✅ Testing your own x402 API during development
- ✅ Debugging payment flows with real-time logging
- ✅ Validating that your API correctly implements x402

**Key Features:**
- Pre-configured for SKALE Hackathon Sandbox (no `--network` flag needed!)
- Educational logging - see every step of the payment protocol
- File upload support for testing image APIs
- Clean, forkable code for building custom agents

**Quick Start:**
```bash
cd test-agent
npm install
cp .env.example .env
# Add your EVM_PRIVATE_KEY to .env
npm start http://localhost:3000/answer
```

👉 [Full test-agent documentation](./test-agent/README.md)

---

### 📁 [`example-server/`](./example-server) - Deep Thought API

**What it does:** A reference implementation of an x402-enabled API server. The "Hello World" of paywalled APIs, answering the Ultimate Question for $0.001.

**Perfect for:**
- ✅ Learning how to build x402 server-side payment verification
- ✅ Forking as a starting point for your own paywalled API
- ✅ Understanding the complete payment flow (client + server)

**Key Features:**
- Pre-configured for SKALE Hackathon Sandbox
- Platform-agnostic design (runs on Node.js, Cloudflare, Docker)
- Clean architecture with extensive comments
- Optional Kobaru API key for console access and metrics

**Quick Start:**
```bash
cd example-server
npm install
cp .env.example .env
# Add your SKALE_WALLET_ADDRESS to .env
npm run dev
```

👉 [Full example-server documentation](./example-server/README.md)

---

## 🎯 Complete Workflow: Build → Test → Deploy

### Step 1: Build Your API (or use the example)

```bash
# Option A: Use the example API
cd example-server
npm install
cp .env.example .env
# Edit .env: Add SKALE_WALLET_ADDRESS and optionally KOBARU_API_KEY
npm run dev
```

Your API is now running at `http://localhost:3000` 🎉

### Step 2: Test Your API

```bash
# In a new terminal
cd test-agent
npm install
cp .env.example .env
# Edit .env: Add EVM_PRIVATE_KEY
npm start http://localhost:3000/answer
```

Watch as the agent:
1. Makes a request (gets 402 Payment Required)
2. Creates a payment proof
3. Retries with Authorization header
4. Receives the answer (42!)

### Step 3: Monitor in Kobaru Console

1. Sign up at https://console.kobaru.io/sign-up
2. Generate your API key
3. Add `KOBARU_API_KEY` to your server's `.env`
4. Restart your server
5. Open the Kobaru Console
6. See real-time payment logs as you test! 📊

---

## 🚀 Powered by Kobaru

**Kobaru makes blockchain payments simple** - focus on building your winning solution, not payment infrastructure.

### Hackathon Superpowers with Kobaru

✅ **Real-Time Debugging** - See payment logs live in the console as you test
✅ **Success Metrics** - Track payment volume, conversion, and revenue to measure impact
✅ **Zero Infrastructure** - No blockchain nodes, RPC endpoints, or gas fee headaches
✅ **Free Access** - Full features available during the hackathon

### Get Started with Kobaru

1. 🔗 **Sign up for free:** https://console.kobaru.io/sign-up
2. 🔑 **Generate your API key** (optional but recommended) at the console
3. 🔍 **Open the console** while testing to see payments in real-time
4. 📊 **Track metrics** to optimize your solution and impress judges
5. 📚 **Learn more:** https://www.kobaru.io

**💡 Pro Tip:** Keep the Kobaru Console open during your demo - showing live payment logs flowing through your API is a powerful way to prove your solution works!

---

## 💡 Quick Reference

### Environment Variables

**For your API server (`example-server`):**
```bash
SKALE_WALLET_ADDRESS=""      # Required - where you receive payments
KOBARU_API_KEY=""            # Optional - for console access & metrics
FACILITATOR_URL="https://gateway.kobaru.io"
PORT=3000
```

**For testing (`test-agent`):**
```bash
EVM_PRIVATE_KEY=""           # Required - for signing payment proofs
# No API key needed - this is client-side only
```

### SKALE Networks Supported

| Network | Chain ID | USDC Contract | Environment |
|---------|----------|---------------|-------------|
| **Hackathon Sandbox** ⭐ | `eip155:103698795` | `0xc4083B1E81ceb461Ccef3FDa8A9F24F0d764B6D8` | **Default** |
| SKALE Sepolia | `eip155:324705682` | `0x2e08028E3C4c2356572E096d8EF835cD5C6030bD` | Testnet |
| SKALE Mainnet | `eip155:1187947933` | `0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20` | Production |

⭐ = Pre-configured default (no configuration needed!)

---

## 🛠️ For Builders

### Why This Toolkit is Perfect for the Hackathon

**🎓 Educational Focus:**
- Every line of code is documented and explained
- Shows the complete x402 flow from both client and server perspectives
- Real-time logging helps you understand what's happening

**⚡ Hackathon-Optimized:**
- Pre-configured for SKALE Hackathon Sandbox
- Minimal environment variables required
- No multi-chain complexity to slow you down

**🔧 Production-Ready Patterns:**
- Factory pattern for platform-agnostic code
- Clean separation of concerns
- Works on Node.js, Cloudflare, Docker, etc.

**📚 Reference Implementation:**
- Copy this structure for your own APIs
- Fork the test-agent to build custom payment clients
- Learn x402 protocol by reading working code

### Suggested Use Cases

**Build an AI API:**
```
example-server → Your AI Endpoint
- POST /analyze → Analyze text with AI ($0.01)
- POST /generate → Generate content ($0.05)
- Test with test-agent during development
```

**Build a Data API:**
```
example-server → Your Data Endpoint
- GET /price/:symbol → Real-time price data ($0.001)
- GET /analytics → Market analytics ($0.10)
- Test with test-agent during development
```

**Build Custom Agents:**
```
test-agent → Fork for your use case
- Automated payment testing
- Payment flow debugging
- Custom payment clients
```

---

## 🔗 Resources

### Hackathon Resources

- **💬 Hackathon Telegram:** https://t.me/c/2825693624/538
- **🎯 SKALE Faucet:** (Check Telegram for testnet funds)
- **📊 Kobaru Console:** https://console.kobaru.io

### Technical Resources

- **x402 Protocol Spec:** https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
- **Kobaru Documentation:** https://www.kobaru.io
- **SKALE Documentation:** https://skale.space
- **Hono Framework:** https://hono.dev

### Full Multi-Chain Support

This is a **SKALE-focused hackathon edition**. For production use with Solana and Base support:

👉 **Original API Paywall Cookbook:** https://github.com/kobaru/api-paywall-cookbook

---

## 📝 License

Apache 2.0 - Open Source

---

## 🎉 Good Luck!

You now have everything you need to build amazing payment-enabled APIs for the hackathon:

1. ✅ A working example server to learn from (and fork!)
2. ✅ A testing tool to validate your implementation
3. ✅ Pre-configured SKALE network settings
4. ✅ Kobaru integration for metrics and debugging
5. ✅ Comprehensive documentation

**Now go build something amazing!** 🚀

Questions? Join the Telegram: https://t.me/c/2825693624/538

---

*Don't Panic! 🐬*
