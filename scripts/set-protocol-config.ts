/**
 * Set min_grace_period for our protocol on devnet.
 * Usage: npx ts-node scripts/set-protocol-config.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Load keypair from default Solana CLI path
const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

const PROGRAM_ID = new PublicKey("4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn");
const PROTOCOL_PDA = new PublicKey("FTTNvUSEqPh3YNsv3KjsByV5nswhihEiz6hSpxFDbjPq");

// 3 days in seconds
const MIN_GRACE_PERIOD = 3 * 24 * 60 * 60; // 259200

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idl = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "target", "idl", "proof_of_hack.json"), "utf-8"
  ));
  const program = new anchor.Program(idl, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config"), PROTOCOL_PDA.toBuffer()],
    PROGRAM_ID
  );

  console.log("Setting protocol config...");
  console.log("  Protocol PDA:", PROTOCOL_PDA.toBase58());
  console.log("  Config PDA:", configPda.toBase58());
  console.log("  Min grace period:", MIN_GRACE_PERIOD, "seconds (3 days)");

  const tx = await program.methods
    .setProtocolConfig(new anchor.BN(MIN_GRACE_PERIOD))
    .accounts({
      config: configPda,
      protocol: PROTOCOL_PDA,
      authority: payer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("  TX:", tx);
  console.log("Done! Protocol now requires minimum 3-day grace period.");
}

main().catch(console.error);
