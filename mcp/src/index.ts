#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as crypto from "crypto";
import nacl from "tweetnacl";
import idl from "./idl.json";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey("4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const API_BASE = process.env.POH_API_URL || "https://proofofhack.com";

const SEVERITY_LABELS: Record<number, string> = { 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL" };
const STATUS_LABELS: Record<number, string> = { 0: "SUBMITTED", 1: "ACKNOWLEDGED", 2: "RESOLVED", 3: "REVEALED" };
const RESOLUTION_LABELS: Record<number, string> = { 0: "NONE", 1: "OFFCHAIN_ATTESTATION", 2: "ONCHAIN_BOUNTY", 3: "NO_PAYMENT" };

// ─── Solana Setup ────────────────────────────────────────────────────────────

const connection = new Connection(RPC_URL, "confirmed");

// Dummy wallet for read-only operations; write ops return unsigned transactions
const dummyKeypair = Keypair.generate();
const dummyWallet = new Wallet(dummyKeypair);
const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
const program = new Program(idl as any, provider);

// ─── PDA Helpers ─────────────────────────────────────────────────────────────

function findProtocolPda(programAddress: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol"), programAddress.toBuffer()],
    PROGRAM_ID
  );
}

function findDisclosurePda(hacker: PublicKey, targetProgram: PublicKey, nonce: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("disclosure"), hacker.toBuffer(), targetProgram.toBuffer(), new BN(nonce).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

function findVaultPda(protocolPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), protocolPda.toBuffer()],
    PROGRAM_ID
  );
}

function findBountyClaimPda(disclosurePda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bounty_claim"), disclosurePda.toBuffer()],
    PROGRAM_ID
  );
}

