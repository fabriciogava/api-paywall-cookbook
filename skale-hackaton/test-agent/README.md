# Agent 007 - Classified Paywall Auditor
## 🎯 SKALE HACKATHON EDITION 🎯

> **SPECIAL BUILD FOR:** San Francisco Agentic Commerce x402 Hackathon
> **NETWORK FOCUS:** SKALE networks only (Solana and Base removed for simplicity)
> **FOR FULL MULTI-CHAIN SUPPORT:** See the [original 007 Test Agent](https://github.com/kobaru/api-paywall-cookbook/tree/main/tools/007-test-agent)

---

> **TOP SECRET // EYES ONLY**
> **SUBJECT:** Validation tool for x402-fortified API endpoints on SKALE networks.

This elite digital asset is designed to **perform military-grade validation** of any x402-compliant API paywall using SKALE payment rails. It demonstrates the complete payment lifecycle ("The Audit") with **Real-Time Wiretap Logging** and **Educational Intel**.

**🎯 PRE-CONFIGURED FOR HACKATHON SUCCESS:**
- ✅ **Zero Configuration:** Pre-configured with SKALE Sandbox Chain data
- ✅ **Default Network:** Uses `skale-hackathon-sandbox` automatically (no `--network` flag needed)
- ✅ **Builder-Friendly:** Perfect for testing new x402 resource servers during development
- ✅ **Copy-Friendly:** Clean, well-documented code ready to fork for your own agent implementations
- ✅ **Educational:** Every step explained with detailed comments and logging

**Mission Objectives:**
- **Defense Systems Check:** Validate your own x402 APIs during R&D.
- **Security Audit:** Inspect and verify third-party paywalled endpoints.
- **Protocol Analysis:** Gain deep understanding of the x402 protocol handshake.
- **Agent Training:** Learn the x402 flow through "For Dummies" style field notes.
- **Builder Resource:** Fork this code to build your own custom x402 client agents.

**Tactical Capabilities:**
- **URL Validation:** Military-grade target verification rejects malformed or dangerous protocols.
- **Mission Timing:** Precision performance metrics using high-resolution timers.
- **Timeout Override:** Optional countdown timer aborts slow missions after specified duration.
- **CI/CD Ready:** Proper exit codes (0=success, 1=failure) for automation pipelines.
- **Interactive Mainnet Safety:** Confirms authorization before spending real assets.
- **Multi-Network Support:** Operates on both Solana (SVM) and Base (EVM) networks.

---

## Mission Briefing (Quick Start)

### 1. Equip Tech (Install Dependencies)

Initialize the gadgetry:

```bash
cd tools/007-test-agent
npm install
```

### 2. Encode Credentials (Configure Environment)

Establish your cover identity:

```bash
cp .env.example .env
```

**WARNING:** Access the classified `.env` file and input your private key. This is your digital credentials for authorization.

**For SKALE networks** (all networks in this build):
```env
EVM_PRIVATE_KEY=your_hex_private_key_here
```

> **HACKATHON BUILD:** This version only requires EVM_PRIVATE_KEY (for SKALE networks).
> The original 007 Test Agent also supports SVM_PRIVATE_KEY (for Solana networks).

### 3. Launch Operation (Run Tests)

**HACKATHON SIMPLIFICATION:** The `--network` flag is **OPTIONAL** in this build. It defaults to `skale-hackathon-sandbox` if not specified.

**Valid network options:**
| Option | Network | Type | Environment |
|--------|---------|------|-------------|
| `skale-hackathon-sandbox` | SKALE Hackathon Sandbox | EVM | Simulation (DEFAULT) |
| `skale` | SKALE Sepolia Testnet | EVM | Simulation |
| `skale-mainnet` | SKALE Mainnet | EVM | Live Fire |

> **INTEL:** Network aliases are accepted: `skale-devnet` or `skale-testnet` map to `skale`.
> **HACKATHON BUILD:** This version only supports SKALE networks. For Solana/Base support, see the [original 007 Test Agent](https://github.com/kobaru/api-paywall-cookbook/tree/main/tools/007-test-agent).

**Command Syntax:**
```bash
npm start [URL] [JSON_BODY] [--network <network>] [--file <path>] [--timeout <ms>]
```

| Flag | Short | Required | Description |
|------|-------|----------|-------------|
| `--network` | `-n` | No | Target network (defaults to `skale-hackathon-sandbox`) |
| `--file` | `-f` | No | Path to file to upload (automatically encodes to base64 JSON) |
| `--timeout` | `-t` | No | Request timeout in milliseconds (default: no timeout) |

**Audit Specific Targets:**
```bash
# Uses default hackathon sandbox network
npm start http://localhost:3000/answer

# Explicitly specify network
npm start http://localhost:3000/answer --network skale
npm start https://api.example.com/paid-endpoint --network skale-mainnet
npm start http://slow-api.com/endpoint --timeout 30000
```

**Audit Default Target** (Training Simulation):
```bash
# Simplest form - uses default URL and network
npm start
```

> **TARGET VALIDATION:** The agent performs strict URL verification before any mission. Invalid protocols (like `file://` or `javascript:`) will trigger an immediate mission abort with guidance on proper usage.

**Automation Integration:**
```bash
# Use in CI/CD pipelines - exit codes indicate mission status
npm start http://localhost:3000/answer --network solana && echo "Mission Success" || echo "Mission Failed"
```

---

## Field Manual (FEATURES)

### Wiretap Mode (Hyper-Verbose Logging)
The agent now intercepts every signal. You will see:
- **Outgoing HTTP Requests:** Exactly what goes over the wire.
- **Incoming HTTP Responses:** Raw headers, including the mysterious `WWW-Authenticate`.
- **Credential Flashing:** See the exact moment the `Authorization` header is attached.

### Educational Intel (For Rookie Agents)
Every tactical move is accompanied by **EDUCATIONAL INTEL** notes. These explain *why* the agent is doing what it's doing, translating complex protocol specs into plain English.

### POST Request Support (Data Transmission)

The agent supports transmitting JSON payloads to paywalled endpoints. Pass a JSON body as the second positional argument:

```bash
npm start http://localhost:3000/ask '{"question":"What is 6x7?"}'
```

The agent automatically:
- Sets the HTTP method to `POST`
- Applies `Content-Type: application/json` header
- Includes your payload in the request body

This is useful for testing APIs that accept questions, queries, or other structured input behind a paywall.

### File Upload Support (Image Transmission)

The agent supports uploading files (especially images) to paywalled endpoints without the "Argument list too long" error that occurs when passing large base64 strings on the command line.

**Using the --file flag:**

```bash
npm start http://localhost:3000/restore --file path/to/image.jpg --network skale
```

The agent automatically:
- Reads the file from disk
- Encodes it to base64
- Creates a JSON payload: `{"image": "base64-data", "filename": "image.jpg"}`
- Sets the HTTP method to `POST`
- Applies `Content-Type: application/json` header
- **Saves the response image** to disk with `-response.{ext}` suffix

**Example with photo restoration API:**

```bash
# Original command (causes "Argument list too long" error):
npm start http://localhost:3000/restore \
  "$(base64 -w 0 photo.jpg | jq -R '{image: .}')"

# New command (works perfectly):
npm start http://localhost:3000/restore --file photo.jpg

# With explicit network:
npm start http://localhost:3000/restore --file photo.jpg --network skale

# Result: Creates photo-response.jpg in the same directory
```

**Automatic Image Saving:**

When you upload an image file via `--file` and the API returns an image response (with `result.data` containing base64), the agent automatically:
1. Detects the image response format (JPEG, PNG, etc.)
2. Decodes the base64 data
3. Saves the output file as: `{original-name}-response.{format}`
4. Places it in the same directory as the input file

**Use Cases:**
- **Photo Restoration APIs:** Send old photos and automatically save restored versions
- **Image Processing APIs:** Upload images for filters, transformations, etc.
- **Computer Vision APIs:** Send images for analysis or enhancement
- **Any API that accepts base64-encoded files**

### Safety Protocols (License to Kill)
The agent performs real-time environment detection to protect your assets:
- **Devnet (Simulation):** "License to Kill" active. Transactions are authorized automatically for rapid testing.
- **Mainnet (Live Fire):** License revoked. The agent halts mission execution and demands **interactive confirmation** before authorizing any real-money transaction.

When mainnet is detected, you'll see:
```text
   MISSION CRITICAL DECISION REQUIRED
   LIVE FIRE EXERCISE DETECTED [MAINNET]
   EDUCATIONAL INTEL: You DO NOT have a 'License to Kill' (Spend Real Money) without explicit authorization.
   CONFIRM REAL MONEY TRANSACTION? (Y/n): _
```

### Performance Metrics (Mission Timer)
Every operation is timed with high-resolution precision using `performance.now()`. After mission completion, you'll receive total execution time:
```text
      Total mission duration: 1847ms
```

### Mission Timer Override (Timeout Control)

By default, the agent waits indefinitely for target response. When operating against slow or unreliable targets, you can set a countdown timer that aborts the mission if exceeded.

```bash
# Abort if target doesn't respond within 30 seconds
npm start http://slow-api.com/endpoint --network solana --timeout 30000

# Short form
npm start http://slow-api.com/endpoint --network solana -t 30000
```

**Behavior:**
- When specified, the timeout applies to both the initial reconnaissance request and the payment retry.
- When NOT specified, no timeout is enforced—the agent waits as long as necessary.
- On timeout, mission aborts with: `Request timeout after {N}ms`

**Use Cases:**
- **CI/CD Pipelines:** Prevent builds from hanging on unresponsive targets.
- **Resilience Testing:** Verify your API responds within acceptable time limits.
- **Slow API Audits:** Set generous timeouts for known slow endpoints.

### Automation Ready (Exit Codes)
The agent returns proper exit codes for use in scripts and CI/CD pipelines:
- **Exit 0:** Mission accomplished. Target successfully audited.
- **Exit 1:** Mission failed. Includes: invalid URL, missing credentials, payment failure, or server rejection.

---

## Post-Mission Report (Example Output)

Upon execution, the Agent will provide a detailed tactical log:

```text

   AGENT 007 INITIALIZED - CODENAME: PAYWALL AUDITOR

   Gadget Loaded: Wallet Address: 7xKXtg2C...

   PHASE 1: RECONNAISSANCE

   Target: http://localhost:3000/answer
   EDUCATIONAL INTEL: We are about to make the first request without any credentials...
   ...

   PHASE 2: ANALYZING SECURITY PROTOCOL

   The target server stopped us with a '402 Payment Required' status.
      Scheme (How to pay): exact
      Price (How much): 1000
      Environment Detected: DEVNET/TESTNET

   MISSION CRITICAL DECISION REQUIRED
   SIMULATION MODE [DEVNET]
   EDUCATIONAL INTEL: Environment secured. 'License to Kill' active: You may perform transactions at will.

   PHASE 3: FABRICATING CREDENTIALS

   Payment transaction has been signed by your wallet.
   ...

   PHASE 4: ACCESS GRANTED

   Final Status: 200 OK
      Total mission duration: 1847ms
   EDUCATIONAL INTEL: Success! The server accepted our payment proof and returned the hidden data.

```

---

## Obtaining Credentials (Private Keys)

### SKALE (EVM) Networks

#### Method A: Extract from Existing Cover (Wallet)

Extract your private key from MetaMask or similar EVM wallets:
- **MetaMask:** Settings -> Security & Privacy -> Reveal Secret Recovery Phrase (then derive private key)

**ADVISORY:** Use a segregated wallet for field operations. Never expose your primary vault.

#### Method B: Forge New Identity (CLI)

Generate a fresh identity using Foundry's cast tool:

```bash
cast wallet new
```

This outputs both address and private key. Copy the private key (hex format) to your `.env` file.

#### Method C: Simulation Mode (SKALE Sandbox)

For training without financial risk:
1. Create a burner wallet (Method B).
2. Request SKALE Hackathon Sandbox funds (join hackathon Telegram: https://t.me/c/2825693624/538).

> **HACKATHON BUILD:** This version is pre-configured for SKALE Sandbox Chain.
> For other EVM networks (Base, Ethereum), see the [original 007 Test Agent](https://github.com/kobaru/api-paywall-cookbook/tree/main/tools/007-test-agent).

---

## Technical Schematics

### Validation Sequence (The "Audit")

1.  **Target Validation:** Agent verifies URL is a valid HTTP/HTTPS target.
2.  **Network Selection:** Agent loads the appropriate wallet (SVM or EVM) based on `--network` flag.
3.  **Recon (Initial Request):** Agent pokes the bear.
4.  **Challenge (402 Response):** Bear roars back with price tags.
5.  **Network Compatibility Check:** Agent verifies server requirements match the selected network.
6.  **Fabrication (Payment Creation):** Agent signs the check (cryptographically).
7.  **Authorization (Retry):** Agent walks back in, flashing the badge (`Authorization` header).
8.  **Verification (Delivery):** Door opens. Information flows.

### Security Measures

**URL Validation Protocol:**
- Only `http://` and `https://` protocols are permitted.
- Dangerous protocols (`file://`, `javascript://`, `data://`) are rejected immediately.
- Malformed URLs trigger mission abort with helpful error messages.

**Network Enforcement:**
- The `--network` flag is mandatory to prevent accidental mainnet transactions.
- Network mismatch between client and server triggers immediate mission abort.
- Mainnet operations require interactive confirmation.

**Error Response Examples:**
```text
CRITICAL FAILURE: Invalid protocol detected.
   Expected: http:// or https://
   Received: file:
   Example: npm start http://localhost:3000/answer --network solana
```

```text
CRITICAL FAILURE: Malformed URL provided.
   Target: not-a-valid-url
   Example: npm start http://localhost:3000/answer --network solana
```

```text
HACKATHON BUILD: Network defaults to skale-hackathon-sandbox
   Valid options: skale-hackathon-sandbox, skale, skale-mainnet
   Example: npm start http://localhost:3000/answer
   Or: npm start http://localhost:3000/answer --network skale-mainnet
```

### Performance Instrumentation

- **Timer:** Uses `performance.now()` for sub-millisecond precision.
- **Scope:** Measures complete mission duration including all HTTP round-trips.
- **Output:** Displayed as `Total mission duration: Xms` after final phase.

### Exit Code Reference

| Code | Status | Triggers |
|------|--------|----------|
| `0` | Success | API responded with 2xx after payment |
| `1` | Failure | Invalid URL, missing credentials, payment error, server rejection, user abort, network mismatch |

### Approved Gadgetry (Dependencies)

**Solana (SVM) Networks:**
- `@x402/fetch` - Automated infiltration client
- `@x402/svm` - Solana payment protocol implementation
- `@solana/web3.js` v2 - Blockchain interface
- `@solana/signers` - Cryptographic signing tools

**Base (EVM) Networks:**
- `@x402/fetch` - Automated infiltration client
- `@x402/evm` - EVM payment protocol implementation
- `viem` - TypeScript interface for Ethereum

---

## Training Simulations (Local APIs)

Ideal for training against x402-enabled APIs running locally:

### SKALE Network Training

1.  **Spin up the Target (API Server configured for SKALE):**
    ```bash
    # Example: Any x402-enabled API configured for SKALE
    cd your-api-directory
    npm run dev
    ```

2.  **Deploy the Agent:**
    ```bash
    # In a new terminal
    cd skale-hackaton/test-agent

    # Simple form (uses default network)
    npm start http://localhost:3000/answer

    # Or specify network explicitly
    npm start http://localhost:3000/answer --network skale
    ```

### Testing POST Requests

```bash
npm start http://localhost:3000/ask '{"question":"What is the meaning of life?"}'
```

### Testing File Uploads

```bash
npm start http://localhost:3000/restore --file photo.jpg
```

---

## Security Clearance Levels

- **.env FILE:** CI/Top Secret. Contains raw private keys. Do not commit.
- **WALLETS:** Use "Burner" classification only. Minimal funds recommended.
- **MAINNET:** Live fire exercise. Real assets will be expended. Requires confirmation.
- **DEVNET:** Simulation. Unlimited retry attempts.

---

## 🚀 Powered by Kobaru

**Kobaru makes blockchain payments simple** - focus on building your winning solution, not payment infrastructure.

### Hackathon Superpowers with Kobaru

✅ **Real-Time Debugging** - See payment logs live in the console as you test
✅ **Success Metrics** - Track payment volume, conversion, and revenue to measure impact
✅ **Zero Infrastructure** - No blockchain nodes, RPC endpoints, or gas fee headaches
✅ **Free Access** - Full features available during the hackathon

### Get Started

1. 🔗 **Sign up for free:** https://console.kobaru.io/sign-up
2. 🔍 **Open the console** while testing to see payments in real-time
3. 📊 **Track metrics** to see how your API performs
4. 📚 **Learn more:** https://www.kobaru.io

**💡 Note:** This is a client testing tool - no API key needed here. API keys are only required on your API server (see `../example-server`).

**💡 Pro Tip:** Keep the Kobaru Console open during your demo - showing live payment logs flowing through your API is a powerful way to prove your solution works!

---

## For Builders 🛠️

This hackathon edition is intentionally streamlined to serve as an **excellent reference implementation** for developers building x402-enabled applications:

### Why This Code is Valuable for Builders:

1. **Complete x402 Client Implementation:** Shows the full client-side flow from initial request to payment proof creation.

2. **Well-Documented Architecture:** Every function and flow is extensively commented, explaining not just WHAT but WHY.

3. **Modular Design:** Clean separation between CLI parsing (`cli.ts`), business logic (`index.ts`), and configuration makes it easy to understand and fork.

4. **Educational Logging:** The verbose logging system demonstrates exactly what happens at each protocol step - invaluable for debugging your own implementations.

5. **Pre-Configured for Hackathon:** All SKALE Sandbox Chain parameters are already set up, so you can focus on building your API, not configuring the client.

### Suggested Uses:

- **Test Your x402 APIs:** Point this agent at your API during development to verify payment flows work correctly.
- **Fork for Custom Agents:** Use this as a starting template for building specialized x402 client agents (CLI tools, automation scripts, etc.).
- **Learn the Protocol:** Read through the code and watch the logging to understand how x402 works under the hood.
- **Debug Payment Issues:** The detailed logging helps identify exactly where payment negotiation fails.

### For Full Multi-Chain Support:

This is a simplified version for the hackathon. For production use cases requiring Solana or Base networks, see the **[original 007 Test Agent](https://github.com/kobaru/api-paywall-cookbook/tree/main/tools/007-test-agent)** with full multi-chain support.

---

## License

Apache 2.0 - Open Source Intelligence (OSINT).

## Alliance

Part of the [API Paywall Cookbook](https://github.com/kobaru/api-paywall-cookbook). Reinforcements welcome.
