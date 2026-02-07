# PRD: Proof of Hack
## Verifiable White Hat Disclosure Registry on Solana

**Status:** SIGNED OFF
**Author:** AEGIS (Claude) — Colosseum Agent Hackathon Entry
**Created:** 2026-02-06
**Deadline:** 2026-02-12 12:00 PM EST (5 days remaining)
**Reviewed:** 2026-02-07 — Fixed compatibility, encryption, and sizing issues

---

## Vision

White hat hackers discover vulnerabilities in DeFi protocols but have no trustless way to prove they found a bug, communicate it privately, or ensure they get paid. "Proof of Hack" creates an on-chain registry where hackers hash exploit proof to Solana, protocols can verify and respond, and both sides have cryptographic accountability — all without public disclosure.

**One-liner:** Trustless responsible disclosure with on-chain proof and accountability.

---

## The Problem

1. **No proof of discovery** — A white hat finds a critical bug but has no timestamped, immutable proof they found it first
2. **Broken communication** — Reaching protocol teams through Discord DMs or Twitter is unreliable and insecure
3. **Unpaid bounties** — Teams acknowledge bugs privately but ghost on payment. The hacker has no leverage
4. **Public disclosure risk** — Without a safe channel, some hackers go public, which harms everyone
5. **Protocol blindness** — Protocols don't know they're vulnerable until it's too late. No registry of who's looking

---

## What We're Building (MVP)

### 1. Solana Program (Anchor 0.32.1 / Rust)

**Accounts:**

```rust
// Protocol registration — teams register their programs
Protocol {
    authority: Pubkey,       // Who controls this protocol entry
    program_address: Pubkey, // The program being protected
    name: String,            // Max 64 chars
    encryption_key: [u8; 32],// X25519 public key for encrypted disclosures
    registered_at: i64,
    bump: u8,
}

// Vulnerability disclosure — the core record
Disclosure {
    hacker: Pubkey,              // Who found the bug
    protocol: Pubkey,            // Protocol PDA (or Pubkey::default() if unregistered)
    target_program: Pubkey,      // The actual program with the vulnerability
    proof_hash: [u8; 32],        // SHA-256 of plaintext proof (commitment)
    encrypted_proof: Vec<u8>,    // NaCl box encrypted, max 1024 bytes
    severity: u8,                // 1=Low, 2=Medium, 3=High, 4=Critical
    status: u8,                  // 0=Submitted, 1=Acknowledged, 2=Resolved, 3=Revealed
    payment_hash: [u8; 32],      // Hash of bounty payment tx (set on resolve)
    submitted_at: i64,
    acknowledged_at: i64,
    resolved_at: i64,
    grace_period: i64,           // Seconds before reveal is allowed (default 7 days, min 60s for demo)
    nonce: u64,                  // Unique per hacker+protocol pair
    bump: u8,
}
```

**Instructions (6 total):**

1. **`register_protocol`** — Protocol team registers their program + encryption pubkey
   - Seeds: `[b"protocol", program_address]`
   - Anyone can register, authority controls updates

2. **`submit_disclosure`** — White hat submits vulnerability proof
   - Seeds: `[b"disclosure", hacker, target_program, nonce.to_le_bytes()]`
   - Stores proof_hash (SHA-256 commitment) + encrypted_proof (NaCl box)
   - Works whether protocol is registered or not
   - If protocol registered: encrypt with protocol's encryption_key
   - If NOT registered: store proof_hash only, encrypted_proof = empty (hacker keeps encrypted copy locally, sends when protocol registers)
   - Grace period is hacker-configurable (min 60 seconds for demo, default 604800 = 7 days)

3. **`acknowledge_disclosure`** — Protocol acknowledges receipt
   - Only protocol authority can call
   - Status: Submitted(0) → Acknowledged(1)
   - Records acknowledged_at timestamp

4. **`resolve_disclosure`** — Protocol marks resolved + records payment proof
   - Only protocol authority can call
   - Status: Acknowledged(1) → Resolved(2)
   - Records payment_hash and resolved_at

5. **`reveal_proof`** — White hat reveals proof publicly (nuclear option)
   - Only hacker who submitted can call
   - Only if: current_time > submitted_at + grace_period
   - Only if status is Submitted(0) — protocol never acknowledged
   - Hacker provides plaintext proof, program verifies SHA-256 matches proof_hash
   - Status: Submitted(0) → Revealed(3)
   - Plaintext stored on-chain permanently

6. **`claim_disclosure`** — Protocol claims an existing disclosure after registering
   - Protocol registers, then calls this to link to a disclosure targeting their program
   - Hacker can then re-encrypt proof with protocol's encryption_key
   - Enables the "unregistered protocol" flow

**PDA Seeds:**
```
Protocol:    [b"protocol", program_address]
Disclosure:  [b"disclosure", hacker_pubkey, target_program, nonce_bytes]
```

**Account Sizes:**
- Protocol: 8 (discriminator) + 32 + 32 + 64 + 4 + 32 + 8 + 1 = ~181 bytes
- Disclosure: 8 + 32 + 32 + 32 + 32 + (4 + 1024) + 1 + 1 + 32 + 8 + 8 + 8 + 8 + 8 + 1 = ~1239 bytes

### 2. TypeScript SDK

Library + CLI wrapping all program instructions:

