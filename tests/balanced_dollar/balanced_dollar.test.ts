import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import * as rlp from "rlp";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { expect } from "chai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  Account,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { BalancedDollar } from "../../target/types/balanced_dollar";
import { XcallManager } from "../../target/types/xcall_manager";
import { TransactionHelper, sleep } from "../utils/index";
import { TestContext, BalancedDollarPDA } from "./setup";
import { Xcall } from "../../types/xcall";
import { CentralizedConnection } from "../../types/centralized_connection";
import connectionIdlJson from "../../target/idl/centralized_connection.json";
import xcallIdlJson from "../../target/idl/xcall.json";
import {
  CSMessage,
  CSMessageType,
  CSResponseType,
  MessageType,
} from "../utils/types/message";
import { CSMessageRequest } from "../utils/types/request";
import { CSMessageResult } from "../utils/types/result";
import { TestContext as XcallContext, XcallPDA } from "../xcall/xcall/setup";
import {
  TestContext as ConnectionContext,
  ConnectionPDA,
} from "../xcall/centralized_connection/setup";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program: anchor.Program<BalancedDollar> = anchor.workspace.BalancedDollar;

const xcall_manager_program: anchor.Program<XcallManager> =
  anchor.workspace.XcallManager;

const connectionProgram: anchor.Program<CentralizedConnection> =
  new anchor.Program(
    connectionIdlJson as anchor.Idl,
    provider
  ) as unknown as anchor.Program<CentralizedConnection>;

const xcallProgram: anchor.Program<Xcall> = new anchor.Program(
  xcallIdlJson as anchor.Idl,
  provider
) as unknown as anchor.Program<Xcall>;

