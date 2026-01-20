# 🎮 God Mode: Zero-Code API Monetization

> "What if Jurassic Park had just paid their IT staff properly?"

Welcome to God Mode.  The timeline where everything just... works.

## 🌟 What is this?

Kobaru's Transparent Proxy turns your unpaid API into a paid API in under 5 minutes. **Zero code changes. Zero deployment.** Just flip a switch in the console, and every endpoint becomes payment-gated.

Think of it like this:

- **Jurassic Park**: If Hammond had simply negotiated a better contract with Nedry or hired a larger IT team to avoid a single point of failure, the fences stay on, the T-Rex stays in its paddock, and the visitors enjoy a mildly impressive, albeit expensive, tropical zoo. 🦖
- **Home Alone**: An accurate head count or a working alarm clock, and the whole family goes to Paris together. Kevin spends the holiday being annoyed by his cousins in France instead of booby-trapping his house against burglars. 🏠
- **Harry Potter**: Social services or a simple background check, and Harry grows up in a normal home with adequate care. No chosen one. No dark wizards. Just an ordinary kid with excellent eyesight. ⚡
- **Finding Nemo**: A childproof latch on the aquarium filter. If Marlin had invested $5 in basic safety equipment or actually enforced boundaries with his rebellious son, Nemo never gets scooped up by divers. The movie becomes a 90-minute nature documentary about clownfish living peacefully inside an anemone. 🐠
- **John Wick**: The buyer accepts "no" the first time. If the spoiled kid had simply respected John's answer when he said the car wasn't for sale, the dog lives (that's the important part) and John stays retired. 🐕
- **Romeo & Juliet**: A reliable postal service or a working cell phone. If Friar Lawrence's letter had actually reached Romeo explaining the fake death plan, they both live, get married, and force their families to get over it at awkward holiday dinners. 💌
- **Titanic**: Binoculars in the crow's nest or a slower cruise speed. If the White Star Line hadn't locked up the binoculars or if Captain Smith had slowed down in iceberg-infested waters like he was supposed to, the lookout spots the iceberg in time, the ship arrives in New York on schedule, and Jack and Rose have an awkward breakup in Southampton. 🚢

You might correctly say those stories would be ruined, but I bet you wouldn't enjoy being in their shoes. Kobaru helps you solve payments the easy way. This is your unfair advantage. The cheat code.

---

## 🎯 What you get

From basic features to advanced payment models—everything you'd build yourself with the SDK—Kobaru's transparent proxy handles it automatically:

✅ **Payment verification** — HTTP 402 responses with payment instructions
✅ **Multi-network support** — Solana, Base, SKALE - any blockchain you configure
✅ **Usage tracking** — Pay-per-request or pay-per-time models
✅ **Automatic refunds** — Server errors refund the client automatically
✅ **Route-based pricing** — Different prices for different endpoints
✅ **Request forwarding** — Payments verified, headers cleaned, requests proxied
✅ **No backend changes** — Your API doesn't need to know about payments

All of this works **out of the box**. No SDKs. No middleware. No deployment.

---

## 📁 What's in this directory?

**Nothing.** That's the point.

The transparent proxy requires zero code. You configure it once in the [Kobaru Console](https://kobaru.io/console), and it just works.

But if you want to understand how it all works under the hood—the HTTP 402 flow, payment verification, usage models, automatic refunds, header forwarding, route overrides—check out the full technical documentation:

👉 **[Transparent Proxy Integration Guide](https://docs.kobaru.io/integration/transparent-proxy)**

That guide has everything: sequence diagrams, setup steps, configuration tables, header specs, refund logic, testing instructions, and edge case handling.

---

## 🚀 Quick Start

1. **Sign-up** at [Kobaru.io](https://kobaru.io)
1. **Create your service** in the [Kobaru Console](https://kobaru.io/console)
2. **Set your backend URL** (e.g., `https://api.yourcompany.com`)
3. **Configure payment defaults** (network, currency, price, usage model)
4. **Activate your service**

Done. Your entire API is now payment-gated at:

```
https://access.kobaru.io/{your-slug}/
```

Every path, every endpoint, every route—automatically proxied and payment-protected.

| Your original API | Now accessible at |
|-------------------|-------------------|
| `api.yourcompany.com/forecast` | `access.kobaru.io/your-slug/forecast` |
| `api.yourcompany.com/data/history` | `access.kobaru.io/your-slug/data/history` |
| `api.yourcompany.com/v2/realtime` | `access.kobaru.io/your-slug/v2/realtime` |

No code changes. No redeployment. Just works.

---

## 💡 How it works (in one sentence)

Kobaru sits between your clients and your backend: when a client requests your API, Kobaru checks for payment, verifies it via blockchain, and forwards the request to your backend only if payment is valid.

**For the full technical flow**, including sequence diagrams, header specs, and edge cases:
👉 **[How the Transparent Proxy Works](https://docs.kobaru.io/integration/transparent-proxy#how-it-works)**

---

## 🎮 Usage models

Kobaru supports two usage models, both configurable in the console with zero code:

### Pay-per-request
Clients pay for a bundle of requests. Each successful request decrements their count. Errors refund usage automatically.

**Best for:** API calls with predictable value per request (e.g., geocoding, data lookups, image processing).

### Pay-per-time
Clients pay for unlimited access within a time window. The clock starts on the first request after payment.

**Best for:** High-frequency access, streaming data, real-time feeds, or APIs where request count varies wildly.

Tip: More usage models are coming to Kobaru. Let us know if you are interested in new features!

**For detailed behavior, refund logic, and when to use each model:**
👉 **[Usage Models Documentation](https://docs.kobaru.io/integration/transparent-proxy#usage-models)**

---

## 🛠️ Route-based pricing

Need different prices for different endpoints? Set route-level overrides in the console:

| Route | Price | Usage Model |
|-------|-------|-------------|
| `GET /forecast/*` | $0.001 | 10 requests |
| `GET /historical/*` | $0.10 | 1 request |
| `POST /realtime` | $0.10 | 1 hour |

Routes without overrides use your service defaults. Expensive endpoints (AI inference, large exports) get higher prices. High-frequency endpoints get time-based access. Free endpoints can bypass payment entirely.

**For configuration examples and when to use route overrides:**
👉 **[Route Configuration Guide](https://docs.kobaru.io/integration/transparent-proxy#configure-route-overrides-optional)**

---

## 🔄 Automatic refunds

If your backend returns a server error (5xx), rate limit (429), or auth issue (401/403), Kobaru automatically refunds the client's usage. If the client sent a bad request (400, 404, 422), they don't get a refund—they made the mistake.

**Key principle:** Clients only pay for successful requests. If your backend fails, they get their usage back.

**For the complete refund decision matrix and pay-per-time behavior:**
👉 **[Automatic Refunds Documentation](https://docs.kobaru.io/integration/transparent-proxy#automatic-refunds)**

---

## 🧪 Testing

Before going live, test with Solana Devnet, Base Sepolia or SKALE on Base Sepolia:

1. Set your service to use a test network in the console
2. Get test USDC from a faucet
3. Request your endpoint to see the `402 Payment Required` response
4. Pay and verify your backend receives the request

**For complete testing instructions, cURL examples, and expected responses:**
👉 **[Testing Your Integration](https://docs.kobaru.io/integration/transparent-proxy#testing-your-integration)**

---

## ⚠️ Limitations

The transparent proxy has some constraints due to its edge-first architecture:

| Limitation | Value | Workaround |
|------------|-------|------------|
| WebSocket connections | Not supported | Use the [Standard SDK](https://docs.kobaru.io/integration/standard-sdk) |
| Response streaming | Supported | None needed |
| Request timeout | 50 seconds | Optimize slow endpoints |

### When to use the SDK instead

Consider the [Standard SDK integration](https://docs.kobaru.io/integration/standard-sdk) if you need:

- WebSocket or long-lived connections
- Custom payment verification logic
- Full control over the 402 response format

**Route-based dynamic pricing** (different prices per endpoint) is fully supported in the proxy via route overrides. Use the SDK only if you need pricing based on request body content, user identity, or runtime conditions.

---

## 🔗 Resources

- [Transparent Proxy Full Documentation](https://docs.kobaru.io/integration/transparent-proxy)
- [Kobaru Console](https://kobaru.io/console)
- [x402 Protocol](https://github.com/coinbase/x402)
- [Usage Models Deep Dive](https://docs.kobaru.io/concepts/usage-models)
- [API Pricing Best Practices](https://docs.kobaru.io/guides/pricing)

---

## 📜 Quote

> "Spared no expense... except on IT staff."
> — John Hammond, *Jurassic Park*

Don't be like Hammond. Use God Mode. 🎮

---

## 🎯 Next Steps

1. **Try it yourself**: Create a service in the [Kobaru Console](https://kobaru.io/console)
2. **See it in action**: Check out our [live examples](https://github.com/kobaru/api-paywall-cookbook) with real code
3. **Go deeper**: Read the [Standard SDK guide](https://docs.kobaru.io/integration/standard-sdk) for advanced use cases

---

*No code. No deployment. No drama.* 🚀
