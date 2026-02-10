"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, getReadonlyProgram, findDisclosurePda, findProtocolPda } from "@/lib/program";
import {
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  parseAnchorError,
} from "@/lib/constants";
import nacl from "tweetnacl";

interface RecentDisclosure {
  pda: string;
  severity: number;
  severityLabel: string;
  status: number;
  statusLabel: string;
  targetProgram: string;
  submittedAt: number;
}

function RecentDisclosures() {
  const [disclosures, setDisclosures] = useState<RecentDisclosure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const program = getReadonlyProgram();
        const all = await (program.account as any).disclosure.all();
        const mapped = all.map((d: any) => ({
          pda: d.publicKey.toBase58(),
          severity: d.account.severity,
          severityLabel: SEVERITY_LABELS[d.account.severity] || "Unknown",
          status: d.account.status,
          statusLabel: STATUS_LABELS[d.account.status] || "Unknown",
          targetProgram: d.account.targetProgram.toBase58(),
          submittedAt: d.account.submittedAt.toNumber(),
        }));
        const sorted = mapped.sort((a: any, b: any) => b.submittedAt - a.submittedAt).slice(0, 10);
        setDisclosures(sorted);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">Loading recent disclosures...</p>;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Recent Disclosures ({disclosures.length})</h2>
      {disclosures.length === 0 ? (
        <p className="text-gray-500 text-sm">No disclosures yet. Submit the first one!</p>
      ) : (
        <div className="space-y-2">
          {disclosures.map((d) => (
            <div
              key={d.pda}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium text-white ${SEVERITY_COLORS[d.severity]}`}
                >
                  {d.severityLabel}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium text-white ${STATUS_COLORS[d.status]}`}
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
      )}
    </div>
  );
}

export default function SubmitPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const [targetProgram, setTargetProgram] = useState("");
  const [proof, setProof] = useState("");
  const [severity, setSeverity] = useState(3);
  const [gracePeriod, setGracePeriod] = useState(604800);
  const [protocolAddress, setProtocolAddress] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [proofHash, setProofHash] = useState<string | null>(null);
  const [submittedProof, setSubmittedProof] = useState<string | null>(null);
  const [submittedPda, setSubmittedPda] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // T1-4: Live byte counter for proof text
  const proofByteLength = useMemo(() => {
    return new TextEncoder().encode(proof).length;
  }, [proof]);

  // Max bytes: 1024 for encrypted proof on-chain. NaCl box adds 40 bytes overhead (24 nonce + 16 auth tag).
  // Sender pubkey embedded adds 32 bytes. So usable plaintext is ~928 bytes when encrypted.
  // Without encryption, raw bytes can be up to 1024.
  const maxBytes = protocolAddress ? 928 : 1024;
  const bytePercent = Math.min(100, (proofByteLength / maxBytes) * 100);
  const byteLimitExceeded = proofByteLength > maxBytes;

  const computeHash = async (data: string): Promise<Uint8Array> => {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded.buffer as ArrayBuffer);
    return new Uint8Array(hashBuffer);
  };

  const handleCopyProof = async () => {
    if (submittedProof) {
      await navigator.clipboard.writeText(submittedProof);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // T1-3: Download proof backup as JSON
  const handleDownloadBackup = () => {
    if (!submittedProof || !submittedPda || !proofHash) return;
    const backup = {
      disclosurePda: submittedPda,
      proofHash: proofHash,
      proofText: submittedProof,
      targetProgram: targetProgram,
      severity: SEVERITY_LABELS[severity] || severity,
      gracePeriodSeconds: gracePeriod,
      submittedAt: new Date().toISOString(),
      transactionSignature: txSig,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poh-proof-backup-${submittedPda?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      setError("Please connect your wallet first");
      return;
    }

    if (byteLimitExceeded) {
      setError(`Proof exceeds maximum size (${proofByteLength} / ${maxBytes} bytes). Shorten your proof.`);
      return;
    }

    setStatus("Submitting disclosure...");
    setError(null);
    setTxSig(null);
    setProofHash(null);
    setSubmittedProof(null);
    setSubmittedPda(null);

    try {
      const targetPubkey = new PublicKey(targetProgram);
      const hash = await computeHash(proof);
      const hashHex = Buffer.from(hash).toString("hex");
      setProofHash(hashHex);

      let protocolPda = PublicKey.default;
      let encryptedProof = Buffer.alloc(0);

      if (protocolAddress) {
        try {
          const protocolPubkey = new PublicKey(protocolAddress);
          const [pda] = findProtocolPda(protocolPubkey);

          const wallet = { publicKey, signTransaction, signAllTransactions };
          const provider = new AnchorProvider(connection, wallet as any, {
            commitment: "confirmed",
          });
          const program = getProgram(provider);
          const protocol = await (program.account as any).protocol.fetch(pda);
          protocolPda = pda;

          const protocolEncKey = new Uint8Array(protocol.encryptionKey);
          const senderKeypair = nacl.box.keyPair();
          const nonce = nacl.randomBytes(24);
          const proofBytes = new TextEncoder().encode(proof);
          const encrypted = nacl.box(proofBytes, nonce, protocolEncKey, senderKeypair.secretKey);

          if (encrypted) {
            encryptedProof = Buffer.concat([
              Buffer.from(nonce),
              Buffer.from(senderKeypair.publicKey),
              Buffer.from(encrypted),
            ]);
          }
        } catch {
          protocolPda = PublicKey.default;
        }
      }

      let nonce = 0;
      let disclosurePda: PublicKey | undefined;
      while (nonce < 100) {
        const [pda] = findDisclosurePda(publicKey, targetPubkey, nonce);
        const info = await connection.getAccountInfo(pda);
        if (!info) {
          disclosurePda = pda;
          break;
        }
        nonce++;
      }

      if (!disclosurePda) {
        throw new Error("Could not find available nonce (max 100 disclosures per target)");
      }

      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      const sig = await program.methods
        .submitDisclosure(
          Array.from(hash),
          encryptedProof,
          severity,
          new BN(gracePeriod),
          new BN(nonce)
        )
        .accounts({
          disclosure: disclosurePda,
          hacker: publicKey,
          targetProgram: targetPubkey,
          protocol: protocolPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSig(sig);
      setSubmittedProof(proof);
      setSubmittedPda(disclosurePda.toBase58());
      setStatus("Disclosure submitted successfully!");

      // T1-3: Save proof to localStorage for later reveal
      try {
        const saved = JSON.parse(localStorage.getItem("poh_proof_backups") || "{}");
        saved[disclosurePda.toBase58()] = {
          proofText: proof,
          proofHash: hashHex,
          targetProgram: targetProgram,
          severity,
          gracePeriod,
          submittedAt: new Date().toISOString(),
          txSig: sig,
        };
        localStorage.setItem("poh_proof_backups", JSON.stringify(saved));
      } catch {
        // localStorage might be full or unavailable
      }
    } catch (err: any) {
      setError(parseAnchorError(err));
      setStatus(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Submit Disclosure</h1>
      <p className="text-gray-400 mb-8">
        Submit a vulnerability disclosure. Your proof is hashed (SHA-256)
        on-chain as a commitment. Optionally encrypt it for the protocol.
      </p>

      {/* T2-6: Wallet privacy warning */}
      {publicKey && (
        <div className="mb-4 p-3 bg-gray-900 border border-gray-700 rounded-lg">
          <p className="text-xs text-gray-400">
            Your wallet address will be permanently recorded on-chain as the submitter of this
            disclosure. If you prefer anonymity, consider using a separate wallet.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Target Program Address *
          </label>
          <input
            type="text"
            value={targetProgram}
            onChange={(e) => setTargetProgram(e.target.value)}
            placeholder="Solana program with the vulnerability"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Protocol Program Address (optional)
          </label>
          <input
            type="text"
            value={protocolAddress}
            onChange={(e) => setProtocolAddress(e.target.value)}
            placeholder="If registered, proof will be encrypted for them"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter the same program address the protocol registered with on Proof of Hack.
            If registered, your proof will be encrypted so only they can read it.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Vulnerability Proof *
          </label>
          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Describe the vulnerability, include PoC details..."
            rows={6}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500 font-mono text-sm"
          />
          {/* T1-4: Byte counter */}
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">
              This will be hashed on-chain. Keep the original — you will need it to
              reveal or prove your discovery.
            </p>
            <span
              className={`text-xs font-mono whitespace-nowrap ml-2 ${
                byteLimitExceeded
                  ? "text-red-400"
                  : bytePercent >= 80
                  ? "text-yellow-400"
                  : "text-gray-500"
              }`}
            >
              {proofByteLength} / {maxBytes} bytes
            </span>
          </div>
          {byteLimitExceeded && (
            <p className="text-xs text-red-400 mt-1">
              Proof exceeds maximum size. Shorten your proof or remove unnecessary details.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
            >
              <option value={1}>Low</option>
              <option value={2}>Medium</option>
              <option value={3}>High</option>
              <option value={4}>Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Grace Period
            </label>
            {/* T1-6: Expanded grace period options */}
            <select
              value={gracePeriod}
              onChange={(e) => setGracePeriod(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
            >
              <option value={60}>60 seconds (demo)</option>
              <option value={3600}>1 hour</option>
              <option value={86400}>1 day</option>
              <option value={259200}>3 days</option>
              <option value={604800}>7 days (default)</option>
              <option value={1209600}>14 days</option>
              <option value={2592000}>30 days</option>
              <option value={7776000}>90 days (industry standard)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!publicKey || !targetProgram || !proof || byteLimitExceeded}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
        >
          {!publicKey ? "Connect Wallet First" : byteLimitExceeded ? "Proof Too Large" : "Submit Disclosure"}
        </button>

        {/* T1-3: Proof export section after successful submission */}
        {submittedProof && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm font-semibold">Save Your Proof</span>
              <span className="text-yellow-600 text-xs">(required for reveal)</span>
            </div>
            <p className="text-xs text-yellow-200/70">
              You will need the exact proof text below to reveal your disclosure if the
              protocol does not respond. If you lose this text, you can never prove your discovery.
            </p>
            <textarea
              readOnly
              value={submittedProof}
              rows={4}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 font-mono text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCopyProof}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={handleDownloadBackup}
                className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded text-xs text-white transition"
              >
                Download Proof Backup (.json)
              </button>
            </div>
          </div>
        )}

        {proofHash && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Proof Hash (SHA-256):</p>
            <p className="font-mono text-xs text-green-400 break-all">{proofHash}</p>
          </div>
        )}
        {status && (
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-400">
            {status}
          </div>
        )}
        {txSig && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Transaction:</p>
            <a
              href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm break-all"
            >
              {txSig}
            </a>
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}
      </div>

      <RecentDisclosures />
    </div>
  );
}
