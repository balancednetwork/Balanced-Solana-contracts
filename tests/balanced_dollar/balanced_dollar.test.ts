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
  CSMessageType,
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

  // it("Handle call message cross transfer", async() => {
  //   let sender = Keypair.generate();
  //   await  sleep(3);
  //   await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
  //   await  sleep(3);
  //   const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
  //   let iconBnUsd = stateAccount.iconBnUsd;
  //   let bytes = Buffer.alloc(0);
  //   const data = ["xCrossTransfer", sender.publicKey.toString(), withdrawerKeyPair.publicKey.toString(), 20000000000,  bytes];
  //   const rlpEncodedData = rlp.encode(data);

  //   let protocols = xcall_manager_program.account.xmState.fetch(BalancedDollarPDA.xcall_manager_state().pda);
  //   let program_authority = BalancedDollarPDA.program_authority();
  //   let handleCallMessageIx = await program.methods
  //   .handleCallMessage(iconBnUsd, Buffer.from(rlpEncodedData), (await protocols).sources )
  //   .accountsStrict({
  //     signer: wallet.payer.publicKey,
  //     instructionSysvar: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
  //     state: BalancedDollarPDA.state().pda,
  //     to: withdrawerTokenAccount.address,
  //     mint: mint,
  //     mintAuthority: program_authority.pda,
  //     xcallManager: xcall_manager_program.programId,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda
  //   }).instruction();
  //   let tx = await ctx.txnHelpers.buildV0Txn([handleCallMessageIx], [ctx.admin]);
  //   let txHash = await ctx.connection.sendTransaction(tx);
  //   await txnHelpers.logParsedTx(txHash);

  //   console.log("handle call message balanced dollar");

  //   // Fetch the token balance
  //   const tokenAccountInfo = await connection.getTokenAccountBalance(withdrawerTokenAccount.address);

  //   let balance = tokenAccountInfo.value.amount;
  //   console.log("balanced of withdrawer: {}", balance);
  //   expect(balance).toBe("20000000000");
  //   await  sleep(3);

  // });

  // it("Handle call message cross trasfer revert", async() => {
  //   let sender = Keypair.generate();
  //   await  sleep(3);
  //   await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
  //   await  sleep(3);
  //   const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
  //   const data = ["xCrossTransferRevert", withdrawerKeyPair.publicKey.toString(), 20000000000];
  //   const rlpEncodedData = rlp.encode(data);

  //   let protocols = xcall_manager_program.account.xmState.fetch(BalancedDollarPDA.xcall_manager_state().pda);
  //   let program_authority = BalancedDollarPDA.program_authority();
  //   console.log("bnusd authority is: ", program_authority.pda);
  //   let handleCallMessageIx = await program.methods
  //   .handleCallMessage(xcall_program.programId.toString(), Buffer.from(rlpEncodedData), (await protocols).sources )
  //   .accountsStrict({
  //     signer: wallet.payer.publicKey,
  //     instructionSysvar: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
  //     state: BalancedDollarPDA.state().pda,
  //     to: withdrawerTokenAccount.address,
  //     mint: mint,
  //     mintAuthority: program_authority.pda,
  //     xcallManager: xcall_manager_program.programId,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda
  //   }).instruction();
  //   let tx = await ctx.txnHelpers.buildV0Txn([handleCallMessageIx], [ctx.admin]);
  //   let txHash = await ctx.connection.sendTransaction(tx);
  //   await txnHelpers.logParsedTx(txHash);

  //   console.log("handle call message balanced dollar");

  //   // Fetch the token balance
  //   const tokenAccountInfo = await connection.getTokenAccountBalance(withdrawerTokenAccount.address);

  //   let balance = tokenAccountInfo.value.amount;
  //   console.log("balanced of withdrawer: {}", balance);
  //   expect(balance).toBe("20000000000");
  //   await  sleep(3);

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
      20000000000,
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
        receipt: ConnectionPDA.receipt(connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .remainingAccounts([...recvMessageAccounts.slice(3)])
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
        connectionCtx.dstNetworkId
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

    const stateAccount = await program.account.state.fetch(
      BalancedDollarPDA.state().pda
    );
    let iconBnUsd = stateAccount.iconBnUsd;
    let bytes = Buffer.alloc(0);
    let sender = Keypair.generate();
    const data = [
      "xCrossTransferRevert",
      withdrawerTokenAccount.address.toString(),
      20000000000,
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
        receipt: ConnectionPDA.receipt(connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .remainingAccounts([...recvMessageAccounts.slice(3)])
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
        connectionCtx.dstNetworkId
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
      .crossTransfer("", new anchor.BN(1000000000), bytes)
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
});
