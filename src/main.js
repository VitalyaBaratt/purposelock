import {isAddress,getAddress} from 'ethers';
import {network,networkKey,local,contractAddress} from './config.js';
import {session,read,lock,verify,connect,changeRole,onStatus,write,getFund,getActivity,phase,units,rawAmount,failure} from './chain.js';
import {t,lang,setLanguage,locale} from './i18n.js';
import {encodeFund,decodeFund,metadataBytes} from './metadata.js';
import {icon} from './icons.js';
import './style.css';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=value=>`${value.slice(0,6)}…${value.slice(-4)}`;
const money=value=>{const [whole,fraction]=rawAmount(value).split('.');return BigInt(whole).toLocaleString(locale())+(fraction&&Number(fraction)?`${lang()==='en'?'.':','}${fraction}`:'');};
const date=value=>new Date(Number(value)*1000).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'});
const fullDate=value=>new Date(Number(value)*1000).toLocaleString(locale());
const same=(a,b)=>a?.toLowerCase()===b?.toLowerCase();
const fundUrl=id=>`#/fund/${id}`;
const address=(a,compact=false)=>network.explorer?`<a class="address" title="${esc(a)}" href="${network.explorer}/address/${a}" target="_blank" rel="noreferrer">${compact?short(a):a}${icon('external')}</a>`:`<span class="address" title="${esc(a)}">${compact?short(a):a}</span>`;
let busy=false,renderVersion=0,loadedLimit=20,currentFund=null,history=null,historyError=false;
let message={text:'',hash:null,kind:''};
const draft={title:'',purpose:'',description:'',merchantName:'',merchant:'',goal:'',deadline:''};
function notify(text,hash=null,kind='success'){
 message={text,hash,kind};renderStatus();
}
onStatus(notify);
function renderStatus(){
 const node=$('#status');if(!node)return;
 node.hidden=!message.text;node.className=`toast ${message.kind}`;
 node.innerHTML=`${icon(message.kind==='error'?'info':message.kind==='pending'?'clock':'check')}<span>${esc(message.text)}${message.hash&&network.explorer?` <a target="_blank" rel="noreferrer" href="${network.explorer}/tx/${message.hash}">${t('checkTx')}</a>`:''}</span><button class="icon-button" id="dismiss" aria-label="Dismiss notification">${icon('close')}</button>`;
 $('#dismiss').onclick=()=>{message.text='';renderStatus();};
}
function setBusy(value){busy=value;document.querySelectorAll('button,select').forEach(b=>{b.disabled=value||b.dataset.unavailable==='true';});document.body.classList.toggle('is-busy',value);}
async function action(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){notify(failure(e),null,'error');}finally{setBusy(false);}}
function route(){
 const parts=location.hash.replace(/^#\//,'').split('/'),name=parts[0],id=parts[1];
 if((name==='fund'||name==='dashboard')&&/^[1-9]\d*$/.test(id||''))return {name,id};
 if(['explore','create','dashboard','deploy'].includes(name)&&parts.length===1)return {name};
 return {name:local?'fund':'explore',id:local?'1':null};
}
function navigate(path){if(location.hash===path)void render();else location.hash=path;}
function shell(){
 const r=route();
 $('#app').innerHTML=`<a class="skip-link" href="#content">Skip to content</a>
 <header class="site-header"><div class="header-inner"><a class="brand" href="#/explore" aria-label="PurposeLock home"><span class="brand-symbol">${icon('lock')}</span>PurposeLock<span class="brand-dot">.</span></a>
 <nav aria-label="Main navigation"><a class="${r.name==='explore'?'active':''}" href="#/explore">${t('explore')}</a><a class="${r.name==='create'?'active':''}" href="#/create">${t('create')}</a><a class="${r.name==='dashboard'?'active':''}" href="#/dashboard">${t('myFunds')}</a></nav>
 <div class="header-actions"><div class="language" aria-label="Language"><button data-language="en" aria-pressed="${lang()==='en'}">EN</button><span>/</span><button data-language="uk" aria-pressed="${lang()==='uk'}">UA</button></div><button class="wallet-button" id="connect">${icon('wallet')}<span>${session.account?short(session.account):t('connect')}</span></button></div></div></header>
 ${local?`<div class="demo-bar"><div><span class="demo-tag">${t('demo')}</span><span class="demo-note">${t('demoNote')}</span><label>${t('role')}<select id="role"><option value="1">${t('donorA')}</option><option value="2">${t('donorB')}</option><option value="0">${t('creator')}</option><option value="3">${t('merchant')}</option></select></label></div></div>`:`<div class="network-bar">${esc(network.name)} · ${t('auditNote')}</div>`}
 <main id="content" tabindex="-1"><div class="loading">${icon('lock')}<p>${t('preparing')}</p></div></main>
 <footer class="site-footer"><a class="brand small" href="#/explore">${icon('lock')}PurposeLock</a><p>${t('footer')}</p><span>${t('onArc')}</span><span>${t('auditNote')}</span></footer><div id="status" role="status" aria-live="polite" hidden></div>`;
 $('.skip-link').onclick=e=>{e.preventDefault();$('#content').focus();$('#content').scrollIntoView({block:'start'});};
 $('#connect').onclick=()=>action(async()=>{await connect();await render();});
 document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>{saveDraft();setLanguage(b.dataset.language);void render();});
 if(local){$('#role').value=String(session.role);$('#role').onchange=e=>{const value=e.target.value;void action(async()=>{await changeRole(value);await render();});};}
 renderStatus();setBusy(busy);
}
const badge=f=>`<span class="badge ${phase(f)}"><i></i>${t(phase(f))}</span>`;
const percent=c=>Number(c.raised*1000n/c.goal)/10;
const progress=c=>`<div class="progress-track" role="progressbar" aria-label="Funding progress" aria-valuenow="${percent(c)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent(c)}%"></span></div>`;
function protection(){return `<span class="protection">${icon('shield')}${t('protected')}</span>`;}
function rules(){return `<section class="rules-section"><div class="section-heading"><span class="eyebrow">${t('rules')}</span></div><div class="rule-grid">${['rule1','rule2','rule3'].map((k,i)=>`<div>${icon(['lock','clock','return'][i])}<h3>${t(k)}</h3><p>${t(`${k}Desc`)}</p></div>`).join('')}</div><details class="limits" open><summary>${icon('info')}${t('limits')}</summary><p>${t('limitsDesc')}</p></details></section>`;}
function flow(){return `<section class="money-path panel"><div class="section-heading"><div><h2>${t('routeTitle')}</h2><p>${t('routeDesc')}</p></div>${icon('shield')}</div><div class="path-nodes"><div class="path-node">${icon('person')}<strong>${t('donor')}</strong><small>USDC</small></div><span class="path-connector">${icon('arrow')}</span><div class="path-node escrow-node">${icon('lock')}<strong>PurposeLock</strong><small>${t('lockedFunds')}</small></div><span class="path-connector">${icon('arrow')}</span><div class="path-node">${icon('store')}<strong>${t('approvedMerchant')}</strong><small>${t('approvedDestination')}</small></div></div><div class="blocked-path"><span>${icon('block')}PurposeLock <b>↛</b> ${t('creatorWallet')}</span><strong>${t('noWithdrawal')}</strong></div></section>`;}
function how(){return `<section class="how"><h2>${t('how')}</h2><div class="how-grid">${[1,2,3].map(n=>`<div><span class="step-number">0${n}</span><h3>${t(`step${n}`)}</h3><p>${t(`step${n}Desc`)}</p></div>`).join('')}</div></section>`;}
function donatePanel(f){
 const {c,own}=f,state=phase(f),remaining=c.goal-c.raised;
 const claimable=c.state===2n||(state==='expired');
 let controls='';
 if(!session.account)controls=`<button class="primary full" data-connect>${icon('wallet')}${t('connect')}</button><p class="form-note">${t('connectDonate')}</p>`;
 else if(claimable&&own>0n)controls=`<div class="refund-notice">${icon('return')}<div><strong>${t('refundReady')}</strong><p>${money(own)} USDC</p></div></div><button class="primary full" data-action="claimRefund">${t('claim')}</button>`;
 else if(state==='open')controls=`<form id="donate-form"><div class="field-heading"><label for="donation-amount">${t('amount')}</label><button class="text-button" type="button" id="max-donation">${t('max')}</button></div><div class="amount-input"><input id="donation-amount" name="amount" type="number" inputmode="decimal" min="0.000001" max="${rawAmount(remaining)}" step="0.000001" required value="25" aria-describedby="donation-help"><span><b class="usdc-symbol">$</b> USDC</span></div><div class="amount-presets">${['10','25','50','100'].map(v=>`<button type="button" data-preset="${v}" ${units(v)>remaining?'data-unavailable="true" disabled':''}>${v}</button>`).join('')}</div><div class="balance-row"><span>${t('balance')}</span><span>${money(session.balance)} USDC</span></div><button class="primary full donate-cta" type="submit">${icon('lock')}${t('donate')}</button><p class="form-note" id="donation-help">${t('approval')} ${t('gas')}</p></form>`;
 else controls=`<div class="closed-note">${icon(state==='merchantPending'?'clock':'check')}<p>${t(state==='merchantPending'?'waitingDesc':'fundingClosed')}</p></div>${claimable?`<p class="form-note">${t('noContribution')}</p>`:''}`;
 return `<aside class="donation-panel panel" aria-label="Donation"><div class="donation-heading">${protection()}<span class="eyebrow">${t('support')}</span></div><div class="funding-amount"><strong data-testid="raised">${money(c.raised)}</strong><span>USDC ${t('raised')}</span></div><div class="goal-line"><span>/ ${money(c.goal)} USDC ${t('goal')}</span><strong>${percent(c)}%</strong></div>${progress(c)}<div class="funding-meta"><div>${icon('calendar')}<span>${t('deadline')}<strong title="${fullDate(c.deadline)}">${date(c.deadline)}</strong></span></div><div>${icon('chart')}<span>${t('left')}<strong>${money(remaining)} USDC</strong></span></div></div><div class="donation-controls">${controls}</div><div class="own-contribution"><span>${icon('person')}${t('refundableBalance')}</span><strong>${session.account?`${money(own)} USDC`:'—'}</strong><p>${t('contributionNote')}</p></div><div class="fund-lock-note">${icon('shield')}<span>${t('noWithdrawalDesc')}</span></div></aside>`;
}
function management(f){
 const {c}=f,isCreator=same(session.account,c.creator),isMerchant=same(session.account,c.merchant),state=phase(f);
 if(!isCreator&&!isMerchant)return '';
 return `<section class="management panel" id="management"><div class="section-heading"><div><span class="eyebrow">${t(isMerchant?'merchantTools':'creatorActions')}</span><h2>${t('management')}</h2></div>${icon(isMerchant?'store':'lock')}</div>
 ${isCreator?`<div class="management-body"><p>${t('paymentNote')}</p>${state==='goalReached'?`<button class="primary" data-action="payMerchant">${icon('store')}${t('pay')}</button>`:`<p class="muted">${t('nothingToDo')}</p>`}<div class="permission-note">${icon('block')}${t('noWithdrawalDesc')}</div></div>`:''}
 ${isMerchant?`<div class="management-body"><p>${t('merchantExplain')}</p>${state==='merchantPending'?`<button class="primary" data-action="acceptMerchant">${t('accept')}</button>`:c.state===1n?`<p>${t('fullReturn')} <strong>${money(c.raised)} USDC</strong></p><button class="primary" data-action="merchantRefund" data-amount="${c.raised}">${icon('return')}${t('return')}</button>`:state==='goalReached'?`<button class="primary" data-action="payMerchant">${t('pay')}</button>`:`<p class="muted">${c.state===0n?t('merchantReady'):t(state)}</p>`}</div>`:''}</section>`;
}
function activityView(){
 if(historyError)return `<p class="inline-error">${t('activityError')}</p>`;
 if(!history)return `<p class="muted">${t('preparing')}</p>`;
 const eventKeys={CampaignCreated:'eventCreated',MerchantAccepted:'eventAccepted',Donated:'eventDonated',MerchantPaid:'eventPaid',MerchantRefunded:'eventReturned',DonorRefunded:'eventClaimed'};
 return `<div class="activity-list">${history.entries.length?history.entries.map(e=>`<div class="activity-row"><span class="activity-icon ${e.name==='Donated'?'violet':''}">${icon(e.name==='Donated'?'plus':e.name.includes('Refund')?'return':e.name==='MerchantPaid'?'store':'check')}</span><div class="activity-info"><strong>${t(eventKeys[e.name]||'transaction')}</strong><span>${e.args.donor?`${short(e.args.donor)} · `:''}${fullDate(e.timestamp)}</span></div><div class="activity-value">${e.args.amount!==undefined?`<strong>${money(e.args.amount)} USDC</strong>`:''}${network.explorer?`<a href="${network.explorer}/tx/${e.hash}" target="_blank" rel="noreferrer">${short(e.hash)}${icon('external')}</a>`:`<span title="${e.hash}">${short(e.hash)}</span>`}</div></div>`).join(''):`<p class="muted">${t('noActivity')}</p>`}</div><div class="history-footer"><span>${history.complete?t('fullHistory'):`${t('recentRange')}: ${history.start}–${history.end}`}</span>${!history.complete?`<button class="secondary small-button" id="older">${t('older')}</button>`:''}</div>`;
}
async function loadHistory(id,version){
 let result,failed=false;
 try{result=await getActivity(id);}catch{failed=true;}
 if(version!==renderVersion)return;
 history=result||null;historyError=failed;
 if($('#history-body')){$('#history-body').innerHTML=activityView();bindHistory(id);}
}
function bindHistory(id){if($('#older'))$('#older').onclick=()=>action(async()=>{const earlier=await getActivity(id,history.start-1);history={...earlier,end:history.end,entries:[...history.entries,...earlier.entries]};$('#history-body').innerHTML=activityView();bindHistory(id);});}
async function renderCampaign(id,version){
 const f=await getFund(id);if(version!==renderVersion)return;
 currentFund=f;history=null;historyError=false;
 const {c}=f,m=decodeFund(c.purpose),isDemo=local&&BigInt(id)===1n&&m.title==='New PC for my stream';
 document.title=`${m.title} · PurposeLock`;
 $('#content').innerHTML=`<div class="page-wrap campaign-page"><div class="page-toolbar"><a class="breadcrumb" href="#/explore">${icon('back')}${t('back')}<span>/</span><span>#${id}</span></a><div><button class="icon-button" id="refresh" aria-label="${t('refresh')}" title="${t('refresh')}">${icon('refresh')}</button><button class="secondary share-button" id="share">${icon('share')}${t('share')}</button></div></div>
 <section class="campaign-header"><div class="title-meta"><span class="eyebrow">${isDemo?t('featured'):t('campaign')}</span>${badge(f)}</div><h1>${esc(m.title)}</h1><div class="creator-line"><span class="avatar">${icon('person')}</span><div><span>${t('creator')}</span><strong>${isDemo?t('demoCreator'):short(c.creator)}</strong></div>${address(c.creator,true)}</div><div class="mobile-campaign-summary"><span>${t('purpose')}<strong>${esc(m.purpose||m.title)}</strong></span><span>${t('approvedMerchant')}<strong>${esc(m.merchantName||short(c.merchant))}</strong></span><div class="mobile-protection-note">${icon('shield')}${t('noWithdrawalDesc')}</div></div></section>
 <div class="campaign-layout"><div class="campaign-main"><section class="purpose-panel panel"><div class="purpose-icon">${icon('monitor')}</div><div><span class="eyebrow">${t('purpose')}</span><h2>${esc(m.purpose||m.title)}</h2><p>${esc(m.description||t('noDescription'))}</p></div><span class="purpose-label">USDC ${icon('lock')}</span></section>
 ${flow()}<section class="merchant-card panel"><span class="merchant-avatar">${icon('store')}</span><div><span class="eyebrow">${t('approvedMerchant')}</span><h3>${esc(m.merchantName||short(c.merchant))}</h3>${address(c.merchant,true)}</div>${c.accepted?`<span class="accepted-badge">${icon('check')}${t('accepted')}</span>`:`<span class="badge merchantPending">${t('merchantPending')}</span>`}<p>${t('chosenMerchant')}</p></section>
 ${how()}${rules()}${management(f)}<section class="activity-section panel"><div class="section-heading"><div><h2>${t('activity')}</h2><p>${t('activityDesc')}</p></div>${icon('chart')}</div><div id="history-body">${activityView()}</div></section></div>${donatePanel(f)}</div></div>`;
 bindCampaign(f);setBusy(busy);void loadHistory(id,version);
}
function bindCampaign(f){
 $('#refresh').onclick=()=>action(async()=>{await render();notify(t('updated'));});
 $('#share').onclick=()=>action(async()=>{try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}${fundUrl(f.id)}`);notify(t('copied'));}catch{notify(t('shareFail'),null,'error');}});
 document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=()=>action(async()=>{await connect();await render();}));
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(async()=>{await write(b.dataset.action,[f.id],b.dataset.amount?BigInt(b.dataset.amount):undefined);await render();}));
 if($('#donate-form')){
  const amount=$('#donation-amount');if(units(amount.value)>f.c.goal-f.c.raised)amount.value=rawAmount(f.c.goal-f.c.raised);
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{amount.value=b.dataset.preset;amount.focus();});
  $('#max-donation').onclick=()=>{amount.value=rawAmount(f.c.goal-f.c.raised);amount.focus();};
  $('#donate-form').onsubmit=e=>{e.preventDefault();void action(async()=>{const value=units(amount.value);if(value<=0n||value>f.c.goal-f.c.raised)throw new Error(t('invalidAmount'));await write('donate',[f.id,value],value);await render();});};
 }
}
function fundCard(f,dashboard=false){
 const m=decodeFund(f.c.purpose);
 return `<article class="fund-card panel" data-fund="${f.id}"><div class="card-heading"><span class="category-icon">${icon('monitor')}</span>${badge(f)}</div><a href="${fundUrl(f.id)}" class="fund-title"><h2>${esc(m.title)}</h2></a><p class="card-description">${esc(m.description||m.purpose||t('noDescription'))}</p><div class="card-funding"><strong>${money(f.c.raised)} <span>USDC</span></strong><span>/ ${money(f.c.goal)}</span></div>${progress(f.c)}<div class="card-bottom"><span>${icon('calendar')}${date(f.c.deadline)}</span><span>${percent(f.c)}%</span></div><div class="card-merchant">${icon('store')}<span>${esc(m.merchantName||short(f.c.merchant))}</span></div><a class="${dashboard?'primary':'secondary'} full" href="${dashboard?`#/dashboard/${f.id}`:fundUrl(f.id)}">${t(dashboard?'manage':'view')}</a></article>`;
}
async function renderListing(dashboard,version){
 document.title=`${t(dashboard?'dashboard':'explore')} · PurposeLock`;
 const count=session.ready?await lock.campaignCount():0n;
 const limit=Number(count>BigInt(loadedLimit)?BigInt(loadedLimit):count);
 const block=session.ready?await read.getBlock('latest'):null;
 const rows=await Promise.all(Array.from({length:limit},async(_,i)=>{const id=count-BigInt(i);return {id,c:await lock.campaign(id),now:block.timestamp};}));
 if(version!==renderVersion)return;
 const mine=dashboard?rows.filter(f=>same(f.c.creator,session.account)):rows;
 const totals=mine.reduce((a,f)=>({raised:a.raised+f.c.raised,returned:a.returned+f.c.refunded,active:a.active+(phase(f)==='open'?1:0)}),{raised:0n,returned:0n,active:0});
 $('#content').innerHTML=`<div class="page-wrap listing-page"><section class="listing-header"><div><span class="eyebrow">${dashboard?t('myFunds'):'PURPOSE-LOCKED GIVING'}</span><h1>${t(dashboard?'dashboard':'exploreTitle')}</h1><p>${t(dashboard?'dashboardDesc':'exploreDesc')}</p></div><a class="primary" href="#/create">${icon('plus')}${t('create')}</a></section>
 ${dashboard?`<div class="dashboard-guard">${icon('shield')}${t('noWithdrawalDesc')}</div><div class="stats-grid">${[[t('yourFunds'),mine.length],[t('totalRaised'),`${money(totals.raised)} <small>USDC</small>`],[t('active'),totals.active],[t('totalReturned'),`${money(totals.returned)} <small>USDC</small>`]].map(([label,value])=>`<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`:''}
 <div class="listing-controls"><h2>${t(dashboard?'myFunds':'allFunds')}</h2><form id="lookup"><label for="lookup-id" class="sr-only">${t('lookup')}</label><input id="lookup-id" type="number" min="1" step="1" required placeholder="${t('lookup')}"><button class="icon-button" aria-label="${t('openFund')}">${icon('arrow')}</button></form><button class="icon-button" id="refresh" aria-label="${t('refresh')}">${icon('refresh')}</button></div>
 ${dashboard&&!session.account?`<div class="empty-state panel">${icon('wallet')}<h2>${t('dashboardConnect')}</h2><button class="primary" data-connect>${t('connect')}</button></div>`:mine.length?`<div class="fund-grid">${mine.map(f=>fundCard(f,dashboard)).join('')}</div>`:`<div class="empty-state panel">${icon('lock')}<h2>${t('empty')}</h2><p>${t('start')}</p><a href="#/create" class="primary">${t('create')}</a></div>`}
 <div class="listing-footer"><span>${t('scanned')}: ${limit} / ${count}${dashboard&&BigInt(limit)<count?` · ${t('scanNote')}`:''}</span>${BigInt(limit)<count?`<button class="secondary" id="load-more">${t('loadMore')}</button>`:''}</div>${!dashboard?how():''}</div>`;
 $('#lookup').onsubmit=e=>{e.preventDefault();navigate(fundUrl($('#lookup-id').value));};
 $('#refresh').onclick=()=>action(async()=>{await render();notify(t('updated'));});
 if($('#load-more'))$('#load-more').onclick=()=>action(async()=>{loadedLimit+=20;await render();});
 document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=()=>action(async()=>{await connect();await render();}));setBusy(busy);
}
async function renderManage(id,version){
 const f=await getFund(id);if(version!==renderVersion)return;currentFund=f;history=null;historyError=false;
 const {c}=f,m=decodeFund(c.purpose);
 if(!same(session.account,c.creator)){
  $('#content').innerHTML=`<div class="page-wrap"><div class="empty-state panel">${icon('wallet')}<h2>${t('dashboardConnect')}</h2><p>${address(c.creator)}</p><a class="secondary" href="${fundUrl(id)}">${t('view')}</a></div></div>`;return;
 }
 document.title=`${m.title} · ${t('dashboard')}`;
 $('#content').innerHTML=`<div class="page-wrap manage-page"><div class="page-toolbar"><a class="breadcrumb" href="#/dashboard">${icon('back')}${t('myFunds')}<span>/</span>#${id}</a><button class="icon-button" id="manage-refresh" aria-label="${t('refresh')}">${icon('refresh')}</button></div><section class="listing-header"><div><span class="eyebrow">${t('dashboard')}</span><h1>${esc(m.title)}</h1><p>${esc(m.description)}</p></div><a class="secondary" href="${fundUrl(id)}">${t('view')}${icon('external')}</a></section><div class="stats-grid"><div class="stat-card"><span>${t('totalRaised')}</span><strong>${money(c.raised)} <small>USDC</small></strong></div><div class="stat-card"><span>${t('goal')}</span><strong>${money(c.goal)} <small>USDC</small></strong></div><div class="stat-card"><span>${t('totalReturned')}</span><strong>${money(c.refunded)} <small>USDC</small></strong></div><div class="stat-card"><span>${t('deadline')}</span><strong class="stat-date">${date(c.deadline)}</strong></div></div><div class="manage-layout"><div><div class="manage-summary panel"><div class="section-heading"><h2>${t('purpose')}: ${esc(m.purpose||m.title)}</h2>${badge(f)}</div>${progress(c)}<p>${t('approvedMerchant')}: <strong>${esc(m.merchantName||short(c.merchant))}</strong></p>${address(c.merchant)}<p class="muted">${t('chosenMerchant')}</p></div><section class="activity-section panel"><div class="section-heading"><div><h2>${t('activity')}</h2><p>${t('activityDesc')}</p></div>${icon('chart')}</div><div id="history-body">${activityView()}</div></section></div><aside>${management(f)}</aside></div></div>`;
 $('#manage-refresh').onclick=()=>action(async()=>{await render();notify(t('updated'));});
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(async()=>{await write(b.dataset.action,[f.id],b.dataset.amount?BigInt(b.dataset.amount):undefined);await render();}));
 setBusy(busy);void loadHistory(id,version);
}
function saveDraft(){if($('#create-form'))Object.assign(draft,Object.fromEntries(new FormData($('#create-form'))));}
function renderCreate(){
 document.title=`${t('create')} · PurposeLock`;
 const field=(name,key,placeholder,other='')=>`<label>${t(key)}<input name="${name}" value="${esc(draft[name])}" placeholder="${esc(placeholder)}" ${other}></label>`;
 $('#content').innerHTML=`<div class="page-wrap create-page"><section class="listing-header"><div><span class="eyebrow">${t('create')}</span><h1>${t('createTitle')}</h1><p>${t('createDesc')}</p></div></section><div class="create-layout"><form id="create-form" class="panel create-form"><div class="form-section"><div class="section-heading"><h2><span class="section-number">01</span>${t('details')}</h2></div>${field('title','title','New PC for my stream','required maxlength="80"')}${field('purpose','purpose','Gaming/Streaming PC','required maxlength="80"')}<label>${t('description')}<textarea name="description" rows="3" required maxlength="200" placeholder="Tell donors what their contribution will make possible.">${esc(draft.description)}</textarea></label>${field('merchantName','merchantName','Example PC Store','required maxlength="60"')}<div class="byte-counter" id="byte-counter"></div></div><div class="form-section"><div class="section-heading"><h2><span class="section-number">02</span>${t('budget')}</h2></div><div class="two-fields">${field('goal','goal','1,000','type="number" min="0.000001" step="0.000001" required')}<label>${t('deadline')}<input name="deadline" type="datetime-local" value="${esc(draft.deadline)}" required><small>${t('localTime')}</small></label></div>${field('merchant','merchantAddress','0x…','required pattern="0x[a-fA-F0-9]{40}"')}<div class="form-callout">${icon('lock')}<p>${t('immutableNote')}</p></div></div><div class="create-submit">${!session.account?`<button class="primary full" type="button" data-connect>${t('connect')}</button>`:`<button class="primary full" type="submit" ${!session.ready?'disabled data-unavailable="true"':''}>${icon('plus')}${t('create')}</button>`}<p class="form-note">${t('gas')}</p></div></form><aside class="create-explanation"><div class="explanation-icon">${icon('shield')}</div><h2>${t('reviewTitle')}</h2><p>${t('reviewDesc')}</p><ul><li>${icon('check')}${t('reviewConsent')}</li><li>${icon('check')}${t('noWithdrawalDesc')}</li><li>${icon('check')}${t('reviewRefund')}</li></ul><div class="mini-route"><span>${t('donor')}</span>${icon('arrow')}<strong>PurposeLock</strong>${icon('arrow')}<span>${t('merchant')}</span></div><p class="muted">${t('chosenMerchant')}</p></aside></div></div>`;
 const updateBudget=()=>{saveDraft();const bytes=metadataBytes(encodeFund(draft));$('#byte-counter').textContent=`${t('bytes')}: ${bytes} / 240 bytes`;$('#byte-counter').classList.toggle('over-limit',bytes>240);};
 $('#create-form').oninput=updateBudget;updateBudget();
 document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=()=>action(async()=>{saveDraft();await connect();await render();}));
 $('#create-form').onsubmit=e=>{e.preventDefault();void action(async()=>{
  saveDraft();const purpose=encodeFund(draft);if(metadataBytes(purpose)>240)throw new Error(t('byteError'));
  if(!isAddress(draft.merchant))throw new Error(t('invalidAddress'));
  const deadline=Math.floor(new Date(draft.deadline).getTime()/1000),now=(await read.getBlock('latest')).timestamp;
  if(!Number.isFinite(deadline)||deadline<=now||deadline>now+365*86400)throw new Error(t('invalidDeadline'));
  const receipt=await write('createCampaign',[purpose,units(draft.goal),deadline,getAddress(draft.merchant)]);
  const event=receipt.logs.map(log=>{try{return lock.interface.parseLog(log);}catch{return null;}}).find(e=>e?.name==='CampaignCreated');
  Object.keys(draft).forEach(k=>draft[k]='');navigate(fundUrl(event.args.id));
 });};setBusy(busy);
}
async function render(){
 const version=++renderVersion;currentFund=null;shell();
 const r=route();
 try{
  if(r.name==='create')renderCreate();
  else if(r.name==='fund'){if(!session.ready)throw new Error(t('unavailable'));await renderCampaign(r.id,version);}
  else if(r.name==='dashboard'&&r.id)await renderManage(r.id,version);
  else if(r.name==='deploy'){const {renderDeployment}=await import('./deploy.js');renderDeployment({container:$('#content'),action,notify});}
  else await renderListing(r.name==='dashboard',version);
 }catch(e){if(version!==renderVersion)return;$('#content').innerHTML=`<div class="page-wrap"><section class="empty-state panel">${icon('info')}<h1>${t('notFound')}</h1><p>${esc(failure(e))}</p><p>${t('tryAgain')}</p><a class="primary" href="#/explore">${t('explore')}</a></section></div>`;}
 setBusy(busy);
}
window.addEventListener('hashchange',()=>{saveDraft();window.scrollTo({top:0});void render();});
try{
 shell();await verify();if(local)await connect();await render();
 const pending=JSON.parse(sessionStorage.getItem('purposelock-pending')||'null');if(pending?.network===networkKey)notify(t('previousTx'),pending.hash,'pending');
}catch(e){notify(failure(e),null,'error');await render();}
