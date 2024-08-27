import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, AssetManagerPDA } from "./setup";
import { TestContext as xCallManagerContext } from "../axcall_manager/setup";

import { AssetManager } from "../../target/types/asset_manager";
import { XcallManager } from "../../target/types/xcall_manager";
import * as rlp from "rlp";

import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  Account,
} from "@solana/spl-token";
import { BN, min } from "bn.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

import { Xcall } from "../../types/xcall";
import { CentralizedConnection } from "../../types/centralized_connection";
import connectionIdlJson from "../../target/idl/centralized_connection.json";
const connectionProgram: anchor.Program<CentralizedConnection> =
  new anchor.Program(
    connectionIdlJson as anchor.Idl,
    provider
  ) as unknown as anchor.Program<CentralizedConnection>;
import xcallIdlJson from "../../target/idl/xcall.json";
const xcallProgram: anchor.Program<Xcall> = new anchor.Program(
  xcallIdlJson as anchor.Idl,
  provider
) as unknown as anchor.Program<Xcall>;
import {
  CSMessage,
  CSMessageRequest,
  CSMessageResult,
  CSMessageType,
  CSResponseType,
  MessageType,
} from "../utils/types";
import { TestContext as XcallContext, XcallPDA } from "../xcall/xcall/setup";
import {
  TestContext as ConnectionContext,
  ConnectionPDA,
} from "../xcall/centralized_connection/setup";

