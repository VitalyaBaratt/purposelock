import {defineConfig,loadEnv} from 'vite';
export default defineConfig(({command,mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 if(command==='build'&&(process.env.VITE_NETWORK||env.VITE_NETWORK)==='local') throw new Error('Refusing to publish a local mock deployment. Set VITE_NETWORK=arcTestnet or arc and the matching contract/RPC.');
 return {server:{host:'127.0.0.1'},build:{target:'es2022'}};
});
