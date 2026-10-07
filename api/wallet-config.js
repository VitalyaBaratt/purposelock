// Project ID is a client-visible identifier, not a private RPC credential.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET required.'});
 const projectId=process.env.WALLETCONNECT_PROJECT_ID;
 if(!/^[a-f0-9]{32}$/i.test(projectId||''))return res.status(503).json({error:'WalletConnect not configured.'});
 return res.status(200).json({projectId});
}
