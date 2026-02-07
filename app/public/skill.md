# Proof of Hack — Agent Skill

> Trustless responsible disclosure with on-chain proof and accountability on Solana.

## What This Does

White hats hash exploit proof to Solana, protocols verify privately, both sides get cryptographic accountability — all without public disclosure.

**Program ID:** `4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn`
**Network:** Solana Devnet
**SDK:** `@proof-of-hack/sdk` (TypeScript)
**GitHub:** https://github.com/estentz/proof-of-hack

## Instructions

### 1. register_protocol
Register your program to receive encrypted vulnerability disclosures.

**Signer:** Protocol authority (your wallet)
**Params:**
- `program_address: PublicKey` — The Solana program you want to protect
- `name: String` — Protocol name (1-64 chars)
- `encryption_key: [u8; 32]` — X25519 public key for receiving encrypted proofs

**PDA:** `["protocol", program_address]`

### 2. submit_disclosure
Submit a vulnerability disclosure with SHA-256 proof commitment.

**Signer:** Hacker (discoverer's wallet)
**Params:**
- `proof_hash: [u8; 32]` — SHA-256 hash of your vulnerability proof
- `encrypted_proof: Vec<u8>` — NaCl box encrypted proof (max 1024 bytes, optional)
- `severity: u8` — 1=Low, 2=Medium, 3=High, 4=Critical
- `grace_period: i64` — Seconds before reveal is allowed (min 60)
- `nonce: u64` — Unique per hacker+program pair (start at 0, increment)

**PDA:** `["disclosure", hacker, target_program, nonce_le_bytes]`

### 3. acknowledge_disclosure
Protocol acknowledges receipt of a vulnerability report.

**Signer:** Protocol authority
**Constraint:** Disclosure status must be SUBMITTED (0)

### 4. resolve_disclosure
Protocol marks vulnerability as resolved with payment proof.

**Signer:** Protocol authority
**Params:**
- `payment_hash: [u8; 32]` — SHA-256 hash of payment proof (tx hash, receipt, etc.)

**Constraint:** Disclosure status must be ACKNOWLEDGED (1)

### 5. reveal_proof
Hacker reveals proof publicly after grace period expires (nuclear option).

**Signer:** Hacker (original submitter)
**Params:**
- `plaintext_proof: Vec<u8>` — Original proof text (max 1024 bytes)

**Constraints:** Status SUBMITTED, grace period elapsed, SHA-256(plaintext) matches original proof_hash

### 6. claim_disclosure
Protocol claims an unclaimed disclosure (submitted before protocol registered).

**Signer:** Protocol authority
**Constraint:** disclosure.target_program == protocol.program_address AND disclosure.protocol == default

## Status Lifecycle

```
SUBMITTED (0) → acknowledge → ACKNOWLEDGED (1) → resolve → RESOLVED (2)
     ↓
[grace period expires]
     ↓
reveal_proof → REVEALED (3)
```

## SDK Quick Start

```typescript
import { ProofOfHack, hashProof, encryptProof } from "@proof-of-hack/sdk";

const poh = new ProofOfHack(connection, wallet);

// Submit a disclosure
const { tx, disclosurePda, proofHash } = await poh.submitDisclosure(
  targetProgram,
  "Critical reentrancy in withdraw()",
  SEVERITY.CRITICAL,
  { gracePeriod: 604800 } // 7 days
);

// Query all disclosures
const disclosures = await poh.getAllDisclosures();

// Acknowledge (as protocol)
await poh.acknowledgeDisclosure(disclosurePda, protocolPda);

// Resolve with payment proof
await poh.resolveDisclosure(disclosurePda, protocolPda, paymentHashBytes);
```

## Encryption

Proofs are encrypted client-side using NaCl box (X25519-XSalsa20-Poly1305):
- Protocol provides X25519 public key during registration
- Hacker generates ephemeral X25519 keypair
- Encrypted payload: `[24-byte nonce][32-byte sender pubkey][ciphertext]`
- Only the protocol can decrypt with their secret key

## REST API

When the frontend is deployed, agents can query:
- `GET /api/disclosures` — All disclosures (filterable: ?hacker=X&status=N)
- `GET /api/protocols` — All registered protocols

## Account Sizes

- Protocol: 181 bytes
- Disclosure: 1239 bytes

## Constraints

| Parameter | Min | Max |
|-----------|-----|-----|
| Protocol name | 1 char | 64 chars |
| Encrypted proof | 0 bytes | 1024 bytes |
| Severity | 1 | 4 |
| Grace period | 60 seconds | unlimited |
| Nonce | 0 | 2^64-1 |

## Use Cases for Agents

1. **Security Scanner Agent:** Find vulnerabilities, submit disclosures automatically
2. **Protocol Guardian Agent:** Auto-acknowledge incoming disclosures, triage by severity
3. **Bounty Manager Agent:** Track disclosure lifecycle, trigger payments on resolution
4. **Reputation Agent:** Query resolved disclosures to build hacker trust scores
5. **Alert Agent:** Monitor for new disclosures targeting your protocol
