// Read-only Node process. Never import this module into the frontend.
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {ContractFactory,Interface,isAddress,ZeroAddress,formatUnits,keccak256} from 'ethers';
const file='.env.deployment.local';
const env={...(fs.existsSync(file)?parseEnv(fs.readFileSync(file,'utf8')):{}),...process.env};
const TOKEN='0x3600000000000000000000000000000000000000';
const abi=new Interface(['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)']);
let sequence=0;
const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getCode','eth_call','eth_getBalance','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_getBlockByNumber']);
async function rpc(method,params=[]){
 if(!allowed.has(method))throw new Error('Non-read-only RPC method refused.');
 let response;
 try{response=await fetch(env.ARC_MAINNET_RPC_URL,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method,params}),signal:AbortSignal.timeout(20000)});}catch{throw new Error(`${method}: connection failed or timed out (endpoint withheld).`);}
 if(!response.ok)throw new Error(`${method}: HTTP ${response.status} (endpoint and response body withheld).`);
 let data;try{data=await response.json();}catch{throw new Error(`${method}: invalid JSON response.`);}
 if(data.error||data.result===undefined)throw new Error(`${method}: RPC failure (provider message withheld).`);
 return data.result;
}
try{
 if(!env.ARC_MAINNET_RPC_URL)throw new Error(`Set ARC_MAINNET_RPC_URL locally in ${file}. Do not use a VITE_ variable.`);
 let url;try{url=new URL(env.ARC_MAINNET_RPC_URL);}catch{throw new Error('Invalid RPC URL (value withheld).');}
 if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use an HTTPS endpoint without URL user/password credentials.');
 const wallet=env.DEPLOYMENT_WALLET_ADDRESS?.trim();
 if(wallet&&(!isAddress(wallet)||wallet===ZeroAddress))throw new Error('Invalid public deployment wallet address.');
 if(BigInt(await rpc('eth_chainId'))!==5042n)throw new Error('STOP: RPC is not Arc Mainnet (5042).');
 const block=await rpc('eth_blockNumber');
 const [code,decimalsResult]=await Promise.all([rpc('eth_getCode',[TOKEN,block]),rpc('eth_call',[{to:TOKEN,data:abi.encodeFunctionData('decimals')},block])]);
 if(abi.decodeFunctionResult('decimals',decimalsResult)[0]!==6n)throw new Error('STOP: USDC decimals mismatch.');
 const report={checkedAt:new Date().toISOString(),chainId:5042,block:Number(BigInt(block)),usdc:TOKEN,decimals:6,usdcBytecodePresent:code!=='0x',wallet:wallet||null,transactionSent:false};
 if(code==='0x')report.note='Empty eth_getCode response. Native/precompile interfaces can have no EVM bytecode; decimals() responded, but review this result before authorizing deployment.';
 if(!wallet){report.status='Network/token calls checked; public wallet address needed for balance and deployment simulation.';console.log(JSON.stringify(report,null,2));process.exitCode=2;}
 else{
  const artifact=JSON.parse(fs.readFileSync('artifacts/PurposeLock.json','utf8'));
  const creation=await new ContractFactory(artifact.abi,artifact.bytecode).getDeployTransaction(TOKEN);
  const tx={from:wallet,data:creation.data,value:'0x0'};
  const [balance,tokenBalance,simulation,gas,price,tip,latest]=await Promise.all([
   rpc('eth_getBalance',[wallet,block]),rpc('eth_call',[{to:TOKEN,data:abi.encodeFunctionData('balanceOf',[wallet])},block]),
   rpc('eth_call',[tx,'latest']),rpc('eth_estimateGas',[tx]),rpc('eth_gasPrice'),rpc('eth_maxPriorityFeePerGas'),rpc('eth_getBlockByNumber',['latest',false])
  ]);
  if(typeof simulation!=='string'||simulation==='0x')throw new Error('STOP: creation simulation did not return runtime code.');
  const estimate=BigInt(gas),gasLimit=(estimate*120n+99n)/100n;
  const gasPrice=BigInt(price),priority=BigInt(tip),base=BigInt(latest.baseFeePerGas);
  const maxFee=[gasPrice,base*2n+priority,20_000_000_000n].reduce((a,b)=>a>b?a:b);
  Object.assign(report,{nativeUSDCBalance:formatUnits(BigInt(balance),18),erc20USDCBalance:formatUnits(abi.decodeFunctionResult('balanceOf',tokenBalance)[0],6),contract:'contracts/PurposeLock.sol:PurposeLock',compiler:artifact.compiler,constructorUSDC:TOKEN,creationCodeHash:keccak256(creation.data),simulation:'creation eth_call succeeded',estimatedGas:estimate.toString(),gasLimitWith20PercentMargin:gasLimit.toString(),gasPriceGwei:formatUnits(gasPrice,9),estimatedCostUSDC:formatUnits(estimate*gasPrice,18),maxFeePerGasGwei:formatUnits(maxFee,9),maximumBudgetUSDC:formatUnits(gasLimit*maxFee,18),sufficientBalance:BigInt(balance)>=gasLimit*maxFee,status:'Read-only checks complete; no signature requested. User approval is still required.'});
  if(!report.sufficientBalance){report.status='STOP: insufficient balance for maximum deployment budget.';process.exitCode=2;}
  if(code==='0x'){report.status='Review native token code availability before approval.';process.exitCode=2;}
  console.log(JSON.stringify(report,null,2));
 }
}catch(error){
 // Never print provider errors, stacks or URLs: endpoint paths contain access credentials.
 const safe=error instanceof Error&&/^(Set |Invalid public|Invalid RPC|Use an HTTPS|STOP:|Non-read-only|eth_)/.test(error.message)?error.message:'Preflight failed; details withheld to protect the endpoint. Check local configuration and compiled artifacts.';
 console.error(safe);process.exitCode=1;
}
