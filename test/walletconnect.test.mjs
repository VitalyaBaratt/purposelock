import {test} from 'node:test';import assert from 'node:assert/strict';import {connectWalletConnect} from '../src/walletconnect-client.js';
globalThis.location={origin:'http://127.0.0.1:5175'};
async function setup(chain='5042',expiry=Math.floor(Date.now()/1000)+1000){
 const events={},calls=[];let invalid=0;
 const session={topic:'test',expiry,namespaces:{eip155:{accounts:[`eip155:${chain}:0x1111111111111111111111111111111111111111`],methods:['eth_sendTransaction']}}};
 const client={session:{get:()=>session},on:(k,f)=>events[k]=f,request:async q=>calls.push(q),disconnect:async()=>{},connect:async q=>{assert.deepEqual(q.optionalNamespaces.eip155.chains,['eip155:5042']);return {uri:'wc:test',approval:async()=>session};}};
 const provider=await connectWalletConnect({projectId:'a'.repeat(32),canvas:{},connectionOnly:true,onInvalid:()=>invalid++,clientFactory:async()=>client,renderQR:async()=>{}});
 return {provider,events,calls,invalid:()=>invalid};
}
test('WalletConnect accepts only approved Arc 5042 accounts',async()=>{const {provider}=await setup();assert.equal(await provider.request({method:'eth_chainId'}),'0x13b2');assert.equal((await provider.request({method:'eth_accounts'})).length,1);await assert.rejects(setup('1'),/5042/);await assert.rejects(setup('5042002'),/5042/);await assert.rejects(setup('5042',1),/5042/);});
test('connection-only WalletConnect never forwards transactions or signatures',async()=>{const {provider,calls}=await setup();for(const method of ['eth_sendTransaction','eth_sendRawTransaction','personal_sign','eth_signTypedData_v4'])await assert.rejects(provider.request({method,params:[]}),/disabled/);assert.equal(calls.length,0);});
test('WalletConnect account/chain changes invalidate the session',async()=>{const {provider,events,invalid}=await setup();events.session_event({topic:'test',params:{event:{name:'chainChanged',data:'0x1'}}});assert.equal(invalid(),1);await assert.rejects(provider.request({method:'eth_accounts'}),/5042/);});
test('WalletConnect disconnect prevents reuse',async()=>{const {provider}=await setup();await provider.disconnect();await assert.rejects(provider.request({method:'eth_accounts'}),/5042/);});
