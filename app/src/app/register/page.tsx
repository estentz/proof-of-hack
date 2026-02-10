"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, getReadonlyProgram, findProtocolPda } from "@/lib/program";
import nacl from "tweetnacl";

interface ProtocolEntry {
  pda: string;
  name: string;
  programAddress: string;
  authority: string;
  registeredAt: number;
}

function RegisteredProtocols() {
  const [protocols, setProtocols] = useState<ProtocolEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const program = getReadonlyProgram();
        const all = await (program.account as any).protocol.all();
        setProtocols(
          all.map((p: any) => ({
            pda: p.publicKey.toBase58(),
            name: p.account.name,
            programAddress: p.account.programAddress.toBase58(),
            authority: p.account.authority.toBase58(),
            registeredAt: p.account.registeredAt.toNumber(),
          }))
        );
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">Loading registered protocols...</p>;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Registered Protocols ({protocols.length})</h2>
      {protocols.length === 0 ? (
        <p className="text-gray-500 text-sm">No protocols registered yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {protocols.map((p) => (
            <div
              key={p.pda}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-white font-medium">{p.name}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {p.programAddress.slice(0, 8)}...{p.programAddress.slice(-8)}
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(p.registeredAt * 1000).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [programAddress, setProgramAddress] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      setError("Please connect your wallet first");
      return;
    }

    setStatus("Registering protocol...");
    setError(null);
    setTxSig(null);

    try {
      const targetPubkey = new PublicKey(programAddress);
      const encryptionKeypair = nacl.box.keyPair();

      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);
      const [protocolPda] = findProtocolPda(targetPubkey);

      const sig = await program.methods
        .registerProtocol(targetPubkey, name, Array.from(encryptionKeypair.publicKey))
        .accounts({
          protocol: protocolPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSig(sig);

      const keypairData = {
        publicKey: Array.from(encryptionKeypair.publicKey),
        secretKey: Array.from(encryptionKeypair.secretKey),
        programAddress,
        name,
      };
      const stored = JSON.parse(localStorage.getItem("poh_encryption_keys") || "[]");
      stored.push(keypairData);
      localStorage.setItem("poh_encryption_keys", JSON.stringify(stored));

      setStatus(
        "Protocol registered! Encryption keys saved to browser storage. Back them up — clearing browser data will lose decryption ability."
      );
    } catch (err: any) {
      setError(err.message || "Failed to register protocol");
      setStatus(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Register Protocol</h1>
      <p className="text-gray-400 mb-8">
        Register your protocol to receive encrypted vulnerability disclosures.
        An X25519 encryption keypair will be generated automatically.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Program Address
          </label>
          <input
            type="text"
            value={programAddress}
            onChange={(e) => setProgramAddress(e.target.value)}
            placeholder="Enter Solana program address"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Protocol Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. MyDeFiProtocol"
            maxLength={64}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">{name.length}/64 characters</p>
        </div>

        <button
          onClick={handleRegister}
          disabled={!publicKey || !programAddress || !name}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
        >
          {!publicKey ? "Connect Wallet First" : "Register Protocol"}
        </button>

        {txSig && (
          <button
            onClick={() => {
              const keys = localStorage.getItem("poh_encryption_keys") || "[]";
              const blob = new Blob([keys], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "poh-encryption-keys.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition"
          >
            Download Encryption Keys (Back Up!)
          </button>
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

      <RegisteredProtocols />
    </div>
  );
}
