// Shared pairing implementation; no RPC credential enters this module.
import SignClient from '@walletconnect/sign-client';
import QRCode from 'qrcode';
const CHAIN='eip155:5042';
export async function connectWalletConnect({projectId,canvas,onInvalid,onProgress=()=>{},connectionOnly=false,signal,renderQR=QRCode.toCanvas,clientFactory=options=>SignClient.init(options)}){
 if(!/^[a-fA-F0-9]{32}$/.test(projectId||''))throw new Error('Set WALLETCONNECT_PROJECT_ID in .env.deployment.local, then restart the local helper.');
 const memory=new Map();
 const storage={async getItem(k){return memory.get(k);},async setItem(k,v){memory.set(k,v);},async removeItem(k){memory.delete(k);},async getKeys(){return [...memory.keys()];},async getEntries(){return [...memory.entries()];}};
 onProgress('Connecting to WalletConnect relay…');
 const bounded=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out. Reload this page before trying again.')),30000);})]);}finally{clearTimeout(timer);}};
 const client=await bounded(clientFactory({projectId,logger:'silent',telemetryEnabled:false,storage,metadata:{name:connectionOnly?'PurposeLock':'PurposeLock local deployment',description:'Connect to Arc Mainnet. No transaction is sent by connecting.',url:location.origin,icons:[]}}),'WalletConnect initialization');
 onProgress('Creating secure pairing QR…');
 const {uri,approval}=await bounded(client.connect({optionalNamespaces:{eip155:{chains:[CHAIN],methods:['eth_sendTransaction'],events:['accountsChanged','chainChanged']}}}),'WalletConnect pairing');
 if(!uri)throw new Error('WalletConnect did not return a pairing URI. Reload before retrying.');
 await renderQR(canvas,uri,{width:280,margin:3,errorCorrectionLevel:'M'});
 canvas.hidden=false;onProgress('Scan this QR inside Binance Wallet and approve connection to Arc (5042). No signature requested.');
 let session;
 const approved=approval();
 if(signal?.aborted)throw new Error('Connection cancelled.');
 const cancelled=new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(new Error('Connection cancelled.')),{once:true}));
 approved.then(async v=>{if(signal?.aborted)await client.disconnect({topic:v.topic,reason:{code:6000,message:'Connection cancelled'}});}).catch(()=>{});
 try{session=await Promise.race([approved,cancelled]);}finally{canvas.hidden=true;}
 let valid=true;
 const validate=()=>{
  const current=client.session.get(session.topic),namespaces=Object.values(current.namespaces);
  const accounts=[...new Set(namespaces.flatMap(n=>n.accounts||[]).filter(a=>a.startsWith(CHAIN+':')).map(a=>a.split(':')[2]))];
  if(!valid||current.expiry*1000<=Date.now()||!accounts.length||!namespaces.some(n=>(n.accounts||[]).some(a=>a.startsWith(CHAIN+':'))&&(n.methods||[]).includes('eth_sendTransaction')))throw new Error('Binance Wallet did not approve Arc Mainnet (5042). Do not use another chain.');
  return accounts;
 };
 const invalidate=event=>{if(event.topic===session.topic){valid=false;onInvalid();}};
 client.on('session_delete',invalidate);client.on('session_update',invalidate);client.on('session_event',invalidate);
 validate();
 return {
  async request({method,params}){
   const accounts=validate();
   if(method==='eth_accounts'||method==='eth_requestAccounts')return accounts;
   if(method==='eth_chainId')return '0x13b2';
   if(method==='wallet_switchEthereumChain'&&params?.[0]?.chainId==='0x13b2')return null;
   if(connectionOnly)throw new Error('Mainnet signing is disabled until the live test is approved.');
   if(method!=='eth_sendTransaction')throw new Error('Unsupported signing method.');
   return client.request({topic:session.topic,chainId:CHAIN,request:{method,params}});
  },
  async disconnect(){valid=false;await client.disconnect({topic:session.topic,reason:{code:6000,message:'User disconnected'}});onInvalid();}
 };
}
