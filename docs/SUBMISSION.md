# Arc Microgrants submission preparation

**Do not submit until the mainnet deployment works and all links are real.** Eligibility and dates must be rechecked on the [official program page](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq).

## Short project description (English)

PurposeLock is a USDC donation escrow on Arc for a fixed purchasing purpose. A creator selects a goal, deadline and merchant; the merchant accepts the terms before funding. Donors deposit USDC, and once the goal is reached the contract can pay only the nominated merchant. Unsuccessful campaigns let donors reclaim their own contributions. A participating merchant can return the full payment to the contract, reopening donor claims instead of paying the beneficiary.

Arc provides USDC-denominated gas and a native USDC ERC-20 interface, allowing the donation and fee experience to use one asset. PurposeLock does not claim to verify delivery, merchant identity or prevent offchain collusion. It demonstrates programmable payment destinations and a merchant-integrated refund path, with explicit trust boundaries.

## Attach after deployment

- Live frontend URL: pending
- Public GitHub repo: pending
- Verified Arc mainnet contract: pending
- Public builder profile: pending (user-provided)
- Mainnet lifecycle transaction links: pending

## Two-minute demo

1. Show fixed purpose, budget, deadline, creator and merchant.
2. Merchant accepts. Donors approve and contribute USDC.
3. Show that there is no beneficiary withdrawal or recipient edit.
4. Complete funding and trigger payment; explorer confirms merchant receives funds.
5. Merchant approves and refunds to escrow. Donors claim their original amounts.
6. Show a separate underfunded campaign after its deadline and a donor refund.
7. Explain the offchain limitation honestly and point to tests/source.

The local demo is useful for rehearsal only. A recording or testnet deployment does not replace a working mainnet build.
