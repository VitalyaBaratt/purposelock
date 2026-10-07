import {forward} from '../server/rpc.mjs';
// Vercel Node function. Only this server process sees the private endpoint.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required.'});
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Origin refused.'});}catch{return res.status(403).json({error:'Origin refused.'});}}
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid JSON.'});}
 const result=await forward(body,process.env.ARC_MAINNET_RPC_URL);return res.status(result.status).json(result.body);
}
