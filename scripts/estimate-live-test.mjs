// Local mock lifecycle only: no Mainnet transaction or wallet access.
import {fixture} from '../test/helpers.mjs';
const f=await fixture(),rows=[];
const tx=async(name,p)=>{const r=await(await p).wait();rows.push({name,gasUsed:r.gasUsed.toString()});};
try{
 const a=await f.lock.getAddress(),m=await f.merchant.getAddress(),d=f.lock.connect(f.donorA),mt=f.token.connect(f.merchant),dt=f.token.connect(f.donorA),ml=f.lock.connect(f.merchant);
 await tx('Create funded campaign',f.lock.createCampaign('PurposeLock live success',10000n,await f.now()+3600,m));
 await tx('Merchant accept',ml.acceptMerchant(1));await tx('Donor approval',dt.approve(a,10000n));await tx('Donation 0.01',d.donate(1,10000n));await tx('Pay merchant',f.lock.payMerchant(1));await tx('Merchant approval',mt.approve(a,10000n));await tx('Merchant refund',ml.merchantRefund(1));await tx('Donor claim',d.claimRefund(1));
 await tx('Create failed campaign',f.lock.createCampaign('PurposeLock live deadline',10000n,await f.now()+600,m));await tx('Merchant accept',ml.acceptMerchant(2));await tx('Donor approval',dt.approve(a,5000n));await tx('Donation 0.005',d.donate(2,5000n));await f.advance(601);await tx('Donor deadline claim',d.claimRefund(2));
 console.log(JSON.stringify({scope:'Local mock USDC only; not an Arc gas guarantee',rows,totalGas:rows.reduce((n,r)=>n+BigInt(r.gasUsed),0n).toString()},null,2));
}finally{await f.engine.disconnect();}
