import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, AssetManagerPDA } from "./setup";
import { XcallPDA, ConnectionPDA } from "./xcall_pda";
import { TestContext as xCallManagerContext } from "../xcall_manager/setup";


import { AssetManager } from "../../target/types/asset_manager";
import { XcallManager } from "../../target/types/xcall_manager";
import { Xcall } from "../../types/xcall";
import xcallIdlJson from "../../target/idl/xcall.json";
import { CentralizedConnection } from "../../types/centralized_connection";
const connectionProgram: anchor.Program<CentralizedConnection> =
  anchor.workspace.CentralizedConnection;

const xcallIdl = xcallIdlJson as anchor.Idl;
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  Account
} from "@solana/spl-token";
import { BN } from "bn.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { TokenClass } from "typescript";


describe("asset_manager", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  const program: anchor.Program<AssetManager> = anchor.workspace.AssetManager;
  const xcall_manager_program: anchor.Program<XcallManager> = anchor.workspace.XcallManager;
  //const xcallProgramId = new anchor.web3.PublicKey("3489r9oW63a8MRk5CXD2Lv8YTFQ9iGjaXxgGnaoccPhc");
  const xcall_program =  new anchor.Program(xcallIdl, provider);

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);
  let xcallManagerCtx = new xCallManagerContext(connection, txnHelpers, wallet.payer);

  let xcallKeyPair = Keypair.generate();
  let xcallManagerKeyPair = Keypair.generate();
  let mintKeyPair: Keypair;
  let mint: PublicKey;
  let vaultTokenAccount: Account;

  beforeEach(async () => {
    mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.payer.publicKey,
      null,
      9,
      mintKeyPair,
      null,
      TOKEN_PROGRAM_ID
    );
    let vaultTokenAccountPda = AssetManagerPDA.vault(mint).pda;
    vaultTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      vaultTokenAccountPda,
      true
    );

    console.log("initialized");
  });

  it("should initialize the state properly", async () => {
    await ctx.initialize(
        xcallKeyPair.publicKey,
        "icon/hxcnjsd",
        xcallManagerKeyPair.publicKey
    );
    const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    expect(stateAccount.xcall.toString()).toBe(xcallKeyPair.publicKey.toString());
    expect(stateAccount.iconAssetManager).toBe("icon/hxcnjsd");
    expect(stateAccount.xcallManager.toString()).toBe(xcallManagerKeyPair.publicKey.toString());
    expect(stateAccount.admin.toString()).toBe( wallet.payer.publicKey.toString());
  });

  it("configure rate limit test", async() => {
      let configureIx = await program.methods
      .configureRateLimit(mint, bn(300), bn(900))
      .accountsStrict({
        admin: ctx.admin.publicKey,
        state: AssetManagerPDA.state().pda,
        tokenState: AssetManagerPDA.token_state(mint).pda,
        vaultTokenAccount: vaultTokenAccount.address,
        mint: mint,
        systemProgram: SYSTEM_PROGRAM_ID
      }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);


    await  sleep(3);
    console.log("rate limit configured");
  });

  async function setUpXcallManager(){
    let source1 = Keypair.generate();
    let source2 = Keypair.generate();
    await xcallManagerCtx.initialize(
        xcallKeyPair.publicKey,
        "icon/hxcnjsd",
        [source1.publicKey.toString(), source2.publicKey.toString()],
        ["icon/cxjkefnskdjfe", "icon/cxjdkfndjwk"]
    );
    await sleep(3);
  }

  it("deposit token", async() => {
    let mintToKeyPair = Keypair.generate();
    let mintTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      mintToKeyPair.publicKey,
      true
    );
    await  sleep(3);

    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      mintTokenAccount.address,
      wallet.payer,
      10000000000,
      [ctx.admin],
      null,
      TOKEN_PROGRAM_ID
    );
    await  sleep(3);

    console.log("xcall program id is: ", xcall_program.programId)
    await txnHelpers.airdrop(mintToKeyPair.publicKey, 5000000000);
    await  sleep(3);
    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositToken(bn(1000000000), mintTokenAccount.address.toString(), bytes)
      .accountsStrict({
        user: mintToKeyPair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        userTokenAccount: mintTokenAccount.address,
        vaultTokenAccount: vaultTokenAccount.address,
        mint: mint,
        state: AssetManagerPDA.state().pda,
        assetManager: AssetManagerPDA.asset_manager().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        xcall: xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        systemProgram: SYSTEM_PROGRAM_ID,
      }).remainingAccounts([
        {
          pubkey: XcallPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.reply().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.rollback(1).pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.defaultConnection("icx").pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: mintToKeyPair.publicKey,
          isSigner: false,
          isWritable: true,
        },
        //connection params
        {
          pubkey: connectionProgram.programId,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: ConnectionPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: ConnectionPDA.fee("icx").pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: ConnectionPDA.claimFees().pda,
          isSigner: false,
          isWritable: true,
        },
      ]).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([depositTokenIx], [mintToKeyPair]);
    //try{
      await ctx.connection.sendTransaction(tx);
    // } catch {

    // }

    console.log("deposited");
  });

  function bn(number: number){
    return new anchor.BN(number);
  }
  
});
