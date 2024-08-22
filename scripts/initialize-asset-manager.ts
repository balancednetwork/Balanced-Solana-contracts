//imports
import * as anchor from "@coral-xyz/anchor";

import { TransactionHelper, sleep } from "./utils";
import { TestContext as AssetManagerContext } from "./xasset_manager/setup";
import { XcallManagerPDA } from "./axcall_manager/setup";
import { XcallManager } from "../target/types/xcall_manager";


const args = process.argv.slice(3);

const xcall_address = args[0];
const icon_asset_manager = args[1]
const environment_rpc = args[2]


let xcall_program = new anchor.web3.PublicKey(xcall_address)

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const connection = new anchor.web3.Connection(environment_rpc, "confirmed");
// const connection = provider.connection; //new Connection("https://solana-rpc.venture23.xyz", "confirmed");
let wallet = provider.wallet as anchor.Wallet;
let txnHelpers = new TransactionHelper(connection, wallet.payer);

import xcallManagerIdlJson from "../target/idl/xcall_manager.json";
import { env } from "process";
const xcall_manager_program: anchor.Program<XcallManager> =
new anchor.Program(xcallManagerIdlJson as anchor.Idl, provider) as unknown as anchor.Program<XcallManager> ;


let assetManagerContext =  new AssetManagerContext(
    connection, txnHelpers, wallet.payer
);



async function init(){
    sleep(3);
    console.log("initializing asset manager contract");
    await assetManagerContext.initialize(xcall_program, icon_asset_manager, xcall_manager_program.programId, XcallManagerPDA.state().pda );
    console.log("asset manager contract successfully initialized");

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


