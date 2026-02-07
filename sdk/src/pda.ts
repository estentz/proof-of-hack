import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PROGRAM_ID } from "./constants";

export function findProtocolPda(
  programAddress: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol"), programAddress.toBuffer()],
    programId
  );
}

export function findDisclosurePda(
  hacker: PublicKey,
  targetProgram: PublicKey,
  nonce: BN | number,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const nonceBn = typeof nonce === "number" ? new BN(nonce) : nonce;
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("disclosure"),
      hacker.toBuffer(),
      targetProgram.toBuffer(),
      nonceBn.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}
