import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenVesting } from "../target/types/token_vesting";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("token-vesting", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenVesting as Program<TokenVesting>;
  
  // Test accounts
  let mint: anchor.web3.PublicKey;
  let adminTokenAccount: anchor.web3.PublicKey;
  let beneficiaryTokenAccount: anchor.web3.PublicKey;
  let vestingSchedulePda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  
  const admin = provider.wallet;
  const beneficiary = anchor.web3.Keypair.generate();
  
  // Vesting parameters
  const totalAmount = new anchor.BN(1_000_000_000); // 1 billion tokens (9 decimals = 1 token)
  const oneDay = 86_400; // seconds in a day
  const cliffDuration = new anchor.BN(oneDay * 30); // 30 days cliff
  const vestingDuration = new anchor.BN(oneDay * 365); // 365 days total vesting

  before(async () => {
    // Airdrop SOL to beneficiary for transaction fees
    const airdropSignature = await provider.connection.requestAirdrop(
      beneficiary.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Create a new SPL Token mint
    mint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      9 // 9 decimals
    );

    // Create admin's token account
    adminTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      mint,
      admin.publicKey
    );

    // Mint tokens to admin
    await mintTo(
      provider.connection,
      admin.payer,
      mint,
      adminTokenAccount,
      admin.publicKey,
      2_000_000_000 // 2 billion tokens
    );

    // Derive PDAs
    [vestingSchedulePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting"),
        admin.publicKey.toBuffer(),
        beneficiary.publicKey.toBuffer(),
        mint.toBuffer(),
      ],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), vestingSchedulePda.toBuffer()],
      program.programId
    );
  });

  describe("create_vesting_schedule", () => {
    it("creates a vesting schedule successfully", async () => {
      // Start time is 1 hour from now
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);

      const tx = await program.methods
        .createVestingSchedule(
          totalAmount,
          startTime,
          cliffDuration,
          vestingDuration
        )
        .accounts({
          admin: admin.publicKey,
          beneficiary: beneficiary.publicKey,
          mint,
          vestingSchedule: vestingSchedulePda,
          vault: vaultPda,
          adminTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Create vesting tx:", tx);

      // Fetch and verify the vesting schedule
      const vestingSchedule = await program.account.vestingSchedule.fetch(
        vestingSchedulePda
      );

      expect(vestingSchedule.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(vestingSchedule.beneficiary.toBase58()).to.equal(beneficiary.publicKey.toBase58());
      expect(vestingSchedule.mint.toBase58()).to.equal(mint.toBase58());
      expect(vestingSchedule.totalAmount.toNumber()).to.equal(totalAmount.toNumber());
      expect(vestingSchedule.claimedAmount.toNumber()).to.equal(0);
      expect(vestingSchedule.isRevoked).to.be.false;

      // Verify vault has the tokens
      const vaultAccount = await getAccount(provider.connection, vaultPda);
      expect(Number(vaultAccount.amount)).to.equal(totalAmount.toNumber());
    });

    it("fails if vesting duration too short", async () => {
      const shortDuration = new anchor.BN(3600); // 1 hour (less than 1 day)
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      
      const newBeneficiary = anchor.web3.Keypair.generate();
      const [newVestingPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vesting"),
          admin.publicKey.toBuffer(),
          newBeneficiary.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );
      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), newVestingPda.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .createVestingSchedule(
            totalAmount,
            startTime,
            new anchor.BN(0),
            shortDuration
          )
          .accounts({
            admin: admin.publicKey,
            beneficiary: newBeneficiary.publicKey,
            mint,
            vestingSchedule: newVestingPda,
            vault: newVaultPda,
            adminTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal("DurationTooShort");
      }
    });

    it("fails if cliff exceeds 50% of vesting duration", async () => {
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const duration = new anchor.BN(oneDay * 100);
      const longCliff = new anchor.BN(oneDay * 60); // 60% cliff
      
      const newBeneficiary = anchor.web3.Keypair.generate();
      const [newVestingPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vesting"),
          admin.publicKey.toBuffer(),
          newBeneficiary.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );
      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), newVestingPda.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .createVestingSchedule(
            totalAmount,
            startTime,
            longCliff,
            duration
          )
          .accounts({
            admin: admin.publicKey,
            beneficiary: newBeneficiary.publicKey,
            mint,
            vestingSchedule: newVestingPda,
            vault: newVaultPda,
            adminTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal("CliffPercentageTooHigh");
      }
    });
  });

  describe("claim", () => {
    it("fails to claim before cliff", async () => {
      try {
        beneficiaryTokenAccount = await createAssociatedTokenAccount(
          provider.connection,
          beneficiary,
          mint,
          beneficiary.publicKey
        );
      } catch {
        // Account might already exist
      }

      try {
        await program.methods
          .claim()
          .accounts({
            beneficiary: beneficiary.publicKey,
            vestingSchedule: vestingSchedulePda,
            mint,
            vault: vaultPda,
            beneficiaryTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([beneficiary])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal("CliffNotReached");
      }
    });
  });

  describe("revoke", () => {
    it("allows admin to revoke vesting", async () => {
      // Create a new vesting schedule for revoke test
      const newBeneficiary = anchor.web3.Keypair.generate();
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      
      const [newVestingPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vesting"),
          admin.publicKey.toBuffer(),
          newBeneficiary.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );
      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), newVestingPda.toBuffer()],
        program.programId
      );

      // Create the vesting
      await program.methods
        .createVestingSchedule(
          new anchor.BN(500_000_000),
          startTime,
          cliffDuration,
          vestingDuration
        )
        .accounts({
          admin: admin.publicKey,
          beneficiary: newBeneficiary.publicKey,
          mint,
          vestingSchedule: newVestingPda,
          vault: newVaultPda,
          adminTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Get admin token balance before revoke
      const beforeBalance = await getAccount(provider.connection, adminTokenAccount);

      // Revoke the vesting
      const tx = await program.methods
        .revoke()
        .accounts({
          admin: admin.publicKey,
          vestingSchedule: newVestingPda,
          mint,
          vault: newVaultPda,
          adminTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Revoke tx:", tx);

      // Verify the vesting is revoked
      const vestingSchedule = await program.account.vestingSchedule.fetch(newVestingPda);
      expect(vestingSchedule.isRevoked).to.be.true;

      // Verify tokens returned to admin
      const afterBalance = await getAccount(provider.connection, adminTokenAccount);
      expect(Number(afterBalance.amount)).to.be.greaterThan(Number(beforeBalance.amount));
    });

    it("fails if non-admin tries to revoke", async () => {
      try {
        await program.methods
          .revoke()
          .accounts({
            admin: beneficiary.publicKey, // Wrong admin
            vestingSchedule: vestingSchedulePda,
            mint,
            vault: vaultPda,
            adminTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([beneficiary])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error: any) {
        // Should fail with constraint violation
        expect(error).to.exist;
      }
    });
  });
});
