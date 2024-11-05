import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as rlp from "rlp";

import { XcallManager } from "../../target/types/xcall_manager";

import { TransactionHelper, sleep } from "../utils/index";
import { TestContext, XcallManagerPDA } from "./setup";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
const program: anchor.Program<XcallManager> = anchor.workspace.XcallManager;

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
  CSMessageType,
  MessageType,
} from "../utils/types/message";
import {
  CSMessageRequest,
} from "../utils/types/request";
import { TestContext as XcallContext, XcallPDA } from "../xcall/xcall/setup";
import {
  TestContext as ConnectionContext,
  ConnectionPDA,
} from "../xcall/centralized_connection/setup";
import { expect } from "chai";

describe("balanced xcall manager", () => {
  const connection = provider.connection; // new Connection("http://127.0.0.1:8899", "confirmed");
  const wallet = provider.wallet as anchor.Wallet;

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);
  let xcallCtx = new XcallContext(connection, txnHelpers, wallet.payer);
  let connectionCtx = new ConnectionContext(
    connection,
    txnHelpers,
    wallet.payer
  );

  let networkId = "solana";
  let iconGovernance = "icon/hxcnjsd";
  let iconConnection = "icon/cxjkefnskdjfe";
  let fromNid = "icon";

  before(async () => {
    await connectionCtx.initialize();
    console.log("connection initialized");
    sleep(3);
    await xcallCtx.initialize(networkId);
    console.log("xcall initialized");
    sleep(3);

    console.log("setting fee");
    await connectionProgram.methods
      .setFee("icon", new anchor.BN(50), new anchor.BN(50))
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        networkFee: ConnectionPDA.network_fee("icon").pda,
        admin: wallet.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([wallet.payer])
      .rpc();
    console.log("fee set");
  });

  it("Test initialized!", async () => {
    await ctx.initialize(
      xcallProgram.programId,
      iconGovernance,
      [connectionProgram.programId.toString()],
      [iconConnection]
    );

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(stateAccount.xcall.toString()).equals(
      xcallProgram.programId.toString()
    );
    expect(stateAccount.iconGovernance).equals("icon/hxcnjsd");
    expect(stateAccount.admin.toString()).equals(
      wallet.payer.publicKey.toString()
    );
  });

  it("Test proposal removal", async () => {
    let protocolToRemove = Keypair.generate();
    let protocolRemoveIx = await program.methods
      .proposeRemoval(protocolToRemove.publicKey.toString())
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([protocolRemoveIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(stateAccount.proposedProtocolToRemove).equals(
      protocolToRemove.publicKey.toString()
    );
  });

  it("Test set multi protocols!", async () => {
    let extra_protocol = Keypair.generate();
    let sources = [
      connectionProgram.programId.toString(),
      extra_protocol.publicKey.toString(),
    ];
    let destinations = [iconConnection, "icon/icon_extra"]
    let setProtocolIx = await program.methods
      .setProtocols( sources, destinations )
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setProtocolIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    

    let verified = await program.methods
      .verifyProtocols(sources)
      .accounts({
        state: XcallManagerPDA.state().pda,
      })
      .view();
    expect(verified).equals(true);
  });

  //to do test duplicate protocols
  it("Test duplicate protocols!", async () => {
    let extra_protocol = Keypair.generate();
    let sources = [
      connectionProgram.programId.toString(),
      extra_protocol.publicKey.toString(),
    ];
    let destinations = [iconConnection, "icon/icon_extra"];
    let setProtocolIx = await program.methods
      .setProtocols( sources,  destinations )
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();
    

    let tx = await ctx.txnHelpers.buildV0Txn([setProtocolIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);
    let duplicateSources = [
      connectionProgram.programId.toString(),
      connectionProgram.programId.toString(),
    ];

    let verifiedFalse = await program.methods
      .verifyProtocols(duplicateSources)
      .accounts({
        state: XcallManagerPDA.state().pda,
      })
      .view();
    expect(verifiedFalse).equals(false);
    let verifiedTrue = await program.methods
      .verifyProtocols(sources)
      .accounts({
        state: XcallManagerPDA.state().pda,
      })
      .view();
    expect(verifiedTrue).equals(true);
  });

  it("Test set protocols!", async () => {
    let sources = [connectionProgram.programId.toString()];
    let destinations = [iconConnection];
    let setProtocolIx = await program.methods
      .setProtocols(sources, destinations)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setProtocolIx], [ctx.admin]);
    let txHash = await ctx.connection.sendTransaction(tx);
    await sleep(3);

    let verified = await program.methods
      .verifyProtocols(sources)
      .accounts({
        state: XcallManagerPDA.state().pda,
      })
      .view();
    expect(verified).equals(true);
  });

  it("Test set admin!", async () => {
    let admin = Keypair.generate();
    txnHelpers.airdrop(admin.publicKey, 1000000000);

    let setAdminIx = await program.methods
      .setAdmin(admin.publicKey)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setAdminIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(stateAccount.admin.toString()).equals(admin.publicKey.toString());
    txnHelpers.airdrop(admin.publicKey, 1000000000);
    let reverseSetAdminIx = await program.methods
      .setAdmin(ctx.admin.publicKey)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: admin.publicKey,
      })
      .instruction();

    let reverseTx = await ctx.txnHelpers.buildV0Txn(
      [reverseSetAdminIx],
      [admin]
    );
    await ctx.connection.sendTransaction(reverseTx);
    await sleep(3);

    const reverseStateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(reverseStateAccount.admin.toString()).equals(
      ctx.admin.publicKey.toString()
    );
  });

  it("Test whitelist action", async () => {
    let data = "this is the test whitelist action data";
    let bytes = Buffer.alloc(data.length, data);
    let whitelistActionIx = await program.methods
      .whitelistAction(bytes)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([whitelistActionIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(stateAccount.whitelistedActions[0].toString()).equals(
      bytes.toString()
    );

    let removeWhitelistActionIx = await program.methods
      .removeAction(bytes)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let removeTx = await ctx.txnHelpers.buildV0Txn(
      [removeWhitelistActionIx],
      [ctx.admin]
    );
    await ctx.connection.sendTransaction(removeTx);
    await sleep(3);
    const stateAccountRemovedAction = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(stateAccountRemovedAction.whitelistedActions.length).equals(0);
  });

  it("Test proposal removal", async () => {
    let protocolToRemove = Keypair.generate();
    let protocolRemoveIx = await program.methods
      .proposeRemoval(protocolToRemove.publicKey.toString())
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([protocolRemoveIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    expect(stateAccount.proposedProtocolToRemove).equals(
      protocolToRemove.publicKey.toString()
    );
  });

  it("test handle call message complete flow with xcall", async () => {
   
    await connectionProgram.methods
      .setAdmin(wallet.publicKey)
      .accountsStrict({
        admin: wallet.payer.publicKey,
        config: ConnectionPDA.config().pda,
      })
      .signers([wallet.payer])
      .rpc();
    let xcallConfig = await xcallCtx.getConfig();

    const connSn = 5;
    console.log("proxy request: ", XcallPDA.proxyRequest(fromNid, connSn, connectionProgram.programId).pda)
    //const fromNetwork = "icon";
    let nextReqId = xcallConfig.lastReqId.toNumber() + 1;
    let nextSequenceNo = xcallConfig.sequenceNo.toNumber() + 1;

    //let data = Buffer.from("rollback", "utf-8");
    const data = [
      "ConfigureProtocols",
      [connectionProgram.programId.toString()],
      [iconConnection],
    ];
    const rlpEncodedData = rlp.encode(data);

    let whitelistActionIx = await program.methods
      .whitelistAction(Buffer.from(rlpEncodedData))
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();
    
    let tx = await ctx.txnHelpers.buildV0Txn([whitelistActionIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);
    console.log("after white list");
    let request = new CSMessageRequest(
      iconGovernance,
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
    console.log("after receive message accounts");
    console.log(recvMessageAccounts);
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
        authority: ConnectionPDA.authority().pda
      })
      .remainingAccounts([...recvMessageAccounts.slice(4)])
      .signers([ctx.admin])
      .rpc();

    await sleep(2);
    console.log("after receive message");
    // call xcall execute_call
    let executeCallAccounts = await xcallCtx.getExecuteCallAccounts(
      nextReqId,
      Buffer.from(rlpEncodedData),
      XcallManagerPDA.state().pda,
      program.programId,
      connSn,
      fromNid,
      connectionProgram.programId
    );
    console.log("after get accounts");
    console.log(executeCallAccounts);
    
    await xcallProgram.methods
      .executeCall(
        new anchor.BN(nextReqId),
        fromNid,
        new anchor.BN(connSn),
        connectionProgram.programId,
        Buffer.from(rlpEncodedData),
      )
      .accounts({
        signer: ctx.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: XcallPDA.config().pda,
        admin: xcallConfig.admin,
        proxyRequest: XcallPDA.proxyRequest(fromNid, connSn, connectionProgram.programId).pda,
      })
      .remainingAccounts([
        // ACCOUNTS TO CALL CONNECTION SEND_MESSAGE
        ...executeCallAccounts.slice(4),
      ])
      .signers([ctx.admin])
      .rpc();
  });
});
