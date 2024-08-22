//imports
import * as anchor from "@coral-xyz/anchor";
import { TransactionHelper, sleep } from "./utils";
import { TestContext as xCallManagerContext, XcallManagerPDA } from "./axcall_manager/setup";
import { AssetManager } from "../target/types/asset_manager";
import { XcallManager } from "../target/types/xcall_manager";
import { BalancedDollar } from "../target/types/balanced_dollar";

const args = process.argv.slice(2);

const admin_address = args[0];
const environment = args[1]

console.log("got values " , admin_address , environment)
let xcall_program = new anchor.web3.PublicKey("7GoW5ACKgsKcjWKnfPXeGyZHMSNBJkqHFwjt5ex2i73z")
let connection_program = new anchor.web3.PublicKey("7GoW5ACKgsKcjWKnfPXeGyZHMSNBJkqHFwjt5ex2i73z")

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const connection = provider.connection; //new Connection("https://solana-rpc.venture23.xyz", "confirmed");
let wallet = provider.wallet as anchor.Wallet;
let txnHelpers = new TransactionHelper(connection, wallet.payer);

import xcallManagerIdlJson from "../target/idl/xcall_manager.json";
const xcall_manager_program: anchor.Program<XcallManager> =
new anchor.Program(xcallManagerIdlJson as anchor.Idl, provider) as unknown as anchor.Program<XcallManager> ;
import assetManagerIdlJson from "../target/idl/asset_manager.json";
const asset_manager_program: anchor.Program<AssetManager> =
new anchor.Program(assetManagerIdlJson as anchor.Idl, provider) as unknown as anchor.Program<AssetManager> ;
import balancedDollarIdlJson from "../target/idl/balanced_dollar.json";
const balanced_dollar_program: anchor.Program<BalancedDollar> =
new anchor.Program(balancedDollarIdlJson as anchor.Idl, provider) as unknown as anchor.Program<BalancedDollar> ;


let xcallManagerCtx =  new xCallManagerContext(
    connection, txnHelpers, wallet.payer
);


let icon_governance = "0x2.icon/cxdb3d3e2717d4896b336874015a4b23871e62fb6b";
let icon_connection_contract = "cx6664f06c1e19dc1d8fcbd031e99e9d623a411136";
let sources = [connection_program.toString()];
let destinations = [icon_connection_contract];

async function init(){
    sleep(3);
    console.log("initializing xcall manager contract");
    await xcallManagerCtx.initialize(xcall_program, icon_governance, sources, destinations );
    console.log("xcall manager contract initialized successfully");
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


