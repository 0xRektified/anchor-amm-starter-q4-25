import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createMint, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert, expect } from "chai";

describe("anchor-amm-q4-25", () => {
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;
  const initializer = anchor.web3.Keypair.generate();

  const user = anchor.web3.Keypair.generate();
  let userLpBump: number;
  
  const minter = provider.wallet.publicKey;
  let configPda = provider.wallet.publicKey;
  let configBump: number;

  let mintLp: anchor.web3.PublicKey;
  let mintLpBump: number;
  
  let mintX: anchor.web3.PublicKey;
  let mintY: anchor.web3.PublicKey;

  let userLp: anchor.web3.PublicKey;
  let userX: anchor.web3.PublicKey;
  let userY: anchor.web3.PublicKey;

  let vaultX: anchor.web3.PublicKey;
  let vaultY: anchor.web3.PublicKey;

  let seed = new anchor.BN(1234);
  let fee = 100;


  before(async () => {
    await provider.connection.requestAirdrop(user.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(initializer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));

    mintX = await createMint(provider.connection, provider.wallet.payer, minter, null, 6);
    mintY = await createMint(provider.connection, provider.wallet.payer, minter, null, 6);

    userX = getAssociatedTokenAddressSync(mintX, user.publicKey);
    const userXAtaATx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(provider.wallet.publicKey, userX, user.publicKey, mintX)
    );
    await provider.sendAndConfirm(userXAtaATx);

    userY = getAssociatedTokenAddressSync(mintY, user.publicKey);
    const userYAtaATx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(provider.wallet.publicKey, userY, user.publicKey, mintY)
    );
    await provider.sendAndConfirm(userYAtaATx);


    seed = new anchor.BN(1111);
    [configPda, configBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    [mintLp, mintLpBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), configPda.toBuffer()],
      program.programId
    );
    userLp = getAssociatedTokenAddressSync(mintLp, user.publicKey);
    vaultX = getAssociatedTokenAddressSync(mintX, configPda, true);
    vaultY = getAssociatedTokenAddressSync(mintY, configPda, true);

    console.log(`user -> ${user.publicKey}`);
    console.log(`mintX -> ${mintX}`);
    console.log(`mintY -> ${mintY}`);
    console.log(`userX -> ${userX}`);
    console.log(`userY -> ${userY}`);
    console.log(`seed -> ${seed}`);
    console.log(`configPda -> ${configPda}`);
    console.log(`mintLp -> ${mintLp}`);
    console.log(`userLp -> ${userLp}`);
    console.log(`vaultX -> ${vaultX}`);
    console.log(`vaultY -> ${vaultY}`);
  })

  describe("Initialize", () => {
    it("Is initialized!", async () => {
      await program.methods.initialize(
        seed,
        fee,
        provider.wallet.publicKey,
      ).accountsStrict({
        initializer: initializer.publicKey,
        mintX: mintX,
        mintY: mintY,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        config: configPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initializer])
      .rpc();
    
      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.authority.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
      expect(configAccount.mintX.toBase58()).to.equal(mintX.toBase58());
      expect(configAccount.mintY.toBase58()).to.equal(mintY.toBase58());
      expect(configAccount.fee).to.equal(fee);
      expect(configAccount.locked).to.equal(false);
      expect(configAccount.configBump).to.equal(configBump);
      expect(configAccount.lpBump).to.equal(mintLpBump);
      expect(configAccount.seed.toNumber()).to.equal(seed.toNumber());
    });
  })

  describe("Deposit", () => {
    it("Deposits initial liquidity", async () => {
      const amountX = 200;
      const amountY = 200;

      await mintTo(provider.connection, provider.wallet.payer, mintX, userX, minter, amountX * 1e6);
      await mintTo(provider.connection, provider.wallet.payer, mintY, userY, minter, amountY * 1e6);

      const userLpAccountBefore = await provider.connection.getAccountInfo(userLp);
      expect(userLpAccountBefore).to.be.null;
      const userXBalanceBefore = (await provider.connection.getTokenAccountBalance(userX)).value.uiAmount;
      expect(userXBalanceBefore).to.equal(amountX);
      const userYBalanceBefore = (await provider.connection.getTokenAccountBalance(userY)).value.uiAmount;
      expect(userYBalanceBefore).to.equal(amountY);
    

      const vaultXBefore = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXBefore).to.equal(0);
      const vaultYBefore = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYBefore).to.equal(0);
      const lpSupplyBefore = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyBefore).to.equal(0);

      const tx = await program.methods.deposit(
        new anchor.BN(100 * 1e6),
        new anchor.BN(amountX* 1e6),
        new anchor.BN(amountY* 1e6),
      ).accountsStrict({
        user: user.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: configPda,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
      console.log(tx);

      const userLpBalanceAfter = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;
      expect(userLpBalanceAfter).to.equal(100);
      const userXBalanceAfter = (await provider.connection.getTokenAccountBalance(userX)).value.uiAmount;
      expect(userXBalanceAfter).to.equal(0);
      const userYBalanceAfter = (await provider.connection.getTokenAccountBalance(userY)).value.uiAmount;
      expect(userYBalanceAfter).to.equal(0);


      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.equal(200);
      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.equal(200);
      const lpSupplyAfter = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyAfter).to.equal(100);
    });

    it("Deposits additional liquidity", async () => {
      const lpToMint = 50;
  
      // Ration 2: 1
      const requiredX = (lpToMint / 100) * 200;
      const requiredY = (lpToMint / 100) * 200;
      
      // Buffer for slippage
      const maxX = Math.ceil(requiredX * 1.01);
      const maxY = Math.ceil(requiredY * 1.01);
      

      await mintTo(provider.connection, provider.wallet.payer, mintX, userX, minter, maxX * 1e6);
      await mintTo(provider.connection, provider.wallet.payer, mintY, userY, minter, maxY * 1e6);
      
      const vaultXBefore = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXBefore).to.equal(200);
      const vaultYBefore = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYBefore).to.equal(200);
      const lpSupplyBefore = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyBefore).to.equal(100);

      const tx = await program.methods.deposit(
        new anchor.BN(lpToMint * 1e6),
        new anchor.BN(maxX * 1e6),
        new anchor.BN(maxY * 1e6),
      ).accountsStrict({
        user: user.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: configPda,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
      console.log(tx);

      const userLpBalanceAfter = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;
      expect(userLpBalanceAfter).to.equal(150);
      const userXBalanceAfter = (await provider.connection.getTokenAccountBalance(userX)).value.uiAmount;
      expect(userXBalanceAfter).to.equal(1);
      const userYBalanceAfter = (await provider.connection.getTokenAccountBalance(userY)).value.uiAmount;
      expect(userYBalanceAfter).to.equal(1);

      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.equal(300);  // 200 + 100
      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.equal(300);  // 200 + 100
      const lpSupplyAfter = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyAfter).to.equal(150);  // 100 + 50

      console.log("Vaults: X=300, Y=300 | LP Supply: 150");

    });
    
    it("Fails when slippage is exceeded", async () => {
      const lpToMint = 50;
      

      const maxX = 50;
      const maxY = 50;
      
      await mintTo(provider.connection, provider.wallet.payer, mintX, userX, minter, maxX * 1e6);
      await mintTo(provider.connection, provider.wallet.payer, mintY, userY, minter, maxY * 1e6);
      
      try {
        await program.methods.deposit(
          new anchor.BN(lpToMint * 1e6),
          new anchor.BN(maxX * 1e6),
          new anchor.BN(maxY * 1e6),
        ).accountsStrict({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
        
        assert.fail("Should have failed with SlippageExceeded");
      } catch (error) {
        expect(error.message).to.include("SlippageExceeded");
        console.log("✓ Correctly failed with SlippageExceeded");
      }

      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.equal(300);
      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.equal(300);
      const lpSupplyAfter = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyAfter).to.equal(150);
    });
  });

  describe("Swap", () => {
    it("Swap X token for Y token", async () => {
      const amountX = 10;
      const amountXMin = 9;

      await mintTo(provider.connection, provider.wallet.payer, mintX, userX, minter, amountX * 1e6);

      const userXBalanceBefore = (await provider.connection.getTokenAccountBalance(userX)).value.uiAmount;
      const userYBalanceBefore = (await provider.connection.getTokenAccountBalance(userY)).value.uiAmount;
      const vaultXBefore = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      const vaultYBefore = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;

      // 1 from previous slippage left, 50 for failed LP, 10 just minted
      expect(userXBalanceBefore).to.equal(61);
      expect(userYBalanceBefore).to.equal(51);
      expect(vaultXBefore).to.equal(300);
      expect(vaultYBefore).to.equal(300);

      const tx = await program.methods.swap(
        true,
        new anchor.BN(amountX * 1e6),
        new anchor.BN(amountXMin * 1e6),
      ).accountsStrict({
        user: user.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: configPda,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
      console.log(tx);

      // Calculate expected swap output dynamically
      const k = vaultXBefore * vaultYBefore;
      const expectedVaultXAfter = vaultXBefore + amountX;
      const expectedVaultYAfter = k / expectedVaultXAfter;
      const yOutputBeforeFee = vaultYBefore - expectedVaultYAfter;
      const feeRate = fee / 10000;
      const yOutputAfterFee = yOutputBeforeFee * (1 - feeRate);

      // Expected user balances
      const expectedUserXAfter = userXBalanceBefore - amountX;
      const expectedUserYAfter = userYBalanceBefore + yOutputAfterFee;

      const userXBalanceAfter = (await provider.connection.getTokenAccountBalance(userX)).value.uiAmount;
      expect(userXBalanceAfter).to.equal(expectedUserXAfter);

      const userYBalanceAfter = (await provider.connection.getTokenAccountBalance(userY)).value.uiAmount;
      expect(userYBalanceAfter).to.be.approximately(expectedUserYAfter, 0.01);

      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.equal(expectedVaultXAfter);

      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.be.approximately(expectedVaultYAfter, 0.1);

      console.log(`Swap successful: Exchanged ${amountX} X for ~${yOutputAfterFee.toFixed(2)} Y (${feeRate * 100}% fee applied to output)`);
    })
  })

  describe("Withdraw", () => {
    it("User withdraw partial LP", async () => {

      const userLpBalanceBefore = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;

      const vaultXBefore = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;

      const vaultYBefore = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      const minX = vaultXBefore / 2;
      const minY = vaultYBefore / 2;

      await program.methods.withdraw(
        new anchor.BN(userLpBalanceBefore * 1e6 / 2),
        new anchor.BN(minX * 1e6),
        new anchor.BN(minY * 1e6),
      ).accountsStrict({
        user: user.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: configPda,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

      const resultLp = userLpBalanceBefore / 2;

      const userLpBalanceAfter = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;
      expect(userLpBalanceAfter).to.equal(resultLp);
      const lpSupplyAfter = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyAfter).to.equal(resultLp);

      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.be.approximately(vaultXBefore / 2, 0.0001);

      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.be.approximately(vaultYBefore / 2, 0.0001);
    });

    it("User withdraws all remaining liquidity", async () => {
      const userLpBalanceBefore = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;
      const vaultXBefore = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      const vaultYBefore = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      const lpSupplyBefore = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;

      expect(userLpBalanceBefore).to.equal(lpSupplyBefore);

      const minX = 1;
      const minY = 1;

      await program.methods.withdraw(
        new anchor.BN(userLpBalanceBefore * 1e6),
        new anchor.BN(minX),
        new anchor.BN(minY),
      ).accountsStrict({
        user: user.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: configPda,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

      const userLpBalanceAfter = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;
      expect(userLpBalanceAfter).to.equal(0);
      const lpSupplyAfter = (await provider.connection.getTokenSupply(mintLp)).value.uiAmount;
      expect(lpSupplyAfter).to.equal(0);

      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.be.approximately(0, 0.0001);
      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.be.approximately(0, 0.0001);

      console.log(`All liquidity withdrawn: Burned ${userLpBalanceBefore} LP, received ~${vaultXBefore} X and ~${vaultYBefore} Y`);
    });

    it("Fails when trying to withdraw more than available (slippage)", async () => {
      const depositAmount = 100;
      await mintTo(provider.connection, provider.wallet.payer, mintX, userX, minter, depositAmount * 1e6);
      await mintTo(provider.connection, provider.wallet.payer, mintY, userY, minter, depositAmount * 1e6);

      await program.methods.deposit(
        new anchor.BN(50 * 1e6),
        new anchor.BN(depositAmount * 1e6),
        new anchor.BN(depositAmount * 1e6),
      ).accountsStrict({
        user: user.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: configPda,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

      const userLpBalance = (await provider.connection.getTokenAccountBalance(userLp)).value.uiAmount;
      const vaultXBefore = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      const vaultYBefore = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;

      const minX = vaultXBefore * 10;
      const minY = vaultYBefore * 10;

      try {
        await program.methods.withdraw(
          new anchor.BN(userLpBalance * 1e6),
          new anchor.BN(minX * 1e6),
          new anchor.BN(minY * 1e6),
        ).accountsStrict({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

        assert.fail("Should have failed with slippage error");
      } catch (error) {
        expect(error.message).to.satisfy((msg: string) =>
          msg.includes("Slippage") || msg.includes("Error")
        );
        console.log("Correctly failed when requesting more than available");
      }

      const vaultXAfter = (await provider.connection.getTokenAccountBalance(vaultX)).value.uiAmount;
      expect(vaultXAfter).to.equal(vaultXBefore);
      const vaultYAfter = (await provider.connection.getTokenAccountBalance(vaultY)).value.uiAmount;
      expect(vaultYAfter).to.equal(vaultYBefore);
    });
  });

  describe("Lock Pool", () => {
    it("Authority can lock the pool", async () => {
      await program.methods.lock(true)
        .accountsStrict({
          authority: provider.wallet.publicKey,
          config: configPda,
        })
        .rpc();

      const configAfter = await program.account.config.fetch(configPda);
      expect(configAfter.locked).to.equal(true);
      console.log("✓ Pool locked successfully");
    });

    it("Fails to deposit when pool is locked", async () => {
      const depositAmount = 10;
      await mintTo(provider.connection, provider.wallet.payer, mintX, userX, minter, depositAmount * 1e6);
      await mintTo(provider.connection, provider.wallet.payer, mintY, userY, minter, depositAmount * 1e6);

      try {
        await program.methods.deposit(
          new anchor.BN(5 * 1e6),
          new anchor.BN(depositAmount * 1e6),
          new anchor.BN(depositAmount * 1e6),
        ).accountsStrict({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

        assert.fail("Should have failed with PoolLocked");
      } catch (error) {
        expect(error.message).to.include("PoolLocked");
        console.log("✓ Correctly failed with PoolLocked");
      }
    });

    it("Authority can unlock the pool", async () => {
      await program.methods.lock(false)
        .accountsStrict({
          authority: provider.wallet.publicKey,
          config: configPda,
        })
        .rpc();

      const configAfter = await program.account.config.fetch(configPda);
      expect(configAfter.locked).to.equal(false);
      console.log("✓ Pool unlocked successfully");
    });

    it("Non-authority cannot lock the pool", async () => {
      const nonAuthority = anchor.web3.Keypair.generate();
      await provider.connection.requestAirdrop(nonAuthority.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await program.methods.lock(true)
          .accountsStrict({
            authority: nonAuthority.publicKey,
            config: configPda,
          })
          .signers([nonAuthority])
          .rpc();

        assert.fail("Should have failed with InvalidAuthority");
      } catch (error) {
        expect(error.message).to.satisfy((msg: string) =>
          msg.includes("InvalidAuthority") || msg.includes("ConstraintRaw")
        );
        console.log("✓ Correctly failed when non-authority tried to lock");
      }
    });
  });

  describe("Fee Validation", () => {
    it("Fails to initialize with fee > 100%", async () => {
      const badFee = 10001;
      const newSeed = new anchor.BN(9999);

      const [badConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newSeed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [badMintLp] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lp"), badConfigPda.toBuffer()],
        program.programId
      );

      const badVaultX = getAssociatedTokenAddressSync(mintX, badConfigPda, true);
      const badVaultY = getAssociatedTokenAddressSync(mintY, badConfigPda, true);

      try {
        await program.methods.initialize(
          newSeed,
          badFee,
          badConfigPda,
        ).accountsStrict({
          initializer: initializer.publicKey,
          mintX: mintX,
          mintY: mintY,
          mintLp: badMintLp,
          vaultX: badVaultX,
          vaultY: badVaultY,
          config: badConfigPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([initializer])
        .rpc();

        assert.fail("Should have failed with InvalidFee");
      } catch (error) {
        expect(error.message).to.include("InvalidFee");
        console.log("✓ Correctly rejected fee > 100%");
      }
    });
  });
});
