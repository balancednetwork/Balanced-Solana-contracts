import * as anchor from "@coral-xyz/anchor";

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { AssetManager } from "../../target/types/asset_manager";
import { XcallManager } from "../../target/types/xcall_manager";
import { TransactionHelper, sleep } from "../utils";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const assetManagerProgram: anchor.Program<AssetManager> = anchor.workspace.AssetManager;
const xcallManagerProgram: anchor.Program<XcallManager> =  anchor.workspace.XcallManager;

export class TestContext {
  admin: Keypair;
  fee_handler: Keypair;
  connection: Connection;
  txnHelpers: TransactionHelper;

  constructor(connection: Connection, txnHelpers: TransactionHelper, admin: Keypair) {
    this.connection = connection;
    this.txnHelpers = txnHelpers;
    this.admin = admin;
    this.fee_handler = admin;
  }

  async initialize(xcall: PublicKey, icon_asset_manager: string, xcall_manager: PublicKey, xcall_manager_state: PublicKey) {
    let initializeIx = await assetManagerProgram.methods
        .initialize(xcall, icon_asset_manager, xcall_manager, xcall_manager_state )
        .accountsStrict({
          state: AssetManagerPDA.state().pda,
          admin: this.admin.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
        }).instruction();

      let tx = await this.txnHelpers.buildV0Txn([initializeIx], [this.admin]);
      await this.connection.sendTransaction(tx);
      await sleep(3);
  }

}
export class AssetManagerPDA {
  constructor() {}
    
  static state() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      assetManagerProgram.programId
    );

    return { bump, pda };
  }

  static token_state(mint: PublicKey){
    let [pda, bump] =  PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), mint.toBuffer()],
      assetManagerProgram.programId
    );

    return { bump, pda };
  }

  static vault(mint: PublicKey){
    let [pda, bump] =  PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), mint.toBuffer()],
      assetManagerProgram.programId
    );

    return { bump, pda };
  }

  static vault_native(){
    let [pda, bump] =  PublicKey.findProgramAddressSync(
      [Buffer.from("vault_native")],
      assetManagerProgram.programId
    );

    return { bump, pda };
  }

  static rate_limit(token_key: Buffer) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("rate_limit"), token_key],
      assetManagerProgram.programId
    );

    return { bump, pda };
  }

  static asset_manager() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("asset_manager_signer")],
      assetManagerProgram.programId
    );

    return { bump, pda };
  }

  static xcall_manager_state() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      xcallManagerProgram.programId
    );

    return { bump, pda };
  }
  
}