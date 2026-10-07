# PurposeLock

[Live site](https://purposelock.vercel.app) · [Public repository](https://github.com/VitalyaBaratt/purposelock)

A purpose-locked USDC fundraising MVP for Arc Microgrants. Solidity escrow + an English-first web UI with EN/UA support (Vite / ethers), a narrowly scoped read-only RPC backend, and no database or storage of wallet secrets.

**Status:** the contract is deployed on Arc Mainnet at `0xca986d006b0a07f3f31c6087cb38cdbf3aedfa0d`. The production frontend connects to it through a private server-side RPC. The public version is connection-only: Mainnet transactions are temporarily blocked pending a separately approved live test; live lifecycle testing and source verification remain pending. The project has not been independently audited.

Current configuration and limitations: [deployment record](docs/DEPLOYMENT.md), [mainnet release instructions](docs/MAINNET-RELEASE.md). The previously observed 403/1009 error from the official RPC no longer blocks development: a private QuickNode endpoint is now in use.

## Get started in minutes

Requires Node.js **22.13+** (the latest Node 22 LTS release is recommended) and npm.

```sh
npm ci
npm test
npm run demo
```

In another terminal, from the same directory:

```sh
npm run dev
```

Open [PurposeLock locally](http://127.0.0.1:5173). The demo starts Hardhat at `127.0.0.1:8545`, deploys mock USDC and the contract, creates two campaigns, and writes public settings to the ignored `.env.local` file. Switch between Creator / Donor A / Donor B / Merchant in the UI. No real funds or wallet are required. The merchant address is printed at startup; keys are not.

The demo runs entirely in memory. Restarting clears its history; restart the web server and refresh the browser tab as well. The script will not overwrite `.env.local` if it contains a different network configuration. To stop, press Ctrl+C in both terminals. Do not expose the local RPC to other machines; its accounts are unlocked for testing only.

To run the network and UI in a single process instead of using two terminals, use `npm run demo:web`.

## Updated frontend

English is the default language. The **EN / UA** switch uses the dictionary in `src/i18n.js`; the language preference is stored locally. Creator-written titles and descriptions are not translated automatically.

- [Demo campaign](http://127.0.0.1:5173/#/fund/1): **New PC for my stream**, 735 / 1,000 USDC, Gaming/Streaming PC, Example PC Store. The 735 USDC represents actual contributions to the local mock contract (500 + 235), rather than a static illustration. The amount changes as you make transactions.
- [Explore Funds](http://127.0.0.1:5173/#/explore): browse campaigns and open them by ID.
- [Create Fund](http://127.0.0.1:5173/#/create): a dedicated creation form.
- [My Funds](http://127.0.0.1:5173/#/dashboard): shows only the connected creator's campaigns, statistics, and links to `#/dashboard/<id>` for activity history and permitted actions.
- `#/fund/<id>`: a public, shareable campaign page with Donate USDC / Claim Refund. The designated merchant also sees Accept Campaign Terms / Refund to PurposeLock on this page.

Dark graphite surfaces, violet accents, subtle glass effects, and a responsive donation panel. Green indicators signal a protected payment route or a successful state, **not a verified merchant identity**. On mobile, the campaign purpose and merchant appear in the header before the donation form.

The Solidity code and the file containing all 17 contract tests are unchanged. The four new text fields are encoded as `PL1:[title,purpose,description,merchantName]` in the existing `purpose` field, with a combined limit of 240 UTF-8 bytes. The original plain-text format remains supported. No metadata is stored exclusively in the browser; opening a link on another device retrieves the same data from the contract.

Activity history is read from contract events in batches of 5,000 blocks using Load earlier activity. When only part of the history has been loaded, the UI explicitly shows the range. The dashboard initially scans the 20 most recent campaigns and offers Load more; statistics are labeled as applying to the loaded campaigns.

## Implemented features

- The creator is also the beneficiary of the goods. They set the purpose (up to 240 UTF-8 bytes), goal, deadline up to 365 days away, and a fixed merchant address.
- The merchant accepts the terms in a separate transaction. Donations are blocked until acceptance.
- The donor grants an exact ERC-20 approval, then calls `donate`. Amounts are whole micro-USDC units, with **6 decimals**. Contributions exceeding the remaining goal are rejected.
- Once the goal is reached, anyone can call `payMerchant`. The full goal amount goes exclusively to the fixed merchant, even after the deadline.
- If `block.timestamp >= deadline` and the goal has not been reached, `claimRefund` returns only the donor's own contribution. Repeat claims are blocked.
- After payment, the merchant can make a **full** `merchantRefund`: exact approval + transferFrom into the contract. Original donors can then claim their contributions. Partial refunds are not supported in the MVP.
- UI: campaign creation, merchant acceptance, donations, settlement, both refund paths, balance, deadline, the latest 20 campaigns + lookup by ID, explorer links, pending/error/success states, account/network change handling, and a local deployment helper.

### States

| Current state | Condition / action | Result |
|---|---|---|
| Funding, merchant has not accepted | `acceptMerchant` by the fixed merchant | Donations enabled |
| Funding | Before deadline, contribution ≤ remaining goal | Contribution and escrow increase |
| Funding | Raised = goal, `payMerchant` | Paid; funds sent to merchant |
| Funding | Deadline reached, raised < goal, donor claim | Refunding; funds returned to original donor |
| Paid | Full `merchantRefund` by merchant | Refunding; funds back in escrow |
| Refunding | Original donor claim | Donor's own contribution returned |

`raised` is the historical amount raised, not the current balance. `refunded` tracks donor refunds already paid. `totalEscrowed` is the sum of outstanding obligations across all campaigns currently held by the contract. A failed campaign does not require a separate finalization step.

## Scope of guarantees and trust model

The contract enforces permitted payout addresses **within its own functions**. There is no owner/admin, upgrade mechanism, sweep function, beneficiary withdrawal, or merchant change. If the creator also donated, they have only the same right as other donors to reclaim their own contribution.

**Approved merchant means selected by the creator, not verified by PurposeLock.** Different addresses may belong to the same person. A merchant may collude with the creator, fail to deliver goods, refuse a refund, or transfer funds to the beneficiary outside the system. On-chain acceptance cannot compel a real-world refund. Physical goods require a separate agreement with the store to issue refunds exclusively through `merchantRefund`, along with merchant and delivery verification. This is not a validated AML screening mechanism.

Do not send USDC directly to the contract: a regular ERC-20 transfer does not create a contribution or establish a refund entitlement. Unattributed transfers cannot be recovered; there is no administrative sweep function. Calls that send native value to this contract are not supported. Use `donate` / `merchantRefund`.

USDC blocklisting or network failures may prevent individual payouts. One donor's claim does not depend on another's. If the merchant is blocklisted after a campaign is fully funded, payout may become unavailable: this version has no alternative recipient or cancellation mechanism. SafeERC20, ReentrancyGuard, and checks-effects-interactions protect the accounting but do not eliminate network limitations.

## Verified Arc Microgrants requirements

Checked on **September 30, 2026** against the [official program page](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq):

- 20 microgrants of 500 USDC each; a total pool of 10,000 USDC.
- Submission requires a **working deployment on Arc mainnet**, a public repository, a short description, and a public builder profile.
- Testnet-only projects, mockups, and work already funded by Circle/Arc are not eligible.
- Deadline: **October 14, 2026, 23:59 ET**; decisions by October 21. Check the page again before submitting, as dates may change.
- Jurisdiction screening and recipient verification apply before payment. Selection and funding are not guaranteed.

Technical decisions and documentation discrepancies: [docs/RESEARCH.md](docs/RESEARCH.md). Demo plan and application draft: [docs/SUBMISSION.md](docs/SUBMISSION.md).

## Arc configuration

| Parameter | Mainnet | Testnet |
|---|---|---|
| `VITE_NETWORK` | `arc` | `arcTestnet` |
| Chain ID | 5042 | 5042002 |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | Same address |
| ERC-20 decimals | 6 | 6 |
| Native gas decimals | 18 | 18 |

Sources: [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [Contract addresses](https://docs.arc.io/arc/references/contract-addresses). These are two interfaces to **one USDC balance**. Donations do not use `msg.value`. Additional USDC is needed for gas; in particular, the merchant must not spend the entire balance before making a full refund.

Read-only checks without a wallet:

```sh
npm run check:arc
npm run check:arc -- --mainnet
```

The script checks the chain ID and USDC decimals, and reads the symbol and block number. If it returns 403/1009, check the official RPC's availability and access conditions with the network operator; do not treat that result as successful mainnet verification.

## Deploy through your wallet without exporting keys

1. Run the tests. First verify the full lifecycle on Arc Testnet; local Hardhat does not emulate Arc-specific precompiles or native USDC.
2. Stop demo/dev. Back up your `.env.local` if needed, then create it from `.env.example`. For testnet, keep `VITE_NETWORK=arcTestnet`; for mainnet, use `arc`. Leave `VITE_CONTRACT_ADDRESS` empty for the first deployment and `VITE_RPC_URL` empty to use the official endpoint. Do not leave the demo's localhost RPC configured.
3. Run `npm run dev`. Open `http://127.0.0.1:5173` in a browser with an EVM wallet. Connect your wallet; the UI prompts for the correct network. Fund the wallet with USDC and approve any signatures yourself in the wallet. For testnet, use the [Circle faucet](https://faucet.circle.com).
4. The developer helper is available at `http://127.0.0.1:5173/#/deploy` (localhost development only, with an Arc configuration), outside the main navigation. Check the network, canonical USDC address, and contract source; first click “Estimate deployment (no transaction)”. Signing is disabled by default. Only after separately and explicitly approving a real deployment, set the public flag `VITE_ENABLE_DEPLOYMENT=YES` locally, restart dev, repeat the estimate, select the checkbox, and click “Deploy PurposeLock”. Review the gas settings in your wallet and confirm or reject the transaction yourself.
5. After the receipt arrives, the UI displays `VITE_CONTRACT_ADDRESS=0x…`. Add this public address to `.env.local`, restart dev, and verify the address/transaction in the explorer. Testnet and mainnet settings are not interchangeable.
6. Verify the source in the explorer: compiler **0.8.37+commit.f401782d**, optimizer **enabled, 200 runs**, EVM **Shanghai**, contract `contracts/PurposeLock.sol:PurposeLock`, constructor `address` set to canonical USDC. `npm run compile` generates the complete `artifacts/standard-input.json` for Standard JSON verification. Explorer UIs/APIs may change; verification has not yet been completed.
7. On testnet, then with a minimal amount on mainnet, check both scenarios: goal → merchant payment → merchant refund → donor claims; failed deadline → donor claims. Sign manually. Record the contract address, deployment tx, campaign IDs, and transaction links in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The deployment helper is available only on **localhost in dev mode**; it is not part of the production UI. There is no seed phrase/private key form, no secret environment variables or script-based signer for wallet keys. Do not enter them into chat, the terminal, `.env`, GitHub, or Vercel.

## GitHub and Vercel

Publish the clean export from `npm run check:release -- --export` (the `release-mainnet/` directory), excluding local artifacts and the parent ChatGPT project. The original directory remains the development root. `.gitignore` excludes local settings, dependencies, artifacts, and test reports. The parent ChatGPT project's `sources/` directory is not part of this project and remains untouched.

1. Create a public GitHub repository containing **only the clean `release-mainnet/` directory's contents**; include `package-lock.json`. GitHub Desktop is an option. Having a repository does not, by itself, constitute a deployment.
2. GitHub Actions is triggered manually through workflow_dispatch and runs `npm ci`, contract tests, a build smoke check, and Playwright E2E. CI does not require wallet signatures or secrets.
3. Import the repository into Vercel. Framework: **Vite**. If you uploaded the parent directory, set Root Directory to `purposelock`; if this directory's contents are at the repository root, leave Root Directory empty. Build: `npm run build:production`; output: `dist`; Node: 22.x.
4. Add only the server-side `ARC_MAINNET_RPC_URL` to private Vercel environment settings. The production build sets the mainnet address and `/api/rpc` automatically. Do not put private URLs in `VITE_*` variables: they are included in the bundle.
5. Deploy a preview and check the UI and network selection. Then publish production. Configuration changes take effect only after a rebuild. `vercel.json` is ready; the server-side RPC requires the private variable above.
6. Add the live URL / repository / explorer links to the deployment record and application.

`npm run build` deliberately refuses to publish `VITE_NETWORK=local`. To run a compile/build smoke check while keeping the local demo configured:

```sh
VITE_NETWORK=arcTestnet VITE_CONTRACT_ADDRESS= VITE_RPC_URL= npm run build
```

This build has no deployment address and is **not a submission-ready grant project**. Vercel workflow references: [Vite deployment](https://vite.dev/guide/static-deploy.html#vercel), [Vercel Git](https://vercel.com/docs/git).

## Tests

```sh
npm test
npm run build  # for arc/arcTestnet configuration, not local
npx playwright install chromium
npm run test:ui
npm audit
```

E2E starts the local demo and web server automatically if they are not already running. Run it with a local configuration; back up any existing non-local `.env.local` separately. If Google Chrome is installed, you can use `PW_CHANNEL=chrome npm run test:ui` instead of downloading Chromium.

17 contract tests: terms/consent, roles, cap, allowance/balance failure, deadline boundary, fixed recipient, repeated calls, full merchant refund, atomic rollback, blocklisted transfer simulation, reentrancy, fee-token rejection, isolated accounting, unsolicited transfers, micro-unit precision, and the mixed-campaign accounting invariant. 3 browser tests: the full merchant refund lifecycle, failed deadline + escaping, and mobile layout. Tests use local mock funds; a real browser extension, the Arc runtime, and mainnet signatures require a separate manual smoke test.

## Project structure

- `contracts/PurposeLock.sol` — escrow; `contracts/test/MockUSDC.sol` — tests only.
- `src/` — UI and networks; `scripts/compile.mjs` — pinned compiler / ABI / verification input.
- `scripts/demo.mjs` — local network; `scripts/check-arc.mjs` — read-only preflight.
- `test/` — contract tests; `e2e/` — UI tests.
- `docs/` — research, deployment evidence, submission draft, verification results.

License: MIT. Large real-world campaigns require an independent audit and a verified merchant integration.
