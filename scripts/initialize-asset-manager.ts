//imports
import * as anchor from "@coral-xyz/anchor";

import { TransactionHelper, sleep } from "./utils";
import { TestContext as AssetManagerContext } from "./xasset_manager/setup";
import { XcallManagerPDA } from "./axcall_manager/setup";
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


let assetManagerContext =  new AssetManagerContext(
    connection, txnHelpers, wallet.payer
);


let icon_asset_manager = "0x2.icon/cxe9d69372f6233673a6ebe07862e12af4c2dca632";

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


