import {connectWalletConnect} from './walletconnect-client.js';
let active;
export async function chooseWallet(onInvalid){
 if(active){await active.disconnect();active=null;return null;}
 const dialog=document.createElement('dialog');dialog.className='panel wallet-dialog';
 dialog.innerHTML='<h2>Connect wallet</h2><p>Arc Mainnet · 5042. Connection only — signing is disabled.</p><button class="primary" id="wallet-qr">Binance Wallet · QR</button> <button class="secondary" id="wallet-extension">Browser extension</button><p role="status"></p><canvas hidden aria-label="WalletConnect pairing QR"></canvas><p><button class="secondary" id="wallet-cancel">Cancel</button></p>';
 document.body.append(dialog);dialog.showModal();const controller=new AbortController();
 return new Promise((resolve,reject)=>{
  const finish=(value,error)=>{controller.abort();dialog.close();dialog.remove();error?reject(error):resolve(value);};
  dialog.querySelector('#wallet-cancel').onclick=()=>finish(null);
  dialog.oncancel=e=>{e.preventDefault();finish(null);};
  dialog.querySelector('#wallet-extension').onclick=()=>finish(window.ethereum,window.ethereum?null:new Error('No browser wallet extension found. Use Binance Wallet QR.'));
  dialog.querySelector('#wallet-qr').onclick=async()=>{
   dialog.querySelector('#wallet-qr').disabled=true;dialog.querySelector('#wallet-extension').disabled=true;
   try{
    const response=await fetch('/api/wallet-config',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('WalletConnect is not configured on this server.');
    const {projectId}=await response.json();
    const provider=await connectWalletConnect({projectId,connectionOnly:true,signal:controller.signal,canvas:dialog.querySelector('canvas'),onInvalid,onProgress:message=>{dialog.querySelector('[role=status]').textContent=message;}});
    if(controller.signal.aborted){await provider.disconnect();return;}
    active=provider;dialog.close();dialog.remove();resolve(provider);
   }catch(e){if(!controller.signal.aborted)finish(null,e);}
  };
 });
}
