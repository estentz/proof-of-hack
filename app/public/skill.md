# Proof of Hack — Agent Skill

> Trustless responsible disclosure with on-chain proof, accountability, and bounty escrow on Solana.

## What This Does

White hats hash exploit proof to Solana, protocols verify privately, both sides get cryptographic accountability — all without public disclosure. Bounty vaults enable automatic SOL payouts per severity. Security-audited with 12 hardening fixes.

**Program ID:** `4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn`
**Network:** Solana Devnet
**SDK:** `@proof-of-hack/sdk` (TypeScript)
**GitHub:** https://github.com/estentz/proof-of-hack

## Instructions (16)

### Core Disclosure Flow

#### 1. register_protocol
Register your program to receive encrypted vulnerability disclosures. Signer must be the upgrade authority of the target program (verified via BPF Upgradeable Loader).

**Signer:** Protocol authority (upgrade authority of target program)
**Params:**
- `program_address: PublicKey` — The Solana program you want to protect
- `name: String` — Protocol name (1-64 printable ASCII chars)
- `encryption_key: [u8; 32]` — X25519 public key for receiving encrypted proofs

**PDA:** `["protocol", program_address]`

#### 2. submit_disclosure
Submit a vulnerability disclosure with SHA-256 proof commitment. Target must be an executable program. Enforces protocol's min_grace_period if ProtocolConfig exists.

