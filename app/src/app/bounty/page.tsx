"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getProgram, getReadonlyProgram, getConnection } from "@/lib/program";

interface VaultInfo {
  pda: string;
  protocolPda: string;
  lowBounty: number;
  mediumBounty: number;
  highBounty: number;
  criticalBounty: number;
  totalDeposited: number;
  totalPaid: number;
  active: boolean;
  createdAt: number;
  balance: number;
}

interface ProtocolInfo {
  pda: string;
  name: string;
  programAddress: string;
}

interface PublicVault {
  vaultPda: string;
  protocolName: string;
  programAddress: string;
  rates: { low: number; medium: number; high: number; critical: number };
  balance: number;
  totalDeposited: number;
  totalPaid: number;
  active: boolean;
}

const lamportsToSol = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);

function AllVaults() {
  const [vaults, setVaults] = useState<PublicVault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const program = getReadonlyProgram();
        const connection = getConnection();
        const [allVaults, allProtocols] = await Promise.all([
          (program.account as any).bountyVault.all(),
          (program.account as any).protocol.all(),
        ]);

        const protocolMap = new Map<string, any>();
        for (const p of allProtocols) {
          protocolMap.set(p.publicKey.toBase58(), p.account);
        }

        const balances = await Promise.all(
          allVaults.map((v: any) => connection.getBalance(v.publicKey))
        );

        setVaults(
          allVaults.map((v: any, i: number) => {
            const prot = protocolMap.get(v.account.protocol.toBase58());
            return {
              vaultPda: v.publicKey.toBase58(),
              protocolName: prot?.name || "Unknown",
              programAddress: prot?.programAddress?.toBase58() || v.publicKey.toBase58(),
              rates: {
                low: v.account.lowBounty.toNumber(),
                medium: v.account.mediumBounty.toNumber(),
                high: v.account.highBounty.toNumber(),
                critical: v.account.criticalBounty.toNumber(),
              },
              balance: balances[i],
              totalDeposited: v.account.totalDeposited.toNumber(),
              totalPaid: v.account.totalPaid.toNumber(),
              active: v.account.active,
            };
          })
        );
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">Loading bounty vaults...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Active Bounty Vaults ({vaults.length})</h2>
      {vaults.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400">No bounty vaults created yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            Protocol owners can create vaults to incentivize white hat disclosures.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vaults.map((v) => (
            <div
              key={v.vaultPda}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-semibold">{v.protocolName}</p>
                  <a
                    href={`https://explorer.solana.com/address/${v.programAddress}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                  >
                    {v.programAddress.slice(0, 8)}...{v.programAddress.slice(-8)}
                  </a>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    v.active
                      ? "bg-green-900/50 text-green-400 border border-green-800"
                      : "bg-red-900/50 text-red-400 border border-red-800"
                  }`}
                >
                  {v.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Audit this program for vulnerabilities. Submit a disclosure to earn bounties based on severity.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Vault Balance</p>
                  <p className="text-sm font-semibold text-green-400">
                    {lamportsToSol(v.balance)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Deposited</p>
                  <p className="text-sm font-semibold text-white">
                    {lamportsToSol(v.totalDeposited)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Paid to Hackers</p>
                  <p className="text-sm font-semibold text-white">
                    {lamportsToSol(v.totalPaid)} SOL
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">Bounty per finding:</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-gray-800 rounded p-2 text-center">
                  <p className="text-gray-400">Low</p>
                  <p className="text-white font-medium">{lamportsToSol(v.rates.low)} SOL</p>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <p className="text-yellow-400">Medium</p>
                  <p className="text-white font-medium">{lamportsToSol(v.rates.medium)} SOL</p>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <p className="text-orange-400">High</p>
                  <p className="text-white font-medium">{lamportsToSol(v.rates.high)} SOL</p>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <p className="text-red-400">Critical</p>
                  <p className="text-white font-medium">{lamportsToSol(v.rates.critical)} SOL</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BountyPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const [lowRate, setLowRate] = useState("");
  const [mediumRate, setMediumRate] = useState("");
  const [highRate, setHighRate] = useState("");
  const [criticalRate, setCriticalRate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [fundAmount, setFundAmount] = useState("");

  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [protocol, setProtocol] = useState<ProtocolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const fetchVaultAndProtocol = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;

    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      const allProtocols = await (program.account as any).protocol.all();
      const myProtocol = allProtocols.find(
        (p: any) => p.account.authority.toBase58() === publicKey.toBase58()
      );

      if (!myProtocol) {
        setProtocol(null);
        setVault(null);
        return;
      }

      setProtocol({
        pda: myProtocol.publicKey.toBase58(),
        name: myProtocol.account.name,
        programAddress: myProtocol.account.programAddress.toBase58(),
      });

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), myProtocol.publicKey.toBuffer()],
        program.programId
      );

      try {
        const vaultAccount = await (program.account as any).bountyVault.fetch(vaultPda);
        const vaultBalance = await connection.getBalance(vaultPda);
        setVault({
          pda: vaultPda.toBase58(),
          protocolPda: myProtocol.publicKey.toBase58(),
          lowBounty: vaultAccount.lowBounty.toNumber(),
          mediumBounty: vaultAccount.mediumBounty.toNumber(),
          highBounty: vaultAccount.highBounty.toNumber(),
          criticalBounty: vaultAccount.criticalBounty.toNumber(),
          totalDeposited: vaultAccount.totalDeposited.toNumber(),
          totalPaid: vaultAccount.totalPaid.toNumber(),
          active: vaultAccount.active,
          createdAt: vaultAccount.createdAt.toNumber(),
          balance: vaultBalance,
        });
      } catch {
        setVault(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch vault info:", err);
    }
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  useEffect(() => {
    fetchVaultAndProtocol();
  }, [fetchVaultAndProtocol]);

  const handleCreateVault = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions || !protocol) return;

    setLoading(true);
    setStatus("Creating bounty vault...");
    setError(null);
    setTxSig(null);

    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      const protocolPda = new PublicKey(protocol.pda);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), protocolPda.toBuffer()],
        program.programId
      );

      const low = new BN(Math.floor(parseFloat(lowRate) * LAMPORTS_PER_SOL));
      const medium = new BN(Math.floor(parseFloat(mediumRate) * LAMPORTS_PER_SOL));
      const high = new BN(Math.floor(parseFloat(highRate) * LAMPORTS_PER_SOL));
      const critical = new BN(Math.floor(parseFloat(criticalRate) * LAMPORTS_PER_SOL));
      const deposit = new BN(Math.floor(parseFloat(depositAmount) * LAMPORTS_PER_SOL));

      const sig = await program.methods
        .createBounty(low, medium, high, critical, deposit)
        .accounts({
          vault: vaultPda,
          protocol: protocolPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSig(sig);
      setStatus("Bounty vault created successfully!");
      await fetchVaultAndProtocol();
    } catch (err: any) {
      setError(err.message || "Failed to create bounty vault");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFundVault = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions || !protocol || !vault) return;

    setLoading(true);
    setStatus("Funding bounty vault...");
    setError(null);
    setTxSig(null);

    try {
      const wallet = { publicKey, signTransaction, signAllTransactions };
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);

      const protocolPda = new PublicKey(protocol.pda);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), protocolPda.toBuffer()],
        program.programId
      );

      const amount = new BN(Math.floor(parseFloat(fundAmount) * LAMPORTS_PER_SOL));

      const sig = await program.methods
        .fundBounty(amount)
        .accounts({
          vault: vaultPda,
          protocol: protocolPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSig(sig);
      setStatus("Vault funded successfully!");
      setFundAmount("");
      await fetchVaultAndProtocol();
    } catch (err: any) {
      setError(err.message || "Failed to fund bounty vault");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Bounty Vaults</h1>
      <p className="text-gray-400 mb-6">
        Find vulnerabilities in registered Solana programs. Get paid in SOL.
      </p>

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">How Bounties Work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-white font-medium mb-1">1. Find a Bug</p>
            <p className="text-gray-400">
              Audit any registered program&apos;s on-chain code. Look for access control flaws,
              integer overflows, PDA validation issues, or logic bugs.
            </p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">2. Submit Proof</p>
            <p className="text-gray-400">
              Submit an encrypted disclosure with a hash commitment. The protocol gets a
              grace period to acknowledge, fix, and resolve.
            </p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">3. Get Paid</p>
            <p className="text-gray-400">
              Once resolved, claim your bounty automatically from the vault.
              Payout is based on severity. All on-chain, no middlemen.
            </p>
          </div>
        </div>
      </div>

      {/* Severity guide */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">Severity Levels</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-gray-400 font-semibold mb-1">Low</p>
            <p className="text-gray-500">Informational issues, minor logic errors, gas optimizations, missing events</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-yellow-400 font-semibold mb-1">Medium</p>
            <p className="text-gray-500">State corruption under edge cases, missing validation on non-critical paths, griefing vectors</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-orange-400 font-semibold mb-1">High</p>
            <p className="text-gray-500">Bypassing access control, manipulating protocol logic, unauthorized state changes</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-red-400 font-semibold mb-1">Critical</p>
            <p className="text-gray-500">Direct fund theft, permanent fund lock, complete protocol takeover</p>
          </div>
        </div>
      </div>

      <AllVaults />

      {publicKey && protocol && !vault && (
        <div className="mt-8 space-y-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400">Your Protocol</p>
            <p className="text-white font-semibold">{protocol.name}</p>
            <p className="text-xs text-gray-500 break-all mt-1">{protocol.programAddress}</p>
          </div>

          <h2 className="text-xl font-semibold">Create Bounty Vault</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Low Severity (SOL)
              </label>
              <input type="number" step="0.01" min="0" value={lowRate}
                onChange={(e) => setLowRate(e.target.value)} placeholder="0.1"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Medium Severity (SOL)
              </label>
              <input type="number" step="0.01" min="0" value={mediumRate}
                onChange={(e) => setMediumRate(e.target.value)} placeholder="0.5"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                High Severity (SOL)
              </label>
              <input type="number" step="0.01" min="0" value={highRate}
                onChange={(e) => setHighRate(e.target.value)} placeholder="2.0"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Critical Severity (SOL)
              </label>
              <input type="number" step="0.01" min="0" value={criticalRate}
                onChange={(e) => setCriticalRate(e.target.value)} placeholder="10.0"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Initial Deposit (SOL)
            </label>
            <input type="number" step="0.01" min="0" value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)} placeholder="5.0"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500" />
          </div>

          <button onClick={handleCreateVault}
            disabled={loading || !lowRate || !mediumRate || !highRate || !criticalRate || !depositAmount}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition">
            {loading ? "Creating..." : "Create Bounty Vault"}
          </button>
        </div>
      )}

      {publicKey && protocol && vault && (
        <div className="mt-8 space-y-6">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Your Protocol</p>
            <p className="text-white font-semibold">{protocol.name}</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Fund Your Vault</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Amount (SOL)</label>
              <input type="number" step="0.01" min="0" value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)} placeholder="1.0"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500" />
            </div>
            <button onClick={handleFundVault} disabled={loading || !fundAmount}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition">
              {loading ? "Funding..." : "Fund Vault"}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-6 bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-400">
          {status}
        </div>
      )}
      {txSig && (
        <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Transaction:</p>
          <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
            target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm break-all">{txSig}</a>
        </div>
      )}
      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
