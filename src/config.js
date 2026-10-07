export const USDC = '0x3600000000000000000000000000000000000000';
const networks = {
  arc: {id:5042, name:'Arc Mainnet', rpc:'https://rpc.mainnet.arc.io', explorer:'https://explorer.arc.io', token:USDC},
  arcTestnet: {id:5042002, name:'Arc Testnet', rpc:'https://rpc.testnet.arc.io', explorer:'https://explorer.testnet.arc.io', token:USDC},
  local: {id:31337, name:'Local demo · mock USDC', rpc:'http://127.0.0.1:8545', explorer:'', token:import.meta.env.VITE_LOCAL_TOKEN_ADDRESS},
};
export const networkKey = import.meta.env.VITE_NETWORK || 'arcTestnet';
if (!networks[networkKey]) throw new Error('Unsupported VITE_NETWORK');
export const network = {...networks[networkKey], walletRpc:networks[networkKey].rpc, rpc:import.meta.env.VITE_RPC_URL?.startsWith('/')?new URL(import.meta.env.VITE_RPC_URL,location.origin).href:(import.meta.env.VITE_RPC_URL || networks[networkKey].rpc)};
export const local = networkKey === 'local' && import.meta.env.DEV && ['localhost','127.0.0.1'].includes(location.hostname);
if (networkKey === 'local' && !local) throw new Error('Local demo is only available on a local development server.');
export const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || '';
export const tokenAbi = ['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];
