# Release checks — 2026-10-03

- Contract tests: 17 passed; Solidity unchanged (SHA-256 4375df0a2de7e8eb0a6c2f1db7621d24aaa299db31e8120d3af1254a5b80edd6).
- RPC access tests: 2 passed, including rejection of write/sign methods.
- Browser tests: 3 passed, including merchant refund, deadline refund and mobile layout.
- Production build: passed; chain 5042, canonical USDC and deployed runtime bytecode validated through private QuickNode RPC.
- npm audit: 0 vulnerabilities at check time.
- Browser bundle and clean export: configured private RPC and WalletConnect project ID absent; heuristic credential scan passed. This is not a formal audit or a Git-history audit.
- Local production preview: Mainnet displayed, 0/0 campaigns loaded successfully, no browser warnings/errors observed.
- Source verification: blocked by missing exact compiler 0.8.37 in Arc Explorer; no false verified claim.
- No new blockchain transactions, GitHub publication or Vercel deployment performed.

## WalletConnect preparation — 2026-10-06

23 tests passed (17 contract, 2 RPC, 4 WalletConnect), all 3 browser tests passed, production build passed, npm audit 0 vulnerabilities. Mainnet chain/USDC/runtime checked read-only. Actual relay pairing QR successfully displayed in the main frontend; real wallet approval remains manual. Mainnet writes and WalletConnect signatures are blocked. No blockchain transactions sent.
