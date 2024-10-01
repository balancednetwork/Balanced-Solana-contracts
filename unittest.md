# Steps to run unit test
Copy xcall.json and centralized_connectoin.json from .types to .target/idl/
```shell
	cp types/xcall.json target/idl/
	cp types/centralized_connection.json target/idl
```
Initialized solana-test-validator (assumed it is previously installed)
```shell
	solana-test-validator -r
```
Deploy the xcall and centralized connection programs:
```shell
	solana program deploy xcall_so/xcall.so
	solana program deploy xcall_so/centralized_connection.so
```
Run the balanced test
```shell
	anchor test --skip-local-validator