import {Interface} from 'ethers';
export const LOCK='0xca986d006b0a07f3f31c6087cb38cdbf3aedfa0d';
export const USDC='0x3600000000000000000000000000000000000000';
const lockABI=new Interface(['function usdc() view returns(address)','function campaignCount() view returns(uint256)','function totalEscrowed() view returns(uint256)','function campaign(uint256) view returns(address,address,uint64,uint256,uint256,uint256,bool,uint8,string)','function contributions(uint256,address) view returns(uint256)']);
const tokenABI=new Interface(['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)']);
const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x);
const block=x=>['latest','pending','earliest','safe','finalized'].includes(x)||typeof x==='string'&&/^0x[0-9a-f]{1,16}$/i.test(x);
export function allowed(q){
 if(!q||q.jsonrpc!=='2.0'||!Array.isArray(q.params)||!['string','number'].includes(typeof q.id))return false;
 const p=q.params;
 switch(q.method){
 case 'eth_chainId':case 'eth_blockNumber':case 'eth_gasPrice':case 'eth_maxPriorityFeePerGas':return p.length===0;
 case 'eth_getBalance':return p.length===2&&address(p[0])&&block(p[1]);
 case 'eth_getCode':return p.length===2&&address(p[0])&&[LOCK,USDC].includes(p[0].toLowerCase())&&block(p[1]);
 case 'eth_getBlockByNumber':return p.length===2&&block(p[0])&&p[1]===false;
 case 'eth_getTransactionReceipt':return p.length===1&&/^0x[0-9a-f]{64}$/i.test(p[0]);
 case 'eth_call':{if(p.length!==2||!block(p[1])||!p[0]||Object.keys(p[0]).some(k=>!['to','data'].includes(k)))return false;const {to,data}=p[0];if(!address(to)||typeof data!=='string'||data.length>266)return false;const a=to?.toLowerCase()===LOCK?lockABI:to?.toLowerCase()===USDC?tokenABI:null;try{return !!a?.parseTransaction({data});}catch{return false;}}
 case 'eth_getLogs':{const f=p[0];if(p.length!==1||!f||Object.keys(f).some(k=>!['address','fromBlock','toBlock','topics'].includes(k))||!address(f.address)||f.address.toLowerCase()!==LOCK)return false;try{return /^0x[0-9a-f]+$/i.test(f.fromBlock)&&/^0x[0-9a-f]+$/i.test(f.toBlock)&&BigInt(f.toBlock)>=BigInt(f.fromBlock)&&BigInt(f.toBlock)-BigInt(f.fromBlock)<=4999n&&JSON.stringify(f.topics||[]).length<=1000;}catch{return false;}}
 default:return false;
 }
}
export async function forward(body,url){
 const list=Array.isArray(body)?body:[body];
 if(!list.length||list.length>12||(JSON.stringify(body)||'').length>16000||!list.every(allowed))return {status:400,body:{error:'Read-only RPC request not permitted.'}};
 if(!url||!url.startsWith('https://'))return {status:503,body:{error:'RPC not configured.'}};
 try{const r=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const data=await r.json();const results=Array.isArray(data)?data:[data];if(results.length!==list.length)throw Error();const clean=results.map(x=>x.error?{jsonrpc:'2.0',id:x.id,error:{code:-32000,message:'Upstream read unavailable.'}}:{jsonrpc:'2.0',id:x.id,result:x.result});return {status:200,body:Array.isArray(body)?clean:clean[0]};}catch{return {status:502,body:{error:'RPC temporarily unavailable.'}};}
}
