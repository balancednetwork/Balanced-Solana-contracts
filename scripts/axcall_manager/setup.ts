import * as anchor from "@coral-xyz/anchor";

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { XcallManager } from "../../target/types/xcall_manager";
import { TransactionHelper, sleep } from "../utils";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const xcallManagerProgram: anchor.Program<XcallManager> =
  anchor.workspace.XcallManager;

export class TestContext {
  nid: String;
  admin: Keypair;
  fee_handler: Keypair;
  connection: Connection;
  txnHelpers: TransactionHelper;

  constructor(
    connection: Connection,
    txnHelpers: TransactionHelper,
    admin: Keypair
  ) {
    this.connection = connection;
    this.txnHelpers = txnHelpers;
    this.admin = admin;
    this.fee_handler = admin;
  }

  async initialize(
    xcall: PublicKey,
    icon_governance: string,
    sources: Array<string>,
    destinations: Array<string>
  ) {
    let initializeIx = await xcallManagerProgram.methods
      .initialize(xcall, icon_governance, sources, destinations)
      .accountsStrict({
        state: XcallManagerPDA.state().pda,
        admin: this.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction();

    let tx = await this.txnHelpers.buildV0Txn([initializeIx], [this.admin]);
    await this.connection.sendTransaction(tx);
    await sleep(3);
  }
}
export class XcallManagerPDA {
  constructor() {}

  static state() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      xcallManagerProgram.programId
    );

    return { bump, pda };
  }
}
