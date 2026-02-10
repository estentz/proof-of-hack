import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface ProtocolAccount {
  authority: PublicKey;
  programAddress: PublicKey;
  name: string;
  encryptionKey: number[];
  registeredAt: BN;
  bump: number;
}

export interface DisclosureAccount {
  hacker: PublicKey;
  protocol: PublicKey;
  targetProgram: PublicKey;
  proofHash: number[];
  encryptedProof: Buffer;
  severity: number;
  status: number;
  paymentHash: number[];
  submittedAt: BN;
  acknowledgedAt: BN;
  resolvedAt: BN;
  gracePeriod: BN;
  nonce: BN;
  bump: number;
}

export interface BountyVaultAccount {
  protocol: PublicKey;
  authority: PublicKey;
  lowBounty: BN;
  mediumBounty: BN;
  highBounty: BN;
  criticalBounty: BN;
  totalDeposited: BN;
  totalPaid: BN;
  active: boolean;
  createdAt: BN;
  bump: number;
}
