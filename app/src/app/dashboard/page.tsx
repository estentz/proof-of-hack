"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram } from "@/lib/program";
import { PROGRAM_ID, parseAnchorError } from "@/lib/constants";
import {
  SEVERITY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  SEVERITY_COLORS,
} from "@/lib/constants";
import Link from "next/link";
import nacl from "tweetnacl";

interface DisclosureEntry {
  publicKey: string;
  hacker: string;
  protocol: string;
  targetProgram: string;
  proofHash: string;
  encryptedProof: number[];
  severity: number;
  status: number;
  submittedAt: number;
  acknowledgedAt: number;
  resolvedAt: number;
  gracePeriod: number;
}

interface PublicStats {
  protocolCount: number;
  disclosureCount: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  recentDisclosures: {
    pda: string;
    severity: number;
    severityLabel: string;
    status: number;
    statusLabel: string;
    targetProgram: string;
    submittedAt: number;
  }[];
}

function PublicDashboard() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [protRes, discRes] = await Promise.all([
          fetch("/api/protocols"),
          fetch("/api/disclosures"),
        ]);
        const protocols = await protRes.json();
        const disclosures = await discRes.json();

        const byStatus: Record<string, number> = {
          Submitted: 0,
          Acknowledged: 0,
          Resolved: 0,
          Revealed: 0,
        };
        const bySeverity: Record<string, number> = {
          Low: 0,
          Medium: 0,
          High: 0,
          Critical: 0,
        };

        for (const d of disclosures.disclosures || []) {
          if (d.statusLabel) byStatus[d.statusLabel] = (byStatus[d.statusLabel] || 0) + 1;
          if (d.severityLabel) bySeverity[d.severityLabel] = (bySeverity[d.severityLabel] || 0) + 1;
        }

        const sorted = [...(disclosures.disclosures || [])].sort(
          (a: any, b: any) => b.submittedAt - a.submittedAt
        );

        setStats({
          protocolCount: protocols.count || 0,
          disclosureCount: disclosures.count || 0,
          byStatus,
          bySeverity,
          recentDisclosures: sorted.slice(0, 5).map((d: any) => ({
            pda: d.pda,
            severity: d.severity,
            severityLabel: d.severityLabel,
            status: d.status,
            statusLabel: d.statusLabel,
            targetProgram: d.targetProgram,
            submittedAt: d.submittedAt,
          })),
        });
      } catch (err) {
        console.error("Failed to load public stats:", err);
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400">Loading network data...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400">Failed to load network data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <span className="text-sm text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
          Devnet
        </span>
      </div>

      <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg text-center">
        <p className="text-gray-400 mb-2">Connect your wallet to manage disclosures and claim bounties.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.protocolCount}</p>
          <p className="text-sm text-gray-400">Protocols</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.disclosureCount}</p>
          <p className="text-sm text-gray-400">Disclosures</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.byStatus.Submitted}</p>
          <p className="text-sm text-gray-400">Pending</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.byStatus.Resolved}</p>
          <p className="text-sm text-gray-400">Resolved</p>
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">By Severity</h2>
        <div className="grid grid-cols-4 gap-3">
          {["Low", "Medium", "High", "Critical"].map((sev) => (
            <div key={sev} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
              <p className="text-xl font-bold">{stats.bySeverity[sev]}</p>
              <p className="text-xs text-gray-400">{sev}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent disclosures */}
      {stats.recentDisclosures.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Disclosures</h2>
          <div className="space-y-2">
            {stats.recentDisclosures.map((d) => (
              <div
                key={d.pda}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                      SEVERITY_COLORS[d.severity]
                    }`}
                  >
                    {d.severityLabel}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                      STATUS_COLORS[d.status]
                    }`}
                  >
                    {d.statusLabel}
                  </span>
                  <span className="text-sm text-gray-400 font-mono">
                    {d.targetProgram.slice(0, 4)}...{d.targetProgram.slice(-4)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(d.submittedAt * 1000).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [disclosures, setDisclosures] = useState<DisclosureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"mine" | "protocol" | "all">("mine");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [decryptedProofs, setDecryptedProofs] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealProofText, setRevealProofText] = useState("");

  const loadData = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    setLoading(true);
    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);
      const allDisclosures = await (program.account as any).disclosure.all();

      const entries: DisclosureEntry[] = allDisclosures.map((d: any) => ({
        publicKey: d.publicKey.toBase58(),
        hacker: d.account.hacker.toBase58(),
        protocol: d.account.protocol.toBase58(),
        targetProgram: d.account.targetProgram.toBase58(),
        proofHash: Buffer.from(d.account.proofHash).toString("hex"),
        encryptedProof: Array.from(d.account.encryptedProof),
        severity: d.account.severity,
        status: d.account.status,
        submittedAt: d.account.submittedAt.toNumber(),
        acknowledgedAt: d.account.acknowledgedAt.toNumber(),
        resolvedAt: d.account.resolvedAt.toNumber(),
        gracePeriod: d.account.gracePeriod.toNumber(),
      }));

      const myKey = publicKey.toBase58();
      if (filter === "mine") {
        setDisclosures(entries.filter((d) => d.hacker === myKey));
      } else if (filter === "protocol") {
        const myProtocols = await (program.account as any).protocol.all();
        const myProtocolPdas = new Set(
          myProtocols
            .filter((p: any) => p.account.authority.toBase58() === myKey)
            .map((p: any) => p.publicKey.toBase58())
        );
        setDisclosures(entries.filter((d) => myProtocolPdas.has(d.protocol)));
      } else {
        setDisclosures(entries);
      }
    } catch (err) {
      console.error("Failed to load:", err);
    }
    setLoading(false);
  }, [publicKey, signTransaction, signAllTransactions, connection, filter]);

  useEffect(() => {
    if (publicKey && signTransaction && signAllTransactions) {
      loadData();
    }
  }, [publicKey, filter, loadData]);

  const handleAcknowledge = async (disclosure: DisclosureEntry) => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    setActionStatus("Acknowledging disclosure...");
    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      await program.methods
        .acknowledgeDisclosure()
        .accounts({
          disclosure: new PublicKey(disclosure.publicKey),
          protocol: new PublicKey(disclosure.protocol),
          authority: publicKey,
        })
        .rpc();

      setActionStatus("Disclosure acknowledged!");
      loadData();
    } catch (err: any) {
      setActionStatus(`Error: ${parseAnchorError(err)}`);
    }
  };

  const handleResolve = async (disclosure: DisclosureEntry) => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    const paymentProof = prompt("Enter payment proof (tx hash or description):");
    if (!paymentProof) return;

    setActionStatus("Resolving disclosure...");
    try {
      const encoded = new TextEncoder().encode(paymentProof);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoded.buffer as ArrayBuffer);
      const paymentHash = Array.from(new Uint8Array(hashBuffer));

      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      await program.methods
        .resolveDisclosure(paymentHash)
        .accounts({
          disclosure: new PublicKey(disclosure.publicKey),
          protocol: new PublicKey(disclosure.protocol),
          authority: publicKey,
        })
        .rpc();

      setActionStatus("Disclosure resolved!");
      loadData();
    } catch (err: any) {
      setActionStatus(`Error: ${parseAnchorError(err)}`);
    }
  };

  const handleClaimBounty = async (disclosure: DisclosureEntry) => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    setActionStatus("Claiming bounty...");
    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      const protocolKey = new PublicKey(disclosure.protocol);
      const disclosureKey = new PublicKey(disclosure.publicKey);

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), protocolKey.toBuffer()],
        PROGRAM_ID
      );
      const [bountyClaimPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty_claim"), disclosureKey.toBuffer()],
        PROGRAM_ID
      );

      await program.methods
        .claimBounty()
        .accounts({
          vault: vaultPda,
          bountyClaim: bountyClaimPda,
          disclosure: disclosureKey,
          protocol: protocolKey,
          hacker: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setActionStatus("Bounty claimed successfully!");
      loadData();
    } catch (err: any) {
      setActionStatus(`Error: ${parseAnchorError(err)}`);
    }
  };

  const handleDecrypt = (disclosure: DisclosureEntry) => {
    try {
      const stored = JSON.parse(localStorage.getItem("poh_encryption_keys") || "[]");
      if (stored.length === 0) {
        setActionStatus("No encryption keys found in local storage.");
        return;
      }

      const encBytes = new Uint8Array(disclosure.encryptedProof);
      if (encBytes.length < 56) {
        setActionStatus("Encrypted proof too short to decrypt.");
        return;
      }

      const nonce = encBytes.slice(0, 24);
      const senderPub = encBytes.slice(24, 56);
      const ciphertext = encBytes.slice(56);

      for (const key of stored) {
        const secretKey = new Uint8Array(key.secretKey);
        const decrypted = nacl.box.open(ciphertext, nonce, senderPub, secretKey);
        if (decrypted) {
          const text = new TextDecoder().decode(decrypted);
          setDecryptedProofs((prev) => ({ ...prev, [disclosure.publicKey]: text }));
          setActionStatus("Proof decrypted successfully!");
          return;
        }
      }
      setActionStatus("Could not decrypt with any stored keys.");
    } catch (err: any) {
      setActionStatus(`Decrypt error: ${parseAnchorError(err)}`);
    }
  };

  const handleStartReveal = (disclosure: DisclosureEntry) => {
    // Try to load saved proof from localStorage
    const backups = JSON.parse(localStorage.getItem("poh_proof_backups") || "{}");
    const saved = backups[disclosure.publicKey];
    setRevealProofText(saved?.proof || "");
    setRevealingId(disclosure.publicKey);
  };

  const handleConfirmReveal = async (disclosure: DisclosureEntry) => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    if (!revealProofText.trim()) {
      setActionStatus("Error: Proof text cannot be empty.");
      return;
    }

    setActionStatus("Revealing proof on-chain...");
    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      const proofBytes = Buffer.from(revealProofText, "utf-8");

      await program.methods
        .revealProof(proofBytes)
        .accounts({
          disclosure: new PublicKey(disclosure.publicKey),
          hacker: publicKey,
        })
        .rpc();

      setActionStatus("Proof revealed on-chain!");
      setRevealingId(null);
      setRevealProofText("");
      loadData();
    } catch (err: any) {
      setActionStatus(`Error: ${parseAnchorError(err)}`);
    }
  };

  const getGraceDeadline = (d: DisclosureEntry) => {
    return d.submittedAt + d.gracePeriod;
  };

  const isGraceExpired = (d: DisclosureEntry) => {
    const now = Math.floor(Date.now() / 1000);
    return now >= getGraceDeadline(d);
  };

  const getGraceRemaining = (d: DisclosureEntry) => {
    const deadline = getGraceDeadline(d);
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    if (remaining <= 0) return "Grace period expired";
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h remaining`;
    const mins = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${mins}m remaining`;
  };

  const shortAddr = (addr: string) =>
    addr === PublicKey.default.toBase58()
      ? "Unclaimed"
      : `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  // Status 3 = Revealed. Render the plaintext proof that's stored in encryptedProof after reveal.
  const getRevealedProof = (d: DisclosureEntry): string | null => {
    if (d.status !== 3) return null;
    try {
      const bytes = new Uint8Array(d.encryptedProof);
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  };

  if (!publicKey) {
    return <PublicDashboard />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {(["mine", "protocol", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {f === "mine" ? "My Disclosures" : f === "protocol" ? "My Protocol" : "All"}
            </button>
          ))}
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:text-white transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {actionStatus && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            actionStatus.startsWith("Error")
              ? "bg-red-900/30 border border-red-800 text-red-400"
              : "bg-green-900/30 border border-green-800 text-green-400"
          }`}
        >
          {actionStatus}
          <button
            onClick={() => setActionStatus(null)}
            className="ml-4 text-xs opacity-60 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : disclosures.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-gray-400 mb-4">
            {filter === "protocol"
              ? "No disclosures found for your protocol."
              : "No disclosures found."}
          </p>
          <Link href="/submit" className="text-green-400 hover:text-green-300">
            Submit your first disclosure
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {disclosures.map((d) => {
            const revealedProof = getRevealedProof(d);
            const canReveal =
              filter === "mine" &&
              d.status !== 3 &&
              d.hacker === publicKey.toBase58();
            const graceExpired = isGraceExpired(d);

            return (
              <div
                key={d.publicKey}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium text-white ${SEVERITY_COLORS[d.severity]}`}
                      >
                        {SEVERITY_LABELS[d.severity]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium text-white ${STATUS_COLORS[d.status]}`}
                      >
                        {STATUS_LABELS[d.status]}
                      </span>
                      {d.status !== 3 && (
                        <span className={`text-xs ${graceExpired ? "text-red-400" : "text-yellow-400"}`}>
                          {getGraceRemaining(d)}
                        </span>
                      )}
                    </div>

                    {/* Progress timeline */}
                    <div className="flex items-center gap-1 mb-2 text-xs">
                      <span className={d.status >= 0 ? "text-green-400" : "text-gray-600"}>
                        Submitted
                      </span>
                      <span className="text-gray-600">→</span>
                      <span className={d.status >= 1 ? "text-blue-400" : "text-gray-600"}>
                        Acknowledged
                      </span>
                      <span className="text-gray-600">→</span>
                      <span className={d.status >= 2 ? "text-green-400" : "text-gray-600"}>
                        Resolved
                      </span>
                      {d.status === 3 && (
                        <>
                          <span className="text-gray-600">→</span>
                          <span className="text-red-400 font-medium">Revealed</span>
                        </>
                      )}
                    </div>

                    <p className="text-sm text-gray-300">
                      Target:{" "}
                      <span className="font-mono">{shortAddr(d.targetProgram)}</span>
                    </p>
                    <p className="text-sm text-gray-400">
                      Hacker: <span className="font-mono">{shortAddr(d.hacker)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      Hash: {d.proofHash.slice(0, 16)}...
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(d.submittedAt * 1000).toLocaleString()}
                      {d.acknowledgedAt > 0 &&
                        ` | Ack: ${new Date(d.acknowledgedAt * 1000).toLocaleString()}`}
                      {d.resolvedAt > 0 &&
                        ` | Resolved: ${new Date(d.resolvedAt * 1000).toLocaleString()}`}
                    </p>

                    {/* Decrypted proof (protocol view) */}
                    {decryptedProofs[d.publicKey] && (
                      <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
                        <p className="text-xs text-green-400 mb-1">Decrypted Proof:</p>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                          {decryptedProofs[d.publicKey]}
                        </pre>
                      </div>
                    )}

                    {/* Revealed proof (public, on-chain) */}
                    {revealedProof && (
                      <div className="mt-2 p-2 bg-red-900/20 rounded border border-red-800">
                        <p className="text-xs text-red-400 mb-1">Revealed Proof (public):</p>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                          {revealedProof}
                        </pre>
                      </div>
                    )}

                    {/* Reveal inline form */}
                    {revealingId === d.publicKey && (
                      <div className="mt-3 p-3 bg-gray-800 rounded border border-yellow-800">
                        <p className="text-xs text-yellow-400 mb-2">
                          Paste the exact proof text you submitted. The on-chain program will verify
                          its SHA-256 hash matches your original commitment.
                        </p>
                        {!graceExpired && (
                          <p className="text-xs text-red-400 mb-2">
                            Grace period has not expired yet. The transaction will fail.
                          </p>
                        )}
                        <textarea
                          value={revealProofText}
                          onChange={(e) => setRevealProofText(e.target.value)}
                          rows={4}
                          className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-200 mb-2 font-mono"
                          placeholder="Paste your original proof text..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirmReveal(d)}
                            disabled={!revealProofText.trim()}
                            className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-white font-medium"
                          >
                            Confirm Reveal
                          </button>
                          <button
                            onClick={() => {
                              setRevealingId(null);
                              setRevealProofText("");
                            }}
                            className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <a
                      href={`https://explorer.solana.com/address/${d.publicKey}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Explorer
                    </a>
                    {/* Reveal button — hacker can reveal after grace period */}
                    {canReveal && revealingId !== d.publicKey && (
                      <button
                        onClick={() => handleStartReveal(d)}
                        className={`text-xs px-3 py-1 rounded text-white font-medium ${
                          graceExpired
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-red-900 text-red-400 cursor-not-allowed opacity-60"
                        }`}
                        title={
                          graceExpired
                            ? "Reveal your proof publicly on-chain"
                            : `Grace period active — ${getGraceRemaining(d)}`
                        }
                      >
                        Reveal
                      </button>
                    )}
                    {filter === "protocol" && d.status === 0 && (
                      <button
                        onClick={() => handleAcknowledge(d)}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                      >
                        Acknowledge
                      </button>
                    )}
                    {filter === "protocol" && d.status === 1 && (
                      <button
                        onClick={() => handleResolve(d)}
                        className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white"
                      >
                        Resolve
                      </button>
                    )}
                    {/* Claim bounty: hacker can claim once disclosure is resolved */}
                    {filter === "mine" &&
                      d.status === 2 &&
                      d.hacker === publicKey.toBase58() && (
                        <button
                          onClick={() => handleClaimBounty(d)}
                          className="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white font-medium"
                        >
                          Claim Bounty
                        </button>
                      )}
                    {filter === "protocol" &&
                      d.encryptedProof.length > 0 &&
                      !decryptedProofs[d.publicKey] &&
                      d.status !== 3 && (
                        <button
                          onClick={() => handleDecrypt(d)}
                          className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white"
                        >
                          Decrypt
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
