import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import * as rlp from "rlp";

import { BalancedDollar } from "../../target/types/balanced_dollar";
import { XcallManager } from "../../target/types/xcall_manager";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, BalancedDollarPDA } from "./setup";
const program: anchor.Program<BalancedDollar> = anchor.workspace.BalancedDollar;
const xcall_manager_program: anchor.Program<XcallManager> =
  anchor.workspace.XcallManager;
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  Account,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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

describe("balanced dollar manager", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection; //new Connection("http://127.0.0.1:8899", "confirmed");
  const wallet = provider.wallet as anchor.Wallet;

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);
  let xcallCtx = new XcallContext(connection, txnHelpers, wallet.payer);
  let connectionCtx = new ConnectionContext(
    connection,
    txnHelpers,
    wallet.payer
  );
  const xcall_program: anchor.Program<Xcall> = anchor.workspace.Xcall;
  let iconBnUSD = "icon/hxcnjsdkdfgj";

  let mint: PublicKey;
  let program_authority = BalancedDollarPDA.program_authority();
  let withdrawerKeyPair = Keypair.generate();
  let withdrawerTokenAccount: Account;
  let testAdmin = Keypair.generate();

  beforeAll(async () => {
    mint = await createMint(
      provider.connection,
      wallet.payer,
      program_authority.pda,
      null,
      9
    );
    console.log("mint");
    withdrawerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      withdrawerKeyPair.publicKey,
      true
    );
  });

  it("should initialize the state properly", async () => {
    await ctx.initialize(
      xcallProgram.programId,
      iconBnUSD,
      xcall_manager_program.programId,
      mint,
      BalancedDollarPDA.xcall_manager_state().pda
    );
    const stateAccount = await program.account.state.fetch(
      BalancedDollarPDA.state().pda
    );
    expect(stateAccount.xcall.toString()).toBe(
      xcallProgram.programId.toString()
    );
    expect(stateAccount.iconBnUsd).toBe(iconBnUSD);
    expect(stateAccount.xcallManager.toString()).toBe(
      xcall_manager_program.programId.toString()
    );
    expect(stateAccount.bnUsdToken.toString()).toBe(mint.toString());
  });

  // it("set admin test", async () => {
  //   await txnHelpers.airdrop(testAdmin.publicKey, 5000000000);
  //   let configureIx = await program.methods
  //     .setAdmin(testAdmin.publicKey)
  //     .accountsStrict({
  //       state: BalancedDollarPDA.state().pda,
  //       admin: ctx.admin.publicKey
  //     })
  //     .instruction();
  //   let tx = await ctx.txnHelpers.buildV0Txn([configureIx], [ctx.admin]);
  //   await ctx.connection.sendTransaction(tx);
  //   await sleep(3)
  //   const stateAccount = await program.account.state.fetch(
  //     BalancedDollarPDA.state().pda
  //   );
  //   console.log(stateAccount.admin)

  //   let setAdminTx = await program.methods
  //     .setAdmin(ctx.admin.publicKey)
  //     .accountsStrict({
  //       state: BalancedDollarPDA.state().pda,
  //       admin: testAdmin.publicKey
  //     })
  //     .instruction();
  //   let adminTx = await ctx.txnHelpers.buildV0Txn([setAdminTx], [testAdmin]);
  //   await ctx.connection.sendTransaction(adminTx);
  //   await sleep(5);
  //   const updatedStateAccount = await program.account.state.fetch(
  //     BalancedDollarPDA.state().pda
  //   );
  //   console.log(updatedStateAccount.admin)
  // });

  it("test handle call message complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 6;
    const fromNetwork = "icon";
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    const stateAccount = await program.account.state.fetch(
      BalancedDollarPDA.state().pda
    );
    let iconBnUsd = stateAccount.iconBnUsd;
    let bytes = Buffer.alloc(0);
    let sender = Keypair.generate();
    const data = [
      "xCrossTransfer",
      sender.publicKey.toString(),
      "solana/" + withdrawerTokenAccount.address.toString(),
      20000000000000000000n,
      bytes,
    ];
    const rlpEncodedData = rlp.encode(data);

    let request = new CSMessageRequest(
      iconBnUSD,
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

    await sleep(2);
    // call xcall execute_call
    let executeCallAccounts = await xcallCtx.getExecuteCallAccounts(
      nextReqId,
      Buffer.from(rlpEncodedData),
      BalancedDollarPDA.state().pda,
      program.programId
    );
    await xcallProgram.methods
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
  });

  it("test handle call message revert complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 7;
    const fromNetwork = "icon";
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;
    let crossTransferTx = await program.methods
      .crossTransfer("", new anchor.BN(1000000000000000000), Buffer.alloc(0))
      .accountsStrict({
        from: withdrawerTokenAccount.address,
        fromAuthority: withdrawerKeyPair.publicKey,
        state: BalancedDollarPDA.state().pda,
        mint: mint,
        xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda,
        xcallConfig: XcallPDA.config().pda,
        xcall: xcall_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: BalancedDollarPDA.xcall_authority().pda,
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
    let tx = await ctx.txnHelpers.buildV0Txn(
      [crossTransferTx],
      [withdrawerKeyPair]
    );

    try{
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

    await sleep(2);
    // call xcall execute_call
    let executeRollbackAccounts = await xcallCtx.getExecuteRollbackAccounts(
      nextReqId,
      BalancedDollarPDA.state().pda,
      program.programId
    );
    await xcallProgram.methods
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
    } catch (e){
      console.log(e);
    }
  });

  it("cross transfer test", async () => {
    const tokenAccountInfo = await connection.getTokenAccountBalance(
      withdrawerTokenAccount.address
    );
    let { pda } = XcallPDA.config();
    let xcall_config = await xcall_program.account.config.fetch(pda);
    let balance = tokenAccountInfo.value.amount;
    console.log("balanced of withdrawer: {}", balance);
    expect(balance).toBe("20000000000");
    await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
    await sleep(3);
    let bytes = Buffer.alloc(0);
    let crossTransferTx = await program.methods
      .crossTransfer("",new anchor.BN(1000000000000000897), bytes)
      .accountsStrict({
        from: withdrawerTokenAccount.address,
        fromAuthority: withdrawerKeyPair.publicKey,
        state: BalancedDollarPDA.state().pda,
        mint: mint,
        xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda,
        xcallConfig: XcallPDA.config().pda,
        xcall: xcall_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: BalancedDollarPDA.xcall_authority().pda,
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
    let tx = await ctx.txnHelpers.buildV0Txn(
      [crossTransferTx],
      [withdrawerKeyPair]
    );
    let txHash = await ctx.connection.sendTransaction(tx);
    await txnHelpers.logParsedTx(txHash);

    const updatedTokenAccountInfo = await connection.getTokenAccountBalance(
      withdrawerTokenAccount.address
    );
    let updatedBalance = updatedTokenAccountInfo.value.amount;
    console.log("balanced of withdrawer: {}", updatedBalance);
    expect(updatedBalance).toBe(20000000000 - 1000000000 + "");
  });

  it("test handle force rollback complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 13;
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
      iconBnUSD,
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
        state: BalancedDollarPDA.state().pda,
        xcall: xcall_program.programId,
        systemProgram: SYSTEM_PROGRAM_ID,
        xcallAuthority: BalancedDollarPDA.xcall_authority().pda,
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
      
    let tx = await ctx.txnHelpers.buildV0Txn(
      [forceRollbackIx],
      [ctx.admin]
    );
      let txHash = await ctx.connection.sendTransaction(tx);
      await txnHelpers.logParsedTx(txHash);
  });
});
