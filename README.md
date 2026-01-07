# 🚀 API Paywall Cookbook

**Practical examples of monetizing APIs with the x402 protocol and Kobaru gateway**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![x402 Protocol](https://img.shields.io/badge/protocol-x402-purple.svg)](https://github.com/coinbase/x402)
[![Kobaru Gateway](https://img.shields.io/badge/gateway-Kobaru-orange.svg)](https://kobaru.io)

---

## 📖 About This Project

The **API Paywall Cookbook** is an open-source collection of production-ready examples demonstrating how to monetize APIs using the [x402 protocol](https://github.com/coinbase/x402) and the [Kobaru gateway](https://kobaru.io).

The x402 protocol brings the long-promised HTTP 402 "Payment Required" status code to life, enabling native micropayments for the machine economy. Kobaru acts as a facilitator gateway that handles payment verification, settlement, and provides a seamless developer experience.

### 🎯 Project Goals

1. **Production Testing** — All examples in this cookbook are deployed to production, serving as real-world test cases for the Kobaru gateway.

2. **Practical Learning** — Provide tangible, hands-on examples that go beyond basic documentation, showing developers exactly how to implement paywalled APIs in real scenarios.

3. **Encourage Adoption** — Demonstrate how easy it is for API vendors to monetize their services with x402, inspiring new ideas for creating valuable, pay-per-use APIs.

---

## 🧪 Why This Cookbook?

While the official x402 repository contains reference implementations, this cookbook focuses on:

- **Real-world scenarios** — Each example solves a practical problem.
- **Multiple languages** — Examples in Node.js, Python, Go, and more.
- **Multiple blockchains** — Test different networks (Base, Solana, etc.).
- **Production-ready code** — Not just "hello world", but deployable APIs.
- **Learning by example** — Perfect for developers new to x402 or micropayments.

Think of this as a **sandbox for developers** — a place to experiment, learn, and get inspired.

---

## 📁 Repository Structure

```
api-paywall-cookbook/
├── examples/
│   ├── nodejs/
│   │   ├── deep-thought-api/      # Reference implementation (Hono + x402)
│   │   ├── extract-wisdom-api/    # AI-powered YouTube wisdom extraction
│   │   └── ...
│   ├── python/                    # Coming soon
│   ├── go/                        # Coming soon
│   └── advanced/                  # Coming soon
├── tools/
│   └── 007-test-agent/            # Universal x402 API testing tool
└── README.md
```

---

## 🏁 Getting Started

### Prerequisites

- A [Kobaru account](https://kobaru.io/signup) (or self-hosted facilitator)
- A wallet with funds on a supported blockchain (Base, Solana, etc.)
- Node.js 18+, Python 3.10+, or Go 1.21+ (depending on the example)

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/kobaru/api-paywall-cookbook.git
   cd api-paywall-cookbook
   ```

2. **Pick an example**

   ```bash
   cd examples/nodejs/weather-api
   ```

3. **Configure your environment**

   ```bash
   cp .env.example .env
   # Edit .env with your Kobaru API key and wallet address
   ```

4. **Install dependencies and run**

   ```bash
   npm install
   npm run dev
   ```

5. **Test the paywalled endpoint**

   ```bash
   # Using the 007 Test Agent (recommended)
   cd tools/007-test-agent
   npm install
   npm start http://localhost:3000/answer

   # Or use curl to see the 402 response
   curl http://localhost:3000/answer
   ```

---

## 🌐 Live APIs

All cookbook examples are deployed to production. You can test them directly:

| API | Description | Price | Network |
|-----|-------------|-------|---------|
| 🧠 Deep Thought API | The Answer to Life, Universe, and Everything | $0.001 | Solana |
| 🧙 Extract Wisdom API | AI-powered wisdom extraction from YouTube videos | Dynamic (per token) | Solana |

*More APIs coming soon!*

---

## 📚 Examples

### By Language

| Language | Examples | Status |
|----------|----------|--------|
| **Node.js** | [Deep Thought API](examples/nodejs/deep-thought-api), [Extract Wisdom API](examples/nodejs/extract-wisdom-api) | ✅ Available |
| **Python** | FastAPI, Flask | 🔜 Coming Soon |
| **Go** | Standard library, Gin | 🔜 Coming Soon |

### By Blockchain

| Network | Examples | Status |
|---------|----------|--------|
| **Solana** | [Deep Thought API](examples/nodejs/deep-thought-api), [Extract Wisdom API](examples/nodejs/extract-wisdom-api) | ✅ Available |
| **Base** | EVM examples | 🔜 Coming Soon |
| **Arbitrum** | EVM examples | 🔜 Coming Soon |

### By Complexity

| Level | Description | Examples |
|-------|-------------|----------|
| 🟢 **Beginner** | Simple single-endpoint APIs | [Deep Thought API](examples/nodejs/deep-thought-api) |
| 🟡 **Intermediate** | Dynamic pricing, external integrations | [Extract Wisdom API](examples/nodejs/extract-wisdom-api) |
| 🔴 **Advanced** | Sessions, subscriptions, streaming | Coming Soon |

---

## 🔧 How It Works

The x402 protocol enables a seamless pay-per-request flow:

```
┌─────────┐         ┌─────────────┐         ┌─────────────┐
│  Client │ ──(1)── │   Your API  │ ──(5)── │   Kobaru    │
│         │         │  (Resource) │         │ (Facilitator)│
└─────────┘         └─────────────┘         └─────────────┘
     │                     │                       │
     │  GET /resource      │                       │
     │ ─────────────────►  │                       │
     │                     │                       │
     │  402 Payment Required                       │
     │  (Payment options)  │                       │
     │ ◄─────────────────  │                       │
     │                     │                       │
     │  GET /resource      │                       │
     │  + Payment header   │                       │
     │ ─────────────────►  │                       │
     │                     │   POST /verify        │
     │                     │ ──────────────────►   │
     │                     │   ✓ Valid             │
     │                     │ ◄──────────────────   │
     │                     │                       │
     │  200 OK + Resource  │   POST /settle        │
     │ ◄─────────────────  │ ──────────────────►   │
     │                     │                       │
```

With Kobaru, you don't need to handle blockchain interactions directly. Simply:

1. Add the x402 middleware to your API
2. Configure your payment requirements (price, accepted tokens/networks)
3. Let Kobaru handle verification and settlement

---

## 🛠️ Development Tools

### 007 Test Agent

A universal testing tool for x402-enabled APIs. Test **any** paywalled endpoint (local, remote, third-party) with Solana payments.

**Features:**
- ✅ Works with any x402-compliant API
- ✅ Detailed logging of the payment flow
- ✅ Support for Solana mainnet and devnet
- ✅ Simple command-line interface

**Quick Usage:**
```bash
cd tools/007-test-agent
npm install
cp .env.example .env
# Add your SVM_PRIVATE_KEY to .env

# Test any x402 API
npm start http://localhost:3000/answer
npm start https://api.example.com/paid-endpoint
```

Perfect for:
- Testing your APIs during development
- Exploring third-party paywalled APIs
- Understanding the x402 protocol flow
- Automated integration testing

[Read the full documentation →](tools/007-test-agent/README.md)

---

## 🤝 Contributing

We welcome contributions! Here are some ways you can help:

- **Add new examples** — Have an idea for a useful paywalled API? Build it!
- **Improve documentation** — Help others understand the code better.
- **Report issues** — Found a bug? Let us know.
- **Suggest features** — Ideas for new examples or improvements.

### Contribution Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-new-api`)
3. Follow the existing code style and structure
4. Add documentation for your example
5. Submit a pull request

---

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

---

## 🔗 Resources

- **[Kobaru Documentation](https://docs.kobaru.io)** — Complete guide to using the Kobaru gateway
- **[x402 Protocol Specification](https://github.com/coinbase/x402)** — The official x402 protocol repository
- **[x402 SDKs](https://github.com/coinbase/x402#typescript)** — Official SDKs for TypeScript, Python, and Go

---

## ❓ FAQ

<details>
<summary><strong>Do I need crypto to use these APIs?</strong></summary>

Yes, currently x402 payments are made using stablecoins (like USDC) on supported blockchains. However, Kobaru is working on fiat settlement options.
</details>

<details>
<summary><strong>What's the minimum payment amount?</strong></summary>

There's no functional minimum! You can charge fractions of a cent per request, making true micropayments possible.
</details>

<details>
<summary><strong>Can I use this with my existing API?</strong></summary>

Absolutely! You can add x402 payment requirements to existing endpoints or use Kobaru's transparent proxy to add a paywall without changing your backend.
</details>

<details>
<summary><strong>Which blockchains are supported?</strong></summary>

Currently, x402 and Kobaru support Base, Solana, and other EVM-compatible chains. Check the [Kobaru docs](https://docs.kobaru.io) for the latest list.
</details>

---

<p align="center">
  <strong>Built with 💜 for the machine economy</strong>
  <br>
  <a href="https://kobaru.io">Kobaru</a> • <a href="https://github.com/coinbase/x402">x402 Protocol</a>
</p>