function findProtocolConfigPda(protocolPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config"), protocolPda.toBuffer()],
    PROGRAM_ID
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashProof(proof: string): Buffer {
  return crypto.createHash("sha256").update(Buffer.from(proof)).digest();
}

function formatBN(bn: any): string {
  return bn?.toString?.() ?? "0";
}

function formatPubkey(pk: any): string {
  if (!pk) return "none";
  const s = pk.toString?.() ?? pk;
  return s === PublicKey.default.toString() ? "none" : s;
}

async function fetchApi(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "proof-of-hack",
  version: "1.0.0",
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// READ TOOLS — Query on-chain state via REST API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "list_protocols",
  "List all registered protocols on Proof of Hack (Solana devnet)",
  {},
  async () => {
    try {
      const data = await fetchApi("/api/protocols");
      const protocols = data.protocols || data;
      const lines = protocols.map((p: any) =>
        `${p.name} | authority: ${p.authority} | program: ${p.programAddress} | pda: ${p.pda} | registered: ${new Date((p.registeredAt || 0) * 1000).toISOString().split("T")[0]}`
      );
      return { content: [{ type: "text", text: lines.length ? lines.join("\n") : "No protocols registered yet." }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "list_disclosures",
  "List vulnerability disclosures with optional filters",
  {
    hacker: z.string().optional().describe("Filter by hacker wallet address"),
    target: z.string().optional().describe("Filter by target program address"),
    status: z.number().optional().describe("Filter by status: 0=Submitted, 1=Acknowledged, 2=Resolved, 3=Revealed"),
    protocol: z.string().optional().describe("Filter by protocol PDA"),
  },
  async ({ hacker, target, status, protocol }) => {
    try {
      const params = new URLSearchParams();
      if (hacker) params.set("hacker", hacker);
      if (target) params.set("target", target);
      if (status !== undefined) params.set("status", String(status));
      if (protocol) params.set("protocol", protocol);
      const qs = params.toString() ? `?${params}` : "";
      const data = await fetchApi(`/api/disclosures${qs}`);
      const disclosures = data.disclosures || data;
      if (!disclosures.length) {
        return { content: [{ type: "text", text: "No disclosures found matching filters." }] };
      }
      const lines = disclosures.map((d: any) =>
        `[${STATUS_LABELS[d.status] || d.status}] ${SEVERITY_LABELS[d.severity] || d.severity} severity | hacker: ${d.hacker} | target: ${d.targetProgram} | pda: ${d.pda} | submitted: ${new Date((d.submittedAt || 0) * 1000).toISOString().split("T")[0]} | grace: ${d.gracePeriod}s`
      );
      return { content: [{ type: "text", text: `${disclosures.length} disclosure(s):\n\n${lines.join("\n")}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "list_vaults",
  "List all bounty vaults with rates and balances",
  {},
  async () => {
    try {
      const data = await fetchApi("/api/vaults");
      const vaults = data.vaults || data;
      if (!vaults.length) {
        return { content: [{ type: "text", text: "No bounty vaults created yet." }] };
      }
      const lines = vaults.map((v: any) => {
        const balance = (v.balance ?? ((v.totalDeposited || 0) - (v.totalPaid || 0))) / LAMPORTS_PER_SOL;
        const rates = v.rates || {};
        const low = (rates.low ?? v.lowBounty ?? 0) / LAMPORTS_PER_SOL;
        const med = (rates.medium ?? v.mediumBounty ?? 0) / LAMPORTS_PER_SOL;
        const high = (rates.high ?? v.highBounty ?? 0) / LAMPORTS_PER_SOL;
        const crit = (rates.critical ?? v.criticalBounty ?? 0) / LAMPORTS_PER_SOL;
        return `${v.active ? "ACTIVE" : "INACTIVE"} | protocol: ${v.protocol} | pda: ${v.pda}${v.protocolName ? ` (${v.protocolName})` : ""}\n  Rates: Low=${low} SOL, Med=${med} SOL, High=${high} SOL, Crit=${crit} SOL\n  Balance: ${balance} SOL (deposited: ${(v.totalDeposited || 0) / LAMPORTS_PER_SOL}, paid: ${(v.totalPaid || 0) / LAMPORTS_PER_SOL})`;
      });
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_protocol_status",
  "Get full status of a specific program: protocol registration, config, vault, disclosures",
  {
    program_address: z.string().describe("Solana program address to check"),
  },
  async ({ program_address }) => {
    try {
      const data = await fetchApi(`/api/protocols/${program_address}/status`);
      let text = `Program: ${program_address}\n`;
      if (data.protocol) {
        text += `\nProtocol: ${data.protocol.name}\n  Authority: ${data.protocol.authority}\n  PDA: ${data.protocol.pda}\n  Registered: ${new Date((data.protocol.registeredAt || 0) * 1000).toISOString()}`;
      } else {
        text += "\nProtocol: NOT REGISTERED";
      }
      if (data.config) {
        text += `\n\nConfig: min_grace_period = ${data.config.minGracePeriod}s`;
      }
      if (data.vault) {
        const vr = data.vault.rates || {};
        text += `\n\nVault: ${data.vault.active ? "ACTIVE" : "INACTIVE"}\n  Rates: Low=${(vr.low ?? data.vault.lowBounty ?? 0) / LAMPORTS_PER_SOL} SOL, Med=${(vr.medium ?? data.vault.mediumBounty ?? 0) / LAMPORTS_PER_SOL} SOL, High=${(vr.high ?? data.vault.highBounty ?? 0) / LAMPORTS_PER_SOL} SOL, Crit=${(vr.critical ?? data.vault.criticalBounty ?? 0) / LAMPORTS_PER_SOL} SOL`;
      }
      const disclosures = data.disclosures || [];
      text += `\n\nDisclosures: ${disclosures.length}`;
      for (const d of disclosures.slice(0, 10)) {
        text += `\n  [${STATUS_LABELS[d.status]}] ${SEVERITY_LABELS[d.severity]} from ${d.hacker}`;
      }
      return { content: [{ type: "text", text }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_disclosure",
  "Get details of a specific disclosure by PDA address",
  {
    disclosure_pda: z.string().describe("Disclosure PDA address"),
  },
  async ({ disclosure_pda }) => {
    try {
      const pda = new PublicKey(disclosure_pda);
      const d: any = await (program.account as any).disclosure.fetch(pda);
      const text = [
        `Disclosure: ${disclosure_pda}`,
        `Status: ${STATUS_LABELS[d.status]} (${d.status})`,
        `Severity: ${SEVERITY_LABELS[d.severity]} (${d.severity})`,
        `Resolution: ${RESOLUTION_LABELS[d.resolutionType ?? 0]}`,
        `Hacker: ${d.hacker}`,
        `Target Program: ${d.targetProgram}`,
        `Protocol: ${formatPubkey(d.protocol)}`,
        `Proof Hash: ${Buffer.from(d.proofHash).toString("hex")}`,
        `Encrypted Proof: ${d.encryptedProof?.length || 0} bytes`,
        `Grace Period: ${formatBN(d.gracePeriod)} seconds`,
        `Submitted: ${new Date(Number(formatBN(d.submittedAt)) * 1000).toISOString()}`,
        d.acknowledgedAt && Number(formatBN(d.acknowledgedAt)) > 0 ? `Acknowledged: ${new Date(Number(formatBN(d.acknowledgedAt)) * 1000).toISOString()}` : null,
        d.resolvedAt && Number(formatBN(d.resolvedAt)) > 0 ? `Resolved: ${new Date(Number(formatBN(d.resolvedAt)) * 1000).toISOString()}` : null,
        `Nonce: ${formatBN(d.nonce)}`,
      ].filter(Boolean).join("\n");
      return { content: [{ type: "text", text }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error fetching disclosure: ${e.message}` }], isError: true };
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WRITE TOOLS — Build unsigned transactions for agent to sign
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "submit_disclosure",
  "Build an unsigned transaction to submit a vulnerability disclosure. Returns base64 tx for signing.",
  {
    hacker: z.string().describe("Hacker's wallet address (signer)"),
    target_program: z.string().describe("Address of the vulnerable Solana program"),
    proof_text: z.string().describe("Plaintext vulnerability proof (will be SHA-256 hashed for on-chain commitment)"),
    severity: z.number().min(1).max(4).describe("1=Low, 2=Medium, 3=High, 4=Critical"),
    grace_period: z.number().min(60).default(604800).describe("Seconds before reveal is allowed (min 60, default 7 days)"),
    nonce: z.number().default(0).describe("Unique per hacker+program pair (start at 0, increment)"),
    protocol_encryption_key: z.string().optional().describe("Protocol's X25519 public key as hex (64 chars). If provided, proof will be encrypted for the protocol."),
  },
  async ({ hacker, target_program, proof_text, severity, grace_period, nonce, protocol_encryption_key }) => {
    try {
      const hackerPk = new PublicKey(hacker);
      const targetPk = new PublicKey(target_program);
      const proofHash = hashProof(proof_text);

      // Try to find protocol PDA for the target
      const [protocolPda] = findProtocolPda(targetPk);
      let protocolKey = PublicKey.default;
      try {
        await (program.account as any).protocol.fetch(protocolPda);
        protocolKey = protocolPda;
      } catch {
        // Protocol not registered — submit without protocol link
      }

      // Encrypt if key provided
      let encryptedProof = Buffer.alloc(0);
      let senderEncryptionKey: number[] = new Array(32).fill(0);
      if (protocol_encryption_key) {
        const recipientKey = Buffer.from(protocol_encryption_key, "hex");
        if (recipientKey.length !== 32) throw new Error("Encryption key must be 32 bytes (64 hex chars)");
        const senderKp = nacl.box.keyPair();
        senderEncryptionKey = Array.from(senderKp.publicKey);
        const nonceBytes = nacl.randomBytes(24);
        const encrypted = nacl.box(Buffer.from(proof_text), nonceBytes, recipientKey, senderKp.secretKey);
        if (!encrypted) throw new Error("Encryption failed");
        encryptedProof = Buffer.concat([Buffer.from(nonceBytes), Buffer.from(encrypted)]);
      }

      const [disclosurePda] = findDisclosurePda(hackerPk, targetPk, nonce);

      const ix = await program.methods
        .submitDisclosure(
          Array.from(proofHash),
          encryptedProof,
          Array.from(senderEncryptionKey),
          severity,
          new BN(grace_period),
          new BN(nonce)
        )
        .accounts({
          disclosure: disclosurePda,
          hacker: hackerPk,
          targetProgram: targetPk,
          protocol: protocolKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = hackerPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: [
            "Unsigned transaction built successfully.",
            "",
            `Disclosure PDA: ${disclosurePda}`,
            `Proof Hash: ${proofHash.toString("hex")}`,
            `Severity: ${SEVERITY_LABELS[severity]}`,
            `Grace Period: ${grace_period}s`,
            `Encrypted: ${encryptedProof.length > 0 ? "yes" : "no (no protocol encryption key)"}`,
            `Protocol linked: ${protocolKey.equals(PublicKey.default) ? "no (unregistered)" : protocolPda.toString()}`,
            "",
            "Sign this transaction with the hacker's wallet and send to Solana devnet.",
            "",
            `Transaction (base64): ${serialized}`,
          ].join("\n"),
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error building transaction: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "register_protocol",
  "Build an unsigned transaction to register a protocol for receiving encrypted disclosures. Returns base64 tx for signing.",
  {
    authority: z.string().describe("Protocol authority wallet address (must be upgrade authority of the program)"),
    program_address: z.string().describe("Solana program address to register"),
    name: z.string().max(64).describe("Protocol name (1-64 chars)"),
    encryption_key: z.string().describe("X25519 public key as hex (64 chars) for receiving encrypted proofs"),
  },
  async ({ authority, program_address, name, encryption_key }) => {
    try {
      const authorityPk = new PublicKey(authority);
      const programAddr = new PublicKey(program_address);
      const encKeyBytes = Buffer.from(encryption_key, "hex");
      if (encKeyBytes.length !== 32) throw new Error("Encryption key must be 32 bytes (64 hex chars)");

      const [protocolPda] = findProtocolPda(programAddr);

      // Need programdata account for upgrade authority verification
      const [programdataPda] = PublicKey.findProgramAddressSync(
        [programAddr.toBuffer()],
        new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      );

      const ix = await program.methods
        .registerProtocol(programAddr, name, Array.from(encKeyBytes))
        .accounts({
          protocol: protocolPda,
          authority: authorityPk,
          targetProgram: programAddr,
          programdataAccount: programdataPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = authorityPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: [
            "Unsigned register_protocol transaction built.",
            "",
            `Protocol PDA: ${protocolPda}`,
            `Program: ${program_address}`,
            `Name: ${name}`,
            "",
            "Sign with the program's upgrade authority wallet and send to devnet.",
            "",
            `Transaction (base64): ${serialized}`,
          ].join("\n"),
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "acknowledge_disclosure",
  "Build an unsigned transaction for a protocol to acknowledge a disclosure. Returns base64 tx.",
  {
    authority: z.string().describe("Protocol authority wallet address (signer)"),
    disclosure_pda: z.string().describe("Disclosure PDA address to acknowledge"),
    protocol_pda: z.string().describe("Protocol PDA address"),
  },
  async ({ authority, disclosure_pda, protocol_pda }) => {
    try {
      const authorityPk = new PublicKey(authority);
      const disclosurePk = new PublicKey(disclosure_pda);
      const protocolPk = new PublicKey(protocol_pda);

      const ix = await program.methods
        .acknowledgeDisclosure()
        .accounts({
          disclosure: disclosurePk,
          protocol: protocolPk,
          authority: authorityPk,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = authorityPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: `Unsigned acknowledge transaction built.\n\nDisclosure: ${disclosure_pda}\nProtocol: ${protocol_pda}\n\nSign with protocol authority and send to devnet.\n\nTransaction (base64): ${serialized}`,
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "resolve_disclosure",
  "Build an unsigned transaction for a protocol to resolve a disclosure with payment proof. Returns base64 tx.",
  {
    authority: z.string().describe("Protocol authority wallet address (signer)"),
    disclosure_pda: z.string().describe("Disclosure PDA address to resolve"),
    protocol_pda: z.string().describe("Protocol PDA address"),
    payment_hash: z.string().describe("SHA-256 hash of payment proof as hex (64 chars)"),
    resolution_type: z.number().min(1).max(3).describe("1=Off-chain attestation, 2=On-chain bounty, 3=No payment"),
  },
  async ({ authority, disclosure_pda, protocol_pda, payment_hash, resolution_type }) => {
    try {
      const authorityPk = new PublicKey(authority);
      const disclosurePk = new PublicKey(disclosure_pda);
      const protocolPk = new PublicKey(protocol_pda);
      const paymentHashBytes = Buffer.from(payment_hash, "hex");
      if (paymentHashBytes.length !== 32) throw new Error("Payment hash must be 32 bytes (64 hex chars)");

      const ix = await program.methods
        .resolveDisclosure(Array.from(paymentHashBytes), resolution_type)
        .accounts({
          disclosure: disclosurePk,
          protocol: protocolPk,
          authority: authorityPk,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = authorityPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: `Unsigned resolve transaction built.\n\nDisclosure: ${disclosure_pda}\nResolution: ${RESOLUTION_LABELS[resolution_type]}\n\nSign with protocol authority and send to devnet.\n\nTransaction (base64): ${serialized}`,
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "reveal_proof",
  "Build an unsigned transaction for a hacker to reveal proof publicly after grace period. Nuclear option. Returns base64 tx.",
  {
    hacker: z.string().describe("Hacker's wallet address (original submitter)"),
    disclosure_pda: z.string().describe("Disclosure PDA address"),
    plaintext_proof: z.string().describe("Original plaintext proof (must SHA-256 match the on-chain proof_hash)"),
  },
  async ({ hacker, disclosure_pda, plaintext_proof }) => {
    try {
      const hackerPk = new PublicKey(hacker);
      const disclosurePk = new PublicKey(disclosure_pda);

      const ix = await program.methods
        .revealProof(Buffer.from(plaintext_proof))
        .accounts({
          disclosure: disclosurePk,
          hacker: hackerPk,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = hackerPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: `Unsigned reveal_proof transaction built.\n\nWARNING: This will permanently publish the proof on-chain. Only works if grace period has expired and status is SUBMITTED.\n\nDisclosure: ${disclosure_pda}\nProof Hash: ${hashProof(plaintext_proof).toString("hex")}\n\nSign with hacker wallet and send to devnet.\n\nTransaction (base64): ${serialized}`,
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "create_bounty",
  "Build an unsigned transaction to create a bounty vault for a protocol with per-severity SOL rates. Returns base64 tx.",
  {
    authority: z.string().describe("Protocol authority wallet address (signer)"),
    protocol_pda: z.string().describe("Protocol PDA address"),
    low_bounty_sol: z.number().describe("SOL bounty for Low severity disclosures"),
    medium_bounty_sol: z.number().describe("SOL bounty for Medium severity"),
    high_bounty_sol: z.number().describe("SOL bounty for High severity"),
    critical_bounty_sol: z.number().describe("SOL bounty for Critical severity"),
    initial_deposit_sol: z.number().default(0).describe("Initial SOL deposit into the vault (0 allowed)"),
  },
  async ({ authority, protocol_pda, low_bounty_sol, medium_bounty_sol, high_bounty_sol, critical_bounty_sol, initial_deposit_sol }) => {
    try {
      const authorityPk = new PublicKey(authority);
      const protocolPk = new PublicKey(protocol_pda);
      const [vaultPda] = findVaultPda(protocolPk);

      const ix = await program.methods
        .createBounty(
          new BN(Math.round(low_bounty_sol * LAMPORTS_PER_SOL)),
          new BN(Math.round(medium_bounty_sol * LAMPORTS_PER_SOL)),
          new BN(Math.round(high_bounty_sol * LAMPORTS_PER_SOL)),
          new BN(Math.round(critical_bounty_sol * LAMPORTS_PER_SOL)),
          new BN(Math.round(initial_deposit_sol * LAMPORTS_PER_SOL))
        )
        .accounts({
          vault: vaultPda,
          protocol: protocolPk,
          authority: authorityPk,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = authorityPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: [
            "Unsigned create_bounty transaction built.",
            "",
            `Vault PDA: ${vaultPda}`,
            `Rates: Low=${low_bounty_sol} SOL, Med=${medium_bounty_sol} SOL, High=${high_bounty_sol} SOL, Crit=${critical_bounty_sol} SOL`,
            `Initial deposit: ${initial_deposit_sol} SOL`,
            "",
            "Sign with protocol authority and send to devnet.",
            "",
            `Transaction (base64): ${serialized}`,
          ].join("\n"),
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "claim_bounty",
  "Build an unsigned transaction for a hacker to claim a SOL bounty after their disclosure is resolved. Returns base64 tx.",
  {
    hacker: z.string().describe("Hacker's wallet address (must match disclosure.hacker)"),
    disclosure_pda: z.string().describe("Disclosure PDA address (must be RESOLVED status)"),
    protocol_pda: z.string().describe("Protocol PDA address"),
  },
  async ({ hacker, disclosure_pda, protocol_pda }) => {
    try {
      const hackerPk = new PublicKey(hacker);
      const disclosurePk = new PublicKey(disclosure_pda);
      const protocolPk = new PublicKey(protocol_pda);
      const [vaultPda] = findVaultPda(protocolPk);
      const [bountyClaimPda] = findBountyClaimPda(disclosurePk);

      const ix = await program.methods
        .claimBounty()
        .accounts({
          bountyClaim: bountyClaimPda,
          vault: vaultPda,
          disclosure: disclosurePk,
          protocol: protocolPk,
          hacker: hackerPk,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = hackerPk;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      return {
        content: [{
          type: "text",
          text: `Unsigned claim_bounty transaction built.\n\nDisclosure: ${disclosure_pda}\nBounty Claim PDA: ${bountyClaimPda}\n\nSign with hacker wallet and send to devnet.\n\nTransaction (base64): ${serialized}`,
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.tool(
  "hash_proof",
  "SHA-256 hash a proof string. Returns the hex hash that will be stored on-chain as the proof commitment.",
  {
    proof_text: z.string().describe("The plaintext proof to hash"),
  },
  async ({ proof_text }) => {
    const hash = hashProof(proof_text);
    return {
      content: [{
        type: "text",
        text: `SHA-256 hash: ${hash.toString("hex")}\n\nThis is the proof_hash that gets stored on-chain. Keep the original proof_text — you'll need it if you ever call reveal_proof.`,
      }],
    };
  }
);

server.tool(
  "generate_encryption_keypair",
  "Generate a new X25519 keypair for NaCl box encryption. Use the public key when registering a protocol.",
  {},
  async () => {
    const kp = nacl.box.keyPair();
    return {
      content: [{
        type: "text",
        text: [
          "X25519 Keypair Generated",
          "",
          `Public Key (hex):  ${Buffer.from(kp.publicKey).toString("hex")}`,
          `Secret Key (hex):  ${Buffer.from(kp.secretKey).toString("hex")}`,
          "",
          "Use the public key when calling register_protocol (encryption_key parameter).",
          "Keep the secret key safe — you need it to decrypt incoming vulnerability proofs.",
          "",
          "WARNING: Store the secret key securely. If lost, you cannot decrypt disclosures.",
        ].join("\n"),
      }],
    };
  }
);

server.tool(
  "find_pda",
  "Derive a PDA (Program Derived Address) for Proof of Hack accounts",
  {
    type: z.enum(["protocol", "disclosure", "vault", "bounty_claim", "protocol_config"]).describe("Account type"),
    program_address: z.string().optional().describe("For protocol PDA: the target program address"),
    hacker: z.string().optional().describe("For disclosure PDA: hacker wallet address"),
    target_program: z.string().optional().describe("For disclosure PDA: target program address"),
    nonce: z.number().optional().describe("For disclosure PDA: nonce value"),
    protocol_pda: z.string().optional().describe("For vault/config PDA: protocol PDA address"),
    disclosure_pda: z.string().optional().describe("For bounty_claim PDA: disclosure PDA address"),
  },
  async ({ type, program_address, hacker, target_program, nonce, protocol_pda, disclosure_pda }) => {
    try {
      let pda: PublicKey;
      let bump: number;

      switch (type) {
        case "protocol":
          if (!program_address) throw new Error("program_address required for protocol PDA");
          [pda, bump] = findProtocolPda(new PublicKey(program_address));
          break;
        case "disclosure":
          if (!hacker || !target_program) throw new Error("hacker and target_program required for disclosure PDA");
          [pda, bump] = findDisclosurePda(new PublicKey(hacker), new PublicKey(target_program), nonce ?? 0);
          break;
        case "vault":
          if (!protocol_pda) throw new Error("protocol_pda required for vault PDA");
          [pda, bump] = findVaultPda(new PublicKey(protocol_pda));
          break;
        case "bounty_claim":
          if (!disclosure_pda) throw new Error("disclosure_pda required for bounty_claim PDA");
          [pda, bump] = findBountyClaimPda(new PublicKey(disclosure_pda));
          break;
        case "protocol_config":
          if (!protocol_pda) throw new Error("protocol_pda required for protocol_config PDA");
          [pda, bump] = findProtocolConfigPda(new PublicKey(protocol_pda));
          break;
        default:
          throw new Error(`Unknown PDA type: ${type}`);
      }

      return { content: [{ type: "text", text: `PDA: ${pda}\nBump: ${bump}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[proof-of-hack-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
