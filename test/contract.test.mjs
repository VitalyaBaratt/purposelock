import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,U,artifact} from './helpers.mjs';
let f;
beforeEach(async()=>{f=await fixture();});
afterEach(async()=>{await f.engine.disconnect();});
const rejects=fn=>assert.rejects(fn);
const tx=async p=>(await p).wait();
const bal=who=>f.token.balanceOf(typeof who==='string'?who:who.getAddress());

test('immutable campaign terms and merchant consent before funding',async()=>{
 const id=await f.create(100n*U,3600,false);const c=await f.lock.campaign(id);
 assert.equal(c.creator,await f.creator.getAddress());assert.equal(c.merchant,await f.merchant.getAddress());
 await tx(f.token.connect(f.donorA).approve(await f.lock.getAddress(),U));
 await rejects(()=>f.lock.connect(f.donorA).donate.staticCall(id,U));
 await rejects(()=>f.lock.connect(f.stranger).acceptMerchant.staticCall(id));
 await tx(f.lock.connect(f.merchant).acceptMerchant(id));
 await rejects(()=>f.lock.connect(f.merchant).acceptMerchant.staticCall(id));
 await f.donate(id,f.donorA,U);
 assert.equal(await f.lock.contributions(id,await f.donorA.getAddress()),U);
});
test('rejects invalid terms and nonexistent IDs',async()=>{
 const now=await f.now();const m=await f.merchant.getAddress();const c=await f.creator.getAddress();
 for(const args of [['',U,now+100,m],['x'.repeat(241),U,now+100,m],['x',0,now+100,m],['x',U,now,m],['x',U,now+366*86400,m],['x',U,now+100,c],['x',U,now+100,'0x0000000000000000000000000000000000000000'],['x',U,now+100,await f.lock.getAddress()],['x',U,now+100,await f.token.getAddress()]]) await rejects(()=>f.lock.createCampaign.staticCall(...args));
 for(const id of [0,999]) {await rejects(()=>f.lock.campaign(id));await rejects(()=>f.lock.payMerchant.staticCall(id));}
});
test('caps donations at goal and rejects zero, insufficient approval and funds',async()=>{
 const id=await f.create();
 await rejects(()=>f.lock.connect(f.donorA).donate.staticCall(id,U));
 await f.donate(id,f.donorA,60n*U);
 await rejects(()=>f.lock.connect(f.donorA).donate.staticCall(id,0));
 await rejects(()=>f.lock.connect(f.donorA).donate.staticCall(id,41n*U));
 await tx(f.token.connect(f.stranger).approve(await f.lock.getAddress(),20000n*U));
 const big=await f.create(20000n*U);
 await rejects(()=>f.lock.connect(f.stranger).donate.staticCall(big,20000n*U));
 assert.equal((await f.lock.campaign(id)).raised,60n*U);
});
test('pays exactly approved merchant; anyone can trigger but cannot redirect or pay twice',async()=>{
 const id=await f.create();await f.donate(id,f.donorA,100n*U);
 const creatorBefore=await bal(f.creator);const merchantBefore=await bal(f.merchant);
 await tx(f.lock.connect(f.stranger).payMerchant(id));
 assert.equal(await bal(f.creator),creatorBefore);assert.equal(await bal(f.merchant),merchantBefore+100n*U);
 assert.equal(await f.lock.totalEscrowed(),0n);
 await rejects(()=>f.lock.payMerchant.staticCall(id));await rejects(()=>f.lock.claimRefund.staticCall(id));
 const functions=artifact('PurposeLock').abi.filter(x=>x.type==='function').map(x=>x.name);
 assert.ok(!functions.some(x=>/withdraw|upgrade|owner|setMerchant/.test(x)));
});
test('underfunded campaign cannot pay or refund before deadline',async()=>{
 const id=await f.create();await f.donate(id,f.donorA,70n*U);
 await rejects(()=>f.lock.payMerchant.staticCall(id));await rejects(()=>f.lock.connect(f.donorA).claimRefund.staticCall(id));
});
test('deadline boundary: donation closed, original donors refunded exactly once',async()=>{
 const id=await f.create(100n*U,60);await f.donate(id,f.donorA,30n*U);await f.donate(id,f.donorB,20n*U);
 const c=await f.lock.campaign(id);
 await f.engine.request({method:'evm_setNextBlockTimestamp',params:[Number(c.deadline)]});await f.engine.request({method:'evm_mine',params:[]});
 assert.equal(await f.now(),Number(c.deadline));
 await rejects(()=>f.lock.connect(f.donorA).donate.staticCall(id,U));
 await rejects(()=>f.lock.connect(f.stranger).claimRefund.staticCall(id));
 const before=await bal(f.donorA);await tx(f.lock.connect(f.donorA).claimRefund(id));
 assert.equal(await bal(f.donorA),before+30n*U);
 await rejects(()=>f.lock.connect(f.donorA).claimRefund.staticCall(id));
 await tx(f.lock.connect(f.donorB).claimRefund(id));
 assert.equal(await f.lock.totalEscrowed(),0n);assert.equal((await f.lock.campaign(id)).refunded,50n*U);
});
test('fully funded campaign stays payable after deadline, not refundable',async()=>{
 const id=await f.create(100n*U,60);await f.donate(id,f.donorA,100n*U);await f.advance(61);
 await rejects(()=>f.lock.connect(f.donorA).claimRefund.staticCall(id));await tx(f.lock.payMerchant(id));
 assert.equal((await f.lock.campaign(id)).state,1n);
});
test('full merchant refund enters contract then goes only to original donors',async()=>{
 const id=await f.create();await f.donate(id,f.donorA,30n*U);await f.donate(id,f.donorB,70n*U);await tx(f.lock.payMerchant(id));
 await rejects(()=>f.lock.connect(f.creator).merchantRefund.staticCall(id));
 await rejects(()=>f.lock.connect(f.merchant).merchantRefund.staticCall(id));
 const creatorBefore=await bal(f.creator);
 await tx(f.token.connect(f.merchant).approve(await f.lock.getAddress(),100n*U));await tx(f.lock.connect(f.merchant).merchantRefund(id));
 assert.equal(await bal(await f.lock.getAddress()),100n*U);assert.equal(await bal(f.creator),creatorBefore);
 await rejects(()=>f.lock.connect(f.merchant).merchantRefund.staticCall(id));await rejects(()=>f.lock.payMerchant.staticCall(id));
 await rejects(()=>f.lock.connect(f.creator).claimRefund.staticCall(id));
 for(const who of [f.donorB,f.donorA]) await tx(f.lock.connect(who).claimRefund(id));
 assert.equal(await bal(await f.lock.getAddress()),0n);assert.equal(await f.lock.totalEscrowed(),0n);
});
test('refund forbidden before payment; failed pull leaves state Paid',async()=>{
 const id=await f.create();await rejects(()=>f.lock.connect(f.merchant).merchantRefund.staticCall(id));
 await f.donate(id,f.donorA,100n*U);await tx(f.lock.payMerchant(id));
 await rejects(()=>tx(f.lock.connect(f.merchant).merchantRefund(id,{gasLimit:500000})));
 assert.equal((await f.lock.campaign(id)).state,1n);assert.equal(await f.lock.totalEscrowed(),0n);
});
test('failed payout rolls back accounting and can be retried',async()=>{
 const id=await f.create();await f.donate(id,f.donorA,100n*U);
 await tx(f.token.setBlocked(await f.merchant.getAddress(),true));
 await rejects(()=>tx(f.lock.payMerchant(id,{gasLimit:500000})));
 assert.equal((await f.lock.campaign(id)).state,0n);assert.equal(await f.lock.totalEscrowed(),100n*U);
 await tx(f.token.setBlocked(await f.merchant.getAddress(),false));await tx(f.lock.payMerchant(id));
});
test('blocked donor does not prevent other donors claiming',async()=>{
 const id=await f.create(100n*U,60);await f.donate(id,f.donorA,30n*U);await f.donate(id,f.donorB,20n*U);await f.advance(61);
 await tx(f.token.setBlocked(await f.donorA.getAddress(),true));
 await rejects(()=>tx(f.lock.connect(f.donorA).claimRefund(id,{gasLimit:500000})));
 assert.equal(await f.lock.contributions(id,await f.donorA.getAddress()),30n*U);
 await tx(f.lock.connect(f.donorB).claimRefund(id));assert.equal(await f.lock.totalEscrowed(),30n*U);
 await tx(f.token.setBlocked(await f.donorA.getAddress(),false));await tx(f.lock.connect(f.donorA).claimRefund(id));
});
test('fee-on-transfer token rejected atomically',async()=>{
 const id=await f.create();await tx(f.token.setFee(true));await tx(f.token.connect(f.donorA).approve(await f.lock.getAddress(),U));
 await rejects(()=>tx(f.lock.connect(f.donorA).donate(id,U,{gasLimit:500000})));
 assert.equal((await f.lock.campaign(id)).raised,0n);assert.equal(await f.lock.totalEscrowed(),0n);
});
test('reentrancy during donation cannot settle a funded campaign',async()=>{
 const id=await f.create(U);await tx(f.token.setCallback(await f.lock.getAddress(),f.lock.interface.encodeFunctionData('payMerchant',[id])));
 await f.donate(id,f.donorA,U);
 assert.equal(await f.token.callbackSucceeded(),false);assert.equal((await f.lock.campaign(id)).state,0n);assert.equal(await f.lock.totalEscrowed(),U);
});
test('campaign accounting isolated, unsolicited transfers never credited',async()=>{
 const a=await f.create(10n*U);const b=await f.create(20n*U,60);
 await f.donate(a,f.donorA,10n*U);await f.donate(b,f.donorB,7n*U);
 await tx(f.token.transfer(await f.lock.getAddress(),3n*U));
 assert.equal(await f.lock.totalEscrowed(),17n*U);
 await tx(f.lock.payMerchant(a));await f.advance(61);await tx(f.lock.connect(f.donorB).claimRefund(b));
 assert.equal(await f.lock.totalEscrowed(),0n);assert.equal(await bal(await f.lock.getAddress()),3n*U);
});
test('native value cannot bypass donation accounting',async()=>{
 await rejects(()=>f.donorA.sendTransaction({to:f.lock.getAddress(),value:1n}));
});
test('smallest USDC unit and repeat contributions refund without rounding loss',async()=>{
 const id=await f.create(10n,60);await f.donate(id,f.donorA,1n);await f.donate(id,f.donorA,2n);await f.donate(id,f.donorB,4n);await f.advance(61);
 for(const who of [f.donorA,f.donorB]) await tx(f.lock.connect(who).claimRefund(id));
 assert.equal((await f.lock.campaign(id)).refunded,7n);assert.equal(await f.lock.totalEscrowed(),0n);
});
test('accounting invariant across mixed funded and failed campaigns',async()=>{
 let expected=0n;const ids=[];
 for(let i=1n;i<=5n;i++) {
  const goal=i*19n;const id=await f.create(goal,600);ids.push(id);
  await f.donate(id,f.donorA,i*7n);expected+=i*7n;
  if(i%2n===0n){await f.donate(id,f.donorB,i*12n);expected+=i*12n;}
  assert.equal(await f.lock.totalEscrowed(),expected);assert.equal(await bal(await f.lock.getAddress()),expected);
 }
 await f.advance(601);
 for(const id of ids){const c=await f.lock.campaign(id);if(c.raised===c.goal)await tx(f.lock.payMerchant(id));else await tx(f.lock.connect(f.donorA).claimRefund(id));expected-=c.raised;assert.equal(await f.lock.totalEscrowed(),expected);assert.equal(await bal(await f.lock.getAddress()),expected);}
});
