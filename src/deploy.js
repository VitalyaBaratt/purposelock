// Existing deployment capability kept out of customer navigation and production builds.
import {ContractFactory,formatUnits} from 'ethers';
import {network,local} from './config.js';
import {session,token,signer,fees,confirmed} from './chain.js';
export function renderDeployment({container,action}){
 if(!import.meta.env.DEV||local||!['localhost','127.0.0.1'].includes(location.hostname)){
  container.innerHTML='<div class="page-wrap"><section class="empty-state panel"><h1>Deployment tools unavailable</h1><p>Use a local development server configured for Arc Testnet or Arc. This is not part of the donation experience.</p><a class="secondary" href="#/explore">Explore Funds</a></section></div>';return;
 }
 container.innerHTML=`<div class="page-wrap"><section class="panel create-form"><h1>Local deployment</h1><p>Network: ${network.name}. USDC: ${network.token}. Your wallet signs the deployment. See README before proceeding.</p><button class="secondary" id="estimate">Estimate deployment (no transaction)</button><p id="estimate-result"></p><label><input id="deploy-check" type="checkbox"> I have reviewed the network, source and gas costs.</label><button class="primary" id="deploy" disabled>Deploy PurposeLock</button><p id="deployed"></p></section></div>`;
 let estimate=null;
 document.querySelector('#estimate').onclick=()=>action(async()=>{
  estimate=null;document.querySelector('#deploy').disabled=true;
  const s=await signer();if(Number(await token.decimals())!==6)throw new Error('USDC configuration mismatch.');
  const artifact=await(await fetch('/artifacts/PurposeLock.json')).json();
  const tx=await new ContractFactory(artifact.abi,artifact.bytecode,s).getDeployTransaction(network.token);
  const gas=(await s.estimateGas(tx))*120n/100n, fee=await fees(session.wallet);
  estimate={bytecode:artifact.bytecode,account:session.account,at:Date.now(),gasLimit:gas,...fee};
  document.querySelector('#estimate-result').textContent='Gas limit (20% margin): '+gas+'. Maximum fee budget: '+formatUnits(gas*fee.maxFeePerGas,18)+' USDC. No transaction sent.';
  document.querySelector('#deploy').disabled=import.meta.env.VITE_ENABLE_DEPLOYMENT!=='YES';
  if(import.meta.env.VITE_ENABLE_DEPLOYMENT!=='YES')document.querySelector('#estimate-result').textContent+=' Signing is disabled in this preparation build.';
 });
 document.querySelector('#deploy').onclick=()=>action(async()=>{
  if(import.meta.env.VITE_ENABLE_DEPLOYMENT!=='YES'||!estimate||Date.now()-estimate.at>120000)throw new Error('Deployment is disabled.');
  if(!document.querySelector('#deploy-check').checked)throw new Error('Review and confirm the deployment details.');
  const s=await signer();if(Number(await token.decimals())!==6)throw new Error('USDC configuration mismatch.');
  const artifact=await(await fetch('/artifacts/PurposeLock.json')).json();
  if(artifact.bytecode!==estimate.bytecode)throw new Error('Build changed. Estimate again.');
  await signer(estimate.account);
  const instance=await new ContractFactory(artifact.abi,artifact.bytecode,s).deploy(network.token,{gasLimit:estimate.gasLimit,maxFeePerGas:estimate.maxFeePerGas,maxPriorityFeePerGas:estimate.maxPriorityFeePerGas});
  await confirmed(instance.deploymentTransaction());document.querySelector('#deployed').textContent=`VITE_CONTRACT_ADDRESS=${await instance.getAddress()}`;
 });
}
