# Proof of Hack

**Trustless responsible disclosure with on-chain proof and accountability.**

White hats hash exploit proof to Solana, protocols verify privately, both sides have cryptographic accountability — all without public disclosure.

## The Problem

1. **No proof of discovery** — White hats find bugs but can't prove they found them first
2. **Broken communication** — Discord DMs and Twitter are unreliable for security reports
3. **Unpaid bounties** — Protocols acknowledge bugs privately but ghost on payment
4. **Disclosure risk** — Without a safe channel, some hackers go public
5. **Protocol blindness** — No registry of active security researchers

## How It Works

```
1. HASH & COMMIT     SHA-256 hash your proof → immutable on-chain commitment
2. ENCRYPT & SHARE   NaCl box encrypt with protocol's key → only they can decrypt
3. VERIFY & RESOLVE  Protocol acknowledges, fixes, pays → or you reveal after grace period
```

## Architecture

### Solana Program (Anchor 0.32.1)

6 instructions with full lifecycle:

| Instruction | Description |
|-------------|-------------|
| `register_protocol` | Protocol registers with X25519 encryption key |
| `submit_disclosure` | White hat submits proof hash + encrypted proof |
| `acknowledge_disclosure` | Protocol acknowledges receipt |
| `resolve_disclosure` | Protocol marks resolved + payment proof |
| `reveal_proof` | Hacker reveals proof after grace period (nuclear option) |
| `claim_disclosure` | Protocol claims disclosure after late registration |

### TypeScript SDK

```typescript
import { ProofOfHack, hashProof, encryptProof } from "@proof-of-hack/sdk";

const poh = new ProofOfHack(connection, wallet);
const { tx, disclosurePda, proofHash } = await poh.submitDisclosure(
  targetProgram,
  "Critical reentrancy in withdraw()",
  SEVERITY.CRITICAL,
  { gracePeriod: 604800 } // 7 days
);
```

### Web Frontend (Next.js 14)

- `/` — Landing page
- `/register` — Protocol registration
- `/submit` — Disclosure submission with client-side encryption
- `/dashboard` — View all disclosures

## Security

- All encryption is client-side (NaCl box: X25519-XSalsa20-Poly1305)
- SHA-256 proof commitment is immutable from submission
- Authority checks on every instruction
- Grace period prevents premature disclosure
- Hash verification on reveal prevents forged proofs
- 1024-byte encrypted proof cap prevents DoS
- No server-side storage — everything on-chain

## Development

```bash
# Install dependencies
npm install

# Build program
anchor build

# Run tests (19 passing)
anchor test

# Build SDK
cd sdk && npm install && npm run build

# Build frontend
cd app && npm install && npm run build
```

## Tech Stack

- **Program:** Anchor 0.32.1 / Rust
- **Chain:** Solana (Devnet)
- **SDK:** TypeScript / @coral-xyz/anchor
- **Frontend:** Next.js 14 / Tailwind / @solana/wallet-adapter
- **Encryption:** tweetnacl (NaCl box)
- **Hashing:** SHA-256

## Program ID

```
4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn
```

## License

MIT

---

Built for the [Colosseum Agent Hackathon](https://colosseum.com) (Feb 2-12, 2026)
