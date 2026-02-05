import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createMint, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";


describe("anchor-amm-q4-25", () => {
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;
  const initializer = anchor.web3.Keypair.generate();

  const user = anchor.web3.Keypair.generate();
  const minter = provider.wallet.publicKey;
  let configPda = provider.wallet.publicKey;
  let configBump: number;

  let mintLp: anchor.web3.PublicKey;
  let mintLpBump: number;
  
  let mintX: anchor.web3.PublicKey;
  let mintY: anchor.web3.PublicKey;

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

    vaultX = getAssociatedTokenAddressSync(mintX, configPda, true);
    vaultY = getAssociatedTokenAddressSync(mintY, configPda, true);
  })

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize(
      seed,
      fee,
      configPda,
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
  
    console.log("Your transaction signature", tx);

    const configAccount = await program.account.config.fetch(configPda);
    console.log(configAccount);

    expect(configAccount.authority.toBase58()).to.equal(configPda.toBase58());
    expect(configAccount.mintX.toBase58()).to.equal(mintX.toBase58());
    expect(configAccount.mintY.toBase58()).to.equal(mintY.toBase58());
    expect(configAccount.fee).to.equal(fee);
    expect(configAccount.locked).to.equal(false);
    expect(configAccount.configBump).to.equal(configBump);
    expect(configAccount.lpBump).to.equal(mintLpBump);
    expect(configAccount.seed.toNumber()).to.equal(seed.toNumber());
  });
});
