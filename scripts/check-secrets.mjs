import fs from 'node:fs';import {parseEnv} from 'node:util';
const env={...(fs.existsSync('.env.deployment.local')?parseEnv(fs.readFileSync('.env.deployment.local','utf8')):{}),...process.env};
const values=['ARC_MAINNET_RPC_URL','WALLETCONNECT_PROJECT_ID','VERCEL_TOKEN'].map(k=>env[k]).filter(Boolean);
const walk=p=>fs.existsSync(p)?fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]):[];
for(const f of [...walk('dist'),...walk('release-mainnet')]){const content=fs.readFileSync(f,'utf8');if(values.some(v=>content.includes(v))||/https:\/\/[^\s"']*quiknode\.pro/i.test(content))throw Error('Potential credential in '+f+' (value withheld).');}
console.log('PASS: private RPC and configured identifiers absent from browser bundle/export.');
