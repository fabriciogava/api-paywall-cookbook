# 🕵️ Agent 007 - Classified Paywall Auditor

> **TOP SECRET // EYES ONLY**
> **SUBJECT:** Universal validation tool for x402-fortified API endpoints.

This elite digital asset is designed to **perform military-grade validation** of any x402-compliant API paywall using Solana payment rails. It demonstrates the complete payment lifecycle ("The Audit") with **Real-Time Wiretap Logging** and **Educational Intel**.

**Mission Objectives:**
- 🛡️ **Defense Systems Check:** Validate your own x402 APIs during R&D.
- 🔭 **Security Audit:** Inspect and verify third-party paywalled endpoints.
- 🧠 **Protocol Analysis:** Gain deep understanding of the x402 protocol handshake.
- 🎓 **Agent Training:** Learn the x402 flow through "For Dummies" style field notes.

**Tactical Capabilities:**
- 🔒 **URL Validation:** Military-grade target verification rejects malformed or dangerous protocols.
- ⏱️ **Mission Timing:** Precision performance metrics using high-resolution timers.
- 🤖 **CI/CD Ready:** Proper exit codes (0=success, 1=failure) for automation pipelines.
- 🚨 **Interactive Mainnet Safety:** Confirms authorization before spending real assets.

---

## 🚀 Mission Briefing (Quick Start)

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

**WARNING:** Access the classified `.env` file and input your Solana private key (Base58 encoded). This is your digital credentials for authorization.

```env
SVM_PRIVATE_KEY=your_base58_private_key_here
```

### 3. Launch Operation (Run Tests)

**Audit Specific Targets:**
```bash
npm start http://localhost:3000/answer
npm start https://api.example.com/paid-endpoint
```

**Audit Default Target** (Training Simulation):
```bash
npm start
```

> **⚠️ TARGET VALIDATION:** The agent performs strict URL verification before any mission. Invalid protocols (like `file://` or `javascript:`) will trigger an immediate mission abort with guidance on proper usage.

**Automation Integration:**
```bash
# Use in CI/CD pipelines - exit codes indicate mission status
npm start http://localhost:3000/answer && echo "Mission Success" || echo "Mission Failed"
```

---

## 📖 Field Manual (FEATURES)

### 📡 Wiretap Mode (Hyper-Verbose Logging)
The agent now intercepts every signal. You will see:
- 📨 **Outgoing HTTP Requests:** Exactly what goes over the wire.
- 📥 **Incoming HTTP Responses:** Raw headers, including the mysterious `WWW-Authenticate`.
- 🔑 **Credential Flashing:** See the exact moment the `Authorization` header is attached.

### 💡 Educational Intel (For Rookie Agents)
Every tactical move is accompanied by **EDUCATIONAL INTEL** notes. These explain *why* the agent is doing what it's doing, translating complex protocol specs into plain English.

### 🛡️ Safety Protocols (License to Kill)
The agent performs real-time environment detection to protect your assets:
- **🧪 Devnet (Simulation):** "License to Kill" active. Transactions are authorized automatically for rapid testing.
- **🚨 Mainnet (Live Fire):** License revoked. The agent halts mission execution and demands **interactive confirmation** before authorizing any real-money transaction.

When mainnet is detected, you'll see:
```text
   ⚠️  MISSION CRITICAL DECISION REQUIRED
   ℹ️  🚨 LIVE FIRE EXERCISE DETECTED [MAINNET]
      💡 EDUCATIONAL INTEL: You DO NOT have a 'License to Kill' (Spend Real Money) without explicit authorization.
   ❓ CONFIRM REAL MONEY TRANSACTION? (Y/n): _
```

### ⏱️ Performance Metrics (Mission Timer)
Every operation is timed with high-resolution precision using `performance.now()`. After mission completion, you'll receive total execution time:
```text
      ▪️ Total mission duration: 1847ms
```

### 🤖 Automation Ready (Exit Codes)
The agent returns proper exit codes for use in scripts and CI/CD pipelines:
- **Exit 0:** Mission accomplished. Target successfully audited.
- **Exit 1:** Mission failed. Includes: invalid URL, missing credentials, payment failure, or server rejection.

---

## 📊 Post-Mission Report (Example Output)

Upon execution, the Agent will provide a detailed tactical log:

