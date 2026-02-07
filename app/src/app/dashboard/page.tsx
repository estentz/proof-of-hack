"use client";

import { useState, useEffect } from "react";
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

interface DisclosureEntry {
  publicKey: string;
  hacker: string;
  protocol: string;
  targetProgram: string;
  severity: number;
  status: number;
  submittedAt: number;
}

export default function DashboardPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [disclosures, setDisclosures] = useState<DisclosureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine">("mine");

  useEffect(() => {
    if (publicKey && signTransaction && signAllTransactions) {
      loadData();
    }
  }, [publicKey, filter]);

  const loadData = async () => {
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
        severity: d.account.severity,
        status: d.account.status,
        submittedAt: d.account.submittedAt.toNumber(),
      }));

      if (filter === "mine") {
        const myKey = publicKey.toBase58();
        setDisclosures(entries.filter((d) => d.hacker === myKey));
      } else {
        setDisclosures(entries);
      }
    } catch (err) {
      console.error("Failed to load:", err);
    }
    setLoading(false);
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
          <button
            onClick={() => setFilter("mine")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === "mine"
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            My Disclosures
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === "all"
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:text-white transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : disclosures.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-gray-400 mb-4">No disclosures found.</p>
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
                <div>
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
                  </div>
                  <p className="text-sm text-gray-300">
                    Target: <span className="font-mono">{shortAddr(d.targetProgram)}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Hacker: <span className="font-mono">{shortAddr(d.hacker)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(d.submittedAt * 1000).toLocaleString()}
                  </p>
                </div>
                <a
                  href={`https://explorer.solana.com/address/${d.publicKey}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Explorer
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
