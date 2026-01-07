# 🧙 The Grey Wizard's Wisdom Extractor

> "You shall not pass... without paying the x402 tribute!" - *The Grey Pilgrim*

Welcome, traveler. This API is an arcane construct designed to gaze into the swirling mists of YouTube and extract pure, distilled wisdom using the eldritch powers of **Google AI Studio (Gemini 2.5 Flash)**.

It is guarded by the ancient **x402 Protocol**, a magical barrier that demands a fair tribute in exchange for knowledge. The price of wisdom is not fixed—it fluctuates with the length of the scrolls (transcript tokens).

## 🔮 Arcane Features

-   **The Scales of Equivalent Exchange (Dynamic Pricing)**: The spell consumes 1 micro-USDC (atomic unit) for every token of knowledge. We leverage `paymentMiddleware` to calculate this cost dynamically before the spell is even cast.
-   **The Price Floor**: To ensure the ritual is worth the mana, a minimum tribute of 10,000 atomic units ($0.01) is demanded, regardless of length.
-   **The Bazaar (Agent Discovery)**: The API broadcasts its own instruction manual (Input Schema) via the `bazaar` extension, allowing AI agents to discover and learn how to use it autonomously.
-   **The Great Barrier (x402 v2)**: The API invokes the standard `402 Payment Required` ward, inscribing payment instructions into the very headers of reality.
-   **The Warding Sigil (URL Security)**: The Wizard only listens to authentic messengers. All URLs are validated against a sacred list of legitimate YouTube domains, and HTTPS is enforced—protecting the citadel from malicious summoning attempts.
-   **Structure of the Citadel (Clean Architecture)**: The inner sanctum (Domain) is protected from the outer chaos (Infrastructure & API).
-   **The Oracle (Gemini 2.5 Flash)**: We commune with Google's most powerful spirit for lightning-fast enlightenment.

## 🧙 Why This Spell is Relevant

This example is not merely a parlor trick; it demonstrates high-level wizardry for the modern age:

1.  **Monetization of Thought (LLM Wrapper Revenue)**: It shows how effortless it is to create a revenue stream from an AI wrapper. You aren't just giving access to raw magic; you are selling *insight*.
2.  **Alchemy of Value**: By fusing YouTube (knowledge source) with Gemini (intelligence), we create something greater than the sum of its parts. It is not a simple "pass-thru" to a chatbot; it is a specific tool that solves a tangible problem (digesting long videos), adding genuine value.
3.  **Equivalent Exchange (Dynamic Pricing)**: Unlike simple "flat fee" spells, this API calculates the cost based on the labor required (transcript length). The x402 protocol handles this negotiation seamlessly, ensuring fair compensation for heavier workloads.
4.  **Instant Summoning**: With Docker, this service is ready for production. Minimal incantations are needed to deploy it to the cloud.

> [!NOTE]
> **On Caching**: This example uses an in-memory cache for transcript storage with **no TTL or size limits**—cached transcripts persist until the server restarts. This is intentional to keep the code simple and accessible. For production deployments, consider replacing `InMemoryStorage` with Redis or Memcached (which offer built-in TTL expiration and LRU eviction).

## ⚖️ Pricing Mechanics (Atomic Units)

Why do we trade in integers and set floors?

