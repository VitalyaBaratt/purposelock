# PurposeLock frontend redesign — 2026-10-01

Scope: frontend UX/UI, local demo fixtures and adaptation of the existing three browser tests. No GitHub/Vercel publication, no Arc deployment, no wallet secrets or real signatures.

## Delivered

- Public fund pages at `#/fund/<id>` with title, description, creator, purpose, merchant, deadline, live fundraising progress, donation and refund controls, fixed-destination flow and limitations.
- Explore Funds, Create Fund and creator-only My Funds listing. Individual management pages at `#/dashboard/<id>` provide campaign stats, terms, donation history and merchant-only settlement destination.
- Minimal merchant acceptance and full refund actions on the public fund page, visible only for that address.
- Graphite UI with violet accents, restrained translucent panels, responsive layouts, keyboard focus indicators, accessible form labels and status announcements.
- English default plus EN/UA catalog. Campaign authors' content is not machine-translated.
- Demo fund backed by two actual local donations totaling 735 USDC toward 1,000, with Example PC Store. The store and creator display labels are explicitly demo/creator-supplied, not verified identities.
- Existing local wallet deployment helper preserved at `#/deploy`, outside customer navigation. No deployment was performed.

## Compatibility

The contract and all 17 contract tests are byte-for-byte unchanged:

- `contracts/PurposeLock.sol` SHA256: `4375df0a2de7e8eb0a6c2f1db7621d24aaa299db31e8120d3af1254a5b80edd6`
- `test/contract.test.mjs` SHA256: `5a13085f416613b9210985c8e206d1b280405afb0cfe79d5d5d2b0b85ee657b0`

Wallet connection, chain checks, exact approval, donation, payment, full merchant refund, donor claim, fee handling and receipt handling moved to `src/chain.js`. No custody or new contract permissions were introduced.

Additional creator text fits the existing 240-byte purpose field via versioned `PL1:` JSON. All display strings are escaped. Legacy plain-text campaigns remain readable. The byte budget is shared across four fields; rich content or long descriptions would need a separate future metadata design.

History is sourced from contract logs with bounded block-range pagination. Dashboard statistics cover explicitly loaded campaigns; older campaigns can be loaded. These displays do not substitute for balances or eligibility, which are read from the contract.

## Verification

- Original contract suite: **17/17 passed**.
- Adapted browser suite: **3/3 passed**, retaining both full payment/refund and failed-deadline flows, onchain state assertions, HTML escaping and mobile overflow checks. The failed-deadline donation/refund journey executes at a 390px mobile viewport. Added creator-wallet balance invariant, merchant payout balance, distinct dashboard management, history visibility, shareable page reload, role visibility, donation presets and EN/UA switching.
- Production build: **passed** with non-local testnet configuration and no deployment address.
- `npm audit`: **0 vulnerabilities**.
- Real Arc or wallet-extension transactions: **not run**, outside this redesign request.

The initial page is a working local simulation, not a mainnet grant submission. Resetting `npm run demo:web` restores the seeded balances; it removes ephemeral local chain history.
