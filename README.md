
# Balanced Solana Programs

## Overview

The Balanced programs on Solana blockchain ecosystem is designed to manage various aspects of the decentralized application (dApp) including asset management, stablecoin operations and crosschain administration. This structure ensures efficient handling of these operations through well-defined programs with unique program ID.

## Programs

There are three solana programs associated with balanced, each responsible for specific functionalities:

### 1. Asset Manager: asset_manager

-  **Purpose**: Manages assets within the Balanced ecosystem.

### 2. xCall Manager: xcall_manager

-  **Purpose**: Facilitates cross-chain administration from the icon side.

### 3. Balanced Dollar: balanced_dollar_crosschain

-  **Purpose**: Manages the crosschain bnUSD operations within the Balanced ecosystem.

## Identifiers

### Program IDs

-  **Definition**: Unique identifiers for each program, akin to contract addresses in other blockchain ecosystems.

-  **Usage**:

- Each program (Asset Manager, xCall Manager, Balanced Dollar) has its own Program ID.

- Program IDs are used for configuring the Balanced programs in other chains.

- They enable specific interactions and operations within each program, ensuring modular and isolated management of functionalities.


## Usage in Cross-Chain Configuration

-  **Configuration**: Program IDs are critical for setting up Balanced in cross-chain environments. They ensure that each module can be independently addressed and interacted with from other chains.

-  **Function Calls**: The Program ID is used for function calls from the Solana blockchain, there is no cli infrastructure for function calls on Solana ecosystem, the main reason for this is all accounts used in the transaction should be passed while calling a function on Solana, and that makes it complex to use shell command

## Frontend Integration Interfaces

This guide provides an overview of the key functions for interacting with the Solana blockchain within your frontend application. These functions are part of the Asset Manager, Balanced Dollar, and XCall Programs, which allow for token deposits, cross-chain transfers, and cross-chain calls.

### Important Note: Accessing states in Solana
In Solana programs data are stored in specific accounts, those data later can be read directly from the program accounts providing the specific account, Hence there is no read api's available on the Solana programs


### Important Note: Statelessness in Solana

Solana is a stateless blockchain, which means that unlike stateful blockchains, it does not automatically keep track of states between transactions. Due to this, when interacting with Solana, you need to provide all the accounts used in the transaction. 

The transaction may include multiple program such that accounts of multiple programs should be provided with the Function call. The accounts of the called program are sent on the "accountsStrict" and the accounts of the other programs are sent on the "remainingAccounts". For the user accounts and program ids the public key is used, system Id is provided by SDK and the accounts of data storage (PDAs => Program derived accounts) are derived using program Id and seeds that are defined by the programs.

  #### PDAs of Asset Manager Program

```typescript 
static state() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("state")],
	assetManagerProgram.programId
	);
	return { bump, pda };
}

static token_state(mint: PublicKey) {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("token_state"), mint.toBuffer()],
	assetManagerProgram.programId
	);
	return { bump, pda };
}

static vault(mint: PublicKey) {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("vault"), mint.toBuffer()],
	assetManagerProgram.programId
	);
	return { bump, pda };
}

static vault_native() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("vault_native")],
	assetManagerProgram.programId
	);
	return { bump, pda };
}

static rate_limit(token_key: Buffer) {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("rate_limit"), token_key],
	assetManagerProgram.programId
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

static xcall_authority() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("dapp_authority")],
	assetManagerProgram.programId
	);
	return { bump, pda };
}
```
#### PDAs of Balanced Dollar Program

```typescript
static state() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("state")],
	balancedDollarProgram.programId
	);
	return { bump, pda };
}

static program_authority() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
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

static xcall_authority() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("dapp_authority")],
	balancedDollarProgram.programId
	);
	return { bump, pda };
}
```
#### PDAs of Xcall Manager Program
```typescript
static state() {
	let [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("state")],
	xcallManagerProgram.programId
	);
	return { bump, pda };
}
```
####  The Xcall and Centralized connection PDAs are available in their document 
---

  

### Asset Manager Program

The Asset Manager Program handles depositing Solana native token and Solana SPL tokens in balanced.

  

#### `deposit`

Deposits a specified amount of a token into the Solana blockchain.
```typescript
function deposit_token(
	ctx: Context<DepositToken>, //All the required accounts are passed on the transaction context, In case of optional acccount, if not needed can be sent null
	amount: u64, //amount of token being deposited
	to: Option<String>,// (Optional) The recipient's address if needed
	data: Option<Vec<u8>> //(Optional) An additional data you want to attach to the deposit
)
```
 ##### Calling the deposit method using Typescript 

```typescript 
	await program.methods.depositToken(
		bn(1000000000),
		depositorTokenAccount.address.toString(),
		bytes
	).accountsStrict({
		from: depositorTokenAccount.address,
		vaultNativeAccount: null,
		fromAuthority: depositorKeyPair.publicKey,
		vaultTokenAccount: vaultTokenAccount.address,
		vaultAuthority: AssetManagerPDA.vault(mint).pda,
		state: AssetManagerPDA.state().pda,
		xcallManagerState: AssetManagerPDA.xcall_manager_state().pda,
		xcallConfig: XcallPDA.config().pda,
		xcall: xcall_program.programId,
		xcallManager: xcall_manager_program.programId,
		tokenProgram: TOKEN_PROGRAM_ID,
		systemProgram: SYSTEM_PROGRAM_ID,
		xcallAuthority: AssetManagerPDA.xcall_authority().pda,
	}).remainingAccounts([
		{
			pubkey: XcallPDA.config().pda,
			isSigner: false,
			isWritable: true,
		},
		{
			pubkey: XcallPDA.rollback(xcall_config.sequenceNo.toNumber() + 1).pda,
			isSigner: false,
			isWritable: true,
		},
		{
			pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
			isSigner: false,
			isWritable: false,
		},
		{
			pubkey: xcall_config.feeHandler,
			isSigner: false,
			isWritable: true,
		},

		//connection params
		{
			pubkey: connectionProgram.programId,
			isSigner: false,
			isWritable: true,
		},
		{
			pubkey: ConnectionPDA.config().pda,
			isSigner: false,
			isWritable: true,
		},
		{
			pubkey: ConnectionPDA.network_fee(IconNetworkId).pda,
			isSigner: false,
			isWritable: true,
		},
	]).instruction();
	
	const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
		units: 1000000,
	});
	
	const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
		microLamports: 0,
	});
	
	let tx = await ctx.txnHelpers.buildV0Txn(
		[modifyComputeUnits, addPriorityFee, depositTokenIx],
		[depositorKeyPair]
	);
	await connection.sendTransaction(tx);
```
---
### Balanced Dollar Program

The Balanced Dollar module facilitates the transfer of `BALANCED_DOLLAR` tokens across chains.

#### `cross_transfer`

Transfers `BALANCED_DOLLAR` tokens across chains.

```typescript
function cross_transfer(
	ctx: Context<CrossTransfer>, //All the required accounts are passed on the transaction context, In case of optional acccount, if not needed can be sent null
	to: String,  // The recipient's address on the destination chain.
	value: u64,  // the bnUSD amount being transferred
	data: Option<Vec<u8>>, // (Optional) Any additional data to attach to the transfer.
)
```

### XCallManager Program
The xcall manager program incluses the crosschain administration features. In Solana data stored on accounts can be accessed directly via programs.
