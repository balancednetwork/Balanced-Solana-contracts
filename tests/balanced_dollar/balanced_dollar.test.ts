import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as rlp from 'rlp';

import { BalancedDollar } from "../../target/types/balanced_dollar";
import { XcallManager } from "../../target/types/xcall_manager";
//import xcallIdlJson from "../../types/xcall.json";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, BalancedDollarPDA } from "./setup";
import { XcallPDA, ConnectionPDA } from "../utils/xcall_pda";
const program: anchor.Program<BalancedDollar> = anchor.workspace.BalancedDollar;
const xcall_manager_program: anchor.Program<XcallManager> = anchor.workspace.XcallManager;
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
//import { CentralizedConnection } from "../../types/centralized_connection";
//const xcallIdl = xcallIdlJson as anchor.Idl;
// const connectionProgram: anchor.Program<CentralizedConnection> =
//   anchor.workspace.CentralizedConnection;
import {
    TOKEN_PROGRAM_ID,
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getOrCreateAssociatedTokenAccount,
    Account
} from "@solana/spl-token";
import { BN, min } from "bn.js";

describe("balanced dollar manager", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);
  //const xcall_program =  new anchor.Program(xcallIdl, provider);

  let xcallKeyPair = Keypair.generate();
  let xcallManagerKeyPair = Keypair.generate();
  let mint: PublicKey;

  beforeEach(async () => {
    mint = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        9
      );
  });

  it("should initialize the state properly", async () => {
    await ctx.initialize(
        xcallKeyPair.publicKey,
        "icon/hxcnjsd",
        xcallManagerKeyPair.publicKey,
        mint
    );
    const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
    expect(stateAccount.xcall.toString()).toBe(xcallKeyPair.publicKey.toString());
    expect(stateAccount.iconBnUsd).toBe("icon/hxcnjsd");
    expect(stateAccount.xcallManager.toString()).toBe(xcallManagerKeyPair.publicKey.toString());
    expect(stateAccount.bnUsdToken.toString()).toBe(mint.toString());
  });

  it("cross transfer test", async() => {
    let transfrerPair = Keypair.generate();
    let trnasfererTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      transfrerPair.publicKey,
      true
    );
    await  sleep(3);

    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      trnasfererTokenAccount.address,
      wallet.payer,
      10000000000,
      [ctx.admin],
      null,
      TOKEN_PROGRAM_ID
    );
    await  sleep(3);

    await txnHelpers.airdrop(transfrerPair.publicKey, 5000000000);
    await  sleep(3);
    let bytes = Buffer.alloc(0);
    let crossTransferTx = await program.methods
      .crossTransfer(new BN(1000000000), bytes)
      .accountsStrict({
        from: trnasfererTokenAccount.address,
        fromAuthority: transfrerPair.publicKey,
        to: null,
        state: BalancedDollarPDA.state().pda,
        mint: mint,
        xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda,
        xcall: xcall_manager_program.programId,//xcall_program.programId,
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
          pubkey: transfrerPair.publicKey,
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
      let tx = await ctx.txnHelpers.buildV0Txn([crossTransferTx], [transfrerPair]);
      console.log("cross transfer test")
      await ctx.connection.sendTransaction(tx);

  });

  it("Handle call message", async() => {
    let sender = Keypair.generate();
    let withdrawerKeyPair = Keypair.generate();
    let withdrawerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      withdrawerKeyPair.publicKey,
      true
    );
    await  sleep(3);
    await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
    await  sleep(3);
    const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
    let iconBnUsd = stateAccount.iconBnUsd;
    let bytes = Buffer.alloc(0);
    const data = ["WithdrawTo", sender.publicKey.toString(), withdrawerKeyPair.publicKey.toString(), "1000000000",  bytes];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(BalancedDollarPDA.xcall_manager_state().pda);
    let program_authority = BalancedDollarPDA.program_authority();
    let handleCallMessageIx = await program.methods
    .handleCallMessage(iconBnUsd, Buffer.from(rlpEncodedData), (await protocols).sources, program_authority.bump )
    .accountsStrict({
      state: BalancedDollarPDA.state().pda,
      to: withdrawerTokenAccount.address,
      mint: mint,
      mintAuthority: program_authority.pda,
      xcallManager: xcall_manager_program.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      xcall: xcall_manager_program.programId,
      xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda
    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([handleCallMessageIx], [ctx.admin]);
    await ctx.connection.sendTransaction(tx);
    await  sleep(3);
    console.log("handle call message balanced dollar");
  });
  
});
