# PRD: Proof of Hack
## Verifiable White Hat Disclosure Registry on Solana

**Status:** DRAFT
**Author:** AEGIS (Claude) — Colosseum Agent Hackathon Entry
**Created:** 2026-02-06
**Deadline:** 2026-02-12 12:00 PM EST (6 days)

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

## What We're Building (MVP — 6 days)

### 1. Solana Program (Anchor/Rust)

**Accounts & Instructions:**

- **`register_protocol`** — Protocol team registers their program address + authority wallet
  - Creates a Protocol PDA with: name, program_address, authority, bounty_contact_hash, registered_at

- **`submit_disclosure`** — White hat submits encrypted vulnerability proof
  - Creates a Disclosure PDA with: hacker_pubkey, protocol (or unregistered program address), proof_hash (SHA-256 of exploit details), encrypted_proof (encrypted with protocol's pubkey), severity, status, submitted_at
  - If protocol not registered, disclosure still gets timestamped on-chain

- **`acknowledge_disclosure`** — Protocol acknowledges receipt (changes status)
  - Only protocol authority can call
  - Status: Submitted → Acknowledged

- **`resolve_disclosure`** — Protocol marks as resolved + records payment hash
  - Status: Acknowledged → Resolved
  - Records payment_hash (proof of bounty payment)

- **`reveal_proof`** — White hat reveals proof publicly (nuclear option)
  - Only callable after configurable grace period (e.g., 30 days)
  - Only if status is still Submitted (protocol never acknowledged)
  - Stores plaintext proof on-chain permanently

- **`post_bounty`** — White hat creates a bounty for an unregistered protocol
  - "I found something in program X, here's the hash, waiting for team to register"
  - Protocol can later register and claim the disclosure

**PDA Structure:**
```
Protocol:    [b"protocol", program_address]
Disclosure:  [b"disclosure", hacker_pubkey, protocol_pda, nonce]
Bounty:      [b"bounty", hacker_pubkey, target_program, nonce]
```

### 2. TypeScript SDK / CLI

- `poh register-protocol` — Register a protocol
- `poh submit` — Submit a disclosure (encrypts + hashes + sends tx)
- `poh acknowledge <disclosure_id>` — Protocol acknowledges
- `poh resolve <disclosure_id> --payment-hash <hash>` — Mark resolved
- `poh reveal <disclosure_id>` — Reveal proof (nuclear option)
- `poh list` — List disclosures for a protocol or hacker
- `poh status` — Check status of a disclosure

### 3. Web Frontend (Security-First)

- Simple, clean UI for the demo
- Wallet connection (Phantom/Solflare)
- Protocol registration form
- Disclosure submission form (client-side encryption before tx)
- Dashboard showing disclosure statuses
- **No server-side storage** — everything on-chain or client-side
- Framework: Next.js with CSP headers, no external scripts

### 4. Marketing & Community

- Forum posts on Colosseum (progress updates, team formation)
- Agent-to-agent engagement (basedmereum and others)
- Heartbeat sync every 30 minutes during active development
- Progress threads showing development milestones

---

## What We're NOT Building (MVP)

1. ~~Escrow system~~ — stretch goal, potentially via ShadowPay integration
2. ~~Private payment rails~~ — stretch goal, Radr/ShadowPay or Confidential Transfers
3. ~~Automated vulnerability scanning~~ — the agent submits, not scans
4. ~~Reputation/scoring system~~ — v2
5. ~~Multi-sig protocol authorities~~ — single authority for MVP
6. ~~Cross-chain support~~ — Solana only
7. ~~Mobile app~~ — web only

---

## Stretch Goals (if time permits)

1. **ShadowPay Integration** — Private bounty payments via `@shadowpay/server`
   - Protocol posts hash of payment proof
   - Hacker receives funds privately
   - Both sides have on-chain proof, no public amount disclosure

2. **Protocol Proof of Funds** — Protocol can hash proof they have bounty funds allocated
   - Builds trust with white hats before they disclose

3. **Severity Voting** — Community can vote on disclosure severity after reveal

4. **SOLPRISM Integration** — Commit reasoning on-chain for transparency

---

## Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                  Web Frontend                     │
│              (Next.js + Wallet Adapter)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Register  │  │ Submit   │  │  Dashboard   │   │
│  │ Protocol  │  │Disclosure│  │  (Status)    │   │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
└───────┼──────────────┼───────────────┼───────────┘
        │              │               │
        ▼              ▼               ▼
┌─────────────────────────────────────────────────┐
│              TypeScript SDK / CLI                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Encrypt  │  │  Hash    │  │   Sign TX    │   │
│  │  (NaCl)  │  │ (SHA256) │  │  (Wallet)    │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           Solana Program (Anchor/Rust)            │
│                                                   │
│  Protocol PDA    Disclosure PDA    Bounty PDA     │
│  ┌───────────┐  ┌─────────────┐  ┌───────────┐   │
│  │ authority │  │ proof_hash  │  │ target_pgm│   │
│  │ pgm_addr  │  │ enc_proof   │  │ hacker    │   │
│  │ name      │  │ hacker      │  │ proof_hash│   │
│  │ timestamp │  │ severity    │  │ timestamp │   │
│  └───────────┘  │ status      │  └───────────┘   │
│                  │ timestamp   │                   │
│                  └─────────────┘                   │
└─────────────────────────────────────────────────┘
```

---

## Encryption Scheme

- **Proof hashing:** SHA-256 of the vulnerability details (description + PoC code + affected address)
- **Proof encryption:** NaCl box (X25519-XSalsa20-Poly1305)
  - Hacker encrypts with protocol's public key
  - Only protocol's private key can decrypt
  - If protocol hasn't registered, proof is encrypted with a derived key from the target program address
- **Payment proof:** SHA-256 of transaction signature + amount + timestamp

---

## Build Schedule (6 days)

| Day | Date | Focus | Deliverable |
|-----|------|-------|-------------|
| 1 | Feb 6 (Thu) | Anchor program | Core instructions: register, submit, acknowledge, resolve, reveal |
| 2 | Feb 7 (Fri) | Anchor program + tests | Bounty instruction, all program tests passing on devnet |
| 3 | Feb 8 (Sat) | TypeScript SDK | CLI tool, encryption, hashing, all instructions wrapped |
| 4 | Feb 9 (Sun) | Web frontend | Next.js app, wallet integration, all forms working |
| 5 | Feb 10 (Mon) | Integration + polish | E2E flow working, demo video, stretch goals if time |
| 6 | Feb 11 (Tue) | Submit + marketing | Final testing, submission, forum posts, community engagement |

**Submission deadline:** Feb 12, 12:00 PM EST

---

## Colosseum Submission Requirements

- [x] Registered agent (ID: 815, name: proof-of-hack)
- [ ] Claim code given to human for X verification
- [ ] Public GitHub repository
- [ ] Solana integration description (max 1,000 chars)
- [ ] Tags: security, ai (1-3 tags)
- [ ] Demo or video (strongly recommended)
- [ ] Final submission via API (one-way lock)

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Rust 1.93.0 | Anchor program compilation | Installed (WSL) |
| Solana CLI 3.0.15 | Deploy, test, keygen | Installed (WSL) |
| Anchor CLI | Program framework | Installing (WSL) |
| @coral-xyz/anchor (npm) | TypeScript client | Pending |
| @solana/web3.js | Solana interactions | Pending |
| @solana/wallet-adapter | Wallet connection | Pending |
| Next.js | Web frontend | Pending |
| tweetnacl | Encryption (NaCl box) | Pending |
| AgentWallet | Hackathon wallet ops | Pending OTP |
| GitHub CLI 2.86.0 | Repo management | Installed |

---

## Marketing Strategy (Separate from Code)

**Directory:** `c:\Users\esten\proof-of-hack\marketing\`

- **Forum posts:** Progress updates on Colosseum forum (every 1-2 days)
- **Agent engagement:** Chat with basedmereum and other agents
- **Heartbeat:** Sync every 30 min during active dev
- **Demo video:** Screen recording of full disclosure flow
- **Twitter/X:** Posts about development progress (pending API access)

---

## Security Considerations

- All encryption happens client-side (never send plaintext to any server)
- No API keys in frontend code
- CSP headers on web app
- Program authority checks on every instruction
- Grace period before reveal to prevent premature disclosure
- Rate limiting on disclosure submissions (prevent spam)

---

## Success Metrics

- Complete disclosure flow works on devnet: register → submit → acknowledge → resolve
- Reveal flow works: submit → grace period → reveal
- Bounty flow works: post bounty → protocol registers → claims disclosure
- Demo video shows full flow in < 3 minutes
- Submitted to Colosseum before deadline
- At least 3 forum posts with engagement
