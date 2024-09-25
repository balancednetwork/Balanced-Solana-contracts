import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Xcall } from "../../types/xcall";
import { CentralizedConnection } from "../../types/centralized_connection";
import { uint128ToArray } from "../utils";
const xcallProgram: anchor.Program<Xcall> = anchor.workspace.xcall;
const connectionProgram: anchor.Program<CentralizedConnection> =
  anchor.workspace.centralized_connection;

export class XcallPDA {
  constructor() {}

  static config() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      xcallProgram.programId
    );

    return { bump, pda };
  }

  static proxyRequest(requestId: number) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("proxy"), uint128ToArray(requestId)],
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

  static reply() {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("reply")],
      xcallProgram.programId
    );

    return { pda, bump };
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

  static fee(networkId: string) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee"), Buffer.from(networkId)],
      connectionProgram.programId
    );

    return { pda, bump };
  }

  static claimFees() {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim_fees")],
      connectionProgram.programId
    );

    return { pda, bump };
  }

  static receipt(sn: number) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), uint128ToArray(sn)],
      connectionProgram.programId
    );

    return { pda, bump };
  }
}
