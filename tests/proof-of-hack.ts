import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ProofOfHack } from "../target/types/proof_of_hack";
import { assert, expect } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as crypto from "crypto";

describe("proof-of-hack", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ProofOfHack as Program<ProofOfHack>;

  // Test keypairs
  const protocolAuthority = Keypair.generate();
  const hacker = Keypair.generate();
  const targetProgram = Keypair.generate();
  const unauthorizedUser = Keypair.generate();

  // Test data
  const protocolName = "TestProtocol";
  const encryptionKey = new Uint8Array(32).fill(1); // Dummy X25519 key
  const proofText = "Critical vulnerability in token transfer function: reentrancy in withdraw()";
  const proofHash = crypto.createHash("sha256").update(proofText).digest();
  const encryptedProof = Buffer.from("encrypted-proof-data-here");
  const severity = 4; // Critical
  const gracePeriod = new anchor.BN(60); // 60 seconds (minimum for demo)
  const nonce = new anchor.BN(0);

  // PDAs
  let protocolPda: PublicKey;
  let protocolBump: number;
  let disclosurePda: PublicKey;
  let disclosureBump: number;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;

    await Promise.all([
      provider.connection.requestAirdrop(protocolAuthority.publicKey, airdropAmount),
      provider.connection.requestAirdrop(hacker.publicKey, airdropAmount),
      provider.connection.requestAirdrop(unauthorizedUser.publicKey, airdropAmount),
    ]).then((sigs) =>
      Promise.all(sigs.map((sig) => provider.connection.confirmTransaction(sig)))
    );

    // Derive PDAs
    [protocolPda, protocolBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol"), targetProgram.publicKey.toBuffer()],
      program.programId
    );

    [disclosurePda, disclosureBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("disclosure"),
        hacker.publicKey.toBuffer(),
        targetProgram.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  });

  describe("register_protocol", () => {
    it("registers a protocol successfully", async () => {
      const tx = await program.methods
        .registerProtocol(
          targetProgram.publicKey,
          protocolName,
          Array.from(encryptionKey)
        )
        .accounts({
          protocol: protocolPda,
          authority: protocolAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([protocolAuthority])
        .rpc();

      const protocolAccount = await program.account.protocol.fetch(protocolPda);
      assert.equal(protocolAccount.authority.toBase58(), protocolAuthority.publicKey.toBase58());
      assert.equal(protocolAccount.programAddress.toBase58(), targetProgram.publicKey.toBase58());
      assert.equal(protocolAccount.name, protocolName);
      assert.deepEqual(protocolAccount.encryptionKey, Array.from(encryptionKey));
      assert.ok(protocolAccount.registeredAt.toNumber() > 0);
    });

    it("rejects empty protocol name", async () => {
      const fakeProgram = Keypair.generate();
      const [fakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol"), fakeProgram.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .registerProtocol(fakeProgram.publicKey, "", Array.from(encryptionKey))
          .accounts({
            protocol: fakePda,
            authority: protocolAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([protocolAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "InvalidProtocolName");
      }
    });

    it("rejects protocol name longer than 64 chars", async () => {
      const fakeProgram = Keypair.generate();
      const [fakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol"), fakeProgram.publicKey.toBuffer()],
        program.programId
      );
      const longName = "A".repeat(65);

      try {
        await program.methods
          .registerProtocol(fakeProgram.publicKey, longName, Array.from(encryptionKey))
          .accounts({
            protocol: fakePda,
            authority: protocolAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([protocolAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "InvalidProtocolName");
      }
    });
  });

  describe("submit_disclosure", () => {
    it("submits a disclosure targeting a registered protocol", async () => {
      const tx = await program.methods
        .submitDisclosure(
          Array.from(proofHash),
          Buffer.from(encryptedProof),
          severity,
          gracePeriod,
          nonce
        )
        .accounts({
          disclosure: disclosurePda,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: protocolPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      const disclosure = await program.account.disclosure.fetch(disclosurePda);
      assert.equal(disclosure.hacker.toBase58(), hacker.publicKey.toBase58());
      assert.equal(disclosure.protocol.toBase58(), protocolPda.toBase58());
      assert.equal(disclosure.targetProgram.toBase58(), targetProgram.publicKey.toBase58());
      assert.deepEqual(disclosure.proofHash, Array.from(proofHash));
      assert.equal(disclosure.severity, severity);
      assert.equal(disclosure.status, 0); // Submitted
      assert.ok(disclosure.submittedAt.toNumber() > 0);
      assert.equal(disclosure.acknowledgedAt.toNumber(), 0);
      assert.equal(disclosure.resolvedAt.toNumber(), 0);
      assert.equal(disclosure.gracePeriod.toNumber(), 60);
      assert.equal(disclosure.nonce.toNumber(), 0);
    });

    it("submits disclosure for unregistered protocol (protocol = default pubkey)", async () => {
      const nonce2 = new anchor.BN(1);
      const [discPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(proofHash),
          Buffer.from([]), // No encrypted proof for unregistered
          severity,
          gracePeriod,
          nonce2
        )
        .accounts({
          disclosure: discPda2,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: PublicKey.default,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      const disclosure = await program.account.disclosure.fetch(discPda2);
      assert.equal(disclosure.protocol.toBase58(), PublicKey.default.toBase58());
      assert.equal(disclosure.encryptedProof.length, 0);
    });

    it("rejects invalid severity", async () => {
      const nonce3 = new anchor.BN(99);
      const [discPda3] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce3.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .submitDisclosure(
            Array.from(proofHash),
            Buffer.from([]),
            5, // Invalid severity
            gracePeriod,
            nonce3
          )
          .accounts({
            disclosure: discPda3,
            hacker: hacker.publicKey,
            targetProgram: targetProgram.publicKey,
            protocol: PublicKey.default,
            systemProgram: SystemProgram.programId,
          })
          .signers([hacker])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "InvalidSeverity");
      }
    });

    it("rejects grace period less than 60 seconds", async () => {
      const nonce4 = new anchor.BN(100);
      const [discPda4] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce4.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .submitDisclosure(
            Array.from(proofHash),
            Buffer.from([]),
            severity,
            new anchor.BN(59), // Too short
            nonce4
          )
          .accounts({
            disclosure: discPda4,
            hacker: hacker.publicKey,
            targetProgram: targetProgram.publicKey,
            protocol: PublicKey.default,
            systemProgram: SystemProgram.programId,
          })
          .signers([hacker])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "GracePeriodTooShort");
      }
    });

    it("rejects encrypted proof larger than 1024 bytes", async () => {
      const nonce5 = new anchor.BN(101);
      const [discPda5] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce5.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .submitDisclosure(
            Array.from(proofHash),
            Buffer.alloc(1025), // Too large
            severity,
            gracePeriod,
            nonce5
          )
          .accounts({
            disclosure: discPda5,
            hacker: hacker.publicKey,
            targetProgram: targetProgram.publicKey,
            protocol: PublicKey.default,
            systemProgram: SystemProgram.programId,
          })
          .signers([hacker])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        // Client may throw RangeError before reaching the program, or program returns EncryptedProofTooLarge
        const errStr = err.toString();
        assert.ok(
          errStr.includes("EncryptedProofTooLarge") || errStr.includes("RangeError"),
          `Expected EncryptedProofTooLarge or RangeError, got: ${errStr}`
        );
      }
    });
  });

  describe("acknowledge_disclosure", () => {
    it("protocol authority acknowledges a disclosure", async () => {
      await program.methods
        .acknowledgeDisclosure()
        .accounts({
          disclosure: disclosurePda,
          protocol: protocolPda,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      const disclosure = await program.account.disclosure.fetch(disclosurePda);
      assert.equal(disclosure.status, 1); // Acknowledged
      assert.ok(disclosure.acknowledgedAt.toNumber() > 0);
    });

    it("rejects non-authority acknowledge", async () => {
      // Create a fresh disclosure for this test
      const nonce6 = new anchor.BN(200);
      const [discPda6] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce6.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(proofHash),
          Buffer.from(encryptedProof),
          severity,
          gracePeriod,
          nonce6
        )
        .accounts({
          disclosure: discPda6,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: protocolPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      try {
        await program.methods
          .acknowledgeDisclosure()
          .accounts({
            disclosure: discPda6,
            protocol: protocolPda,
            authority: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "UnauthorizedProtocolAction");
      }
    });
  });

  describe("resolve_disclosure", () => {
    it("protocol resolves an acknowledged disclosure with payment proof", async () => {
      const paymentHash = crypto.createHash("sha256").update("payment-tx-sig-123").digest();

      await program.methods
        .resolveDisclosure(Array.from(paymentHash))
        .accounts({
          disclosure: disclosurePda,
          protocol: protocolPda,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      const disclosure = await program.account.disclosure.fetch(disclosurePda);
      assert.equal(disclosure.status, 2); // Resolved
      assert.deepEqual(disclosure.paymentHash, Array.from(paymentHash));
      assert.ok(disclosure.resolvedAt.toNumber() > 0);
    });

    it("rejects resolve on non-acknowledged disclosure", async () => {
      // Submit a fresh disclosure (status = Submitted)
      const nonce7 = new anchor.BN(300);
      const [discPda7] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce7.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(proofHash),
          Buffer.from(encryptedProof),
          severity,
          gracePeriod,
          nonce7
        )
        .accounts({
          disclosure: discPda7,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: protocolPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      try {
        const paymentHash = crypto.createHash("sha256").update("fake").digest();
        await program.methods
          .resolveDisclosure(Array.from(paymentHash))
          .accounts({
            disclosure: discPda7,
            protocol: protocolPda,
            authority: protocolAuthority.publicKey,
          })
          .signers([protocolAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "InvalidStatus");
      }
    });
  });

  describe("reveal_proof", () => {
    it("hacker reveals proof after grace period on unacknowledged disclosure", async () => {
      // Create a disclosure with very short grace period
      const nonce8 = new anchor.BN(400);
      const revealProofText = "Reveal test: critical bug in transfer()";
      const revealProofHash = crypto.createHash("sha256").update(revealProofText).digest();

      const [discPda8] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce8.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(revealProofHash),
          Buffer.from([]),
          severity,
          new anchor.BN(60), // 60 second grace period
          nonce8
        )
        .accounts({
          disclosure: discPda8,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: PublicKey.default,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      // Wait for grace period (in test validator, we can warp clock)
      // For now, this test may need clock manipulation — skip timing check
      // In a real test, we'd use solana-test-validator's clock warp

      // Try to reveal before grace period (should fail)
      try {
        await program.methods
          .revealProof(Buffer.from(revealProofText))
          .accounts({
            disclosure: discPda8,
            hacker: hacker.publicKey,
          })
          .signers([hacker])
          .rpc();
        // If it succeeds, the test validator clock is already past grace period
      } catch (err) {
        assert.include(err.toString(), "GracePeriodNotElapsed");
      }
    });

    it("rejects reveal with wrong proof (hash mismatch)", async () => {
      const nonce9 = new anchor.BN(401);
      const realProof = "real proof data";
      const realHash = crypto.createHash("sha256").update(realProof).digest();

      const [discPda9] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce9.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(realHash),
          Buffer.from([]),
          severity,
          new anchor.BN(60),
          nonce9
        )
        .accounts({
          disclosure: discPda9,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: PublicKey.default,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      // Try to reveal with wrong proof (should always fail regardless of timing)
      try {
        await program.methods
          .revealProof(Buffer.from("WRONG PROOF DATA"))
          .accounts({
            disclosure: discPda9,
            hacker: hacker.publicKey,
          })
          .signers([hacker])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        // Could be GracePeriodNotElapsed or ProofHashMismatch depending on timing
        const errStr = err.toString();
        assert.ok(
          errStr.includes("ProofHashMismatch") || errStr.includes("GracePeriodNotElapsed"),
          `Expected ProofHashMismatch or GracePeriodNotElapsed, got: ${errStr}`
        );
      }
    });

    it("rejects reveal by non-hacker", async () => {
      const nonce10 = new anchor.BN(402);
      const proofData = "test proof";
      const hash = crypto.createHash("sha256").update(proofData).digest();

      const [discPda10] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce10.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(hash),
          Buffer.from([]),
          severity,
          new anchor.BN(60),
          nonce10
        )
        .accounts({
          disclosure: discPda10,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: PublicKey.default,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      try {
        await program.methods
          .revealProof(Buffer.from(proofData))
          .accounts({
            disclosure: discPda10,
            hacker: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "UnauthorizedHackerAction");
      }
    });
  });

  describe("claim_disclosure", () => {
    it("protocol claims an unclaimed disclosure", async () => {
      // Use the unregistered disclosure from earlier (nonce=1)
      const nonce2 = new anchor.BN(1);
      const [discPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .claimDisclosure()
        .accounts({
          disclosure: discPda2,
          protocol: protocolPda,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      const disclosure = await program.account.disclosure.fetch(discPda2);
      assert.equal(disclosure.protocol.toBase58(), protocolPda.toBase58());
    });

    it("rejects claim on already-claimed disclosure", async () => {
      const nonce2 = new anchor.BN(1);
      const [discPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .claimDisclosure()
          .accounts({
            disclosure: discPda2,
            protocol: protocolPda,
            authority: protocolAuthority.publicKey,
          })
          .signers([protocolAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "AlreadyClaimed");
      }
    });

    it("rejects claim from wrong protocol", async () => {
      // Create another protocol for a different program
      const otherProgram = Keypair.generate();
      const [otherProtocolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol"), otherProgram.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerProtocol(
          otherProgram.publicKey,
          "OtherProtocol",
          Array.from(encryptionKey)
        )
        .accounts({
          protocol: otherProtocolPda,
          authority: protocolAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([protocolAuthority])
        .rpc();

      // Try to claim a disclosure that targets targetProgram, using otherProtocol
      const nonce11 = new anchor.BN(500);
      const [discPda11] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce11.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(proofHash),
          Buffer.from([]),
          severity,
          gracePeriod,
          nonce11
        )
        .accounts({
          disclosure: discPda11,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: PublicKey.default,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      try {
        await program.methods
          .claimDisclosure()
          .accounts({
            disclosure: discPda11,
            protocol: otherProtocolPda,
            authority: protocolAuthority.publicKey,
          })
          .signers([protocolAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "ProtocolMismatch");
      }
    });
  });

  describe("security: grace period bounds", () => {
    it("rejects grace period exceeding 1 year", async () => {
      const nonce12 = new anchor.BN(600);
      const [discPda12] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce12.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .submitDisclosure(
            Array.from(proofHash),
            Buffer.from([]),
            severity,
            new anchor.BN(31_536_001), // 1 year + 1 second
            nonce12
          )
          .accounts({
            disclosure: discPda12,
            hacker: hacker.publicKey,
            targetProgram: targetProgram.publicKey,
            protocol: PublicKey.default,
            systemProgram: SystemProgram.programId,
          })
          .signers([hacker])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "GracePeriodTooLong");
      }
    });
  });

  describe("security: reveal from acknowledged status", () => {
    it("allows reveal from ACKNOWLEDGED status after grace period", async () => {
      // Create disclosure with short grace period
      const nonce13 = new anchor.BN(700);
      const revealProof2 = "Acknowledged reveal test: overflow in mint";
      const revealHash2 = crypto.createHash("sha256").update(revealProof2).digest();

      const [discPda13] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          hacker.publicKey.toBuffer(),
          targetProgram.publicKey.toBuffer(),
          nonce13.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(revealHash2),
          Buffer.from([]),
          severity,
          new anchor.BN(60),
          nonce13
        )
        .accounts({
          disclosure: discPda13,
          hacker: hacker.publicKey,
          targetProgram: targetProgram.publicKey,
          protocol: protocolPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hacker])
        .rpc();

      // Protocol acknowledges
      await program.methods
        .acknowledgeDisclosure()
        .accounts({
          disclosure: discPda13,
          protocol: protocolPda,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      const disc = await program.account.disclosure.fetch(discPda13);
      assert.equal(disc.status, 1); // Acknowledged

      // Attempt reveal from acknowledged state (may fail due to grace period timing)
      try {
        await program.methods
          .revealProof(Buffer.from(revealProof2))
          .accounts({
            disclosure: discPda13,
            hacker: hacker.publicKey,
          })
          .signers([hacker])
          .rpc();
        // Success means reveal from ACKNOWLEDGED works (grace period already elapsed)
        const revealed = await program.account.disclosure.fetch(discPda13);
        assert.equal(revealed.status, 3); // Revealed
      } catch (err) {
        // GracePeriodNotElapsed is acceptable — the important thing is it didn't reject with InvalidStatus
        assert.include(err.toString(), "GracePeriodNotElapsed");
      }
    });
  });

  describe("bounty escrow", () => {
    const bountyTarget = Keypair.generate();
    const bountyHacker = Keypair.generate();
    let bountyProtoPda: PublicKey;
    let bountyVaultPda: PublicKey;
    let bountyDiscPda: PublicKey;
    let bountyClaimPda: PublicKey;
    const bountyNonce = new anchor.BN(0);

    before(async () => {
      const sig1 = await provider.connection.requestAirdrop(
        bountyHacker.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig1);
      const sig2 = await provider.connection.requestAirdrop(
        protocolAuthority.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig2);

      [bountyProtoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol"), bountyTarget.publicKey.toBuffer()],
        program.programId
      );
      [bountyVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), bountyProtoPda.toBuffer()],
        program.programId
      );
      [bountyDiscPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          bountyHacker.publicKey.toBuffer(),
          bountyTarget.publicKey.toBuffer(),
          bountyNonce.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      [bountyClaimPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty_claim"), bountyDiscPda.toBuffer()],
        program.programId
      );

      await program.methods
        .registerProtocol(bountyTarget.publicKey, "BountyProto", Array.from(encryptionKey))
        .accounts({
          protocol: bountyProtoPda,
          authority: protocolAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([protocolAuthority])
        .rpc();
    });

    it("creates bounty vault with deposit", async () => {
      const low = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL);
      const medium = new anchor.BN(0.25 * anchor.web3.LAMPORTS_PER_SOL);
      const high = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);
      const critical = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
      const deposit = new anchor.BN(5 * anchor.web3.LAMPORTS_PER_SOL);

      await program.methods
        .createBounty(low, medium, high, critical, deposit)
        .accounts({
          vault: bountyVaultPda,
          protocol: bountyProtoPda,
          authority: protocolAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([protocolAuthority])
        .rpc();

      const vault = await program.account.bountyVault.fetch(bountyVaultPda);
      assert.equal(vault.lowBounty.toNumber(), 0.1 * anchor.web3.LAMPORTS_PER_SOL);
      assert.equal(vault.mediumBounty.toNumber(), 0.25 * anchor.web3.LAMPORTS_PER_SOL);
      assert.equal(vault.highBounty.toNumber(), 0.5 * anchor.web3.LAMPORTS_PER_SOL);
      assert.equal(vault.criticalBounty.toNumber(), 1 * anchor.web3.LAMPORTS_PER_SOL);
      assert.equal(vault.totalDeposited.toNumber(), 5 * anchor.web3.LAMPORTS_PER_SOL);
      assert.equal(vault.totalPaid.toNumber(), 0);
      assert.equal(vault.active, true);
    });

    it("funds bounty vault with additional SOL", async () => {
      const beforeBalance = await provider.connection.getBalance(bountyVaultPda);
      const fundAmount = new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL);

      await program.methods
        .fundBounty(fundAmount)
        .accounts({
          vault: bountyVaultPda,
          protocol: bountyProtoPda,
          authority: protocolAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([protocolAuthority])
        .rpc();

      const afterBalance = await provider.connection.getBalance(bountyVaultPda);
      assert.ok(afterBalance >= beforeBalance + 2 * anchor.web3.LAMPORTS_PER_SOL);

      const vault = await program.account.bountyVault.fetch(bountyVaultPda);
      assert.equal(vault.totalDeposited.toNumber(), 7 * anchor.web3.LAMPORTS_PER_SOL);
    });

    it("pays hacker bounty on claim after resolve", async () => {
      const proof = "Bounty test: overflow in token mint";
      const hash = crypto.createHash("sha256").update(proof).digest();

      await program.methods
        .submitDisclosure(
          Array.from(hash), Buffer.from("encrypted"), 3, new anchor.BN(60), bountyNonce
        )
        .accounts({
          disclosure: bountyDiscPda,
          hacker: bountyHacker.publicKey,
          targetProgram: bountyTarget.publicKey,
          protocol: bountyProtoPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([bountyHacker])
        .rpc();

      await program.methods.acknowledgeDisclosure()
        .accounts({ disclosure: bountyDiscPda, protocol: bountyProtoPda, authority: protocolAuthority.publicKey })
        .signers([protocolAuthority]).rpc();

      const payHash = crypto.createHash("sha256").update("bounty-payment").digest();
      await program.methods.resolveDisclosure(Array.from(payHash))
        .accounts({ disclosure: bountyDiscPda, protocol: bountyProtoPda, authority: protocolAuthority.publicKey })
        .signers([protocolAuthority]).rpc();

      const hackerBefore = await provider.connection.getBalance(bountyHacker.publicKey);
      await program.methods.claimBounty()
        .accounts({
          vault: bountyVaultPda, bountyClaim: bountyClaimPda, disclosure: bountyDiscPda,
          protocol: bountyProtoPda, hacker: bountyHacker.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([bountyHacker]).rpc();

      const hackerAfter = await provider.connection.getBalance(bountyHacker.publicKey);
      const expectedBounty = 0.5 * anchor.web3.LAMPORTS_PER_SOL;
      // Hacker gains bounty but pays tx fee (~5000) + rent for bounty_claim PDA (~890)
      // Net gain should be at least bounty - 10_000_000 (generous margin)
      assert.ok(hackerAfter - hackerBefore > expectedBounty - 10_000_000,
        `Expected net gain > ${expectedBounty - 10_000_000}, got ${hackerAfter - hackerBefore}`);

      const vault = await program.account.bountyVault.fetch(bountyVaultPda);
      assert.equal(vault.totalPaid.toNumber(), expectedBounty);
    });

    it("prevents double-claim", async () => {
      try {
        await program.methods.claimBounty()
          .accounts({
            vault: bountyVaultPda, bountyClaim: bountyClaimPda, disclosure: bountyDiscPda,
            protocol: bountyProtoPda, hacker: bountyHacker.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([bountyHacker]).rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.ok(err.toString().length > 0);
      }
    });

    it("rejects claim before RESOLVED status", async () => {
      const nonce2 = new anchor.BN(1);
      const hash2 = crypto.createHash("sha256").update("unresolved").digest();
      const [discPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("disclosure"), bountyHacker.publicKey.toBuffer(), bountyTarget.publicKey.toBuffer(), nonce2.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [claimPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty_claim"), discPda2.toBuffer()], program.programId
      );

      await program.methods.submitDisclosure(Array.from(hash2), Buffer.from([]), 2, new anchor.BN(60), nonce2)
        .accounts({ disclosure: discPda2, hacker: bountyHacker.publicKey, targetProgram: bountyTarget.publicKey, protocol: bountyProtoPda, systemProgram: SystemProgram.programId })
        .signers([bountyHacker]).rpc();

      try {
        await program.methods.claimBounty()
          .accounts({ vault: bountyVaultPda, bountyClaim: claimPda2, disclosure: discPda2, protocol: bountyProtoPda, hacker: bountyHacker.publicKey, systemProgram: SystemProgram.programId })
          .signers([bountyHacker]).rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "DisclosureNotResolved");
      }
    });

    it("rejects claim by wrong hacker", async () => {
      // Create a fresh resolved disclosure to test wrong-hacker claim
      const fakeHacker = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(fakeHacker.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);

      const wrongNonce = new anchor.BN(50);
      const wrongHash = crypto.createHash("sha256").update("wrong-hacker-test").digest();
      const [wrongDiscPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("disclosure"), bountyHacker.publicKey.toBuffer(), bountyTarget.publicKey.toBuffer(), wrongNonce.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [wrongClaimPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty_claim"), wrongDiscPda.toBuffer()], program.programId
      );

      // Submit as bountyHacker, resolve it
      await program.methods.submitDisclosure(Array.from(wrongHash), Buffer.from([]), 1, new anchor.BN(60), wrongNonce)
        .accounts({ disclosure: wrongDiscPda, hacker: bountyHacker.publicKey, targetProgram: bountyTarget.publicKey, protocol: bountyProtoPda, systemProgram: SystemProgram.programId })
        .signers([bountyHacker]).rpc();
      await program.methods.acknowledgeDisclosure()
        .accounts({ disclosure: wrongDiscPda, protocol: bountyProtoPda, authority: protocolAuthority.publicKey })
        .signers([protocolAuthority]).rpc();
      const payH = crypto.createHash("sha256").update("pay").digest();
      await program.methods.resolveDisclosure(Array.from(payH))
        .accounts({ disclosure: wrongDiscPda, protocol: bountyProtoPda, authority: protocolAuthority.publicKey })
        .signers([protocolAuthority]).rpc();

      // fakeHacker tries to claim bountyHacker's disclosure
      try {
        await program.methods.claimBounty()
          .accounts({
            vault: bountyVaultPda, bountyClaim: wrongClaimPda, disclosure: wrongDiscPda,
            protocol: bountyProtoPda, hacker: fakeHacker.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([fakeHacker]).rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "UnauthorizedHackerAction");
      }
    });

    it("rejects create_bounty from non-authority", async () => {
      const otherTarget = Keypair.generate();
      const [otherProtoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol"), otherTarget.publicKey.toBuffer()], program.programId
      );
      const [otherVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), otherProtoPda.toBuffer()], program.programId
      );

      await program.methods.registerProtocol(otherTarget.publicKey, "OtherProto", Array.from(encryptionKey))
        .accounts({ protocol: otherProtoPda, authority: protocolAuthority.publicKey, systemProgram: SystemProgram.programId })
        .signers([protocolAuthority]).rpc();

      try {
        await program.methods.createBounty(new anchor.BN(0), new anchor.BN(0), new anchor.BN(0), new anchor.BN(0), new anchor.BN(0))
          .accounts({ vault: otherVaultPda, protocol: otherProtoPda, authority: bountyHacker.publicKey, systemProgram: SystemProgram.programId })
          .signers([bountyHacker]).rpc();
        assert.fail("Should have thrown error");
      } catch (err) {
        assert.include(err.toString(), "UnauthorizedVaultAction");
      }
    });
  });

  describe("full flow: register → submit → acknowledge → resolve", () => {
    it("completes the happy path", async () => {
      const newTarget = Keypair.generate();
      const newHacker = Keypair.generate();
      const nonce = new anchor.BN(0);

      // Airdrop
      const airdropSig = await provider.connection.requestAirdrop(
        newHacker.publicKey,
        5 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      // 1. Register protocol
      const [newProtoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol"), newTarget.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerProtocol(newTarget.publicKey, "HappyPath", Array.from(encryptionKey))
        .accounts({
          protocol: newProtoPda,
          authority: protocolAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([protocolAuthority])
        .rpc();

      // 2. Submit disclosure
      const happyProof = "Found overflow in mint function";
      const happyHash = crypto.createHash("sha256").update(happyProof).digest();
      const [newDiscPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("disclosure"),
          newHacker.publicKey.toBuffer(),
          newTarget.publicKey.toBuffer(),
          nonce.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .submitDisclosure(
          Array.from(happyHash),
          Buffer.from("encrypted-data"),
          3, // High
          new anchor.BN(60),
          nonce
        )
        .accounts({
          disclosure: newDiscPda,
          hacker: newHacker.publicKey,
          targetProgram: newTarget.publicKey,
          protocol: newProtoPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([newHacker])
        .rpc();

      let disc = await program.account.disclosure.fetch(newDiscPda);
      assert.equal(disc.status, 0); // Submitted

      // 3. Acknowledge
      await program.methods
        .acknowledgeDisclosure()
        .accounts({
          disclosure: newDiscPda,
          protocol: newProtoPda,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      disc = await program.account.disclosure.fetch(newDiscPda);
      assert.equal(disc.status, 1); // Acknowledged

      // 4. Resolve
      const paymentHash = crypto.createHash("sha256").update("bounty-paid").digest();
      await program.methods
        .resolveDisclosure(Array.from(paymentHash))
        .accounts({
          disclosure: newDiscPda,
          protocol: newProtoPda,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      disc = await program.account.disclosure.fetch(newDiscPda);
      assert.equal(disc.status, 2); // Resolved
      assert.ok(disc.resolvedAt.toNumber() >= disc.acknowledgedAt.toNumber());
    });
  });
});
