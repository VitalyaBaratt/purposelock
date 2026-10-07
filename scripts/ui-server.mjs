// Start and seed the test chain before Vite reads .env.local (avoids startup races).
await import('./demo.mjs');
const {createServer}=await import('vite');
const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
await server.listen();
server.printUrls();
