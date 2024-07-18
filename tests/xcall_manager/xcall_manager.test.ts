import * as anchor from "@coral-xyz/anchor";
import { Keypair,  } from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

import { XcallManager } from "../../target/types/xcall_manager";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, XcallManagerPDA } from "./setup";
const program: anchor.Program<XcallManager> = anchor.workspace.XcallManager;

describe("balanced_solana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);

  beforeEach(async () => {
        
  });

  it("Test initialized!", async () => {
    let xcallKeyPair = Keypair.generate();
        let source1 = Keypair.generate();
        let source2 = Keypair.generate();

        await ctx.initialize(
            xcallKeyPair.publicKey,
            "icon/hxcnjsd",
            [source1.publicKey.toString(), source2.publicKey.toString()],
            ["icon/cxjkefnskdjfe", "icon/cxjdkfndjwk"]
        );

    const stateAccount = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    expect(stateAccount.xcall.toString()).toBe(xcallKeyPair.publicKey.toString());
    expect(stateAccount.iconGovernance).toBe("icon/hxcnjsd");
    expect(stateAccount.admin.toString()).toBe( wallet.payer.publicKey.toString());
  });

  it("Test set protocols!", async () => {
    let source1 = Keypair.generate();
    let source2 = Keypair.generate();
    let setProtocolIx = await program.methods
      .setProtocols([source1.publicKey.toString(), source2.publicKey.toString()],
      ["icon/cxjkefnskdjfe", "icon/cxjdkfndjwk"])
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      }).instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setProtocolIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

  });

  it("Test set admin!", async () => {
    let admin = Keypair.generate();
    txnHelpers.airdrop(admin.publicKey, 1000000000)

    let setAdminIx = await program.methods
      .setAdmin(admin.publicKey)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      }).instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([setAdminIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    expect(stateAccount.admin.toString()).toBe( admin.publicKey.toString());
    txnHelpers.airdrop(admin.publicKey, 1000000000)
    let reverseSetAdminIx = await program.methods
      .setAdmin(ctx.admin.publicKey)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: admin.publicKey,
      }).instruction();

     let reverseTx = await ctx.txnHelpers.buildV0Txn([reverseSetAdminIx], [admin]);
     await ctx.connection.sendTransaction(reverseTx);
     await sleep(3);

    const reverseStateAccount = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    expect(reverseStateAccount.admin.toString()).toBe( ctx.admin.publicKey.toString());
  });
  
  it("Test whitelist action", async () => {
    let data  = "this is the test whitelist action data";
    let bytes = Buffer.alloc(data.length, data);
    let whitelistActionIx = await program.methods
      .whitelistAction(bytes)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      }).instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([whitelistActionIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    expect(stateAccount.whitelistedActions[0].toString()).toBe(bytes.toString());

    let removeWhitelistActionIx = await program.methods
      .removeAction(bytes)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      }).instruction();

    let removeTx = await ctx.txnHelpers.buildV0Txn([removeWhitelistActionIx], [ctx.admin]);
    await ctx.connection.sendTransaction(removeTx);
    await sleep(3);
    const stateAccountRemovedAction = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    expect(stateAccountRemovedAction.whitelistedActions.length).toBe(0);
  });

  it("Test proposal removal", async () => {
    let protocolToRemove = Keypair.generate();
    let protocolRemoveIx = await program.methods
      .proposeRemoval(protocolToRemove.publicKey.toString())
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: ctx.admin.publicKey,
      }).instruction();

    let tx = await ctx.txnHelpers.buildV0Txn([protocolRemoveIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await sleep(3);

    const stateAccount = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    expect(stateAccount.proposedProtocolToRemove).toBe(protocolToRemove.publicKey.toString());
  });

  it("Test verify protocol", async () => {
    const stateAccount = await program.account.xmState.fetch(XcallManagerPDA.state().pda);
    let sources = stateAccount.sources;

    let verified = await program.methods
      .verifyProtocols(sources)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
      }).view();
      console.log(verified);
      expect(verified).toBe(true);
  });
  
});
