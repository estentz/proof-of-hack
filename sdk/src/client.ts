import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";
import { findProtocolPda, findDisclosurePda, findVaultPda, findBountyClaimPda, findProtocolConfigPda } from "./pda";
import { hashProof, encryptProof } from "./crypto";
import {
  PROGRAM_ID,
  SEVERITY,
  DEFAULT_GRACE_PERIOD,
  MIN_GRACE_PERIOD,
  MAX_ENCRYPTED_PROOF,
  MAX_PROTOCOL_NAME,
} from "./constants";
import type { ProtocolAccount, DisclosureAccount, BountyVaultAccount } from "./types";

// IDL for the Proof of Hack program
import idl from "./idl.json";

export class ProofOfHack {
  public program: Program;
  public provider: AnchorProvider;

  constructor(connection: Connection, wallet: anchor.Wallet) {
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program(idl as any, this.provider);
  }

  /**
   * Register a protocol with its encryption public key.
   */
  async registerProtocol(
    programAddress: PublicKey,
    name: string,
    encryptionKey: Uint8Array
  ): Promise<{ tx: TransactionSignature; protocolPda: PublicKey }> {
    if (!name || name.length > MAX_PROTOCOL_NAME) {
      throw new Error(`Protocol name must be 1-${MAX_PROTOCOL_NAME} characters`);
    }
    if (encryptionKey.length !== 32) {
      throw new Error("Encryption key must be 32 bytes (X25519 public key)");
    }

    const [protocolPda] = findProtocolPda(programAddress, this.program.programId);

    const tx = await this.program.methods
      .registerProtocol(programAddress, name, Array.from(encryptionKey))
      .accounts({
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, protocolPda };
  }

  /**
   * Submit a vulnerability disclosure.
   * @param targetProgram - The program with the vulnerability
   * @param proof - Plaintext proof (will be hashed and optionally encrypted)
   * @param severity - 1=Low, 2=Medium, 3=High, 4=Critical
   * @param options - Optional: gracePeriod, nonce, protocolPda, encryptionKey, senderSecretKey
   */
  async submitDisclosure(
    targetProgram: PublicKey,
    proof: string | Buffer,
    severity: number,
    options: {
      gracePeriod?: number;
      nonce?: number;
      protocolPda?: PublicKey;
      protocolEncryptionKey?: Uint8Array;
      senderSecretKey?: Uint8Array;
    } = {}
  ): Promise<{ tx: TransactionSignature; disclosurePda: PublicKey; proofHash: Buffer }> {
    const {
      gracePeriod = DEFAULT_GRACE_PERIOD,
      nonce = 0,
      protocolPda,
      protocolEncryptionKey,
      senderSecretKey,
    } = options;

    if (severity < SEVERITY.LOW || severity > SEVERITY.CRITICAL) {
      throw new Error("Severity must be 1-4");
    }
    if (gracePeriod < MIN_GRACE_PERIOD) {
      throw new Error(`Grace period must be at least ${MIN_GRACE_PERIOD} seconds`);
    }

    const proofHash = hashProof(proof);

    // Encrypt if protocol key provided
    let encryptedProof = Buffer.alloc(0);
    if (protocolEncryptionKey && senderSecretKey) {
      encryptedProof = encryptProof(proof, protocolEncryptionKey, senderSecretKey);
      if (encryptedProof.length > MAX_ENCRYPTED_PROOF) {
        throw new Error(
          `Encrypted proof too large (${encryptedProof.length} > ${MAX_ENCRYPTED_PROOF} bytes). Use shorter proof or store off-chain.`
        );
      }
    }

    const protocol = protocolPda || PublicKey.default;
    const [disclosurePda] = findDisclosurePda(
      this.provider.wallet.publicKey,
      targetProgram,
      nonce,
      this.program.programId
    );

    const tx = await this.program.methods
      .submitDisclosure(
        Array.from(proofHash),
        encryptedProof,
        severity,
        new BN(gracePeriod),
        new BN(nonce)
      )
      .accounts({
        disclosure: disclosurePda,
        hacker: this.provider.wallet.publicKey,
        targetProgram,
        protocol,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, disclosurePda, proofHash };
  }

  /**
   * Acknowledge a disclosure (protocol authority only).
   */
  async acknowledgeDisclosure(
    disclosurePda: PublicKey,
    protocolPda: PublicKey
  ): Promise<TransactionSignature> {
    return this.program.methods
      .acknowledgeDisclosure()
      .accounts({
        disclosure: disclosurePda,
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();
  }

  /**
   * Resolve a disclosure with payment proof (protocol authority only).
   */
  async resolveDisclosure(
    disclosurePda: PublicKey,
    protocolPda: PublicKey,
    paymentHash: Buffer | Uint8Array
  ): Promise<TransactionSignature> {
    return this.program.methods
      .resolveDisclosure(Array.from(paymentHash))
      .accounts({
        disclosure: disclosurePda,
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();
  }

  /**
   * Reveal proof publicly after grace period (hacker only, nuclear option).
   */
  async revealProof(
    disclosurePda: PublicKey,
    plaintextProof: string | Buffer
  ): Promise<TransactionSignature> {
    const data =
      typeof plaintextProof === "string"
        ? Buffer.from(plaintextProof)
        : plaintextProof;
    return this.program.methods
      .revealProof(data)
      .accounts({
        disclosure: disclosurePda,
        hacker: this.provider.wallet.publicKey,
      })
      .rpc();
  }

  /**
   * Claim an existing disclosure (protocol authority only).
   */
  async claimDisclosure(
    disclosurePda: PublicKey,
    protocolPda: PublicKey
  ): Promise<TransactionSignature> {
    return this.program.methods
      .claimDisclosure()
      .accounts({
        disclosure: disclosurePda,
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();
  }

  // ========== Query Methods ==========

  /**
   * Fetch a protocol account.
   */
  async getProtocol(protocolPda: PublicKey): Promise<ProtocolAccount> {
    return (this.program.account as any).protocol.fetch(protocolPda);
  }

  /**
   * Fetch a disclosure account.
   */
  async getDisclosure(disclosurePda: PublicKey): Promise<DisclosureAccount> {
    return (this.program.account as any).disclosure.fetch(disclosurePda);
  }

  /**
   * Find the protocol PDA for a given program address.
   */
  findProtocolPda(programAddress: PublicKey): [PublicKey, number] {
    return findProtocolPda(programAddress, this.program.programId);
  }

  /**
   * Find the disclosure PDA for a given hacker + target + nonce.
   */
  findDisclosurePda(
    hacker: PublicKey,
    targetProgram: PublicKey,
    nonce: number
  ): [PublicKey, number] {
    return findDisclosurePda(hacker, targetProgram, nonce, this.program.programId);
  }

  /**
   * Fetch all disclosures (use sparingly — fetches all program accounts).
   */
  async getAllDisclosures(): Promise<
    { publicKey: PublicKey; account: DisclosureAccount }[]
  > {
    return (this.program.account as any).disclosure.all();
  }

  /**
   * Fetch all protocols.
   */
  async getAllProtocols(): Promise<
    { publicKey: PublicKey; account: ProtocolAccount }[]
  > {
    return (this.program.account as any).protocol.all();
  }

  // ========== Bounty Escrow Methods ==========

  /**
   * Create a bounty vault for a protocol with severity-based payout rates.
   */
  async createBounty(
    protocolPda: PublicKey,
    rates: { low: BN; medium: BN; high: BN; critical: BN },
    depositLamports: BN
  ): Promise<{ tx: TransactionSignature; vaultPda: PublicKey }> {
    const [vaultPda] = findVaultPda(protocolPda, this.program.programId);

    const tx = await this.program.methods
      .createBounty(rates.low, rates.medium, rates.high, rates.critical, depositLamports)
      .accounts({
        vault: vaultPda,
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, vaultPda };
  }

  /**
   * Fund an existing bounty vault with additional lamports.
   */
  async fundBounty(
    protocolPda: PublicKey,
    amountLamports: BN
  ): Promise<TransactionSignature> {
    const [vaultPda] = findVaultPda(protocolPda, this.program.programId);

    return this.program.methods
      .fundBounty(amountLamports)
      .accounts({
        vault: vaultPda,
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Claim a bounty payout for a resolved disclosure (hacker only).
   */
  async claimBounty(
    disclosurePda: PublicKey,
    protocolPda: PublicKey
  ): Promise<TransactionSignature> {
    const [vaultPda] = findVaultPda(protocolPda, this.program.programId);
    const [bountyClaimPda] = findBountyClaimPda(disclosurePda, this.program.programId);

    return this.program.methods
      .claimBounty()
      .accounts({
        bountyClaim: bountyClaimPda,
        vault: vaultPda,
        disclosure: disclosurePda,
        protocol: protocolPda,
        hacker: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Fetch a bounty vault account.
   */
  async getVault(vaultPda: PublicKey): Promise<BountyVaultAccount> {
    return (this.program.account as any).bountyVault.fetch(vaultPda);
  }

  /**
   * Find the vault PDA for a given protocol PDA.
   */
  findVaultPda(protocolPda: PublicKey): [PublicKey, number] {
    return findVaultPda(protocolPda, this.program.programId);
  }

  /**
   * Find the bounty claim PDA for a given disclosure PDA.
   */
  findBountyClaimPda(disclosurePda: PublicKey): [PublicKey, number] {
    return findBountyClaimPda(disclosurePda, this.program.programId);
  }

  // ========== Protocol Config Methods ==========

  /**
   * Set protocol configuration (min grace period).
   * Only the protocol authority can call this.
   */
  async setProtocolConfig(
    protocolPda: PublicKey,
    minGracePeriod: number
  ): Promise<{ tx: TransactionSignature; configPda: PublicKey }> {
    const [configPda] = findProtocolConfigPda(protocolPda, this.program.programId);

    const tx = await this.program.methods
      .setProtocolConfig(new BN(minGracePeriod))
      .accounts({
        config: configPda,
        protocol: protocolPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, configPda };
  }

  /**
   * Find the protocol config PDA for a given protocol PDA.
   */
  findProtocolConfigPda(protocolPda: PublicKey): [PublicKey, number] {
    return findProtocolConfigPda(protocolPda, this.program.programId);
  }
}
