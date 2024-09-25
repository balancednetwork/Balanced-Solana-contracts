import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as rlp from "rlp";

import { XcallManager } from "../../target/types/xcall_manager";

import { TransactionHelper, sleep } from "../utils";
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
  CSMessageRequest,
  CSMessageType,
  MessageType,
} from "../utils/types";
import { TestContext as XcallContext, XcallPDA } from "../xcall/xcall/setup";
import {
  TestContext as ConnectionContext,
  ConnectionPDA,
} from "../xcall/centralized_connection/setup";

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

  beforeAll(async () => {
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
    expect(stateAccount.xcall.toString()).toBe(
      xcallProgram.programId.toString()
    );
    expect(stateAccount.iconGovernance).toBe("icon/hxcnjsd");
    expect(stateAccount.admin.toString()).toBe(
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
    expect(stateAccount.proposedProtocolToRemove).toBe(
      protocolToRemove.publicKey.toString()
    );
  });

  it("Test set multi protocols!", async () => {
    let extra_protocol = Keypair.generate();
    let setProtocolIx = await program.methods
      .setProtocols(
        [
          connectionProgram.programId.toString(),
          extra_protocol.publicKey.toString(),
        ],
        [iconConnection, "icon/icon_extra"]
      )
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setProtocolIx], [ctx.admin]);
    let txHash = await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    let sources = stateAccount.sources;
    console.log("sources: ", sources);

    let verified = await program.methods
      .verifyProtocols(sources)
      .accounts({
        state: XcallManagerPDA.state().pda,
      })
      .view();
    expect(verified).toBe(true);
  });

  it("Test set protocols!", async () => {
    let setProtocolIx = await program.methods
      .setProtocols([connectionProgram.programId.toString()], [iconConnection])
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      })
      .instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setProtocolIx], [ctx.admin]);
    let txHash = await ctx.connection.sendTransaction(tx);
    txnHelpers.logParsedTx(txHash);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(
      XcallManagerPDA.state().pda
    );
    let sources = stateAccount.sources;
    console.log("sources: ", sources);

    let verified = await program.methods
      .verifyProtocols(sources)
      .accounts({
        state: XcallManagerPDA.state().pda,
      })
      .view();
    expect(verified).toBe(true);
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
    expect(stateAccount.admin.toString()).toBe(admin.publicKey.toString());
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
    expect(reverseStateAccount.admin.toString()).toBe(
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
    expect(stateAccount.whitelistedActions[0].toString()).toBe(
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
    expect(stateAccountRemovedAction.whitelistedActions.length).toBe(0);
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
    expect(stateAccount.proposedProtocolToRemove).toBe(
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
    const fromNetwork = "icon";
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
      XcallManagerPDA.state().pda,
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
});
