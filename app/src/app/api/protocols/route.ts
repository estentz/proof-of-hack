import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";

const RPC = "https://api.devnet.solana.com";

function getReadonlyProgram() {
  const connection = new Connection(RPC, "confirmed");
  const provider = AnchorProvider.local(RPC, { commitment: "confirmed" });
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
    return NextResponse.json(
      { error: err.message || "Failed to fetch protocols" },
      { status: 500 }
    );
  }
}
