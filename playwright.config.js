import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',fullyParallel:false,workers:1,timeout:60000,
 use:{baseURL:'http://127.0.0.1:5173',headless:true,...(process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{})},
 webServer:{command:'npm run compile && node scripts/ui-server.mjs',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:60000}
});
