//imports
import * as anchor from "@coral-xyz/anchor";
import {  PublicKey } from "@solana/web3.js";

import { TransactionHelper, sleep } from "./utils";
import { XcallManagerPDA } from "./axcall_manager/setup";
import { TestContext as BalancedDollarContext } from "./balanced_dollar/setup";
import { XcallManager } from "../target/types/xcall_manager";


const args = process.argv.slice(2);

const xcall_address = args[0];
const icon_balanced_dollar = args[1];
const environment_rpc = args[2]

let xcall_program = new anchor.web3.PublicKey(xcall_address)

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const connection = new anchor.web3.Connection(environment_rpc, "confirmed");
let wallet = provider.wallet as anchor.Wallet;
let txnHelpers = new TransactionHelper(connection, wallet.payer);

import xcallManagerIdlJson from "../target/idl/xcall_manager.json";
import { env } from "process";
const xcall_manager_program: anchor.Program<XcallManager> =
new anchor.Program(xcallManagerIdlJson as anchor.Idl, provider) as unknown as anchor.Program<XcallManager> ;


let balancedDollarContext =  new BalancedDollarContext(
    connection, txnHelpers, wallet.payer
);


async function init(){
    sleep(3);
   
    console.log("initializing balanced dollar contract");
    await balancedDollarContext.initialize(xcall_program, icon_balanced_dollar, xcall_manager_program.programId, new PublicKey("APkyyEDmuhy3ctZiEXUJM2evUZopfnsmvv1uz1j5B9hF"), XcallManagerPDA.state().pda );
    console.log("balanced dollar contract initialized");
}

async function main() {
    await init().catch(err => console.error(err));
}

main().catch(err => console.error(err));


