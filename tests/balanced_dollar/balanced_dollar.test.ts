import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import * as rlp from 'rlp';

import { BalancedDollar } from "../../target/types/balanced_dollar";
import { XcallManager } from "../../target/types/xcall_manager";
import xcallIdlJson from "../../types/xcall.json";

import { TransactionHelper, sleep } from "../utils";
import { TestContext, BalancedDollarPDA } from "./setup";
import { XcallPDA, ConnectionPDA } from "../utils/xcall_pda";
const program: anchor.Program<BalancedDollar> = anchor.workspace.BalancedDollar;
const xcall_manager_program: anchor.Program<XcallManager> = anchor.workspace.XcallManager;
const xcall_program: anchor.Program<Xcall> = anchor.workspace.xcall;
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { CentralizedConnection } from "../../types/centralized_connection";
//const xcallIdl = xcallIdlJson as anchor.Idl;
const connectionProgram: anchor.Program<CentralizedConnection> =
  anchor.workspace.CentralizedConnection;
import {
    TOKEN_PROGRAM_ID,
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getOrCreateAssociatedTokenAccount,
    Account
} from "@solana/spl-token";
import { BN, min } from "bn.js";
import { Xcall } from "../../types/xcall";

describe("balanced dollar manager", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const wallet = provider.wallet as anchor.Wallet;

  let txnHelpers = new TransactionHelper(connection, wallet.payer);
  let ctx = new TestContext(connection, txnHelpers, wallet.payer);
  //const xcall_program =  new anchor.Program(xcallIdl, provider);

  let xcallKeyPair = Keypair.generate();
  let xcallManagerKeyPair = Keypair.generate();
  let mint: PublicKey;
  let program_authority = BalancedDollarPDA.program_authority();
  let withdrawerKeyPair = Keypair.generate();
  let withdrawerTokenAccount: Account;

  beforeEach(async () => {
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

  it("Handle call message cross transfer", async() => {
    let sender = Keypair.generate();
    await  sleep(3);
    await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
    await  sleep(3);
    const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
    let iconBnUsd = stateAccount.iconBnUsd;
    let bytes = Buffer.alloc(0);
    const data = ["xCrossTransfer", sender.publicKey.toString(), withdrawerKeyPair.publicKey.toString(), 20000000000,  bytes];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(BalancedDollarPDA.xcall_manager_state().pda);
    let program_authority = BalancedDollarPDA.program_authority();
    let handleCallMessageIx = await program.methods
    .handleCallMessage(iconBnUsd, Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      state: BalancedDollarPDA.state().pda,
      to: withdrawerTokenAccount.address,
      mint: mint,
      mintAuthority: program_authority.pda,
      xcallManager: xcall_manager_program.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      xcall: xcall_program.programId,
      xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda
    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([handleCallMessageIx], [ctx.admin]);
    try{
      let txHash = await ctx.connection.sendTransaction(tx);
      await txnHelpers.logParsedTx(txHash);
    } catch (err) {
      console.log(err);
    }
    console.log("handle call message balanced dollar");

    // Fetch the token balance
    const tokenAccountInfo = await connection.getTokenAccountBalance(withdrawerTokenAccount.address);

    let balance = tokenAccountInfo.value.amount;
    console.log("balanced of withdrawer: {}", balance);
    expect(balance).toBe("20000000000");
    await  sleep(3);
    
  });

  it("Handle call message cross trasfer revert", async() => {
    let sender = Keypair.generate();
    await  sleep(3);
    await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
    await  sleep(3);
    const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
    let iconBnUsd = stateAccount.iconBnUsd;
    let bytes = Buffer.alloc(0);
    const data = ["xCrossTransferRevert", withdrawerKeyPair.publicKey.toString(), 20000000000];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(BalancedDollarPDA.xcall_manager_state().pda);
    let program_authority = BalancedDollarPDA.program_authority();
    let handleCallMessageIx = await program.methods
    .handleCallMessage(xcall_program.programId.toString(), Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      state: BalancedDollarPDA.state().pda,
      to: withdrawerTokenAccount.address,
      mint: mint,
      mintAuthority: program_authority.pda,
      xcallManager: xcall_manager_program.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      xcall: xcall_program.programId,
      xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda
    }).instruction();
    let tx = await ctx.txnHelpers.buildV0Txn([handleCallMessageIx], [ctx.admin]);
    try{
      let txHash = await ctx.connection.sendTransaction(tx);
      await txnHelpers.logParsedTx(txHash);
    } catch (err) {
      console.log(err);
    }
    console.log("handle call message balanced dollar");

    // Fetch the token balance
    const tokenAccountInfo = await connection.getTokenAccountBalance(withdrawerTokenAccount.address);

    let balance = tokenAccountInfo.value.amount;
    console.log("balanced of withdrawer: {}", balance);
    expect(balance).toBe("20000000000");
    await  sleep(3);
    
  });

  it("cross transfer test", async() => {
    let { pda } = XcallPDA.config();
    let xcall_config = await xcall_program.account.config.fetch(pda);
    console.log("sequence no: ", xcall_config.sequenceNo);
    const stateAccount = await program.account.state.fetch(BalancedDollarPDA.state().pda);
    let iconBnUsd = stateAccount.iconBnUsd;
    let sender = Keypair.generate();
    const data = ["xCrossTransfer", sender.publicKey.toString(), withdrawerKeyPair.publicKey.toString(), 20000000000,  Buffer.alloc(0)];
    const rlpEncodedData = rlp.encode(data);
  
    let protocols = xcall_manager_program.account.xmState.fetch(BalancedDollarPDA.xcall_manager_state().pda);
    await program.methods
    .handleCallMessage(iconBnUsd, Buffer.from(rlpEncodedData), (await protocols).sources )
    .accountsStrict({
      state: BalancedDollarPDA.state().pda,
      to: withdrawerTokenAccount.address,
      mint: mint,
      mintAuthority: program_authority.pda,
      xcallManager: xcall_manager_program.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      xcall: xcall_program.programId,
      xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda
    }).signers([ctx.admin]).rpc();
    // let transfrerPair = Keypair.generate();
    // let trnasfererTokenAccount = await getOrCreateAssociatedTokenAccount(
    //   provider.connection,
    //   wallet.payer,
    //   mint,
    //   transfrerPair.publicKey,
    //   true
    // );
    await  sleep(3);

    // await mintTo(
    //   provider.connection,
    //   wallet.payer,
    //   mint,
    //   withdrawerTokenAccount.address,
    //   program_authority.pda,
    //   10000000000,
    //   [ctx.admin],
    //   null,
    //   TOKEN_PROGRAM_ID
    // );
    // await  sleep(3);
    const tokenAccountInfo = await connection.getTokenAccountBalance(withdrawerTokenAccount.address);

    let balance = tokenAccountInfo.value.amount;
    console.log("balanced of withdrawer: {}", balance);
    expect(balance).toBe("20000000000");
    await txnHelpers.airdrop(withdrawerKeyPair.publicKey, 5000000000);
    await  sleep(3);
    let bytes = Buffer.alloc(0);
    let crossTransferTx = await program.methods
      .crossTransfer(new BN(1000000000), bytes)
      .accountsStrict({
        from: withdrawerTokenAccount.address,
        fromAuthority: withdrawerKeyPair.publicKey,
        to: null,
        state: BalancedDollarPDA.state().pda,
        mint: mint,
        xcallManagerState: BalancedDollarPDA.xcall_manager_state().pda,
        xcall: xcall_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      }).remainingAccounts([
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
          pubkey: ConnectionPDA.fee("icon").pda,
          isSigner: false,
          isWritable: true,
        }
      ]).instruction();
      let tx = await ctx.txnHelpers.buildV0Txn([crossTransferTx], [withdrawerKeyPair]);
      let txHash = await ctx.connection.sendTransaction(tx);
      await txnHelpers.logParsedTx(txHash);

    const updatedTokenAccountInfo = await connection.getTokenAccountBalance(withdrawerTokenAccount.address);
    let updatedBalance = tokenAccountInfo.value.amount;
    console.log("balanced of withdrawer: {}", updatedBalance);
    //expect(updatedBalance).toBe(20000000000-1000000000);
  });

  
  
});
