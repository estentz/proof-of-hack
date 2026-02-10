# Proof of Hack

**Trustless responsible disclosure with on-chain proof, accountability, and bounty escrow.**

White hats hash exploit proof to Solana, protocols verify privately, both sides have cryptographic accountability — all without public disclosure. Bounty vaults enable automatic SOL payouts per severity. Security-audited with 12 hardening fixes.

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
4. BOUNTY ESCROW     SOL vaults pay automatically per severity on resolution
```

## Architecture

### Solana Program (Anchor 0.32.1)

16 instructions across three domains:

**Core Disclosure Flow:**

| Instruction | Description |
|-------------|-------------|
| `register_protocol` | Protocol registers with X25519 encryption key (upgrade authority verified) |
| `submit_disclosure` | White hat submits proof hash + encrypted proof (target must be executable) |
| `acknowledge_disclosure` | Protocol acknowledges receipt |
| `resolve_disclosure` | Protocol marks resolved with payment proof + resolution type |
| `reveal_proof` | Hacker reveals proof after grace period (always allowed, by design) |
| `claim_disclosure` | Protocol claims disclosure after late registration |

**Bounty System:**

| Instruction | Description |
|-------------|-------------|
| `create_bounty` | Create SOL vault with per-severity rates |
| `fund_bounty` | Add SOL to active vault |
| `claim_bounty` | Hacker claims bounty after resolution (auto-sets ONCHAIN_BOUNTY) |
| `deactivate_bounty` | Deactivate vault (required before withdrawal) |
| `withdraw_bounty` | Withdraw SOL from deactivated vault |

**Protocol Management:**

| Instruction | Description |
|-------------|-------------|
| `create_protocol_config` | Set min grace period for disclosures |
| `update_protocol_config` | Update existing config |
| `transfer_authority` | Propose authority transfer (step 1 of 2) |
| `accept_authority` | Accept authority transfer (step 2 of 2) |
| `update_encryption_key` | Rotate encryption key |

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
- `/register` — Protocol registration with upgrade authority verification
- `/submit` — Disclosure submission with client-side NaCl encryption
- `/dashboard` — View disclosures, acknowledge, resolve, reveal with progress timeline
- `/bounty` — Bounty vault management

### Agent Integration

- `skill.json` — Machine-readable program specification (16 instructions, all PDAs, all constraints)
- `skill.md` — Human-readable agent skill documentation
- REST API — `/api/protocols`, `/api/disclosures`, `/api/vaults`, `/api/protocols/{id}/status`
- `POST /api/register` — Build unsigned register tx (3-line agent integration)

## Security

**White-hat adversarial audit with 12 hardening fixes:**

- All encryption is client-side (NaCl box: X25519-XSalsa20-Poly1305)
- SHA-256 proof commitment is immutable from submission
- Upgrade authority verification on registration (BPF Upgradeable Loader)
- Two-step authority transfer prevents accidental lockout
- Grace period bypass prevention (PDA derived from target, not user input)
- Executable target enforcement
- Minimum ciphertext size for valid NaCl box (48 bytes)
- No init-if-needed — explicit create/update pattern
- Stale authority elimination — all auth routes through Protocol account
- Deactivated vault guards for funding and withdrawal
- Resolution type honesty (off-chain attestation vs on-chain bounty vs no payment)
- Encryption key rotation without re-registration

## Development

```bash
# Install dependencies
npm install

# Build program (requires WSL with Anchor 0.32.1, Solana CLI 3.0.15, Rust 1.93.0)
anchor build

# Run tests
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
