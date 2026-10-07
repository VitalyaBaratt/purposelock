# Live test plan — 2026-10-06

Status: connection-only preparation. No Mainnet transaction or signature authorized. Mainnet writes are blocked in src/chain.js and the frontend WalletConnect adapter. Before enabling writes, implement and verify per-transaction gasLimit × maxFeePerGas caps and a cumulative budget ledger; do not merely remove the gate. Reconcile every receipt (including failures) before proceeding. Unknown transaction outcomes stop the test; never blindly retry.

Target: Arc 5042, PurposeLock 0xca986d006b0a07f3f31c6087cb38cdbf3aedfa0d, USDC 0x3600000000000000000000000000000000000000.

## Wallets

Use three distinct, user-controlled wallets. Do not use a real external shop. Creator can be the already funded deployment wallet. No new wallet keys are needed by the app.

| Wallet | Transactions | Required starting Arc USDC budget |
|---|---:|---:|
| Creator | 3 | 0.060 |
| Donor | 6 | 0.135 (0.120 fees + 0.015 principal) |
| Merchant | 4 | 0.080 (fee reserve; return the received 0.010 in full) |
| Total | 13 | 0.275 |

These are conservative allocated budgets, not instructions to transfer funds now. Existing balances can exceed them. Budget calculation assumes the three wallets are already funded and initial donor/merchant allowances to PurposeLock are zero. If funding transfers or allowance resets are necessary, stop and revise the transaction count and fee allocation within 0.275; no extra cost is implicitly authorized. No wallet-funding fee may be silently excluded from the overall ceiling.

## Exact lifecycle (no retries or resets included)

| # | Signer | Transaction | USDC principal |
|---|---|---|---:|
| 1 | Creator | Create success campaign, goal 0.010, merchant fixed, deadline +1 hour | 0 |
| 2 | Merchant | Accept campaign terms | 0 |
| 3 | Donor | Approve exactly 0.010 for PurposeLock | 0 |
| 4 | Donor | Donate to success campaign | 0.010 |
| 5 | Creator | Pay fixed merchant | 0.010 from escrow |
| 6 | Merchant | Approve exactly 0.010 for PurposeLock | 0 |
| 7 | Merchant | Refund full payment into PurposeLock | 0.010 |
| 8 | Donor | Claim original contribution | 0.010 returned |
| 9 | Creator | Create failed campaign, goal 0.010, deadline +10 minutes | 0 |
| 10 | Merchant | Accept campaign terms | 0 |
| 11 | Donor | Approve exactly 0.005 | 0 |
| 12 | Donor | Donate 0.005, leaving goal unmet | 0.005 |
| 13 | Donor | After on-chain deadline, claim refund | 0.005 returned |

Waits, wallet connections, balance checks and read-only rejection simulations cost no gas. Do not submit transactions deliberately expected to revert. Check original contribution accounting, fixed recipient, escrow balance and receipt status at each step.

## Fees and worst-case loss

Read-only Mainnet gas price at preparation: 20,000,000,158 wei (~20 gwei). Local mock execution of the 13 steps used 1,113,320 gas: at this price ~0.02227 USDC. This is an indicative baseline only, not an Arc-native-USDC estimate: calldata, state and native-token implementation differ. Every real step needs a fresh Mainnet eth_estimateGas immediately before signing, after its prerequisites exist.

Ceiling: 0.020 USDC fee per lifecycle transaction, 0.260 total fees; 0.015 total contributed principal conservatively counted as at risk. Maximum total loss/outflow allocated to this test: 0.275 USDC. Successful refunds leave only actual gas irreversibly spent. Worst case includes losing/locking all 0.015 principal plus all allocated fees. Reverts also consume gas and must debit the same budget. Wallet UI fee edits must not exceed the reviewed caps.

## Next manual actions

1. On http://127.0.0.1:5175/#/explore choose Connect Wallet → Binance Wallet · QR; scan inside Binance Wallet and approve connection only to Arc 5042. No signature request is expected.
2. Supply only the three public addresses and roles, or say that donor/merchant wallets are not funded. Do not fund them yet: read-only balances and allowances determine whether the 13-transaction plan applies.
3. Review the final transaction/fee caps after these checks and explicitly authorize the live test. Signing remains disabled until then. No seed phrase/private key is ever requested.

WalletConnect uses a client-visible Reown project identifier fetched at runtime from /api/wallet-config; it is intentionally absent from static files, Git and the compiled bundle. It is not a secret and cannot be hidden from a browser using WalletConnect. QuickNode URL remains server-only. Limit Reown origins before public hosting: https://docs.reown.com/walletkit/ios/cloud/relay.
