import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, AssetManagerPDA } from "./setup";
import { XcallPDA, ConnectionPDA } from "../utils/xcall_pda";
import { TestContext as xCallManagerContext } from "../axcall_manager/setup";


import { AssetManager } from "../../target/types/asset_manager";
import { XcallManager } from "../../target/types/xcall_manager";
//import { Xcall } from "../../types/xcall";
//import xcallIdlJson from "../../types/xcall.json";
//import { CentralizedConnection } from "../../types/centralized_connection";
// const connectionProgram: anchor.Program<CentralizedConnection> =
//   anchor.workspace.CentralizedConnection;
import * as rlp from 'rlp';

//const xcallIdl = xcallIdlJson as anchor.Idl;
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  Account
} from "@solana/spl-token";
import { BN, min } from "bn.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";


describe("xx asset manager test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  const program: anchor.Program<AssetManager> = anchor.workspace.AssetManager;
  const xcall_manager_program: anchor.Program<XcallManager> = anchor.workspace.XcallManager;
  //const xcall_program =  new anchor.Program(xcallIdl, provider);

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
      9
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
      SYSTEM_PROGRAM_ID,//xcallKeyPair.publicKey,
      "icon/hxcnjsd",
      xcallManagerKeyPair.publicKey,
      AssetManagerPDA.xcall_manager_state().pda
    );
    const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    expect(stateAccount.xcall.toString()).toBe(SYSTEM_PROGRAM_ID.toString());
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
    let depositorKeyPair = Keypair.generate();
    let depositorTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      depositorKeyPair.publicKey,
      true
    );
    await  sleep(3);

    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      depositorTokenAccount.address,
      wallet.payer,
      10000000000,
      [ctx.admin],
      null,
      TOKEN_PROGRAM_ID
    );
    await  sleep(3);

    //console.log("xcall program id is: ", xcall_program.programId)
    await txnHelpers.airdrop(depositorKeyPair.publicKey, 5000000000);
    await  sleep(3);
    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositToken(bn(1000000000), depositorTokenAccount.address.toString(), bytes)
      .accountsStrict({
        from: depositorTokenAccount.address,
        vaultNativeAccount: null,
        fromAuthority: depositorKeyPair.publicKey,
        vaultTokenAccount: vaultTokenAccount.address,
        state: AssetManagerPDA.state().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        assetManager: AssetManagerPDA.asset_manager().pda,
        xcall: xcall_manager_program.programId,//xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
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
          pubkey: depositorKeyPair.publicKey,
          isSigner: false,
          isWritable: true,
        },
        //connection params
        {
          pubkey: xcall_manager_program.programId,
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
    let tx = await ctx.txnHelpers.buildV0Txn([depositTokenIx], [depositorKeyPair]);
    await ctx.connection.sendTransaction(tx);

    console.log("deposited");
  });

  it("deposit native token", async() => {
    let depositorKeyPair = Keypair.generate();
    //console.log("xcall program id is: ", xcall_program.programId)
    await txnHelpers.airdrop(depositorKeyPair.publicKey, 5000000000);
    await  sleep(3);
    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositNative(bn(1000000000), depositorKeyPair.publicKey.toString(), bytes)
      .accountsStrict({
        from: null,
        fromAuthority: depositorKeyPair.publicKey,
        vaultTokenAccount: null,
        vaultNativeAccount: AssetManagerPDA.vault_native().pda,
        state: AssetManagerPDA.state().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        assetManager: AssetManagerPDA.asset_manager().pda,
        xcall: xcall_manager_program.programId,//xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        tokenProgram: null,
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
          pubkey: depositorKeyPair.publicKey,
          isSigner: false,
          isWritable: true,
        },
        //connection params
        {
          pubkey: xcall_manager_program.programId,
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
    let tx = await ctx.txnHelpers.buildV0Txn([depositTokenIx], [depositorKeyPair]);
    await ctx.connection.sendTransaction(tx);

    console.log("deposited");
});

  function bn(number: number){
    return new BN(number);
  }

  it("Handle call message", async() => {
    let withdrawerKeyPair = Keypair.generate();
    let withdrawerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      withdrawerKeyPair.publicKey,
      true
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      vaultTokenAccount.address,
      wallet.payer,
      100000000000,
      [ctx.admin],
      null,
      TOKEN_PROGRAM_ID
    );
    await  sleep(3);
    await txnHelpers.airdrop(vaultTokenAccount.address, 5000000000);
    await  sleep(3);
    const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    let iconAssetManager = stateAccount.iconAssetManager;
    const data = ["WithdrawTo", mint.toString(), withdrawerTokenAccount.address.toString(), 1000000000];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(AssetManagerPDA.xcall_manager_state().pda);
    let configureIx = await program.methods
    .handleCallMessage(iconAssetManager, Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      to: withdrawerTokenAccount.address,
      toNative: null,
      vaultNativeAccount: null,
      state: AssetManagerPDA.state().pda,
      vaultTokenAccount: vaultTokenAccount.address,
      valultAuthority: AssetManagerPDA.vault(mint).pda,
      xcallManager: xcall_manager_program.programId,
      mint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      xcall: xcall_manager_program.programId,
      xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
      systemProgram: SYSTEM_PROGRAM_ID
    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);

    let sig = await ctx.connection.sendTransaction(tx);
    //await txnHelpers.logParsedTx(sig);
    await  sleep(3);
    console.log("handle call message asset manager");
  });

  it("Handle call message revert deposit token", async() => {
    let withdrawerKeyPair = Keypair.generate();
    let withdrawerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      withdrawerKeyPair.publicKey,
      true
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      vaultTokenAccount.address,
      wallet.payer,
      100000000000,
      [ctx.admin],
      null,
      TOKEN_PROGRAM_ID
    );
    await  sleep(3);
    await txnHelpers.airdrop(vaultTokenAccount.address, 5000000000);
    await  sleep(3);
    const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    let iconAssetManager = stateAccount.iconAssetManager;
    const data = ["DepositRevert", mint.toString(), withdrawerTokenAccount.address.toString(), 1000000000];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(AssetManagerPDA.xcall_manager_state().pda);
    let configureIx = await program.methods
    .handleCallMessage(SYSTEM_PROGRAM_ID.toString(), Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      to: withdrawerTokenAccount.address,
      toNative: null,
      vaultNativeAccount: null,
      state: AssetManagerPDA.state().pda,
      vaultTokenAccount: vaultTokenAccount.address,
      valultAuthority: AssetManagerPDA.vault(mint).pda,
      xcallManager: xcall_manager_program.programId,
      mint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      xcall: xcall_manager_program.programId,
      xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
      systemProgram: SYSTEM_PROGRAM_ID
    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);

    let sig = await ctx.connection.sendTransaction(tx);
    //await txnHelpers.logParsedTx(sig);
    await  sleep(3);
    console.log("handle call message asset manager");
  });

  it("Handle call message native", async() => {
    let withdrawerKeyPair = Keypair.generate();
    let vaultNativeAccount = AssetManagerPDA.vault_native().pda;
    await  sleep(3);
    await txnHelpers.airdrop(vaultNativeAccount, 5000000000);
    await  sleep(3);
    const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    let iconAssetManager = stateAccount.iconAssetManager;
    const data = ["WithdrawNativeTo", "11111111111111111111111111111111", withdrawerKeyPair.publicKey.toString(), 1000000000];
    const rlpEncodedData = rlp.encode(data);
    console.log("vault native account js", vaultNativeAccount);
    console.log("bump js is: ", AssetManagerPDA.vault_native().bump );
    let protocols = xcall_manager_program.account.xmState.fetch(AssetManagerPDA.xcall_manager_state().pda);
    let configureIx = await program.methods
    .handleCallMessage(iconAssetManager, Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      to: null,
      toNative: withdrawerKeyPair.publicKey,
      state: AssetManagerPDA.state().pda,
      vaultTokenAccount: null,
      vaultNativeAccount: vaultNativeAccount,
      valultAuthority: null,
      xcallManager: xcall_manager_program.programId,
      mint: null,
      tokenProgram: null,
      xcall: xcall_manager_program.programId,
      xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
      systemProgram: SYSTEM_PROGRAM_ID

    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await  sleep(3);
    console.log("handle call message asset manager native");
  });

  it("Handle call message native revert", async() => {
    let withdrawerKeyPair = Keypair.generate();
    //let nativeValultAuthority = Keypair.generate();
    let vaultNativetoken = AssetManagerPDA.vault_native().pda;
    await  sleep(3);
    await txnHelpers.airdrop(vaultNativetoken, 5000000000);
    await  sleep(3);
    // const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    // let iconAssetManager = stateAccount.iconAssetManager;
    const data = ["DepositRevert", "11111111111111111111111111111111", withdrawerKeyPair.publicKey.toString(), 1000000000];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(AssetManagerPDA.xcall_manager_state().pda);
    let configureIx = await program.methods
    .handleCallMessage(SYSTEM_PROGRAM_ID.toString(), Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      to: null,
      toNative: withdrawerKeyPair.publicKey,
      state: AssetManagerPDA.state().pda,
      vaultTokenAccount: null,
      vaultNativeAccount: vaultNativetoken,
      valultAuthority: null,
      xcallManager: xcall_manager_program.programId,
      mint: null,
      tokenProgram: null,
      xcall: xcall_manager_program.programId,
      xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
      systemProgram: SYSTEM_PROGRAM_ID
    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await  sleep(3);
    console.log("handle call message asset manager native");
  });
  
});
