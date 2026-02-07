import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";

const RPC = "https://api.devnet.solana.com";

function getReadonlyProgram() {
  const connection = new Connection(RPC, "confirmed");
  const provider = AnchorProvider.local(RPC, { commitment: "confirmed" });
  return new Program(idl as any, provider);
}

export async function GET(request: NextRequest) {
  try {
    const program = getReadonlyProgram();
    const { searchParams } = new URL(request.url);
    const hacker = searchParams.get("hacker");
    const protocol = searchParams.get("protocol");
    const status = searchParams.get("status");
    const target = searchParams.get("target");

    const allDisclosures = await (program.account as any).disclosure.all();

    let entries = allDisclosures.map((d: any) => ({
      pda: d.publicKey.toBase58(),
      hacker: d.account.hacker.toBase58(),
      protocol: d.account.protocol.toBase58(),
      targetProgram: d.account.targetProgram.toBase58(),
      proofHash: Buffer.from(d.account.proofHash).toString("hex"),
      encryptedProofLength: d.account.encryptedProof.length,
      severity: d.account.severity,
      severityLabel: ["", "Low", "Medium", "High", "Critical"][d.account.severity] || "Unknown",
      status: d.account.status,
      statusLabel: ["Submitted", "Acknowledged", "Resolved", "Revealed"][d.account.status] || "Unknown",
      submittedAt: d.account.submittedAt.toNumber(),
      acknowledgedAt: d.account.acknowledgedAt.toNumber(),
      resolvedAt: d.account.resolvedAt.toNumber(),
      gracePeriod: d.account.gracePeriod.toNumber(),
      nonce: d.account.nonce.toNumber(),
    }));

    if (hacker) entries = entries.filter((d: any) => d.hacker === hacker);
    if (protocol) entries = entries.filter((d: any) => d.protocol === protocol);
    if (status) entries = entries.filter((d: any) => d.status === parseInt(status));
    if (target) entries = entries.filter((d: any) => d.targetProgram === target);

    return NextResponse.json({
      count: entries.length,
      disclosures: entries,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch disclosures" },
      { status: 500 }
    );
  }
}
