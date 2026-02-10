import { NextResponse } from "next/server";
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";
import { RPC_ENDPOINT } from "@/lib/constants";

export const dynamic = "force-dynamic";

function getReadonlyProgram() {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const kp = Keypair.generate();
  const dummyWallet = { publicKey: kp.publicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs };
  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}

export async function GET() {
  try {
    const program = getReadonlyProgram();
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const allVaults = await (program.account as any).bountyVault.all();

    // Fetch all protocols to resolve names and program addresses
    const allProtocols = await (program.account as any).protocol.all();
    const protocolMap = new Map<string, { name: string; programAddress: string }>();
    for (const p of allProtocols) {
      protocolMap.set(p.publicKey.toBase58(), {
        name: p.account.name,
        programAddress: p.account.programAddress.toBase58(),
      });
    }

    const vaults = await Promise.all(
      allVaults.map(async (v: any) => {
        const vaultPda = v.publicKey.toBase58();
        const protocolKey = v.account.protocol.toBase58();
        const protocolInfo = protocolMap.get(protocolKey);
        const balance = await connection.getBalance(v.publicKey);

        return {
          pda: vaultPda,
          protocol: protocolKey,
          authority: v.account.authority.toBase58(),
          protocolName: protocolInfo?.name || "Unknown",
          programAddress: protocolInfo?.programAddress || protocolKey,
          rates: {
            low: v.account.lowBounty.toNumber(),
            medium: v.account.mediumBounty.toNumber(),
            high: v.account.highBounty.toNumber(),
            critical: v.account.criticalBounty.toNumber(),
          },
          balance,
          totalDeposited: v.account.totalDeposited.toNumber(),
          totalPaid: v.account.totalPaid.toNumber(),
          active: v.account.active,
          createdAt: v.account.createdAt.toNumber(),
        };
      })
    );

    return NextResponse.json({
      count: vaults.length,
      vaults,
    });
  } catch (err: any) {
    console.error("Vaults API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch bounty vaults" },
      { status: 500 }
    );
  }
}
