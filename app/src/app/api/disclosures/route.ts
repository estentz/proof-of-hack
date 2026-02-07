import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";
import { RPC_ENDPOINT } from "@/lib/constants";

function getReadonlyProgram() {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  // Dummy wallet for read-only operations — never signs transactions
  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}

// Validate base58 Solana address format
function isValidBase58(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hacker = searchParams.get("hacker");
    const protocol = searchParams.get("protocol");
    const status = searchParams.get("status");
    const target = searchParams.get("target");

    // Validate parameters
    if (hacker && !isValidBase58(hacker)) {
      return NextResponse.json(
        { error: "Invalid hacker address format" },
        { status: 400 }
      );
    }
    if (protocol && !isValidBase58(protocol)) {
      return NextResponse.json(
        { error: "Invalid protocol address format" },
        { status: 400 }
      );
    }
    if (target && !isValidBase58(target)) {
      return NextResponse.json(
        { error: "Invalid target address format" },
        { status: 400 }
      );
    }
    if (status && (isNaN(Number(status)) || Number(status) < 0 || Number(status) > 3)) {
      return NextResponse.json(
        { error: "Status must be 0 (Submitted), 1 (Acknowledged), 2 (Resolved), or 3 (Revealed)" },
        { status: 400 }
      );
    }

    const program = getReadonlyProgram();
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
    console.error("Disclosures API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch disclosures" },
      { status: 500 }
    );
  }
}
