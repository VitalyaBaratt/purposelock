import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import{parseEnv}from'node:util';import{forward}from'../server/rpc.mjs';
const env={...parseEnv(fs.readFileSync('.env.deployment.local','utf8')),...process.env};
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.host!=='127.0.0.1:5175'){res.writeHead(403);return res.end();}
 if(req.url==='/api/wallet-config'){
  const projectId=env.WALLETCONNECT_PROJECT_ID;
  if(req.method!=='GET'||!/^[a-f0-9]{32}$/i.test(projectId||'')){res.writeHead(503);return res.end('{}');}
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({projectId}));
 }
 if(req.url==='/api/rpc'){
  if(req.method!=='POST'){res.writeHead(405);return res.end();}
  if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:5175'){res.writeHead(403);return res.end();}
  try{let raw='';for await(const b of req){raw+=b;if(raw.length>16000)throw Error();}const r=await forward(JSON.parse(raw),env.ARC_MAINNET_RPC_URL);res.writeHead(r.status,{'Content-Type':'application/json'});return res.end(JSON.stringify(r.body));}catch{res.writeHead(400);return res.end('{}');}
 }
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve('dist','.'+pathname);if(!file.startsWith(path.resolve('dist')+path.sep)&&pathname!=='/'){res.writeHead(403);return res.end();}
 const target=pathname==='/'?'dist/index.html':file;
 if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));
}).listen(5175,'127.0.0.1',()=>console.log('Mainnet frontend: http://127.0.0.1:5175 — no automatic wallet connection or transactions.'));
