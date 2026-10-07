import fs from 'node:fs';
import {encodeFund} from '../src/metadata.js';
import {network} from 'hardhat';
import {JsonRpcProvider,ContractFactory,parseUnits} from 'ethers';
// Ephemeral unlocked accounts provided by the local test engine. No keys are read or printed.
const server=await network.createServer('default','127.0.0.1',8545);
await server.listen();
const provider=new JsonRpcProvider('http://127.0.0.1:8545',undefined,{cacheTimeout:0});provider.pollingInterval=30;
const signers=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
const deploy=async(name,args=[])=>{const a=JSON.parse(fs.readFileSync(`artifacts/${name}.json`));const c=await new ContractFactory(a.abi,a.bytecode,signers[0]).deploy(...args);await c.waitForDeployment();return c;};
const token=await deploy('MockUSDC');const lock=await deploy('PurposeLock',[await token.getAddress()]);
for(const s of signers)await(await token.mint(await s.getAddress(),parseUnits('10000',6))).wait();
const now=Number((await provider.getBlock('latest')).timestamp);
const demoFunds=[
 {details:{title:'New PC for my stream',purpose:'Gaming/Streaming PC',description:'Help me build a reliable streaming setup. Your support pays for the PC at our chosen store — never into my wallet.',merchantName:'Example PC Store'},goal:'1000',deadline:now+18*86400,donations:[[1,'500'],[2,'235']]},
 {details:{title:'Community recording kit',purpose:'Microphone & audio interface',description:'A small demo fund to try donor refunds when the deadline is missed.',merchantName:'Example Audio Store'},goal:'100',deadline:now+60,donations:[[1,'25']]}
];
for(const fund of demoFunds){
 await(await lock.createCampaign(encodeFund(fund.details),parseUnits(fund.goal,6),fund.deadline,await signers[3].getAddress())).wait();
 const id=await lock.campaignCount();await(await lock.connect(signers[3]).acceptMerchant(id)).wait();
 for(const [index,amount] of fund.donations){
  await(await token.connect(signers[index]).approve(await lock.getAddress(),parseUnits(amount,6))).wait();
  await(await lock.connect(signers[index]).donate(id,parseUnits(amount,6))).wait();
 }
}
const settings=`VITE_NETWORK=local\nVITE_RPC_URL=http://127.0.0.1:8545\nVITE_CONTRACT_ADDRESS=${await lock.getAddress()}\nVITE_LOCAL_TOKEN_ADDRESS=${await token.getAddress()}\n`;
// Refuse to overwrite an existing network configuration unless it belongs to this demo.
if(fs.existsSync('.env.local')&&!fs.readFileSync('.env.local','utf8').includes('VITE_NETWORK=local')) {
 console.error('Existing .env.local is not a local demo. Preserve it and move it before running npm run demo.');await server.close();process.exit(1);
}
fs.writeFileSync('.env.local',settings);
console.log('Local demo ready on 127.0.0.1:8545. Start npm run dev in another terminal.');
console.log('Creator, Donor A, Donor B and Merchant are available in the UI. Mock USDC only.');
console.log(`Merchant address: ${await signers[3].getAddress()}`);
const stop=async()=>{provider.destroy();await server.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
