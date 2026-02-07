"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, findDisclosurePda, findProtocolPda } from "@/lib/program";
import nacl from "tweetnacl";

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

  const computeHash = async (data: string): Promise<Uint8Array> => {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded.buffer as ArrayBuffer);
    return new Uint8Array(hashBuffer);
  };

  const handleSubmit = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      setError("Please connect your wallet first");
      return;
    }

    setStatus("Submitting disclosure...");
    setError(null);
    setTxSig(null);
    setProofHash(null);

    try {
      const targetPubkey = new PublicKey(targetProgram);
      const hash = await computeHash(proof);
      setProofHash(Buffer.from(hash).toString("hex"));

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
        throw new Error("Could not find available nonce");
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
      setStatus("Disclosure submitted successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to submit disclosure");
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
          <p className="text-xs text-gray-500 mt-1">
            This will be hashed on-chain. Keep the original — you will need it to
            reveal or prove your discovery.
          </p>
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
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!publicKey || !targetProgram || !proof}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
        >
          {!publicKey ? "Connect Wallet First" : "Submit Disclosure"}
        </button>

        {proofHash && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Proof Hash (SHA-256):</p>
            <p className="font-mono text-xs text-green-400 break-all">{proofHash}</p>
            <p className="text-xs text-gray-500 mt-2">
              Save this! It proves your proof matches the on-chain commitment.
            </p>
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
    </div>
  );
}
