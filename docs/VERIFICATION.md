# Verification — 2026-09-30

| Boundary | Result | Evidence |
|---|---|---|
| Solidity compilation | PASS | solc 0.8.37+commit.f401782d, optimizer 200, Shanghai; ABI/bytecode/Standard JSON generated |
| Contract behavior | PASS | 17/17 Node tests on isolated Hardhat EVM instances; final compiler version |
| UI → local RPC → contract → UI | PASS | Browser creates a campaign, merchant accepts, donor funds, creator triggers payment to merchant, merchant returns full amount, donor claims; onchain state/refunded amounts asserted |
| Deadline → donor claim | PASS | Browser flow plus exact chain timestamp boundary in contract tests |
| Input escaping | PASS | HTML-like purpose remains text; no injected image |
| Mobile UI | PASS | 390px viewport, key controls present, no horizontal overflow; screenshot inspected |
| Clean CI-style startup | PASS | No pre-existing demo config or servers; chain seeded before Vite starts; all 3 Playwright tests pass |
| Production build | PASS | Vite 7.3.6 build, Arc Testnet public configuration without a deployed contract address |
| Dependency advisories | PASS | `npm audit` returned 0 vulnerabilities after upgrades and tmp 0.2.7 override |
| Arc mainnet read-only RPC | BLOCKED | Primary RPC returned HTTP 403 / error 1009; no live chain/token confirmation from this environment |
| Arc runtime behavior | NOT RUN | Local EVM does not implement Arc native USDC/precompile semantics |
| Real browser-wallet signatures | NOT RUN | Left to user locally; no wallet secrets collected or used |
| GitHub / Vercel / mainnet publication | NOT RUN | Repository files, CI and config prepared; no remote publication claimed |
| Independent security audit | NOT DONE | Automated tests are not an audit |

Tooling: Node 26.8.1 on the development host; CI targets Node 22. Local browser verification used installed Google Chrome through agent-browser and Playwright. CI installs Chromium; Linux/Node 22 CI has not yet run remotely.

The application uses ethers 6.17.0. Tests use Hardhat 3.18.0; browser tests use Playwright 1.63.0. No local simulation result is presented as mainnet evidence. The latest production build intentionally has no contract address; the user's verified deployment address must be set before publishing a working live app.

## Frontend redesign update — 2026-10-01

See [REDESIGN.md](REDESIGN.md) for the latest UI scope and checks: unchanged 17/17 contract tests, adapted 3/3 browser flows, successful final production build and npm audit with 0 vulnerabilities. No remote publication or Arc deployment was performed during this redesign.
