# Architecture decision record — 2026-09-30

## Official sources checked before implementation

- [Arc Microgrants](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq): mainnet deployment is mandatory; frontend-only and testnet-only are insufficient. A public repo and live link are submission artifacts. No prescribed app framework or requirement to custody signing keys was found on this page.
- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc): mainnet chain 5042, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`; testnet 5042002.
- [Contract addresses](https://docs.arc.io/arc/references/contract-addresses): USDC `0x3600000000000000000000000000000000000000`, ERC-20 interface 6 decimals, shared underlying native balance.
- [EVM differences](https://docs.arc.io/arc/references/evm-differences.md): Arc targets Osaka; standard local EVMs cannot reproduce all Arc behavior. Value-transfer restrictions include zero address, blocklisting and special SELFDESTRUCT behavior. Timestamps can repeat. Fee cap below 20 Gwei can be dropped.
- [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees): estimate fees from RPC and retain USDC for gas.
- [OpenZeppelin SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20): standard safe wrappers used with ReentrancyGuard.

## Documentation contradictions

The current connect and address pages explicitly distinguish mainnet and testnet, and Microgrants says mainnet is live. However, `llms.txt` still says “Testnet only”; the gas page retains a pre-mainnet disclaimer and an example mixing 6-decimal amounts with native sends. We did not copy that example. We use exclusively ERC-20 transfer/transferFrom for campaign amounts and 18-decimal gas units. Current parameter pages take precedence over stale introductory snippets, but deployment must still pass live RPC and manual transaction checks.

A read-only primary mainnet RPC request on 2026-09-30 returned HTTP 403 with `error code: 1009`. Consequently chain ID, deployed USDC behavior and live transaction execution were **not independently confirmed through RPC** here. No mainnet transaction was submitted. Resolve service access with the operator and rerun preflight from an eligible environment before deployment; this project does not bypass access restrictions.

## Decisions

1. One immutable token per contract; canonical USDC in Arc deployment helper. Constructor requires decimals=6. Mock USDC only in local testing.
2. Compile to Shanghai-compatible bytecode (supported earlier EVM target), Solidity 0.8.37, optimizer 200. Avoid new-opcode dependencies, native transfers, delegatecall and SELFDESTRUCT.
3. Creator is beneficiary; approved merchant must be a different nonzero address and cannot be escrow or token address. This is an address constraint, not proof of independent ownership.
4. Merchant accepts before funding. Consent supports the demo and integration, but is not a delivery oracle or enforceable refund guarantee.
5. Cap contributions at goal. No surplus allocation or rounding ambiguity. Funding closes at the deadline; a fully funded campaign remains payable afterwards. Payment is permissionless, destination immutable.
6. Full merchant refund only. It changes state once, pulls exact funds into escrow, then original donors claim exact contributions. No donor iteration, gas-heavy batch or partial-refund dust.
7. No admin withdrawal, upgrades, cancellation or recipient mutation. This narrows trust but leaves permanently inaccessible merchant funds or accidental transfers without administrative recovery.
8. Browser wallet signs each action; exact allowance, simulation, fee estimation, chain checks and transaction receipt. Never collect signing secrets. Local demo uses the test node's own unlocked throwaway accounts and never exports them.
9. Static Vite deployment to Vercel. No centralized transaction signer, cloud wallet custody, indexer or database needed for this scope. UI lists latest 20 IDs plus direct ID lookup.
10. `totalEscrowed` tracks liabilities independently from balances. Tokens sent directly cannot spoof a campaign contribution or merchant refund. Full refund uses the funded amount rather than the token balance.

## Deferred

Partial refunds, merchant vetting, invoices/delivery proofs, dispute resolution, offchain refund enforcement, cancellation after full funding, account abstraction, large-scale indexing, gas sponsorship and independent audit. These are not represented as completed features.
