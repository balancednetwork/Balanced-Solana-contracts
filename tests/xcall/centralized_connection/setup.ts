import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";

import { CentralizedConnection } from "../../../types/centralized_connection";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { TransactionHelper, uint128ToArray } from "../../../tests/utils";
import { CSMessageType } from "../xcall/types";

import { Xcall } from "../../../types/xcall";
import { XcallPDA } from "../xcall/setup";
let provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

import connectionIdlJson from "../../../target/idl/centralized_connection.json";
const connectionProgram: anchor.Program<CentralizedConnection> =
  new anchor.Program(
    connectionIdlJson as anchor.Idl,
    provider
  ) as unknown as anchor.Program<CentralizedConnection>;
import xcallIdlJson from "../../../target/idl/xcall.json";
const xcallProgram: anchor.Program<Xcall> = new anchor.Program(
  xcallIdlJson as anchor.Idl,
  provider
) as unknown as anchor.Program<Xcall>;

export class TestContext {
  program: anchor.Program<CentralizedConnection>;
  signer: Keypair;
  admin: Keypair;
  connection: Connection;
  networkId: string;
  dstNetworkId: string;
  txnHelpers: TransactionHelper;
  isInitialized: boolean;

  constructor(
    connection: Connection,
    txnHelpers: TransactionHelper,
    admin: Keypair
  ) {
    this.program = connectionProgram;
    this.signer = admin;
    this.admin = admin;
    this.connection = connection;
    this.txnHelpers = txnHelpers;
    this.networkId = "solana";
    this.dstNetworkId = "0x3.icon";
  }

  async initialize() {
    try {
      await this.program.methods
        .initialize(xcallProgram.programId, this.signer.publicKey)
        .signers([this.signer])
        .accountsStrict({
          signer: this.signer.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
          config: ConnectionPDA.config().pda,
          authority: ConnectionPDA.authority().pda,
        })
        .rpc();
    } catch (err) {
      console.log("error initializing: ", err);
    }
  }

  async setAdmin(keypair: Keypair) {
    await this.program.methods
      .setAdmin(keypair.publicKey)
      .accountsStrict({
        admin: this.admin.publicKey,
        config: ConnectionPDA.config().pda,
      })
      .signers([this.admin])
      .rpc();

    this.admin = keypair;
  }

  async setNetworkFee(networkId: string, msgFee: number, resFee) {
    await connectionProgram.methods
      .setFee(networkId, new anchor.BN(msgFee), new anchor.BN(resFee))
      .accountsStrict({
        config: ConnectionPDA.config().pda,
        networkFee: ConnectionPDA.network_fee(networkId).pda,
        admin: this.admin.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([this.admin])
      .rpc();
  }

  async getRecvMessageAccounts(
    fromNetwork: string,
    connSn: number,
    sequenceNo: number,
    csMessage: Uint8Array,
    csMessageType: CSMessageType
  ) {
    const remainingAccounts = [
      {
        pubkey: XcallPDA.config().pda,
        isWritable: true,
        isSigner: false,
      },
    ];

    if (csMessageType == CSMessageType.CSMessageResult) {
      remainingAccounts.push({
        pubkey: XcallPDA.rollback(sequenceNo).pda,
        isWritable: false,
        isSigner: false,
      });
    }

    remainingAccounts.push({
      pubkey: xcallProgram.programId,
      isWritable: false,
      isSigner: false,
    });

    let res = await connectionProgram.methods
      .queryRecvMessageAccounts(
        fromNetwork,
        new anchor.BN(connSn),
        Buffer.from(csMessage),
        new anchor.BN(sequenceNo),
        1,
        30
      )
      .accountsStrict({
        config: ConnectionPDA.config().pda,
      })
      .remainingAccounts(remainingAccounts)
      .view({ commitment: "confirmed" });

    return res.accounts;
  }

  async getConfig() {
    return await this.program.account.config.fetch(
      ConnectionPDA.config().pda,
      "confirmed"
    );
  }

  async getFee(nid: string) {
    return await this.program.account.networkFee.fetch(
      ConnectionPDA.network_fee(nid).pda,
      "confirmed"
    );
  }
}

export class ConnectionPDA {
  constructor() {}

  static config() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      connectionProgram.programId
    );

    return { bump, pda };
  }

  static network_fee(networkId: string) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee"), Buffer.from(networkId)],
      connectionProgram.programId
    );

    return { pda, bump };
  }

  static receipt(networkId: string, sn: number) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(networkId), uint128ToArray(sn)],
      connectionProgram.programId
    );

    return { pda, bump };
  }

  static authority() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("connection_authority")],
      connectionProgram.programId
    );

    return { bump, pda };
  }
}
