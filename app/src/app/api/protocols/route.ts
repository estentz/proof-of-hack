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
    const allProtocols = await (program.account as any).protocol.all();

    const entries = allProtocols.map((p: any) => ({
      pda: p.publicKey.toBase58(),
      authority: p.account.authority.toBase58(),
      programAddress: p.account.programAddress.toBase58(),
      name: p.account.name,
      encryptionKey: Buffer.from(p.account.encryptionKey).toString("hex"),
      registeredAt: p.account.registeredAt.toNumber(),
    }));

    return NextResponse.json({
      count: entries.length,
      protocols: entries,
    });
  } catch (err: any) {
    console.error("Protocols API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch protocols" },
      { status: 500 }
    );
  }
}
