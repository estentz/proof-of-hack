import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
} from "@solana/web3.js";
import idl from "./idl.json";
import { PROGRAM_ID, RPC_ENDPOINT } from "./constants";

export function getProgram(provider: AnchorProvider): Program {
  return new Program(idl as any, provider);
}

export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

/** Read-only Anchor program for querying accounts without a wallet */
export function getReadonlyProgram(): Program {
  const connection = getConnection();
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}

export function findProtocolPda(programAddress: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol"), programAddress.toBuffer()],
    PROGRAM_ID
  );
}

export function findDisclosurePda(
  hacker: PublicKey,
  targetProgram: PublicKey,
  nonce: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("disclosure"),
      hacker.toBuffer(),
      targetProgram.toBuffer(),
      new BN(nonce).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}
