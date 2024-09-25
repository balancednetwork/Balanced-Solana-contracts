
**Balanced Solana spoke contracts**

  

This document outlines the major changes in the implementation of Balanced in the Solana blockchain and the rationale behind these changes. Key updates includes query handle call message accounts features on all programs, bnUSD token(an SPL token) separation from Balanced dollar program, force rollback feature and return type of handle_call_message method

  

For more details on each spoke contracts see: [Balanced Crosschain Docs](https://github.com/balancednetwork/balanced-java-contracts/blob/420-balanced-docs/docs/crosschain.md)

  

For more details on the Balanced Protocol see [Balanced Docs](https://github.com/balancednetwork/balanced-java-contracts/blob/420-balanced-docs/docs/docs.md) or [Balanced Network](https://balanced.network/)

  

1.  **Query Handle call message accounts**

  

**Change:** A feature has been added so that all required accounts for the handle call message method can be queried from the program.

  

**Process:**

1. Added the `query_handle_call_message_accounts` method on all the balanced programs. The method takes state account in the context and takes data and the protocols on the parameter. Data is required to get accounts inside the data. protocols is not required for balanced and added it as per the xcall standard only.

  

**Rationale:**

* The methods of Solana programs requires all associated accounts of the methods to be sent on the context of the method. it makes relayer easier to send the account without storing or creating any accounts priorly

  

2.  **Balanced Dollar Token Contract Separation**

  

**Change:** Token program for Balanced Dollar is separated from the cross-chain features.

  

**Rationale:** Solana SPL token can be created with CLI and a general SPL token don't need a program. The bnUSD token will be created with CLI and only the cross chain features is included on balanced dollar program

3.  **Return type of `handle_call_message` method**

  

**Change:**  `handle_call_message` method of all the programs returning same specific data structure

**Rationale:** This is the xcall specification for solana blockchain to return the specified data structure from `handle_call_message` method

4. **Handling Rollback Failures**

   **Change:** Introduced `forced_rollback` in Balanced, which can be executed by an admin in case of a failure in `handle call message`.

   **Rationale:** There is no concept of exception handling in Solana CPI, such as try-catch, making it impossible to rollback every message that fails in `handlecall message`, specially while getting accounts for `execute_call` of Xcall. Instead, it will fail the entire transaction if there is a configuration failure.