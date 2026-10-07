import {JsonRpcProvider,Contract} from 'ethers';
const main=process.argv.includes('--mainnet');
const url=main?'https://rpc.mainnet.arc.io':'https://rpc.testnet.arc.io';
const expected=main?5042n:5042002n;
const provider=new JsonRpcProvider(url);
try {
 const chain=BigInt(await provider.send('eth_chainId',[]));
 if(chain!==expected)throw new Error(`Wrong chain: ${chain}`);
 const token=new Contract('0x3600000000000000000000000000000000000000',['function decimals() view returns(uint8)','function symbol() view returns(string)'],provider);
 const decimals=await token.decimals();if(decimals!==6n)throw new Error(`Unexpected decimals ${decimals}`);
 console.log(JSON.stringify({rpc:url,chainId:Number(chain),usdc:await token.getAddress(),decimals:Number(decimals),symbol:await token.symbol(),block:await provider.getBlockNumber(),checkedAt:new Date().toISOString()},null,2));
} catch(error) {
 console.error(`Arc preflight failed: ${error.shortMessage || error.message}`);
 if(error.info?.responseBody) console.error(error.info.responseBody.trim());
 process.exitCode=1;
} finally {provider.destroy();}