1.  **Atomic Units (The Dust of Value)**: The x402 protocol and the Solana blockchain do not speak in floating-point decimals (like `$0.01`). They speak in **atomic units** (integers). For USDC, which has 6 decimals, $0.01 equals `10,000` units. This prevents the "floating point chaos" (rounding errors) that plagues lesser spells.
2.  **The Floor Price**: We enforce a minimum charge of **$0.01 (10,000 units)**. Even for a short video, there are fixed costs (gas fees, computational overhead in the cloud). The floor ensures the transaction is always economically viable, and to prevent the spell from being abused.
3.  **Middleware Calculation**: The price is calculated *dynamically* by the `paymentMiddleware` interception layer. It fetches the video transcript, counts the tokens, and determines the price before the main application logic ever runs—guarding the GPU resources until payment is proven.
4.  **Error Handling**: If the video transcript cannot be fetched (e.g. video doesn't exist or transcripts are disabled), the API will return a `404 Not Found` immediately. It will **NOT** issue a 402 challenge, ensuring users are never asked to pay for content that cannot be delivered. Note: YouTube does not reliably distinguish between invalid videos and disabled transcripts via API, so the error message will be generic.

## 📜 Magical Reagents (Prerequisites)

Before you can cast this spell, you must gather these artifacts:

1.  **A Key to the Oracle**: A Google AI Studio API key (obtain from [aistudio.google.com](https://aistudio.google.com)).
2.  **A Pouch of Tokens**: A Solana Devnet wallet to receive the tithes (and to pay them, if you are testing the incantations).
3.  **The Vessel**: Docker, to contain the spirit of the application.

## ⚗️ Brewing the Potion (Setup)

1.  **Enter the Wizard's Tower**:
    ```bash
    cd examples/nodejs/extract-wisdom-api
    ```

2.  **Scribe the Scroll of Secrets**:
    Create a `.env` file from the ancient texts:
    ```bash
    cp deploy/docker/.env.example .env
    ```

3.  **Infuse with Mana**:
    Edit `.env` and inscribe your true names:
    -   `GOOGLE_API_KEY`: Your API key from Google AI Studio.
    -   `RESOURCE_WALLET_ADDRESS`: Your Solana Devnet address (where the gold flows).

## ⚡ Casting the Spell (Running the API)

Summon the daemon:

```bash
cd deploy/docker
docker-compose up --build
```

The grey wizard will manifest at `http://localhost:3000`, awaiting your questions.

## 🔮 Consulting the Wizard (Usage)

### 1. Is the Spirit Awake?

Ping the ether to ensure the connection is stable:

```bash
curl http://localhost:3000/
```

### 2. The Unpaid Request (Attemping to Pass)

Try to demand wisdom from a video (e.g., a tale of TED) without offering tribute:

```bash
curl -i -X POST http://localhost:3000/wisdom \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=eF9BtrX0YEE"}'
```

**"YOU SHALL NOT PASS!"**

The Wizard will repel you with a **402 Payment Required**. Gaze upon the headers, for they hold the riddle:
-   `WWW-Authenticate`: The challenge, containing the mysterious `x402` token.
-   `x-402-price`: The tribute demanded by the fates.

### 3. The Ritual of Payment

To pass the test, you must:
1.  Decipher the `WWW-Authenticate` header.
2.  Send the required Solana dust to the address specified.
3.  Approach the Wizard again, this time holding the `Authorization: 402 <proof-token>` talisman.

*(Ideally, use the 007 Agent or a browser extension, for manual incantations can be perilous for mere mortals.)*

### 4. Consulting the Oracle in Tongues (Language Support)

The Grey Wizard is a polyglot. You may request wisdom in any tongue known to the Gemini Oracle (e.g., 'en', 'pt', 'es', 'fr', 'ja').

Include the `language` parameter in your request:

```bash
curl -i -X POST http://localhost:3000/wisdom \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=s41p7Fvj1h8", 
    "language": "pt"
  }'
```

**The Law of Translation:**
-   **Restriction**: If you request the *same* language as the video's original tongue (or request nothing), the Wizard will typically forbid translation, restricting the answer to that language to preserve purity.
-   **Translation**: If you request a *different* language, the Wizard will interpret the wisdom and translate the final output into your desired tongue.


## 🏰 Architecture of the Spire

The tower is built with the geometry of the Ancients (Clean Architecture):

-   **The Inner Sanctum (Core)**: Pure entities (`Transcript`, `Wisdom`) and the essence of logic (`WisdomService`), untouched by the shifting sands of frameworks.
-   **The Outer Walls (Infra)**: Adapters that commune with the external worlds of `Gemini` and `YouTube`.
-   **The Gate (Presentation)**: A Hono server acting as the gatekeeper, speaking the tongue of HTTP and enforcing the x402 payment pacts.

## 📜 The Source of Power (Credits)

This spell borrows wisdom from the great library of **Fabric** by **Daniel Miessler**.
The extraction prompt is adapted from the `extract_wisdom` pattern found in [Fabric](https://github.com/danielmiessler/Fabric).

We also offer our gratitude to **Eric Martin**, the arch-mage behind [youtube-transcript-plus](https://github.com/ericmmartin/youtube-transcript-plus), whose library enables us to decipher the scrolls of YouTube.
