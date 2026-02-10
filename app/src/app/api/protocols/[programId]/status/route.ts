import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";
import { RPC_ENDPOINT, SEVERITY_LABELS, STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function getReadonlyProgram() {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const kp = Keypair.generate();
  const dummyWallet = {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;

    let targetProgramKey: PublicKey;
    try {
      targetProgramKey = new PublicKey(programId);
    } catch {
      return NextResponse.json(
        { error: "Invalid program ID" },
        { status: 400 }
      );
    }

    const program = getReadonlyProgram();

    // Find protocol registration for this program
    const allProtocols = await (program.account as any).protocol.all();
    const protocol = allProtocols.find(
      (p: any) => p.account.programAddress.toBase58() === targetProgramKey.toBase58()
    );

    // Find all disclosures targeting this program
    const allDisclosures = await (program.account as any).disclosure.all();
    const disclosures = allDisclosures.filter(
      (d: any) => d.account.targetProgram.toBase58() === targetProgramKey.toBase58()
    );

    // Find bounty vault if protocol exists
    let vault = null;
    if (protocol) {
      try {
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), protocol.publicKey.toBuffer()],
          program.programId
        );
        const vaultAccount = await (program.account as any).bountyVault.fetch(vaultPda);
        const connection = new Connection(RPC_ENDPOINT, "confirmed");
        const vaultBalance = await connection.getBalance(vaultPda);

        vault = {
          pda: vaultPda.toBase58(),
          rates: {
            low: vaultAccount.lowBounty.toNumber(),
            medium: vaultAccount.mediumBounty.toNumber(),
            high: vaultAccount.highBounty.toNumber(),
            critical: vaultAccount.criticalBounty.toNumber(),
          },
          totalDeposited: vaultAccount.totalDeposited.toNumber(),
          totalPaid: vaultAccount.totalPaid.toNumber(),
          balance: vaultBalance,
          active: vaultAccount.active,
        };
      } catch {
        // No vault exists for this protocol
      }
    }

    // Find protocol config if exists
    let config = null;
    if (protocol) {
      try {
        const [configPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("protocol_config"), protocol.publicKey.toBuffer()],
          program.programId
        );
        const configAccount = await (program.account as any).protocolConfig.fetch(configPda);
        config = {
          pda: configPda.toBase58(),
          minGracePeriod: configAccount.minGracePeriod.toNumber(),
        };
      } catch {
        // No config exists
      }
    }

    // Build summary
    const statusCounts: Record<string, number> = {
      submitted: 0,
      acknowledged: 0,
      resolved: 0,
      revealed: 0,
    };
    const severityCounts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const d of disclosures) {
      const status = d.account.status;
      if (status === 0) statusCounts.submitted++;
      else if (status === 1) statusCounts.acknowledged++;
      else if (status === 2) statusCounts.resolved++;
      else if (status === 3) statusCounts.revealed++;

      const sev = d.account.severity;
      if (sev === 1) severityCounts.low++;
      else if (sev === 2) severityCounts.medium++;
      else if (sev === 3) severityCounts.high++;
      else if (sev === 4) severityCounts.critical++;
    }

    const disclosureDetails = disclosures.map((d: any) => ({
      pda: d.publicKey.toBase58(),
      hacker: d.account.hacker.toBase58(),
      severity: d.account.severity,
      severityLabel: SEVERITY_LABELS[d.account.severity] || "Unknown",
      status: d.account.status,
      statusLabel: STATUS_LABELS[d.account.status] || "Unknown",
      submittedAt: d.account.submittedAt.toNumber(),
      acknowledgedAt: d.account.acknowledgedAt.toNumber(),
      resolvedAt: d.account.resolvedAt.toNumber(),
      gracePeriod: d.account.gracePeriod.toNumber(),
    }));

    return NextResponse.json({
      programId: targetProgramKey.toBase58(),
      registered: !!protocol,
      protocol: protocol
        ? {
            pda: protocol.publicKey.toBase58(),
            name: protocol.account.name,
            authority: protocol.account.authority.toBase58(),
            registeredAt: protocol.account.registeredAt.toNumber(),
          }
        : null,
      config,
      vault,
      disclosures: {
        total: disclosures.length,
        byStatus: statusCounts,
        bySeverity: severityCounts,
        details: disclosureDetails,
      },
    });
  } catch (err: any) {
    console.error("Protocol status API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch protocol status" },
      { status: 500 }
    );
  }
}
