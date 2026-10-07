import fs from 'node:fs';
import {network} from 'hardhat';
import {BrowserProvider, ContractFactory} from 'ethers';
export const artifact = name => JSON.parse(fs.readFileSync(`artifacts/${name}.json`, 'utf8'));
export const U = 1_000_000n;
export async function fixture() {
 const connection=await network.create('default');
 const engine=connection.provider;engine.disconnect=()=>connection.close();
 const provider=new BrowserProvider(engine,undefined,{cacheTimeout:0});provider.pollingInterval=10;
 const accounts=await Promise.all([0,1,2,3,4].map(i=>provider.getSigner(i)));
 const deploy=async(name,args=[])=>{const a=artifact(name);const c=await new ContractFactory(a.abi,a.bytecode,accounts[0]).deploy(...args);await c.waitForDeployment();return c;};
 const token=await deploy('MockUSDC');const lock=await deploy('PurposeLock',[await token.getAddress()]);
 for(const a of accounts) await (await token.mint(await a.getAddress(),10000n*U)).wait();
 const [creator,donorA,donorB,merchant,stranger]=accounts;
 const now=async()=>Number((await provider.getBlock('latest')).timestamp);
 const create=async(goal=100n*U,seconds=3600,accept=true)=>{
  await (await lock.createCampaign('Computer for learning',goal,await now()+seconds,await merchant.getAddress())).wait();
  const id=await lock.campaignCount();if(accept)await(await lock.connect(merchant).acceptMerchant(id)).wait();return id;
 };
 const donate=async(id,who,amount)=>{await(await token.connect(who).approve(await lock.getAddress(),amount)).wait();await(await lock.connect(who).donate(id,amount)).wait();};
 const advance=async seconds=>{await engine.request({method:'evm_increaseTime',params:[seconds]});await engine.request({method:'evm_mine',params:[]});};
 return {engine,provider,accounts,creator,donorA,donorB,merchant,stranger,token,lock,now,create,donate,advance,deploy};
}
