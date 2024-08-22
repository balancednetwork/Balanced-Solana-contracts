//imports
import * as anchor from "@coral-xyz/anchor";
import {  PublicKey } from "@solana/web3.js";

import { TransactionHelper, sleep } from "./utils";
import { XcallManagerPDA } from "./axcall_manager/setup";
import { TestContext as BalancedDollarContext } from "./balanced_dollar/setup";
import { XcallManager } from "../target/types/xcall_manager";


const args = process.argv.slice(2);

const admin_address = args[0];
const environment = args[1]

console.log("got values " , admin_address , environment)
let xcall_program = new anchor.web3.PublicKey("7GoW5ACKgsKcjWKnfPXeGyZHMSNBJkqHFwjt5ex2i73z")

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const connection = provider.connection; //new Connection("https://solana-rpc.venture23.xyz", "confirmed");
let wallet = provider.wallet as anchor.Wallet;
let txnHelpers = new TransactionHelper(connection, wallet.payer);

import xcallManagerIdlJson from "../target/idl/xcall_manager.json";
const xcall_manager_program: anchor.Program<XcallManager> =
new anchor.Program(xcallManagerIdlJson as anchor.Idl, provider) as unknown as anchor.Program<XcallManager> ;


let balancedDollarContext =  new BalancedDollarContext(
    connection, txnHelpers, wallet.payer
);

let icon_balanced_dollar = "0x2.icon/cx87f7f8ceaa054d46ba7343a2ecd21208e12913c6";

async function init(){
    sleep(3);
   
    console.log("initializing balanced dollar contract");
    await balancedDollarContext.initialize(xcall_program, icon_balanced_dollar, xcall_manager_program.programId, new PublicKey("APkyyEDmuhy3ctZiEXUJM2evUZopfnsmvv1uz1j5B9hF"), XcallManagerPDA.state().pda );
    console.log("balanced dollar contract initialized");
}

//NEEDED TO MOVE TO XCALL AND CENTRALIZED SCRIPT

// async function setNetworkFee(networkId: string, msgFee: number, resFee) {
//     console.log("setting network fee");
//     await connectionProgram.methods
//       .setFee(networkId, new anchor.BN(msgFee), new anchor.BN(resFee))
//       .accountsStrict({
//         config: ConnectionPDA.config().pda,
//         networkFee: ConnectionPDA.fee(networkId).pda,
//         admin: wallet.payer.publicKey,
//         systemProgram: SYSTEM_PROGRAM_ID,
//       })
//       .signers([wallet.payer])
//       .rpc();
//     console.log("network fee successfully set");
// }

async function main() {
    await init().catch(err => console.error(err));
}

main().catch(err => console.error(err));


