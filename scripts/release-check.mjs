import fs from 'node:fs';
import path from 'node:path';
// Explicit publication boundary: never include parent ChatGPT project files or Git history.
const roots=['.vercelignore','.gitignore','.env.example','.github','api','server','contracts','docs','e2e','public','scripts','src','test','README.md','LICENSE','package.json','package-lock.json','vite.config.js','vercel.json','hardhat.config.js','playwright.config.js','index.html'];
const files=[];
function walk(p){if(p==='src/generated')return;const st=fs.lstatSync(p);if(st.isSymbolicLink())throw new Error(`Symlink excluded: ${p}`);if(st.isDirectory())for(const f of fs.readdirSync(p))walk(path.join(p,f));else files.push(p);}
roots.forEach(walk);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}/,/\bAKIA[A-Z0-9]{16}\b/,/(?:private[_ -]?key|mnemonic|seed[_ -]?phrase)\s*[:=]\s*["'][^"'\n]{20,}["']/i];
for(const file of files){if(/(?:^|\/)(?:\.env(?!\.example$)|node_modules|dist|artifacts|test-results)(?:\/|$)|\.(?:log|pem|key|keystore|zip|gz)$/.test(file))throw new Error(`Disallowed release file: ${file}`);const text=fs.readFileSync(file,'utf8');if(patterns.some(p=>p.test(text)))throw new Error(`Potential credential in ${file}; review locally (value withheld).`);}
if(process.argv.includes('--export')){if(fs.existsSync('release-mainnet'))throw new Error('release already exists; preserve/review it before creating a new export.');for(const f of files){fs.mkdirSync(path.dirname(`release-mainnet/${f}`),{recursive:true});fs.copyFileSync(f,`release-mainnet/${f}`);}}
console.log(`Release allowlist checked: ${files.length} source/config files; no matching credential patterns. This is a heuristic scan, not a Git-history audit.`);
