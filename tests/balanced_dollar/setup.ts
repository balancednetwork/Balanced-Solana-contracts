import * as anchor from "@coral-xyz/anchor";

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { BalancedDollar } from "../../target/types/balanced_dollar";
import { XcallManager } from "../../target/types/xcall_manager";
import { TransactionHelper, sleep } from "../utils";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const balancedDollarProgram: anchor.Program<BalancedDollar> = anchor.workspace.BalancedDollar;
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

  async initialize(xcall: PublicKey, icon_bn_usd: string, xcall_manager: PublicKey, bn_usd: PublicKey, xcall_manager_state: PublicKey) {
    console.log("bn_usd is: ", bn_usd);
    let initializeIx = await balancedDollarProgram.methods
        .initialize(xcall, icon_bn_usd, xcall_manager, bn_usd, xcall_manager_state)
        .accountsStrict({
          state: BalancedDollarPDA.state().pda,
          admin: this.admin.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID
        }).instruction();

      let tx = await this.txnHelpers.buildV0Txn([initializeIx], [this.admin]);
      await this.connection.sendTransaction(tx);
      await sleep(3);
  }

}
export class BalancedDollarPDA {
  constructor() {}
    
  static state() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      balancedDollarProgram.programId
    );

    return { bump, pda };
  }

  static program_authority(){
    let [pda, bump] =  PublicKey.findProgramAddressSync(
      [Buffer.from("bnusd_authority")],
      balancedDollarProgram.programId
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