describe("balanced dollar manager", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
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
  let fromNid = "icon";

  let mint: PublicKey;
  let program_authority = BalancedDollarPDA.program_authority();
  let withdrawerKeyPair = Keypair.generate();
  let withdrawerTokenAccount: Account;
  let testAdmin = Keypair.generate();

  before(async () => {
    mint = await createMint(
      provider.connection,
      wallet.payer,
      program_authority.pda,
      null,
      9
    );
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
    expect(stateAccount.xcall.toString()).equals(
      xcallProgram.programId.toString()
    );
    expect(stateAccount.iconBnUsd).equals(iconBnUSD);
    expect(stateAccount.xcallManager.toString()).equals(
      xcall_manager_program.programId.toString()
    );
    expect(stateAccount.bnUsdToken.toString()).equals(mint.toString());
  });

  it("test handle call message with uninitialized token account", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 100;
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    let userKeypair = Keypair.generate();
    const data = [
      "xCrossTransfer",
      Keypair.generate().publicKey.toString(),
      "solana/" + userKeypair.publicKey.toString(),
      20000000000000000000n,
      Buffer.alloc(0),
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
      fromNid,
      connSn,
      nextSequenceNo,
      cs_message,
      CSMessageType.CSMessageRequest
    );

    await connectionProgram.methods
      .recvMessage(
        fromNid,
        new anchor.BN(connSn),
        Buffer.from(cs_message),
        new anchor.BN(nextSequenceNo)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNid, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda,
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
      program.programId,
      connSn,
      fromNid,
      connectionProgram.programId
    );
    await xcallProgram.methods
      .executeCall(
        new anchor.BN(nextReqId),
        fromNid,
        new anchor.BN(connSn),
        connectionProgram.programId,
        Buffer.from(rlpEncodedData)
      )
      .accounts({
        signer: ctx.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: XcallPDA.config().pda,
        admin: xcallConfig.admin,
        proxyRequest: XcallPDA.proxyRequest(
          fromNid,
          connSn,
          connectionProgram.programId
        ).pda,
      })
      .remainingAccounts([...executeCallAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
      await sleep(2)

      let userTokenAccountAddress = await getAssociatedTokenAddress(mint, userKeypair.publicKey)
      let userBalance = await connection.getTokenAccountBalance(userTokenAccountAddress);
      expect(userBalance.value.amount.toString()).equals("20000000000")
  });

  it("test handle call message complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 6;
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    const stateAccount = await program.account.state.fetch(
      BalancedDollarPDA.state().pda
    );
    let bytes = Buffer.alloc(0);
    let sender = Keypair.generate();
    const data = [
      "xCrossTransfer",
      sender.publicKey.toString(),
      "solana/" + withdrawerKeyPair.publicKey.toString(),
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
      fromNid,
      connSn,
      nextSequenceNo,
      cs_message,
      CSMessageType.CSMessageRequest
    );

    await connectionProgram.methods
      .recvMessage(
        fromNid,
        new anchor.BN(connSn),
        Buffer.from(cs_message),
        new anchor.BN(nextSequenceNo)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNid, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda,
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
      program.programId,
      connSn,
      fromNid,
      connectionProgram.programId
    );
    await xcallProgram.methods
      .executeCall(
        new anchor.BN(nextReqId),
        fromNid,
        new anchor.BN(connSn),
        connectionProgram.programId,
        Buffer.from(rlpEncodedData)
      )
      .accounts({
        signer: ctx.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: XcallPDA.config().pda,
        admin: xcallConfig.admin,
        proxyRequest: XcallPDA.proxyRequest(
          fromNid,
          connSn,
          connectionProgram.programId
        ).pda,
      })
      .remainingAccounts([...executeCallAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
  });

  it("test handle call message revert complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 7;
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;
    let crossTransferTx = await program.methods
      .crossTransfer("", new anchor.BN(1000000000000000), Buffer.alloc(0))
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
          pubkey: ConnectionPDA.network_fee(fromNid).pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();
    let tx = await ctx.txnHelpers.buildV0Txn(
      [crossTransferTx],
      [withdrawerKeyPair]
    );

    try {
      await ctx.connection.sendTransaction(tx);

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
        fromNid,
        connSn,
        nextSequenceNo,
        csMessage,
        CSMessageType.CSMessageResult
      );

      await connectionProgram.methods
        .recvMessage(
          fromNid,
          new anchor.BN(connSn),
          Buffer.from(csMessage),
          new anchor.BN(nextSequenceNo)
        )
        .accountsStrict({
          config: ConnectionPDA.config().pda,
          admin: ctx.admin.publicKey,
          receipt: ConnectionPDA.receipt(fromNid, connSn).pda,
          systemProgram: SYSTEM_PROGRAM_ID,
          authority: ConnectionPDA.authority().pda,
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
        .executeRollback(new anchor.BN(nextSequenceNo))
        .accounts({
          signer: ctx.admin.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
          config: XcallPDA.config().pda,
          admin: xcallConfig.admin,
          rollbackAccount: XcallPDA.rollback(nextSequenceNo).pda,
        })
        .remainingAccounts([...executeRollbackAccounts.slice(4)])
        .signers([ctx.admin])
        .rpc();
    } catch (e) {
      expect(e.message.toString()).includes(
        "Attempt to debit an account but found no record of a prior credit"
      );
    }
  });

  it("cross transfer test", async () => {
    const tokenAccountInfo = await connection.getTokenAccountBalance(
      withdrawerTokenAccount.address
    );
    let { pda } = XcallPDA.config();
    let xcall_config = await xcall_program.account.config.fetch(pda);
    let balance = tokenAccountInfo.value.amount;
    expect(balance).equals("20000000000");
    await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
    await sleep(3);

    let bytes = Buffer.alloc(0);
    let amount = new anchor.BN(1000000000000000);
    let crossTransferTx = await program.methods
      .crossTransfer("", amount, bytes)
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
          pubkey: ConnectionPDA.network_fee(fromNid).pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();
    let tx = await ctx.txnHelpers.buildV0Txn(
      [crossTransferTx],
      [withdrawerKeyPair]
    );
    await ctx.connection.sendTransaction(tx);
    await sleep(2);

    const updatedTokenAccountInfo = await connection.getTokenAccountBalance(
      withdrawerTokenAccount.address
    );
    let updatedBalance = updatedTokenAccountInfo.value.amount;
    expect(updatedBalance).equals(20000000000 - 1000000 + "");
  });

  it("test handle force rollback complete flow with xcall", async () => {
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 13;
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

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
      fromNid,
      connSn,
      nextSequenceNo,
      cs_message,
      CSMessageType.CSMessageRequest
    );

    await connectionProgram.methods
      .recvMessage(
        fromNid,
        new anchor.BN(connSn),
        Buffer.from(cs_message),
        new anchor.BN(nextSequenceNo)
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        admin: ctx.admin.publicKey,
        receipt: ConnectionPDA.receipt(fromNid, connSn).pda,
        systemProgram: SYSTEM_PROGRAM_ID,
        authority: ConnectionPDA.authority().pda,
      })
      .remainingAccounts([...recvMessageAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();
    await sleep(2);

    let forceRollbackIx = await program.methods
      .forceRollback(
        new anchor.BN(nextReqId),
        fromNid,
        new anchor.BN(connSn),
        connectionProgram.programId
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
          pubkey: XcallPDA.proxyRequest(
            fromNid,
            connSn,
            connectionProgram.programId
          ).pda,
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
          pubkey: ConnectionPDA.network_fee(fromNid).pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([forceRollbackIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
  });
});
