# Production readiness — 2026-10-01

Status: prepared locally; NOT deployed or independently audited. Customer UI and Solidity source are unchanged. No mainnet transaction, wallet signature, GitHub publication or Vercel publication was performed.

## Verified official configuration

| Parameter | Arc Mainnet |
|---|---|
| Chain ID | 5042 (0x13b2) |
| Public RPC | https://rpc.mainnet.arc.io |
| Explorer | https://explorer.arc.io |
| USDC ERC-20 / constructor argument | 0x3600000000000000000000000000000000000000 |
| ERC-20 decimals | 6 |
| Native gas currency / decimals | USDC / 18 |
| PurposeLock address | Pending — do not substitute a mock address |
| Compiler | 0.8.37+commit.f401782d |
| Optimizer / EVM target | enabled, 200 runs / Shanghai |
| Fully qualified contract | contracts/PurposeLock.sol:PurposeLock |

Official sources checked October 1: [network](https://docs.arc.io/arc/references/connect-to-arc), [USDC](https://docs.arc.io/arc/references/contract-addresses), [EVM differences](https://docs.arc.io/arc/references/evm-differences), [fees](https://docs.arc.io/arc/references/gas-and-fees). Arc targets Osaka; the contract uses the older compatible Shanghai instruction set. Native USDC and its ERC-20 interface share one balance. Donations/approval/refund amounts use 6 decimals; gas calculations use 18. Each signing participant needs a gas reserve in addition to their donation/refund amount.

## RPC investigation

A read-only POST `eth_chainId` to the official mainnet endpoint returned HTTP 403, `server: cloudflare`, body `error code: 1009` at 2026-10-01 17:37:01 UTC. Cloudflare Ray ID: `a43d3b9e0c431479-VIE`.

[Cloudflare's definition](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1009/) is a country/region access block at the website edge. This is not a Solidity revert, bad constructor, missing wallet signature or insufficient USDC. The Ray suffix identifies an edge location, not the user's country. Only the endpoint operator can explain the particular matched rule or an IP-geolocation error. Circle publishes [service access restrictions](https://www.circle.com/legal/acceptable-use-policy); those alone do not establish which restriction caused this response. No bypass was attempted.

Consequently, chain ID and token address are documentation-verified, not independently live-RPC-verified in this environment. Live token calls, bytecode comparison, current fee estimate and Arc integration checks remain pending. Request operator review with the timestamp, endpoint, HTTP status and Ray ID above.

## Contract review for native USDC

- Only canonical production USDC is passed by the deployment helper. Constructor enforces 6 decimals; it does not authenticate arbitrary token identity, so deployment configuration matters.
- No owner, upgrade, beneficiary withdrawal, recipient change, native-value accounting, SELFDESTRUCT or fee-oracle assumption in escrow logic.
- Incoming amounts are checked against ERC-20 balance deltas; escrow accounting tracks campaign liabilities. The escrow itself does not pay transaction gas. External signers do.
- Full goal pays only the fixed merchant; anyone can trigger it. Failed-goal refunds and full merchant-return refunds pay original donors individually.
- USDC restrictions can block payouts. A fully funded campaign has no timeout escape if its merchant cannot receive payment. Unsolicited transfers are not claimable. Merchant identity, delivery, collusion and willingness to refund remain external trust assumptions.
- The 17 tests use a mock token and standard Hardhat EVM. They do not validate Arc's native-token precompile. Run the documented complete testnet lifecycle before mainnet authorization. This review is not an independent security audit.

## Safe deployment, after access is restored

Use only a localhost dev server and an injected EVM wallet; there is no key file, private-key environment variable, CLI signer or backend custody. See README for configuration. `#/deploy` offers a read-only gas estimate. Sending is disabled unless the operator later explicitly enables `VITE_ENABLE_DEPLOYMENT=YES` locally, estimates again, checks the confirmation and signs in their wallet. Estimate expires after 2 minutes, binds the account and bytecode, and displays the maximum gas budget with a 20% gas-limit margin. Network and account are checked before signing. Wallet confirmation remains the final user action; no signature has been requested during this preparation.

Compiler outputs include ABI, bytecode, immutable-reference offsets and complete explorer Standard JSON input. After deployment, record the address, receipt and source verification in DEPLOYMENT.md. Do not publish generated artifacts or substitute local evidence for live Arc evidence.

## Vercel gate

`vercel.json` uses `npm run build:production`. Configure Node 22.x, Vite, output `dist`, and public variables:

- `VITE_NETWORK=arc`
- `VITE_CONTRACT_ADDRESS` = actual verified mainnet deployment
- `VITE_RPC_URL` = blank for official default, or an operator-approved HTTPS endpoint without embedded secrets

The guard refuses a missing/zero address, wrong chain, wrong immutable token or decimals, and mismatched deployed runtime bytecode. It masks compiler-declared immutable offsets for comparison and separately checks the immutable USDC value. Network failure blocks publication. This is an additional check, not a replacement for explorer source verification. All VITE variables are public. Never add wallet secrets to Vercel.

`npm run build` remains an offline compilation smoke test; it is NOT the production publication command. Do not import/connect the Git repository to Vercel until the real address is available.

## GitHub publication boundary

Publish only the output of `npm run check:release -- --export`: `release/`. It includes the lockfile, source, tests, license, docs, CI and public configuration example. It excludes `.env.local`, dependencies, generated ABI/bytecode, build output, screenshots, logs, test reports, Git history, archives and parent ChatGPT reference material. The scan checks common credential patterns and refuses symlinks; it cannot prove the absence of every possible secret.

No Git repository exists inside the project folder. System Git is blocked by the unaccepted Xcode license, so no commit/history verification or remote creation was performed. The clean export can be reviewed and used as a new repository. `private: true` in package.json only prevents accidental npm publication; it does not prevent public GitHub publication.

## Cost and verification

Measured unchanged PurposeLock creation on local Hardhat with MockUSDC: **1,182,693 gas**. At illustrative gas prices of 20 and 100 gwei this is approximately **0.0237–0.1183 USDC**, or **0.0284–0.1420 USDC** with a 20% gas-limit budget margin. These are scenarios, not a live mainnet quote or guaranteed price range. Arc precompile execution and current fees must be estimated by the connected wallet after RPC access works. No funds are required for the current read-only checks.

Results: 17/17 contract tests; 3/3 browser tests including mobile and both refund paths; offline production-mode bundle built successfully; npm audit reports 0 vulnerabilities. `build:production` correctly refuses the missing real mainnet address. Live production gate success is intentionally pending.

Contract SHA-256: `4375df0a2de7e8eb0a6c2f1db7621d24aaa299db31e8120d3af1254a5b80edd6`.
Contract-test SHA-256: `5a13085f416613b9210985c8e206d1b280405afb0cfe79d5d5d2b0b85ee657b0`.
