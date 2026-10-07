import {test,expect} from '@playwright/test';
import {JsonRpcProvider,Contract} from 'ethers';
import fs from 'node:fs';
const provider=new JsonRpcProvider('http://127.0.0.1:8545',undefined,{cacheTimeout:0});
let lock,token;
test.beforeAll(async()=>{
 const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').trim().split('\n').map(l=>l.split('=')));
 const abi=JSON.parse(fs.readFileSync('artifacts/PurposeLock.json','utf8')).abi;
 lock=new Contract(env.VITE_CONTRACT_ADDRESS,abi,provider);
 token=new Contract(env.VITE_LOCAL_TOKEN_ADDRESS,['function balanceOf(address) view returns(uint256)'],provider);
});
test.afterAll(()=>provider.destroy());
const merchant=async()=>await(await provider.getSigner(3)).getAddress();
const creator=async()=>await(await provider.getSigner(0)).getAddress();
const role=async(page,index)=>{await page.locator('#role').selectOption(String(index));await expect(page.locator('#status')).toContainText('Demo role changed');};
async function create(page,title,goal='10'){
 await role(page,0);
 await page.getByRole('navigation').getByRole('link',{name:'Create Fund',exact:true}).click();
 await page.locator('[name=title]').fill(title);await page.locator('[name=purpose]').fill('Learning PC');
 await page.getByRole('textbox',{name:'Short description',exact:true}).fill('A PC for lessons. Payments go only to our chosen store.');
 await page.locator('[name=merchantName]').fill('Test PC Store');await page.locator('[name=goal]').fill(goal);
 const deadline=new Date((Number((await provider.getBlock('latest')).timestamp)+3600)*1000);deadline.setMinutes(deadline.getMinutes()-deadline.getTimezoneOffset());
 await page.locator('[name=deadline]').fill(deadline.toISOString().slice(0,16));
 await page.locator('[name=merchant]').fill(await merchant());
 await page.getByRole('button',{name:'Create Fund',exact:true}).click();
 await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 await expect(page).toHaveURL(/#\/fund\/\d+$/);return BigInt(new URL(page.url()).hash.split('/').at(-1));
}
test('create → consent → donation → merchant payment → refund → original donor',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('#role')).toBeVisible();
 const title=`Learning PC ${Date.now()}`;const id=await create(page,title);
 await expect(page.locator('.title-meta')).toContainText('Awaiting merchant');await role(page,3);
 await page.getByRole('button',{name:'Accept Campaign Terms'}).click();await expect(page.locator('.title-meta')).toContainText('Accepting donations');
 await role(page,1);await page.getByRole('spinbutton',{name:'Donation amount'}).fill('10');await page.getByRole('button',{name:'Donate USDC',exact:true}).click();
 await expect(page.locator('.title-meta')).toContainText('Goal reached');
 // Creator dashboard is a distinct management journey. Donors see no payout controls.
 await expect(page.getByRole('button',{name:'Pay Approved Merchant'})).toHaveCount(0);
 await role(page,0);await page.getByRole('navigation').getByRole('link',{name:'My Funds',exact:true}).click();
 const card=page.locator(`[data-fund="${id}"]`);await expect(card).toContainText(title);
 await card.getByRole('link',{name:'Manage fund'}).click();await expect(page).toHaveURL(new RegExp(`#\\/dashboard\\/${id}$`));
 await expect(page.getByRole('heading',{name:'Contribution history'})).toBeVisible();await expect(page.locator('#history-body')).toContainText('Donation received');
 const creatorBefore=await token.balanceOf(await creator()),merchantBefore=await token.balanceOf(await merchant());
 await page.getByRole('button',{name:'Pay Approved Merchant'}).click();await expect(page.locator('.manage-summary')).toContainText('Merchant paid');
 expect((await lock.campaign(id)).state).toBe(1n);expect(await token.balanceOf(await creator())).toBe(creatorBefore);expect(await token.balanceOf(await merchant())).toBe(merchantBefore+10000000n);
 await page.getByRole('link',{name:'View campaign',exact:true}).click();await role(page,3);
 await page.getByRole('button',{name:'Refund to PurposeLock',exact:true}).click();await expect(page.locator('.title-meta')).toContainText('Refunds available');
 await role(page,0);await expect(page.getByRole('button',{name:'Claim Refund',exact:true})).toHaveCount(0);
 await role(page,1);await page.getByRole('button',{name:'Claim Refund',exact:true}).click();await expect(page.locator('.title-meta')).toContainText('Refunds completed');
 expect((await lock.campaign(id)).refunded).toBe(10000000n);await expect(page.getByRole('button',{name:'Claim Refund',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('failed deadline refund and escaped user content',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await expect(page.locator('#role')).toBeVisible();
 const title=`<img src=x onerror=alert(1)> ${Date.now()}`;const id=await create(page,title,'20');
 await expect(page.locator('main img')).toHaveCount(0);await role(page,3);
 await page.getByRole('button',{name:'Accept Campaign Terms'}).click();await expect(page.locator('.title-meta')).toContainText('Accepting donations');
 await role(page,2);await page.getByRole('spinbutton',{name:'Donation amount'}).fill('5');await page.getByRole('button',{name:'Donate USDC',exact:true}).click();
 await expect(page.getByTestId('raised')).toHaveText('5');
 const c=await lock.campaign(id);await provider.send('evm_setNextBlockTimestamp',[Number(c.deadline)]);await provider.send('evm_mine',[]);
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('.title-meta')).toContainText('Deadline reached');
 await page.getByRole('button',{name:'Claim Refund',exact:true}).click();await expect(page.locator('.title-meta')).toContainText('Refunds completed');
 expect((await lock.campaign(id)).refunded).toBe(5000000n);
});
test('mobile campaign, donation controls, routing and language',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#/fund/1');await expect(page.locator('#role')).toBeVisible();
 await expect(page.getByRole('heading',{name:'New PC for my stream',exact:true})).toBeVisible();
 await expect(page.getByTestId('raised')).toHaveText('735');await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-valuenow','73.5');
 await expect(page.getByRole('button',{name:'Donate USDC',exact:true})).toBeVisible();
 await expect(page.locator('.mobile-campaign-summary')).toContainText('Example PC Store');
 await page.getByRole('button',{name:'50',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Donation amount'})).toHaveValue('50');
 await page.getByRole('button',{name:'Max remaining',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Donation amount'})).toHaveValue('265.0');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'UA',exact:true}).click();await expect(page.getByRole('button',{name:'Внести USDC',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'EN',exact:true}).click();await expect(page.getByRole('button',{name:'Donate USDC',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/mobile-campaign.png',fullPage:true});
 await page.getByRole('navigation').getByRole('link',{name:'Explore Funds',exact:true}).click();await expect(page.getByRole('heading',{name:'Good intentions. Clear destinations.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