describe("xx asset manager test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection; // new Connection("http://127.0.0.1:8899", "confirmed");
  const wallet = provider.wallet as anchor.Wallet;
  const program: anchor.Program<AssetManager> = anchor.workspace.AssetManager;
  const xcall_manager_program: anchor.Program<XcallManager> =
    anchor.workspace.XcallManager;
  const xcall_program: anchor.Program<Xcall> = anchor.workspace.Xcall;

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);
  let xcallManagerCtx = new xCallManagerContext(
    connection,
    txnHelpers,
    wallet.payer
  );
  let xcallCtx = new XcallContext(connection, txnHelpers, wallet.payer);
  let connectionCtx = new ConnectionContext(
    connection,
    txnHelpers,
    wallet.payer
  );
  let iconAssetManager = "icon/hxcnjsdkdfgjdjuf";

  let testAdmin = Keypair.generate();
  let mint: PublicKey;
  let vaultTokenAccount: Account;
  let depositorKeyPair = Keypair.generate();
  let depositorTokenAccount: Account;
  let nativeDepositor = Keypair.generate();

  beforeAll(async () => {
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
      xcall_program.programId, //xcallKeyPair.publicKey,
      iconAssetManager,
      xcall_manager_program.programId,
      AssetManagerPDA.xcall_manager_state().pda
    );
    const stateAccount = await program.account.state.fetch(
      AssetManagerPDA.state().pda
    );
    expect(stateAccount.xcall.toString()).toBe(
      xcall_program.programId.toString()
    );
    expect(stateAccount.iconAssetManager).toBe(iconAssetManager);
    expect(stateAccount.xcallManager.toString()).toBe(
      xcall_manager_program.programId.toString()
    );
    expect(stateAccount.admin.toString()).toBe(
      wallet.payer.publicKey.toString()
    );
  });

  it("set admin test", async () => {
    await txnHelpers.airdrop(testAdmin.publicKey, 5000000000);
    let configureIx = await program.methods
      .setAdmin(testAdmin.publicKey)
      .accountsStrict({
        state: AssetManagerPDA.state().pda,
        admin: ctx.admin.publicKey
      })
      .instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3)
    const stateAccount = await program.account.state.fetch(
      AssetManagerPDA.state().pda
    );
    console.log(stateAccount.admin)

    let setAdminTx = await program.methods
      .setAdmin(ctx.admin.publicKey)
      .accountsStrict({
        state: AssetManagerPDA.state().pda,
        admin: testAdmin.publicKey
      })
      .instruction();
    let adminTx = await ctx.txnHelpers.buildV0Txn([setAdminTx], [testAdmin]);
    await ctx.connection.sendTransaction(adminTx);
    await sleep(5);
    const updatedStateAccount = await program.account.state.fetch(
      AssetManagerPDA.state().pda
    );
    console.log(updatedStateAccount.admin)
  });

  it("configure rate limit test", async () => {
    let configureIx = await program.methods
      .configureRateLimit(mint, bn(300), bn(900))
      .accountsStrict({
        admin: ctx.admin.publicKey,
        state: AssetManagerPDA.state().pda,
        tokenState: AssetManagerPDA.token_state(mint).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);

    await sleep(3);
    console.log("rate limit configured");

    let withdraw_limit = await program.methods.
      getWithdrawLimit()
      .accounts({
        tokenState: AssetManagerPDA.token_state(mint).pda,
        vaultTokenAccount: vaultTokenAccount.address
      }).view();
    console.log("initial withdraw limit: ", withdraw_limit )
    expect(withdraw_limit.toNumber()).toBe(0);
  });

  it("configure rate limit for native token test", async () => {
    let native_token = new PublicKey("11111111111111111111111111111111")
    let configureIx = await program.methods
      .configureRateLimit(native_token, bn(300), bn(900))
      .accountsStrict({
        admin: ctx.admin.publicKey,
        state: AssetManagerPDA.state().pda,
        tokenState: AssetManagerPDA.token_state(native_token).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);

    await sleep(3);
    console.log("rate limit configured");
  });

  it("deposit token", async () => {
    let { pda } = XcallPDA.config();
    let xcall_config = await xcall_program.account.config.fetch(pda);
    
    depositorTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      depositorKeyPair.publicKey,
      true
    );
    await sleep(3);

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
    await sleep(3);

    //console.log("xcall program id is: ", xcall_program.programId)
    await txnHelpers.airdrop(depositorKeyPair.publicKey, 5000000000);
    await sleep(3);
    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositToken(
        bn(1000000000),
        depositorTokenAccount.address.toString(),
        bytes
      )
      .accountsStrict({
        from: depositorTokenAccount.address,
        vaultNativeAccount: null,
        fromAuthority: depositorKeyPair.publicKey,
        vaultTokenAccount: vaultTokenAccount.address,
        state: AssetManagerPDA.state().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        xcallConfig: XcallPDA.config().pda,
        xcall: xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: AssetManagerPDA.xcall_authority().pda,
      })
      .remainingAccounts([
        {
          pubkey: XcallPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.rollback(xcall_config.sequenceNo.toNumber() + 1).pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: xcall_config.feeHandler,
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
          pubkey: ConnectionPDA.network_fee("icon").pda,
          isSigner: false,
          isWritable: true,
        },
        
      ])
      .instruction();
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000,
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 0,
    });
    let tx = await ctx.txnHelpers.buildV0Txn(
      [modifyComputeUnits, addPriorityFee, depositTokenIx],
      [depositorKeyPair]
    );
    let txHash = await ctx.connection.sendTransaction(tx);
    await txnHelpers.logParsedTx(txHash);
    console.log("deposited");
  });

  it("get withdraw limit test", async() => {
    let withdraw_limit = await program.methods.
      getWithdrawLimit()
      .accounts({
        tokenState: AssetManagerPDA.token_state(mint).pda,
        vaultTokenAccount: vaultTokenAccount.address
      }).view();
    console.log("initial withdraw limit: ", withdraw_limit )
    expect(withdraw_limit.toNumber()).toBeGreaterThan(0);
  });


  it("deposit native token", async () => {
    let { pda } = XcallPDA.config();
    let xcall_config = await xcall_program.account.config.fetch(pda);
    
    await txnHelpers.airdrop(nativeDepositor.publicKey, 5000000000);
    // Check the balance to ensure it has been funded
    const initialBalance = await provider.connection.getBalance(
      nativeDepositor.publicKey
    );
    expect(initialBalance > 0).toBe(true);

    await sleep(3);
    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositNative(
        bn(1000000000),
        nativeDepositor.publicKey.toString(),
        bytes
      )
      .accountsStrict({
        from: null,
        fromAuthority: nativeDepositor.publicKey,
        vaultTokenAccount: null,
        vaultNativeAccount: AssetManagerPDA.vault_native().pda,
        state: AssetManagerPDA.state().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        xcallConfig: XcallPDA.config().pda,
        xcall: xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        tokenProgram: null,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: AssetManagerPDA.xcall_authority().pda,
      })
      .remainingAccounts([
        {
          pubkey: XcallPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.rollback(xcall_config.sequenceNo.toNumber() + 1).pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: xcall_config.feeHandler,
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
          pubkey: ConnectionPDA.network_fee("icon").pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000,
      });
  
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 0,
      });
    let tx = await ctx.txnHelpers.buildV0Txn(
      [modifyComputeUnits, addPriorityFee, depositTokenIx],
      [nativeDepositor]
    );
    let txHash = await ctx.connection.sendTransaction(tx);
    await txnHelpers.logParsedTx(txHash);
    console.log("native deposited");
  });

  function bn(number: number) {
    return new BN(number);
  }

  it("test handle call message complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 8;
    const fromNetwork = "icon";
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    //const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    let withdrawerKeyPair = Keypair.generate();
    let withdrawerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      withdrawerKeyPair.publicKey,
      true
    );
    let sender = Keypair.generate();
    const data = [
      "WithdrawTo",
      mint.toString(),
      withdrawerTokenAccount.address.toString(),
      1000000000,
    ];
    const rlpEncodedData = rlp.encode(data);
    console.log("data encoded");

    let request = new CSMessageRequest(
      iconAssetManager,
      program.programId.toString(),
      nextSequenceNo,
      MessageType.CallMessageWithRollback,
      Buffer.from(rlpEncodedData),
      [connectionProgram.programId.toString()]
    );

    let cs_message = new CSMessage(
      CSMessageType.CSMessageRequest,
      request.encode()
    ).encode();

    let recvMessageAccounts = await connectionCtx.getRecvMessageAccounts(
      connSn,
      nextSequenceNo,
      cs_message,
      CSMessageType.CSMessageRequest
    );

    await connectionProgram.methods
      .recvMessage(
        fromNetwork,
        new anchor.BN(connSn),
        Buffer.from(cs_message),
        new anchor.BN(nextSequenceNo)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNetwork, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda
      })
      .remainingAccounts([...recvMessageAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
    console.log("receive message complete");
    await sleep(2);
    // call xcall execute_call
    let executeCallAccounts = await xcallCtx.getExecuteCallAccounts(
      nextReqId,
      Buffer.from(rlpEncodedData),
      AssetManagerPDA.state().pda,
      program.programId
    );

    let txHash = await xcallProgram.methods
      .executeCall(
        new anchor.BN(nextReqId),
        Buffer.from(rlpEncodedData),
      )
      .accounts({
        signer: ctx.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: XcallPDA.config().pda,
        admin: xcallConfig.admin,
        proxyRequest: XcallPDA.proxyRequest(nextReqId).pda,
      })
      .remainingAccounts([
        // ACCOUNTS TO CALL CONNECTION SEND_MESSAGE
        ...executeCallAccounts.slice(4),
      ])
      .signers([ctx.admin])
      .rpc();

      await txnHelpers.logParsedTx(txHash);
  });

  it("test handle call message rollback complete flow with xcall", async () => {
    let { pda } = XcallPDA.config();
    let xcall_config = await xcall_program.account.config.fetch(pda);
    let xcall_sequence_no = xcall_config.sequenceNo.toNumber() + 1
    

    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositToken(
        bn(1000000000),
        depositorTokenAccount.address.toString(),
        bytes
      )
      .accountsStrict({
        from: depositorTokenAccount.address,
        vaultNativeAccount: null,
        fromAuthority: depositorKeyPair.publicKey,
        vaultTokenAccount: vaultTokenAccount.address,
        state: AssetManagerPDA.state().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        xcallConfig: XcallPDA.config().pda,
        xcall: xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: AssetManagerPDA.xcall_authority().pda,
      })
      .remainingAccounts([
        {
          pubkey: XcallPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.rollback(xcall_sequence_no).pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: xcall_config.feeHandler,
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
          pubkey: ConnectionPDA.network_fee("icon").pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000,
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 0,
    });
    let tx = await ctx.txnHelpers.buildV0Txn(
      [modifyComputeUnits, addPriorityFee, depositTokenIx],
      [depositorKeyPair]
    );
    let depositTxHash = await ctx.connection.sendTransaction(tx);
    await txnHelpers.logParsedTx(depositTxHash);
    

    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 9;
    const fromNetwork = "icon";
    console.log("spl token rollback")

    let result = new CSMessageResult(
      xcall_sequence_no,
      CSResponseType.CSMessageFailure,
      new Uint8Array([])
    );
    let csMessage = new CSMessage(
      CSMessageType.CSMessageResult,
      result.encode()
    ).encode();

    let recvMessageAccounts = await connectionCtx.getRecvMessageAccounts(
      connSn,
      xcall_sequence_no,
      csMessage,
      CSMessageType.CSMessageResult
    );

    await connectionProgram.methods
      .recvMessage(
        fromNetwork,
        new anchor.BN(connSn),
        Buffer.from(csMessage),
        new anchor.BN(xcall_sequence_no)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNetwork, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda
      })
      .remainingAccounts([...recvMessageAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
    console.log("rollback receive message complete");
    await sleep(2);
    // call xcall execute_call
      let executeRollbackAccounts = await xcallCtx.getExecuteRollbackAccounts(
        xcall_sequence_no,
        AssetManagerPDA.state().pda,
        program.programId
      );

      let txHash = await xcallProgram.methods
        .executeRollback(
          new anchor.BN(xcall_sequence_no),
        )
        .accounts({
          signer: ctx.admin.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
          config: XcallPDA.config().pda,
          admin: xcallConfig.admin,
          rollbackAccount: XcallPDA.rollback(xcall_sequence_no).pda,
        })
        .remainingAccounts([
          // ACCOUNTS TO CALL CONNECTION SEND_MESSAGE
          ...executeRollbackAccounts.slice(4),
        ])
        .signers([ctx.admin])
        .rpc();
        await sleep(3)
        await txnHelpers.logParsedTx(txHash);
    
  });

  it("test handle call message for native token complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 10;
    const fromNetwork = "icon";
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    //const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    let withdrawerKeyPair = Keypair.generate();

    const data = [
      "WithdrawNativeTo",
      "11111111111111111111111111111111",
      withdrawerKeyPair.publicKey.toString(),
      1000000000,
    ];
    const rlpEncodedData = rlp.encode(data);
    console.log("encoded for native");
    let request = new CSMessageRequest(
      iconAssetManager,
      program.programId.toString(),
      nextSequenceNo,
      MessageType.CallMessageWithRollback,
      Buffer.from(rlpEncodedData),
      [connectionProgram.programId.toString()]
    );

    let cs_message = new CSMessage(
      CSMessageType.CSMessageRequest,
      request.encode()
    ).encode();

    let recvMessageAccounts = await connectionCtx.getRecvMessageAccounts(
      connSn,
      nextSequenceNo,
      cs_message,
      CSMessageType.CSMessageRequest
    );
    console.log("receive message accounts: ", recvMessageAccounts);
    await connectionProgram.methods
      .recvMessage(
        fromNetwork,
        new anchor.BN(connSn),
        Buffer.from(cs_message),
        new anchor.BN(nextSequenceNo)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNetwork, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda
      })
      .remainingAccounts([...recvMessageAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
    console.log("receive message complete");
    await sleep(2);
    // call xcall execute_call
    let executeCallAccounts = await xcallCtx.getExecuteCallAccounts(
      nextReqId,
      Buffer.from(rlpEncodedData),
      AssetManagerPDA.state().pda,
      program.programId
    );
    console.log("execute call accounts: ", executeCallAccounts);
    let txHash = await xcallProgram.methods
      .executeCall(
        new anchor.BN(nextReqId),
        Buffer.from(rlpEncodedData),
      )
      .accounts({
        signer: ctx.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: XcallPDA.config().pda,
        admin: xcallConfig.admin,
        proxyRequest: XcallPDA.proxyRequest(nextReqId).pda,
      })
      .remainingAccounts([
        // ACCOUNTS TO CALL CONNECTION SEND_MESSAGE
        ...executeCallAccounts.slice(4),
      ])
      .signers([ctx.admin])
      .rpc();
      await txnHelpers.logParsedTx(txHash);
  });

  it("test handle call message for native token rollback complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 11;
    const fromNetwork = "icon";
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    let bytes = Buffer.alloc(0);
    let depositTokenIx = await program.methods
      .depositNative(
        bn(1000000000),
        nativeDepositor.publicKey.toString(),
        bytes
      )
      .accountsStrict({
        from: null,
        fromAuthority: nativeDepositor.publicKey,
        vaultTokenAccount: null,
        vaultNativeAccount: AssetManagerPDA.vault_native().pda,
        state: AssetManagerPDA.state().pda,
        xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
        xcallConfig: XcallPDA.config().pda,
        xcall: xcall_program.programId,
        xcallManager: xcall_manager_program.programId,
        tokenProgram: null,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: AssetManagerPDA.xcall_authority().pda,
      })
      .remainingAccounts([
        {
          pubkey: XcallPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.rollback(nextSequenceNo).pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: xcallConfig.feeHandler,
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
          pubkey: ConnectionPDA.network_fee("icon").pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000,
      });
  
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 0,
      });
    let tx = await ctx.txnHelpers.buildV0Txn(
      [modifyComputeUnits, addPriorityFee, depositTokenIx],
      [nativeDepositor]
    );
    let txHash = await ctx.connection.sendTransaction(tx);
    await txnHelpers.logParsedTx(txHash);

    let result = new CSMessageResult(
      nextSequenceNo,
      CSResponseType.CSMessageFailure,
      new Uint8Array([])
    );
    let csMessage = new CSMessage(
      CSMessageType.CSMessageResult,
      result.encode()
    ).encode();
      let recvMessageAccounts = await connectionCtx.getRecvMessageAccounts(
        connSn,
        nextSequenceNo,
        csMessage,
        CSMessageType.CSMessageResult
      );
      console.log("receive message accounts: ", recvMessageAccounts);
      await connectionProgram.methods
        .recvMessage(
          fromNetwork,
          new anchor.BN(connSn),
          Buffer.from(csMessage),
          new anchor.BN(nextSequenceNo)
        )
        .accountsStrict({
          config: ConnectionPDA.config().pda,
          admin: ctx.admin.publicKey,
          receipt: ConnectionPDA.receipt(fromNetwork, connSn).pda,
          systemProgram: SYSTEM_PROGRAM_ID,
          authority: ConnectionPDA.authority().pda
        })
        .remainingAccounts([...recvMessageAccounts.slice(4)])
        .signers([ctx.admin])
        .rpc();
      console.log("receive message complete");
      await sleep(2);
      // call xcall execute_call
      
        let executeRollbackAccounts = await xcallCtx.getExecuteRollbackAccounts(
          nextSequenceNo,
          AssetManagerPDA.state().pda,
          program.programId
        );
      
      console.log("execute call accounts: ", executeRollbackAccounts);
      let rollbackTxHash = await xcallProgram.methods
        .executeRollback(
          new anchor.BN(nextSequenceNo),
        )
        .accounts({
          signer: ctx.admin.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
          config: XcallPDA.config().pda,
          admin: xcallConfig.admin,
          rollbackAccount: XcallPDA.rollback(nextSequenceNo).pda,
        })
        .remainingAccounts([
          // ACCOUNTS TO CALL CONNECTION SEND_MESSAGE
          ...executeRollbackAccounts.slice(4),
        ])
        .signers([ctx.admin])
        .rpc();
        await txnHelpers.logParsedTx(rollbackTxHash);
      
  });

  it("test handle force rollback complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 12;
    const fromNetwork = "icon";
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    //const stateAccount = await program.account.state.fetch(AssetManagerPDA.state().pda);
    let withdrawerKeyPair = Keypair.generate();
    let withdrawerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      withdrawerKeyPair.publicKey,
      true
    );
    const data = [
      "WithdrawTo",
      mint.toString(),
      withdrawerTokenAccount.address.toString(),
      1000000000,
    ];
    const rlpEncodedData = rlp.encode(data);
    console.log("data encoded");

    let request = new CSMessageRequest(
      iconAssetManager,
      program.programId.toString(),
      nextSequenceNo,
      MessageType.CallMessageWithRollback,
      Buffer.from(rlpEncodedData),
      [connectionProgram.programId.toString()]
    );

    let cs_message = new CSMessage(
      CSMessageType.CSMessageRequest,
      request.encode()
    ).encode();

    let recvMessageAccounts = await connectionCtx.getRecvMessageAccounts(
      connSn,
      nextSequenceNo,
      cs_message,
      CSMessageType.CSMessageRequest
    );

    await connectionProgram.methods
      .recvMessage(
        fromNetwork,
        new anchor.BN(connSn),
        Buffer.from(cs_message),
        new anchor.BN(nextSequenceNo)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNetwork, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda
      })
      .remainingAccounts([...recvMessageAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
    console.log("receive message complete");
    await sleep(2);
    
    let forceRollbackIx = await program.methods
      .forceRollback(
        new anchor.BN(nextReqId)
      )
      .accountsStrict({
        state: AssetManagerPDA.state().pda,
        xcall: xcall_program.programId,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: AssetManagerPDA.xcall_authority().pda,
        signer: ctx.admin.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: XcallPDA.proxyRequest(nextReqId).pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: XcallPDA.config().pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: ctx.admin.publicKey,
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
          pubkey: ConnectionPDA.network_fee("icon").pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000,
      });
  
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 0,
      });
    let tx = await ctx.txnHelpers.buildV0Txn(
      [modifyComputeUnits, addPriorityFee, forceRollbackIx],
      [ctx.admin]
    );
      let txHash = await ctx.connection.sendTransaction(tx);
      await txnHelpers.logParsedTx(txHash);
  });

});
