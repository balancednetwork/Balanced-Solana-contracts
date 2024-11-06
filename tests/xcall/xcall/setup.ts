import * as anchor from "@coral-xyz/anchor";

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { Xcall } from "../../../types/xcall";
import { TransactionHelper, sleep, uint128ToArray } from "../../../tests/utils";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

import { ConnectionPDA } from "../centralized_connection/setup";
import { CentralizedConnection } from "../../../types/centralized_connection";
let provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

  import connectionIdlJson from "../../../target/idl/centralized_connection.json";
const connectionProgram: anchor.Program<CentralizedConnection> =
  new anchor.Program(connectionIdlJson as anchor.Idl, provider) as unknown as anchor.Program<CentralizedConnection> ;
  import xcallIdlJson from "../../../target/idl/xcall.json";
const xcallProgram: anchor.Program<Xcall> = new anchor.Program(xcallIdlJson as anchor.Idl, provider) as unknown as anchor.Program<Xcall> ;

export class TestContext {
  networkId: string;
  dstNetworkId: string;
  admin: Keypair;
  feeHandler: Keypair;
  connection: Connection;
  txnHelpers: TransactionHelper;
  protocolFee: number;

  constructor(connection: Connection, txnHelpers: TransactionHelper, admin: Keypair) {
    this.networkId = "solana";
    this.dstNetworkId = "0x3.icon";
    this.connection = connection;
    this.txnHelpers = txnHelpers;
    this.admin = admin;
    this.feeHandler = admin;
  }

  async initialize(netId: string) {
    let initializeIx = await xcallProgram.methods
      .initialize(netId)
      .accountsStrict({
        signer: this.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: XcallPDA.config().pda,
      })
      .instruction();

    let tx = await this.txnHelpers.buildV0Txn([initializeIx], [this.admin]);
    await this.connection.sendTransaction(tx);
    await sleep(2);
  }

  async setFeeHandler(fee_handler: Keypair) {
    this.feeHandler = fee_handler;

    let ix = await xcallProgram.methods
      .setProtocolFeeHandler(fee_handler.publicKey)
      .accountsStrict({
        admin: this.admin.publicKey,
        config: XcallPDA.config().pda,
      })
      .instruction();

    let tx = await this.txnHelpers.buildV0Txn([ix], [this.admin]);
    await this.connection.sendTransaction(tx);
    await sleep(2);
  }

  async setProtocolFee(fee: number) {
    this.protocolFee = fee;

    let ix = await xcallProgram.methods
      .setProtocolFee(new anchor.BN(fee))
      .accountsStrict({
        admin: this.admin.publicKey,
        config: XcallPDA.config().pda,
      })
      .instruction();

    let tx = await this.txnHelpers.buildV0Txn([ix], [this.admin]);
    await this.connection.sendTransaction(tx);
    await sleep(2);
  }

  async getExecuteCallAccounts(reqId: number, data: Uint8Array, dappPda: PublicKey, dappProgramId: PublicKey, connSn: number, fromNetwork: string, connection: PublicKey) {
    const res = await xcallProgram.methods
      .queryExecuteCallAccounts(
        new anchor.BN(reqId),
        fromNetwork,
        new anchor.BN(connSn),
        connection,
        Buffer.from(data),
        1,
        30
      )
      .accountsStrict({
        config: XcallPDA.config().pda,
        proxyRequest: XcallPDA.proxyRequest(fromNetwork, connSn, connection)
          .pda,
      })
      .remainingAccounts([
        {
          pubkey: ConnectionPDA.config().pda,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: dappPda,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: connectionProgram.programId,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: dappProgramId,
          isWritable: true,
          isSigner: false,
        },
      ])
      .view({ commitment: "confirmed" });

    return res.accounts;
  }

  async getExecuteRollbackAccounts(sequenceNo: number, dappPda: PublicKey, dappProgramId: PublicKey) {
    let res = await xcallProgram.methods
      .queryExecuteRollbackAccounts(new anchor.BN(sequenceNo), 1, 30)
      .accountsStrict({
        config: XcallPDA.config().pda,
        rollbackAccount: XcallPDA.rollback(sequenceNo).pda,
      })
      .remainingAccounts([
        {
          pubkey: dappPda,
          isWritable: false,
          isSigner: false,
        },
        {
          pubkey: dappProgramId,
          isWritable: false,
          isSigner: false,
        },
      ])
      .view({ commitment: "confirmed" });

    return res.accounts;
  }

  async getConfig() {
    let { pda } = XcallPDA.config();
    return await xcallProgram.account.config.fetch(pda);
  }

  async getProxyRequest(
    fromNetwork: string,
    connSn: number,
    connection: PublicKey
  ) {
    return await xcallProgram.account.proxyRequest.fetch(
      XcallPDA.proxyRequest(fromNetwork, connSn, connection).pda,
      "confirmed"
    );
  }

  async getSuccessRes(sequenceNo: number) {
    return await xcallProgram.account.successfulResponse.fetch(
      XcallPDA.successRes(sequenceNo).pda,
      "confirmed"
    );
  }

  async getPendingRequest(messageBytes: Buffer) {
    return await xcallProgram.account.pendingRequest.fetch(
      XcallPDA.pendingRequest(messageBytes).pda,
      "confirmed"
    );
  }

  async getPendingResponse(messageBytes: Buffer) {
    return await xcallProgram.account.pendingResponse.fetch(
      XcallPDA.pendingResponse(messageBytes).pda,
      "confirmed"
    );
  }

  async getRollback(sequenceNo: number) {
    return await xcallProgram.account.rollbackAccount.fetch(
      XcallPDA.rollback(sequenceNo).pda,
      "confirmed"
    );
  }
}
export class XcallPDA {
  constructor() {}

  static config() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      xcallProgram.programId
    );

    return { bump, pda };
  }

  static proxyRequest(fromNetwork: String, connSn: number, connection: PublicKey) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proxy"),
        Buffer.from(fromNetwork),
        uint128ToArray(connSn),
        connection.toBuffer(),
      ],
      xcallProgram.programId
    );

    return { pda, bump };
  }

  static successRes(sequenceNo: number) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("success"), uint128ToArray(sequenceNo)],
      xcallProgram.programId
    );

    return { pda, bump };
  }

  static defaultConnection(netId: String) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("conn"), Buffer.from(netId)],
      xcallProgram.programId
    );

    return { pda, bump };
  }

  static pendingRequest(messageBytes: Buffer) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("req"), messageBytes],
      xcallProgram.programId
    );

    return { pda, bump };
  }

  static pendingResponse(messageBytes: Buffer) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("res"), messageBytes],
      xcallProgram.programId
    );

    return { pda, bump };
  }

  static rollback(sequenceNo: number) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("rollback"), uint128ToArray(sequenceNo)],
      xcallProgram.programId
    );

    return { pda, bump };
  }
}
