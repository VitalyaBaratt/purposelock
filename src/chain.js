import {BrowserProvider,JsonRpcProvider,Contract,formatUnits,parseUnits,isAddress,getAddress,zeroPadValue,toBeHex} from 'ethers';
import abi from './generated/abi.json';
import {network,networkKey,local,contractAddress,tokenAbi} from './config.js';
import {t} from './i18n.js';
export const read=new JsonRpcProvider(network.rpc,undefined,{cacheTimeout:0});
export const lock=isAddress(contractAddress)?new Contract(contractAddress,abi,read):null;
export const token=isAddress(network.token||'')?new Contract(network.token,tokenAbi,read):null;
export const session={account:null,wallet:null,ready:false,balance:0n,role:1};
let notify=()=>{};
export function onStatus(fn){notify=fn;}
export const units=value=>parseUnits(value,6);
export const rawAmount=value=>formatUnits(value,6);
export async function verify(){
 if(Number(await read.send('eth_chainId',[]))!==network.id)throw new Error('RPC returned the wrong network.');
 if(!lock){notify(t('configMissing'),null,'error');return false;}
 if(await read.getCode(contractAddress)==='0x')throw new Error('No contract exists at the configured address.');
 if(!token||Number(await token.decimals())!==6||(await lock.usdc()).toLowerCase()!==network.token.toLowerCase())throw new Error('USDC configuration mismatch.');
 session.ready=true;return true;
}
export async function fees(provider){
 if(local)return {};
 const f=await provider.getFeeData(),floor=parseUnits('20','gwei'),tip=f.maxPriorityFeePerGas??0n;
 return {maxFeePerGas:[floor,f.maxFeePerGas??0n,(f.gasPrice??floor)*2n+tip].reduce((a,b)=>a>b?a:b),maxPriorityFeePerGas:tip};
}
export async function signer(expected=session.account){
 if(!session.account||!session.wallet)throw new Error(t('walletRequired'));
 if(Number(await session.wallet.send('eth_chainId',[]))!==network.id)throw new Error(`${t('wrongNetwork')} ${network.name}.`);
 const s=await session.wallet.getSigner(session.account);
 if((await s.getAddress()).toLowerCase()!==expected?.toLowerCase())throw new Error(t('changed'));
 return s;
}
export async function updateBalance(){session.balance=session.account&&token?await token.balanceOf(session.account):0n;}
export async function connect(){
 if(local){session.wallet=read;session.account=await(await read.getSigner(session.role)).getAddress();}
 else{
  let provider=window.ethereum;
  if(network.id===5042){
   if(contractAddress.toLowerCase()!=='0xca986d006b0a07f3f31c6087cb38cdbf3aedfa0d')throw new Error('Unexpected Mainnet contract.');
   const {chooseWallet}=await import('./wallet-connect.js');
   provider=await chooseWallet(()=>location.reload());
   if(!provider){session.account=null;session.wallet=null;return;}
  }
  if(!provider)throw new Error(t('noWallet'));
  await provider.request({method:'eth_requestAccounts'});
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:`0x${network.id.toString(16)}`} ]});}
  catch(e){
   if((e.code??e.data?.originalError?.code)!==4902)throw e;
   await provider.request({method:'wallet_addEthereumChain',params:[{chainId:`0x${network.id.toString(16)}`,chainName:network.name,nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:[network.walletRpc],blockExplorerUrls:[network.explorer]}]});
   await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:`0x${network.id.toString(16)}`} ]});
  }
  session.wallet=new BrowserProvider(provider,'any');session.account=await(await session.wallet.getSigner()).getAddress();
 }
 await signer();await updateBalance();notify(t('connected'),null,'success');
}
export async function changeRole(index){session.role=Number(index);await connect();notify(t('roleChanged'),null,'success');}
export async function confirmed(tx){
 notify(t('pending'),tx.hash,'pending');sessionStorage.setItem('purposelock-pending',JSON.stringify({hash:tx.hash,network:networkKey}));
 let receipt;
 try{receipt=await tx.wait(1,120000);}catch(e){if(e.code==='TRANSACTION_REPLACED'&&!e.cancelled&&e.receipt?.status===1)receipt=e.receipt;else throw e;}
 if(!receipt||receipt.status!==1)throw new Error('Transaction did not complete. Check its receipt.');
 sessionStorage.removeItem('purposelock-pending');notify(t('confirmed'),receipt.hash,'success');return receipt;
}
async function approveExact(amount,expected){
 const s=await signer(expected),connectedToken=token.connect(s),allowance=await token.allowance(expected,contractAddress);
 if(allowance!==amount){
  if(allowance!==0n)await confirmed(await connectedToken.approve(contractAddress,0,await fees(session.wallet)));
  await signer(expected);await confirmed(await connectedToken.approve(contractAddress,amount,await fees(session.wallet)));
 }
}
export async function write(method,args,amount){
 if(network.id===5042)throw new Error('Mainnet signing is disabled. Live-test approval and fee checks are required first.');
 if(!session.ready)throw new Error(t('unavailable'));
 const expected=session.account;await signer(expected);
 if(amount!==undefined)await approveExact(amount,expected);
 const s=await signer(expected),overrides=await fees(session.wallet);
 await lock.connect(s)[method].staticCall(...args);
 const receipt=await confirmed(await lock.connect(s)[method](...args,overrides));
 await updateBalance();return receipt;
}
export async function getFund(id){
 const [c,own,block]=await Promise.all([lock.campaign(id),session.account?lock.contributions(id,session.account):0n,read.getBlock('latest')]);
 return {id:BigInt(id),c,own,now:block.timestamp,block:block.number};
}
export function phase({c,now}){
 if(c.state===2n)return c.refunded===c.raised?'refunded':'refunding';
 if(c.state===1n)return 'paid';if(c.raised===c.goal)return 'goalReached';
 if(Number(c.deadline)<=now)return 'expired';return c.accepted?'open':'merchantPending';
}
// Bounded, explicitly paginated history; no inferred or simulated donations in live UI.
export async function getActivity(id,toBlock){
 const end=toBlock??await read.getBlockNumber(),start=Math.max(0,end-4999);
 const logs=await read.getLogs({address:contractAddress,fromBlock:start,toBlock:end,topics:[null,zeroPadValue(toBeHex(id),32)]});
 const blocks=new Map();
 const entries=await Promise.all(logs.map(async log=>{
  const parsed=lock.interface.parseLog(log);if(!parsed)return null;
  if(!blocks.has(log.blockNumber))blocks.set(log.blockNumber,read.getBlock(log.blockNumber));
  const block=await blocks.get(log.blockNumber);
  return {name:parsed.name,args:parsed.args,hash:log.transactionHash,index:log.index,block:log.blockNumber,timestamp:block.timestamp};
 }));
 const complete=start===0||entries.some(e=>e?.name==='CampaignCreated');
 return {entries:entries.filter(Boolean).reverse(),start,end,complete};
}
export function failure(error){return error.code==='ACTION_REJECTED'||error.code===4001?t('declined'):error.shortMessage||error.reason||error.message||'Something went wrong.';}
window.ethereum?.on?.('accountsChanged',()=>location.reload());
window.ethereum?.on?.('chainChanged',()=>{if(session.account)location.reload();});
