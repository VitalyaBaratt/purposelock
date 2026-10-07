import fs from 'node:fs';import {parseEnv} from 'node:util';import {build} from 'vite';
if(fs.existsSync('.env.deployment.local')){for(const [k,v] of Object.entries(parseEnv(fs.readFileSync('.env.deployment.local','utf8'))))if(!process.env[k])process.env[k]=v;}
Object.assign(process.env,{VITE_NETWORK:'arc',VITE_CONTRACT_ADDRESS:'0xca986d006b0a07f3f31c6087cb38cdbf3aedfa0d',VITE_RPC_URL:'/api/rpc',VITE_ENABLE_DEPLOYMENT:'NO'});
await import('./production-check.mjs');
await build();
await import('./check-secrets.mjs');