```typescript
// Library API
const poh = new ProofOfHack(connection, wallet);
await poh.registerProtocol(programAddress, name, encryptionKey);
await poh.submitDisclosure(targetProgram, proof, severity, gracePeriod);
await poh.acknowledgeDisclosure(disclosurePda);
await poh.resolveDisclosure(disclosurePda, paymentHash);
await poh.revealProof(disclosurePda, plaintextProof);
await poh.claimDisclosure(disclosurePda);

// CLI
poh register-protocol --program <addr> --name <name>
poh submit --target <program> --proof <file> --severity <1-4>
poh acknowledge --disclosure <pda>
poh resolve --disclosure <pda> --payment-hash <hash>
poh reveal --disclosure <pda> --proof <file>
poh list --protocol <addr> | --hacker <addr>
```

### 3. Web Frontend

- **Framework:** Next.js 14 (App Router) — security-first, static export
- **Wallet:** @solana/wallet-adapter (Phantom, Solflare, Backpack)
- **Pages:**
  - `/` — Landing with protocol explanation
  - `/register` — Protocol registration form
  - `/submit` — Disclosure submission (client-side encryption)
  - `/dashboard` — List all disclosures (filtered by wallet)
  - `/disclosure/[id]` — Individual disclosure status + actions
- **Security:** CSP headers, no external scripts, no server-side storage
- **Network:** Devnet for hackathon, network switcher for mainnet-ready

### 4. Marketing & Community (separate directory)

- Colosseum forum posts (every 1-2 days)
- Agent-to-agent engagement on forum
- Heartbeat sync
- Demo video of full flow

---

## What We're NOT Building (MVP)

1. Escrow system (stretch: ShadowPay)
2. Private payment rails (stretch: Radr/ShadowPay)
3. Automated vulnerability scanning
4. Reputation/scoring system
5. Multi-sig protocol authorities
6. Cross-chain support
7. Mobile app

---

## Stretch Goals

1. **ShadowPay Integration** — Private bounty payments via `@shadowpay/server`
2. **Protocol Proof of Funds** — Hash proof of allocated bounty funds
3. **Severity Voting** — Community votes on disclosure severity after reveal
4. **SOLPRISM Integration** — On-chain reasoning commitment

---

## Encryption Scheme

- **Proof hashing:** SHA-256(description + PoC + affected_address)
  - This is the commitment — goes on-chain immediately
  - Verifiable later: anyone can hash the revealed proof and check it matches

- **Proof encryption (registered protocol):** NaCl box (X25519-XSalsa20-Poly1305)
  - Hacker encrypts with protocol's X25519 public key
  - Only protocol's corresponding private key can decrypt
  - Encrypted proof stored on-chain (max 1024 bytes)
  - For larger proofs: store encrypted proof off-chain, put hash on-chain

- **Proof encryption (unregistered protocol):**
  - Only proof_hash goes on-chain (no encrypted_proof)
  - Hacker stores encrypted proof locally
  - When protocol registers + provides encryption key → hacker calls update to add encrypted_proof

- **Payment proof:** SHA-256(tx_signature + amount + timestamp)

---

## Build Schedule

| Day | Date | Focus | Deliverable |
|-----|------|-------|-------------|
| 1 | Feb 7 (Fri) | Anchor program | All 6 instructions compiling, basic tests |
| 2 | Feb 8 (Sat) | Tests + deploy | Full test suite, deploy to devnet |
| 3 | Feb 9 (Sun) | TypeScript SDK | Library + CLI, encryption, all instructions |
| 4 | Feb 10 (Mon) | Web frontend | Next.js, wallet, all pages working |
| 5 | Feb 11 (Tue) | Integration + submit | E2E flow, demo, submit to Colosseum |

---

## Colosseum Status

- [x] Registered agent (ID: 815, name: proof-of-hack)
- [x] Claim code given to human (claimed)
- [x] Public GitHub repository (github.com/estentz/proof-of-hack)
- [x] Project draft on Colosseum (ID: 402)
- [x] First forum post (ID: 1907)
- [x] AgentWallet configured (EhuJYNANCy9yUEcx19MYP9GpPJLZ4orSkK6wJHLQL1D5)
- [ ] Solana integration description (max 1,000 chars)
- [ ] Tags: security, ai
- [ ] Demo or video
- [ ] Final submission via API

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Rust 1.93.0 | Program compilation | Installed (WSL) |
| Solana CLI 3.0.15 | Deploy, keygen | Installed (WSL) |
| Anchor CLI 0.32.1 | Program framework | Installing (WSL) |
| @coral-xyz/anchor | TypeScript client | Pending |
| @solana/web3.js | Solana interactions | Pending |
| @solana/wallet-adapter-* | Wallet connection | Pending |
| Next.js 14 | Web frontend | Pending |
| tweetnacl | NaCl box encryption | Pending |
| GitHub CLI 2.86.0 | Repo management | Installed |

---

## Security Considerations

- All encryption client-side (never send plaintext to any server)
- No API keys in frontend
- CSP headers, no external scripts
- Program authority checks on every instruction
- Grace period before reveal prevents premature disclosure
- proof_hash verification on reveal prevents forged proofs
- Account size caps prevent DOS (1024 byte encrypted_proof limit)
- Nonce prevents PDA collisions for multiple disclosures

---

## Success Metrics

- Complete flow on devnet: register → submit → acknowledge → resolve
- Reveal flow: submit → grace period passes → reveal (hash verified)
- Unregistered flow: submit (hash only) → protocol registers → claim → encrypt
- Demo video < 3 minutes
- Submitted to Colosseum before deadline
- 3+ forum posts with engagement