```text

🕵️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AGENT 007 INITIALIZED - CODENAME: PAYWALL AUDITOR
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ℹ️  Gadget Loaded: Wallet Address: 7xKXtg2C...

📡 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PHASE 1: RECONNAISSANCE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ℹ️  Target: http://localhost:3000/answer
   💡 EDUCATIONAL INTEL: We are about to make the first request without any credentials...
   ...

🛑 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PHASE 2: ANALYZING SECURITY PROTOCOL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ℹ️  The target server stopped us with a '402 Payment Required' status.
      ▪️ Scheme (How to pay): exact
      ▪️ Price (How much): 1000
      ▪️ Environment Detected: 🧪 DEVNET/TESTNET

   ⚠️  MISSION CRITICAL DECISION REQUIRED
   ℹ️  🧪 SIMULATION MODE [DEVNET]
   💡 EDUCATIONAL INTEL: Environment secured. 'License to Kill' active: You may perform transactions at will.

✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PHASE 3: FABRICATING CREDENTIALS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ℹ️  Payment transaction has been signed by your wallet.
   ...

🍸 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PHASE 4: ACCESS GRANTED
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ℹ️  Final Status: 200 OK
      ▪️ Total mission duration: 1847ms
   💡 EDUCATIONAL INTEL: Success! The server accepted our payment proof and returned the hidden data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔑 Obtaining Credentials (Solana Private Key)

### Method A: Extract from Existing Cover (Wallet)

Extract your private key from standard issue digital wallets (Phantom, Solflare):
- **Phantom:** Settings → Security & Privacy → Export Private Key
- **Solflare:** Settings → Export Private Key

⚠️ **ADVISORY:** Use a segregated wallet for field operations. Never expose your primary vault.

### Method B: Forge New Identity (CLI)

Generate a fresh identity using Solana Command Line tools:

```bash
solana-keygen new --outfile ~/burner-wallet.json
solana-keygen pubkey ~/burner-wallet.json  # Identity Check
cat ~/burner-wallet.json  # Decode to Base58 for .env
```

### Method C: Simulation Mode (Devnet)

For training without financial risk:
1. Create a burner wallet (Method B).
2. Request funds from HQ (Solana Faucet): https://faucet.solana.com/
3. Request USDC assets: https://faucet.circle.com/

---

## 🛠️ Technical Schematics

### Validation Sequence (The "Audit")

1.  **Target Validation:** Agent verifies URL is a valid HTTP/HTTPS target.
2.  **Recon (Initial Request):** Agent pokes the bear.
3.  **Challenge (402 Response):** Bear roars back with price tags.
4.  **Fabrication (Payment Creation):** Agent signs the check (cryptographically).
5.  **Authorization (Retry):** Agent walks back in, flashing the badge (`Authorization` header).
6.  **Verification (Delivery):** Door opens. Information flows.

### Security Measures

**URL Validation Protocol:**
- Only `http://` and `https://` protocols are permitted.
- Dangerous protocols (`file://`, `javascript://`, `data://`) are rejected immediately.
- Malformed URLs trigger mission abort with helpful error messages.

**Error Response Examples:**
```text
❌ CRITICAL FAILURE: Invalid protocol detected.
   Expected: http:// or https://
   Received: file:
   Example: npm start http://localhost:3000/answer
```

```text
❌ CRITICAL FAILURE: Malformed URL provided.
   Target: not-a-valid-url
   Example: npm start http://localhost:3000/answer
```

### Performance Instrumentation

- **Timer:** Uses `performance.now()` for sub-millisecond precision.
- **Scope:** Measures complete mission duration including all HTTP round-trips.
- **Output:** Displayed as `Total mission duration: Xms` after final phase.

### Exit Code Reference

| Code | Status | Triggers |
|------|--------|----------|
| `0` | Success | API responded with 2xx after payment |
| `1` | Failure | Invalid URL, missing credentials, payment error, server rejection, user abort |

### Approved Gadgetry (Dependencies)

- `@x402/fetch` - Automated infiltration client
- `@x402/svm` - Solana payment protocol implementation
- `@solana/web3.js` v2 - Blockchain interface
- `@solana/signers` - Cryptographic signing tools

---

## 🧪 Training Simulations (Local APIs)

Ideal for training against the Deep Thought API:

1.  **Spin up the Target (API Server):**
    ```bash
    cd examples/nodejs/deep-thought-api
    npm run dev
    ```

2.  **Deploy the Agent:**
    ```bash
    # In a new terminal
    cd tools/007-test-agent
    npm start http://localhost:3000/answer
    ```

---

## 🔒 Security Clearance Levels

- **.env FILE:** CI/Top Secret. Contains raw private keys. Do not commit.
- **WALLETS:** Use "Burner" classification only. Minimal funds recommended.
- **MAINNET:** Live fire exercise. Real assets will be expended.
- **DEVNET:** Simulation. Unlimited retry attempts.

---

## 📝 License

Apache 2.0 - Open Source Intelligence (OSINT).

## 🤝 Alliance

Part of the [API Paywall Cookbook](https://github.com/kobaru/api-paywall-cookbook). Reinforcements welcome.