**Signer:** Hacker (discoverer's wallet)
**Params:**
- `proof_hash: [u8; 32]` — SHA-256 hash of your vulnerability proof
- `encrypted_proof: Vec<u8>` — NaCl box encrypted proof (48-1024 bytes, or empty)
- `sender_encryption_key: [u8; 32]` — Hacker's X25519 public key for decryption
- `severity: u8` — 1=Low, 2=Medium, 3=High, 4=Critical
- `grace_period: i64` — Seconds before reveal is allowed (min 60, max 1 year)
- `nonce: u64` — Unique per hacker+program pair (start at 0, increment)

**PDA:** `["disclosure", hacker, target_program, nonce_le_bytes]`

#### 3. acknowledge_disclosure
Protocol acknowledges receipt of a vulnerability report.

**Signer:** Protocol authority
**Constraint:** Disclosure status must be SUBMITTED (0)

#### 4. resolve_disclosure
Protocol marks vulnerability as resolved with payment proof and resolution type.

**Signer:** Protocol authority
**Params:**
- `payment_hash: [u8; 32]` — SHA-256 hash of payment proof (tx hash, receipt, etc.)
- `resolution_type: u8` — 1=Off-chain attestation, 2=On-chain bounty, 3=No payment

**Constraint:** Disclosure status must be ACKNOWLEDGED (1)

#### 5. reveal_proof
Hacker reveals proof publicly after grace period expires. Allowed even after resolution by design — the hacker always retains the right to publish.

**Signer:** Hacker (original submitter)
**Params:**
- `plaintext_proof: Vec<u8>` — Original proof text (max 1024 bytes)

**Constraints:** Status SUBMITTED, grace period elapsed, SHA-256(plaintext) matches original proof_hash

#### 6. claim_disclosure
Protocol claims an unclaimed disclosure (submitted before protocol registered).

**Signer:** Protocol authority
**Constraint:** disclosure.target_program == protocol.program_address AND disclosure.protocol == default

### Bounty System

#### 7. create_bounty
Create a bounty vault for a protocol with per-severity SOL rates and optional initial deposit.

**Signer:** Protocol authority
**Params:**
- `low_bounty: u64` — Lamports per Low severity
- `medium_bounty: u64` — Lamports per Medium severity
- `high_bounty: u64` — Lamports per High severity
- `critical_bounty: u64` — Lamports per Critical severity
- `deposit: u64` — Initial SOL deposit (lamports, 0 allowed)

**PDA:** `["vault", protocol_pda]`

#### 8. fund_bounty
Add more SOL to an existing active bounty vault.

**Signer:** Protocol authority
**Params:** `amount: u64` — Additional lamports to deposit
**Constraint:** Vault must be active

#### 9. claim_bounty
Hacker claims SOL bounty after disclosure is resolved. Creates receipt PDA to prevent double-claims. Auto-sets resolution_type to ONCHAIN_BOUNTY.

**Signer:** Hacker
**Constraint:** Status RESOLVED, hacker matches disclosure.hacker
**PDA:** `["bounty_claim", disclosure_pda]`

#### 10. deactivate_bounty
Deactivate a bounty vault. Required before withdrawal.

**Signer:** Protocol authority
**Constraint:** Vault must be active

#### 11. withdraw_bounty
Withdraw SOL from a deactivated bounty vault.

**Signer:** Protocol authority
**Params:** `amount: u64` — Lamports to withdraw
**Constraint:** Vault must be deactivated

### Protocol Management

#### 12. create_protocol_config
Create protocol configuration (min grace period). One-time init.

**Signer:** Protocol authority
**Params:** `min_grace_period: i64` — Minimum grace period in seconds (0 = global 60s minimum)
**PDA:** `["protocol_config", protocol_pda]`

#### 13. update_protocol_config
Update existing protocol configuration.

**Signer:** Protocol authority
**Params:** `min_grace_period: i64` — Updated minimum grace period

#### 14. transfer_authority
Propose authority transfer to a new wallet (step 1 of 2). New authority must call accept_authority.

**Signer:** Current authority
**Accounts:** `new_authority` — Proposed new authority (not zero address)

#### 15. accept_authority
Accept a pending authority transfer (step 2 of 2).

**Signer:** New authority (must match protocol.pending_authority)

#### 16. update_encryption_key
Rotate the protocol's X25519 encryption key without re-registering.

**Signer:** Protocol authority
**Params:** `new_key: [u8; 32]` — New X25519 public key

## Status Lifecycle

```
SUBMITTED (0) → acknowledge → ACKNOWLEDGED (1) → resolve → RESOLVED (2)
     ↓                                                          ↓
[grace period expires]                                  claim_bounty (optional)
     ↓
reveal_proof → REVEALED (3)
```

## Resolution Types

| Code | Type | Description |
|------|------|-------------|
| 0 | NONE | Not resolved yet |
| 1 | OFFCHAIN_ATTESTATION | Protocol claims off-chain payment (unverified) |
| 2 | ONCHAIN_BOUNTY | Paid via on-chain bounty vault (verifiable) |
| 3 | NO_PAYMENT | Resolved without payment |

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
await poh.resolveDisclosure(disclosurePda, protocolPda, paymentHashBytes, RESOLUTION_TYPE.OFFCHAIN_ATTESTATION);

// Create bounty vault
await poh.createBounty(protocolPda, {
  low: 0.1 * LAMPORTS_PER_SOL,
  medium: 0.5 * LAMPORTS_PER_SOL,
  high: 1 * LAMPORTS_PER_SOL,
  critical: 5 * LAMPORTS_PER_SOL,
  deposit: 10 * LAMPORTS_PER_SOL,
});

// Claim bounty (as hacker, after resolution)
await poh.claimBounty(disclosurePda, vaultPda);
```

## Encryption

Proofs are encrypted client-side using NaCl box (X25519-XSalsa20-Poly1305):
- Protocol provides X25519 public key during registration
- Hacker generates ephemeral X25519 keypair
- Encrypted payload: `[24-byte nonce][ciphertext+auth_tag]`
- Sender's public key stored in `sender_encryption_key` field on Disclosure
- Only the protocol can decrypt with their secret key
- Minimum ciphertext size: 48 bytes (24 nonce + 16 auth tag + 8 payload)

## REST API

- `GET /api/protocols` — All registered protocols
- `GET /api/disclosures` — All disclosures (filterable: ?hacker=X&status=N&target=Y)
- `GET /api/vaults` — All bounty vaults with rates and balances
- `GET /api/protocols/{programId}/status` — Full status: protocol, config, vault, disclosures
- `POST /api/register` — Build unsigned register_protocol tx for agent integration

## Account Sizes

| Account | Size (bytes) |
|---------|-------------|
| Protocol | 213 |
| Disclosure | 1272 |
| BountyVault | 98 |
| BountyClaim | 9 |
| ProtocolConfig | 49 |

## Constraints

| Parameter | Min | Max |
|-----------|-----|-----|
| Protocol name | 1 char | 64 chars (printable ASCII) |
| Encrypted proof | 48 bytes (if non-empty) | 1024 bytes |
| Severity | 1 (Low) | 4 (Critical) |
| Grace period | 60 seconds | 31,536,000 seconds (1 year) |
| Min grace period (config) | 0 | 31,536,000 seconds (1 year) |
| Nonce | 0 | 2^64-1 |

## Security Audit

White-hat adversarial audit with 12 hardening fixes applied:
- WH-001: Honest resolution types (off-chain attestation vs on-chain bounty vs no payment)
- WH-002: Grace period bypass prevention (protocol PDA derived from target, not user input)
- WH-003: Removed init-if-needed (split into create + update)
- WH-004/012: Eliminated stale authority caching in vaults and configs
- WH-005: Executable target enforcement
- WH-006: Minimum ciphertext size for valid NaCl box
- WH-009/010: Deactivated vault guards for funding and withdrawal
- WH-011: Two-step authority transfer (propose + accept)
- WH-014: Encryption key rotation

## Use Cases for Agents

1. **Security Scanner Agent:** Find vulnerabilities, submit disclosures automatically
2. **Protocol Guardian Agent:** Auto-acknowledge incoming disclosures, triage by severity
3. **Bounty Manager Agent:** Track disclosure lifecycle, manage vault funding, trigger payments
4. **Reputation Agent:** Query resolved disclosures to build hacker trust scores
5. **Alert Agent:** Monitor for new disclosures targeting your protocol
6. **Key Rotation Agent:** Periodically rotate protocol encryption keys
