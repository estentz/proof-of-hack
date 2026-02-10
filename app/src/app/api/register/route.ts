import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";
import { PROGRAM_ID, RPC_ENDPOINT } from "@/lib/constants";

// Validate base58 Solana address format
function isValidBase58(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

// Validate hex string (must be exactly 64 hex chars = 32 bytes)
function isValidHex32(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { programAddress, name, encryptionKey, authority } = body;

    // Validate required fields
    if (!programAddress || !name || !encryptionKey || !authority) {
      return NextResponse.json(
        { error: "Missing required fields: programAddress, name, encryptionKey, authority" },
        { status: 400 }
      );
    }

    // Validate programAddress
    if (!isValidBase58(programAddress)) {
      return NextResponse.json(
        { error: "Invalid programAddress: must be a valid base58 Solana address" },
        { status: 400 }
      );
    }

    // Validate authority
    if (!isValidBase58(authority)) {
      return NextResponse.json(
        { error: "Invalid authority: must be a valid base58 Solana address" },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.length < 1 || name.length > 64) {
      return NextResponse.json(
        { error: "Name must be between 1 and 64 characters" },
        { status: 400 }
      );
    }

    // Validate encryptionKey (32 bytes as hex = 64 hex chars)
    if (!isValidHex32(encryptionKey)) {
      return NextResponse.json(
        { error: "Invalid encryptionKey: must be exactly 64 hex characters (32 bytes)" },
        { status: 400 }
      );
    }

    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const kp = Keypair.generate();
    const dummyWallet = { publicKey: kp.publicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs };
    const provider = new AnchorProvider(connection, dummyWallet as any, {
      commitment: "confirmed",
    });
    const program = new Program(idl as any, provider);

    const targetPubkey = new PublicKey(programAddress);
    const authorityPubkey = new PublicKey(authority);
    const encryptionKeyBytes = Array.from(Buffer.from(encryptionKey, "hex"));

    // Derive protocol PDA
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol"), targetPubkey.toBuffer()],
      PROGRAM_ID
    );

    // Build the instruction
    const ix = await program.methods
      .registerProtocol(targetPubkey, name, encryptionKeyBytes)
      .accounts({
        protocol: protocolPda,
        authority: authorityPubkey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Build the transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction();
    tx.add(ix);
    tx.feePayer = authorityPubkey;
    tx.recentBlockhash = blockhash;

    // Serialize unsigned transaction as base64
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const transactionBase64 = serialized.toString("base64");

    return NextResponse.json({
      transaction: transactionBase64,
      protocolPda: protocolPda.toBase58(),
      message: `Transaction built for registering protocol "${name}". Sign and send to complete registration.`,
    });
  } catch (err: any) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to build registration transaction" },
      { status: 500 }
    );
  }
}
