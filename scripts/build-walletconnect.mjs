import {build} from 'vite';
await build({configFile:false,logLevel:'warn',build:{outDir:'.tmp/wc-assets',emptyOutDir:false,minify:true,sourcemap:false,lib:{entry:'scripts/walletconnect-local.js',formats:['es'],fileName:()=> 'walletconnect.js'},rollupOptions:{output:{inlineDynamicImports:true}}}});
console.log('Local WalletConnect bundle ready; separate from the customer frontend.');
