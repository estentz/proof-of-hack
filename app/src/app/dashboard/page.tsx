"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/lib/program";
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

export default function DashboardPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [disclosures, setDisclosures] = useState<DisclosureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"mine" | "protocol" | "all">("mine");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [decryptedProofs, setDecryptedProofs] = useState<Record<string, string>>({});

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
        // Find protocols owned by this wallet
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
      setActionStatus(`Error: ${err.message}`);
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
      setActionStatus(`Error: ${err.message}`);
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
      setActionStatus(`Decrypt error: ${err.message}`);
    }
  };

  const getGraceRemaining = (d: DisclosureEntry) => {
    if (d.status !== 0) return null;
    const deadline = d.submittedAt + d.gracePeriod;
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    if (remaining <= 0) return "Expired";
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

  if (!publicKey) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400">Connect your wallet to view disclosures.</p>
      </div>
    );
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
          {disclosures.map((d) => (
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
                    {d.status === 0 && (
                      <span className="text-xs text-yellow-400">
                        {getGraceRemaining(d)}
                      </span>
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

                  {decryptedProofs[d.publicKey] && (
                    <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
                      <p className="text-xs text-green-400 mb-1">Decrypted Proof:</p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                        {decryptedProofs[d.publicKey]}
                      </pre>
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
                  {filter === "protocol" &&
                    d.encryptedProof.length > 0 &&
                    !decryptedProofs[d.publicKey] && (
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
          ))}
        </div>
      )}
    </div>
  );
}
