import fs from 'node:fs';
import {loadEnv} from 'vite';
import {Contract,JsonRpcProvider,FetchRequest,isAddress,ZeroAddress} from 'ethers';
const env={...loadEnv('production',process.cwd(),''),...process.env};
if(env.VITE_NETWORK!=='arc')throw new Error('Production requires VITE_NETWORK=arc.');
const address=env.VITE_CONTRACT_ADDRESS;
if(!isAddress(address||'')||address===ZeroAddress)throw new Error('Production blocked: verified Arc Mainnet contract address is required.');
const url=env.ARC_MAINNET_RPC_URL;
if(!url)throw new Error('Set server-only ARC_MAINNET_RPC_URL for production verification.');
if(new URL(url).protocol!=='https:')throw new Error('Production RPC must use HTTPS.');
const request=new FetchRequest(url);request.timeout=15000;
const provider=new JsonRpcProvider(request,undefined,{batchMaxCount:1});
try{
 if(BigInt(await provider.send('eth_chainId',[]))!==5042n)throw new Error('Wrong production chain.');
 const token='0x3600000000000000000000000000000000000000';
 const lock=new Contract(address,['function usdc() view returns(address)'],provider);
 if((await lock.usdc()).toLowerCase()!==token)throw new Error('Wrong immutable USDC.');
 const usdc=new Contract(token,['function decimals() view returns(uint8)'],provider);
 if(await usdc.decimals()!==6n)throw new Error('Wrong USDC decimals.');
 const artifact=JSON.parse(fs.readFileSync('artifacts/PurposeLock.json'));
 const mask=code=>{let bytes=Buffer.from(code.slice(2),'hex');for(const refs of Object.values(artifact.immutableReferences))for(const {start,length} of refs)bytes.fill(0,start,start+length);return bytes.toString('hex');};
 if(mask(await provider.getCode(address))!==mask(artifact.deployedBytecode))throw new Error('Deployed bytecode differs from this build.');
 console.log('Mainnet chain, USDC and deployed PurposeLock bytecode verified.');
}catch{throw new Error('Mainnet verification failed; provider details withheld to protect RPC credentials.');}finally{provider.destroy();}
