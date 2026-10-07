# Mainnet release preparation

Production build: npm run build:production. It pins Arc 5042, the deployed PurposeLock address and /api/rpc; validates live bytecode and USDC before building. Local preview: node scripts/serve-mainnet.mjs, then http://127.0.0.1:5175.

## Vercel / GitHub

Publish only the clean release-mainnet/ export, generated with npm run check:release -- --export, then npm run check:secrets. Do not upload the parent ChatGPT workspace or old release/ exports. Public repository: https://github.com/VitalyaBaratt/purposelock. Production site: https://purposelock.vercel.app. Published 2026-10-07 via GitHub API and Vercel CLI. The Vercel Git connection still requires repository-access authorization; automatic Git deployments are not configured. GitHub test workflow is manual-only.

Vercel: Vite, Node 22.x, build npm run build:production, output dist. Add ARC_MAINNET_RPC_URL as a sensitive server-only environment variable for the intended environments, using the private QuickNode HTTPS URL. Do not add any VITE-prefixed private RPC or WalletConnect variables. api/rpc.js is the Node function; server/rpc.mjs only allows bounded read requests to the deployed contracts. No wallet keys are needed by the server. Set provider quota alerts and Vercel rate limiting for /api/rpc before public promotion: origin checks do not authenticate requests or prevent quota abuse.

Main frontend now includes Binance WalletConnect QR via the shared deployment-helper pairing implementation. All Mainnet signing is blocked during preparation. Configure WALLETCONNECT_PROJECT_ID server-side: /api/wallet-config exposes only this client-visible identifier at runtime. It is absent from bundle/Git, but not a secret hidden from browser users. QuickNode remains private. Restrict Reown origins before publication. Real wallet approval is the remaining manual connection check.

CI runs offline contract/browser tests and a build smoke check; the Vercel production build additionally performs live RPC verification. Source verification remains blocked by Explorer's missing 0.8.37 compiler (see DEPLOYMENT.md).

## Live test

See [exact plan and budget](LIVE-TEST-PLAN.md). No transactions have been sent.
