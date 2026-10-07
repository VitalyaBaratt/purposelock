// One authorized contract creation, signed only by the user's browser wallet.
// Private RPC stays inside this local Node process; no signing/broadcast RPC is exposed.
import fs from 'node:fs';
import http from 'node:http';
import {parseEnv} from 'node:util';
import {ContractFactory,Interface,keccak256,formatUnits,getCreateAddress} from 'ethers';
const env={...parseEnv(fs.readFileSync('.env.deployment.local','utf8')),...process.env};
const WALLET='0xb133ee13c9EbEbe2905382fc41243A4B908579f0';
const TOKEN='0x3600000000000000000000000000000000000000';
const HASH='0x58a502db1ccfdae99f257998e634a1495b5f09ae3969fc1344d35d3e5fb4e009';
const BUDGET=58_000_000_000_000_000n;
const PORT=5174,ORIGIN=`http://127.0.0.1:${PORT}`;
const SIGNING_ENABLED=env.DEPLOYMENT_SIGNING_ENABLED==='YES';
const STATE='.tmp/mainnet-deployment.json';
const artifact=JSON.parse(fs.readFileSync('artifacts/PurposeLock.json','utf8'));
const data=(await new ContractFactory(artifact.abi,artifact.bytecode).getDeployTransaction(TOKEN)).data;
if(keccak256(data)!==HASH)throw new Error('Build differs from the explicitly approved creation code.');
if(env.DEPLOYMENT_WALLET_ADDRESS?.toLowerCase()!==WALLET.toLowerCase())throw new Error('Deployment wallet differs from approval.');
let endpoint;try{endpoint=new URL(env.ARC_MAINNET_RPC_URL);}catch{throw new Error('Missing or invalid private RPC configuration.');}
if(endpoint.protocol!=='https:')throw new Error('HTTPS RPC required.');
const abi=new Interface(['function decimals() view returns(uint8)','function usdc() view returns(address)']);
let id=0,prepared=null,preparing=false;
let record=fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE,'utf8')):null;
const hex=n=>'0x'+n.toString(16);
async function rpc(method,params=[]){
 const allowed=['eth_chainId','eth_getBalance','eth_call','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_getBlockByNumber','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getCode'];
 if(!allowed.includes(method))throw new Error('RPC method refused.');
 let res;try{res=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(20000)});}catch{throw new Error('RPC connection failed; endpoint withheld.');}
 if(!res.ok)throw new Error(`RPC HTTP ${res.status}; endpoint withheld.`);
 let body;try{body=await res.json();}catch{throw new Error('Invalid RPC response.');}
 if(body.error||body.result===undefined)throw new Error(`RPC ${method} failed; provider details withheld.`);
 return body.result;
}
function persist(){fs.mkdirSync('.tmp',{recursive:true});fs.writeFileSync(STATE,JSON.stringify(record,null,2)+'\n',{mode:0o600});}
async function prepare(){
 if(record)throw new Error('An attempt already exists. No second transaction will be offered.');
 if(BigInt(await rpc('eth_chainId'))!==5042n)throw new Error('Wrong RPC chain.');
 const tx={from:WALLET,data,value:'0x0'};
 const [balance,decimal,simulation,gas,price,tip,block,nonce,pendingNonce]=await Promise.all([
  rpc('eth_getBalance',[WALLET,'latest']),rpc('eth_call',[{to:TOKEN,data:abi.encodeFunctionData('decimals')},'latest']),rpc('eth_call',[tx,'latest']),rpc('eth_estimateGas',[tx]),rpc('eth_gasPrice'),rpc('eth_maxPriorityFeePerGas'),rpc('eth_getBlockByNumber',['latest',false]),rpc('eth_getTransactionCount',[WALLET,'latest']),rpc('eth_getTransactionCount',[WALLET,'pending'])]);
 if(abi.decodeFunctionResult('decimals',decimal)[0]!==6n||simulation==='0x')throw new Error('Token or simulation mismatch.');
 if(BigInt(nonce)!==BigInt(pendingNonce))throw new Error('Wallet has pending transactions. Resolve them before deployment.');
 const estimatedGas=BigInt(gas),limit=(estimatedGas*120n+99n)/100n;
 const priority=BigInt(tip),base=BigInt(block.baseFeePerGas);
 const desired=[20_000_000_000n,BigInt(price),base*2n+priority].reduce((a,b)=>a>b?a:b);
 const cap=BUDGET/limit,maxFee=desired<cap?desired:cap;
 if(maxFee<base+priority||maxFee<20_000_000_000n)throw new Error('Current gas cannot fit the approved 0.058 USDC budget.');
 if(BigInt(balance)<limit*maxFee)throw new Error('Insufficient USDC.');
 prepared={at:Date.now(),tx:{...tx,chainId:'0x13b2',type:'0x2',nonce,gas:hex(limit),maxFeePerGas:hex(maxFee),maxPriorityFeePerGas:hex(priority)},wallet:WALLET,balance:formatUnits(BigInt(balance),18),estimatedGas:estimatedGas.toString(),gasLimit:limit.toString(),estimatedCost:formatUnits(estimatedGas*BigInt(price),18),maximumFee:formatUnits(limit*maxFee,18),creationCodeHash:HASH,predictedAddress:getCreateAddress({from:WALLET,nonce:BigInt(nonce)})};
 return prepared;
}
async function status(){
 if(!record)return {state:'not-started'};
 if(record.result)return {state:'confirmed',...record.result};
 // Recover a hash even if the wallet request/tab disappears after broadcasting.
 let hash=record.hash;
 if(!hash){
  const code=await rpc('eth_getCode',[record.prepared.predictedAddress,'latest']);
  if(code!=='0x')return {state:'needs-receipt',address:record.prepared.predictedAddress,message:'Code exists at the predicted address. Paste the deployment hash from your wallet; do not deploy again.'};
  return {state:'wallet-requested',message:'One attempt is locked. Waiting for the wallet response. Do not retry deployment.'};
 }
 const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])]);
 if(!tx||!receipt)return {state:'pending',hash};
 const expected=record.prepared.tx;
 if(tx.from.toLowerCase()!==WALLET.toLowerCase()||tx.to!==null||keccak256(tx.input)!==HASH||BigInt(tx.value)!==0n||BigInt(tx.nonce)!==BigInt(expected.nonce))throw new Error('Transaction does not match the authorized deployment.');
 if(BigInt(receipt.status)!==1n){record.result={hash,status:'failed',feeUSDC:formatUnits(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice),18)};persist();return {state:'confirmed',...record.result};}
 if(receipt.contractAddress?.toLowerCase()!==record.prepared.predictedAddress.toLowerCase())throw new Error('Unexpected contract address.');
 const code=await rpc('eth_getCode',[receipt.contractAddress,'latest']);
 const mask=code=>{const b=Buffer.from(code.slice(2),'hex');for(const refs of Object.values(artifact.immutableReferences))for(const {start,length} of refs)b.fill(0,start,start+length);return b.toString('hex');};
 if(mask(code)!==mask(artifact.deployedBytecode))throw new Error('Runtime code mismatch.');
 const token=abi.decodeFunctionResult('usdc',await rpc('eth_call',[{to:receipt.contractAddress,data:abi.encodeFunctionData('usdc')},'latest']))[0];
 if(token.toLowerCase()!==TOKEN)throw new Error('Immutable USDC mismatch.');
 const cost=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice);
 record.result={hash,address:receipt.contractAddress,status:'success',gasUsed:BigInt(receipt.gasUsed).toString(),feeUSDC:formatUnits(cost,18),withinBudget:cost<=BUDGET,transactionURL:`https://explorer.arc.io/tx/${hash}`,contractURL:`https://explorer.arc.io/address/${receipt.contractAddress}`};persist();console.log(JSON.stringify(record.result,null,2));
 return {state:'confirmed',...record.result};
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(req.headers.host!==`127.0.0.1:${PORT}`)return reply(403,{error:'Invalid host.'});
 if(req.method==='POST'&&(req.headers.origin!==ORIGIN||req.headers['content-type']!=='application/json'))return reply(403,{error:'Same-origin JSON request required.'});
 try{
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://relay.walletconnect.org wss://relay.walletconnect.com https://relay.walletconnect.org https://relay.walletconnect.com https://verify.walletconnect.org https://verify.walletconnect.com; img-src 'self' data:; frame-src https://verify.walletconnect.com https://verify.walletconnect.org; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});return res.end(fs.readFileSync('scripts/deploy-wallet.html'));}
  if(req.method==='GET'&&req.url==='/config')return reply(200,{projectId:env.WALLETCONNECT_PROJECT_ID||'',signingEnabled:SIGNING_ENABLED});
  if(req.method==='GET'&&req.url==='/walletconnect.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(fs.readFileSync('.tmp/wc-assets/walletconnect.js'));}
  if(req.method==='GET'&&req.url==='/status')return reply(200,await status());
  if(req.method==='POST'&&req.url==='/prepare'){
   if(preparing)throw new Error('Preparation in progress.');preparing=true;try{return reply(200,await prepare());}finally{preparing=false;}
  }
  if(req.method==='POST'&&req.url==='/attempt'){
   if(!SIGNING_ENABLED)return reply(403,{error:'Signing is disabled. Connection and simulation only.'});
   if(record||!prepared||Date.now()-prepared.at>120000)throw new Error('Attempt already used or preparation expired.');
   // Lock synchronously before any wallet call; restart also preserves the lock.
   record={createdAt:new Date().toISOString(),prepared};persist();return reply(200,{tx:prepared.tx});
  }
  if(req.method==='POST'&&req.url==='/hash'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>512)throw new Error('Request too large.');}
   const {hash}=JSON.parse(body);if(!record||!/^0x[0-9a-fA-F]{64}$/.test(hash)||record.hash&&record.hash.toLowerCase()!==hash.toLowerCase())throw new Error('Invalid transaction hash.');
   record.hash=hash;persist();return reply(200,await status());
  }
  return reply(404,{error:'Not found.'});
 }catch(e){return reply(400,{error:/^(RPC |Wrong |Wallet |Token |Current |Insufficient |An attempt|Preparation |Attempt |Invalid |Request |Transaction |Unexpected |Runtime |Immutable )/.test(e.message)?e.message:'Operation stopped safely. No automatic retry.'});}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Local wallet signing: ${ORIGIN}\nOne deployment only. Maximum authorized fee: 0.058 USDC. Private RPC stays server-side.`));
