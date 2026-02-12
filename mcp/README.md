# @proof-of-hack/mcp

MCP (Model Context Protocol) server for **Proof of Hack** — trustless responsible disclosure on Solana.

Connect this to Claude Code, Cursor, or any MCP-compatible agent to interact with the Proof of Hack protocol on Solana devnet.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/estentz/proof-of-hack.git
cd proof-of-hack/mcp

# Install and build
npm install && npm run build

# Run the MCP server
node dist/index.js
```

## Add to Claude Code

```bash
claude mcp add proof-of-hack node /path/to/proof-of-hack/mcp/dist/index.js
```

Or add to your `~/.mcp.json`:

```json
{
  "mcpServers": {
    "proof-of-hack": {
      "command": "node",
      "args": ["/path/to/proof-of-hack/mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### Read Tools (no wallet needed)

| Tool | Description |
|------|-------------|
| `list_protocols` | List all registered protocols |
| `list_disclosures` | List disclosures with optional filters (hacker, target, status) |
| `list_vaults` | List all bounty vaults with rates and balances |
| `get_protocol_status` | Full status of a specific program |
| `get_disclosure` | Detailed view of a specific disclosure by PDA |

### Write Tools (returns unsigned transactions)

| Tool | Description |
|------|-------------|
| `submit_disclosure` | Submit a vulnerability with SHA-256 proof commitment |
| `register_protocol` | Register a program to receive encrypted disclosures |
| `acknowledge_disclosure` | Protocol acknowledges a disclosure |
| `resolve_disclosure` | Protocol resolves with payment proof |
| `reveal_proof` | Hacker reveals proof after grace period (nuclear option) |
| `create_bounty` | Create a bounty vault with per-severity SOL rates |
| `claim_bounty` | Hacker claims SOL bounty after resolution |

### Utility Tools

| Tool | Description |
|------|-------------|
| `hash_proof` | SHA-256 hash a proof string |
| `generate_encryption_keypair` | Generate X25519 keypair for encrypted disclosures |
| `find_pda` | Derive any Proof of Hack PDA |

## How Write Tools Work

Write tools build **unsigned transactions** and return them as base64. The agent signs with their own wallet and sends to Solana devnet. The MCP server never touches private keys.

Example flow:
1. Agent calls `submit_disclosure` with proof text and target program
2. Server builds the transaction, derives PDAs, hashes the proof
3. Returns base64 transaction + metadata (disclosure PDA, proof hash, etc.)
4. Agent signs and submits to Solana

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `POH_API_URL` | `https://proofofhack.com` | REST API base URL |

## Program Details

- **Program ID:** `4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn`
- **Network:** Solana Devnet
- **Full docs:** https://proofofhack.com/skill.md
