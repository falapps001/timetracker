
import * as Data from './data.js';
const { S, sync } = Data;
const KEY='waktu', DAY=864e5;
const COLORS=['#4F7CE8','#3F6FB5','#56789F','#2B9BC9','#2A9DA8','#1F9D8A','#2E9E6E','#3F8F4D','#6E8F3A','#B8860B','#C98A1E','#D9822B','#C96B2E','#A0794F','#D9534F','#E5484D','#9E3B4E','#C9579A','#E07BA6','#8B6FD6','#7A4FC9','#7C6FB0','#5B5BD6','#6C8EBF','#607D8B','#6B7584'];
const EMO=['💼','🌱','🧭','⛩️','🕌','🍽️','😴','🚿','👔','🛵','📱','🚬','🔞','🍳','🧹','🧺','🛒','👥','👨‍👩‍👧','📖','🌐','🔬','🎹','🧴','📁','❤️',
  '📚','✍️','💻','🧠','🏃','🏋️','⚽','🚗','🚌','☕','🎮','📺','🎵','🎨','📞','🧘','💊','🩺','🙏','🌳','🐱','💰','🛠️','✈️','🎬','🍿','💤','⭐'];

const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const uid=Data.uid;
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return +d};
const addD=(t,n)=>{const d=new Date(t);d.setDate(d.getDate()+n);return +d};
const hm=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())};
const dur=(ms,sec)=>{ms=Math.max(0,ms);const s=Math.floor(ms/1e3),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return sec?`${h}:${pad(m)}:${pad(s%60)}`:`${h}:${pad(m)}`};
const ov=(x,a,b)=>Math.max(0,Math.min(x.e??Date.now(),b)-Math.max(x.s,a));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDay=t=>new Date(t).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
const fmtShort=t=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

/* ---------- data (lihat data.js) ---------- */
const U={hmode:(()=>{try{return localStorage.getItem(KEY+'-mode')||'day'}catch{return 'day'}})(),view:'timer',day:sod(Date.now()),period:'week',anchor:Date.now()};
const acts=()=>S.acts.filter(a=>!a.hidden);
const act=id=>S.acts.find(a=>a.id===id)||{name:'?',icon:'·',color:'#888'};
const runs=()=>S.entries.filter(x=>x.e==null).sort((p,q)=>q.s-p.s);
function commit(){Data.commit();render()}

/* ---------- aksi utama: satu ketukan ---------- */
const MIN_KEEP=60e3; // catatan < 1 menit dianggap salah tekan dan dihapus otomatis
function tap(aid){
  const t=Date.now(), before=runs().map(x=>({...x}));
  const same=before.some(x=>x.a===aid);
  const dropped=[];
  S.entries=S.entries.filter(x=>{
    if(x.e!=null)return true;
    if(t-x.s<MIN_KEEP){dropped.push(x);return false}
    x.e=t;return true;
  });
  let created=null;
  if(!same){created={id:uid(),a:aid,s:t,e:null,n:''};S.entries.push(created)}
  commit();
  navigator.vibrate?.(12);
  const a=act(aid);
  const msg=same?(dropped.length?`${a.icon} ${a.name} discarded (< 1 min)`:`${a.icon} ${a.name} stopped`):`${a.icon} ${a.name} started`;
  toast(msg,()=>{
    if(created)S.entries=S.entries.filter(x=>x!==created);
    dropped.forEach(x=>{x.e=null;S.entries.push(x)});
    before.forEach(b=>{const x=S.entries.find(y=>y.id===b.id);if(x)x.e=null});
    commit();
  });
}

/* ---------- tampilan ---------- */
function vTimer(){
  const now=Date.now(),t0=sod(now),t1=addD(t0,1),run=runs()[0];
  U.lastDay=t0;
  let total=0;
  const tiles=acts().map(a=>{
    total+=S.entries.filter(x=>x.a===a.id&&(x.e??Infinity)>t0).reduce((s,x)=>s+ov(x,t0,t1),0);
    const on=run&&run.a===a.id;
    return `<button class="tile${on?' on':''}" data-act="${a.id}" style="--c:${a.color}" aria-pressed="${!!on}">
      <span class="emo">${a.icon}</span><span class="nm">${esc(a.name)}</span></button>`;
  }).join('');
  const rf=run?Math.max(run.s,t0):0;
  return `<div class="split"><div class="main-col"><header class="hd"><div><div class="lbl">${fmtDay(now)}</div>
      <div class="cap">${run?`${act(run.a).icon} ${esc(act(run.a).name)} · <span class="num" data-base="0" data-from="${run.s}" data-sec="1">${dur(now-run.s,1)}</span>`:'&nbsp;'}</div></div>
      <div class="hbtns"><button class="syncb${sync.status==='syncing'?' spin':''}${sync.status==='error'||sync.status==='offline'?' warn':''}" data-do="syncnow" aria-label="Sync now" title="${esc(syncLabel())}">
        <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></svg></button>
        <button class="syncb" data-do="settings" aria-label="Settings" title="Settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div></header>
    <section class="grid">${tiles}<button class="tile add" data-do="newAct"><b>+</b>Activity</button></section></div>
    <aside class="tpanel"><div class="today-h"><b>Today</b><button class="linkb" data-goto="${t0}">Open in History ›</button></div>
      <div class="today-s" id="todayScroll"><div class="dv" style="--h:${H}px;grid-template-columns:46px minmax(0,1fr)">
      <div class="hours num">${Array.from({length:23},(_,i)=>`<span style="top:${(i+1)*H}px">${pad(i+1)}:00</span>`).join('')}</div>${laneHtml(t0,false)}</div></div></aside></div>`;
}

const H=56; // tinggi 1 jam (px)
const weekStart=t=>{const d=new Date(t);return addD(sod(t),-((d.getDay()+6)%7))};
function laneHtml(d0,wk){
  const d1=addD(d0,1),now=Date.now(),px=t=>(t-d0)/6e4*H/60;
  const es=S.entries.filter(x=>ov(x,d0,d1)>0).sort((p,q)=>p.s-q.s);
  // susun kolom bila ada catatan yang bertumpuk
  const L=[];let cl=[],cEnd=-1;
  const flush=()=>{const cols=[];cl.forEach(o=>{let i=cols.findIndex(end=>end<=o.s0);if(i<0){i=cols.length;cols.push(0)}cols[i]=o.e0;o.col=i});cl.forEach(o=>o.n=cols.length);cl=[]};
  es.forEach(x=>{const o={x,s0:Math.max(x.s,d0),e0:Math.min(x.e??now,d1)};if(cl.length&&o.s0>=cEnd)flush();cl.push(o);cEnd=Math.max(cEnd,o.e0);L.push(o)});flush();
  const evs=L.map(o=>{
    const a=act(o.x.a),top=px(o.s0),h=Math.max(wk?6:16,px(o.e0)-top-2),w=100/o.n,short=h<36;
    const time=`${hm(o.x.s)}–${o.x.e==null?'now':hm(o.x.e)}`;
    const m=wk?2:4;
    return `<button class="ev${short?' short':''}" data-entry="${o.x.id}" title="${esc(a.name)} ${time}"
      style="--c:${a.color};top:${top+1}px;height:${h}px;left:calc(${o.col*w}% + ${m}px);width:calc(${w}% - ${m+2}px)">
      <span>${h>=14?a.icon:''}<em> ${esc(a.name)}</em></span>${wk?'':`<small class="num">${short?hm(o.x.s):`${time} · ${dur(ov(o.x,o.x.s,Infinity))}`}</small>
      ${h>=58&&o.x.n?`<small>${esc(o.x.n)}</small>`:''}`}</button>`}).join('');
  return `<div class="lane" data-lane="${d0}">${evs}${d0===sod(now)?`<i class="now" style="top:${px(now)}px"></i>`:''}</div>`;
}
function vHistory(){
  const wk=U.hmode==='week',now=Date.now(),today=sod(now);
  const days=wk?Array.from({length:7},(_,i)=>addD(weekStart(U.day),i)):[U.day];
  const s0=days[0],s1=addD(days[days.length-1],1);
  const total=S.entries.reduce((s,x)=>s+ov(x,s0,s1),0);
  const hrs=Array.from({length:23},(_,i)=>i+1);
  const title=wk?`${fmtShort(s0)} – ${fmtShort(addD(s1,-1))}`:fmtDay(s0);
  const cols=`46px repeat(${days.length},minmax(0,1fr))`;
  const wkhd=wk?`<div class="wkhd" style="grid-template-columns:${cols}"><span></span>${days.map(d=>{const x=new Date(d);
    return `<button type="button" data-goday="${d}" class="${d===today?'td':''}"><small>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x.getDay()]}</small><b class="num">${x.getDate()}</b></button>`}).join('')}</div>`:'';
  return `<div class="stick">
      <div class="seg">${[['day','Daily'],['week','Weekly']].map(([k,l])=>`<button data-hmode="${k}" class="${(U.hmode||'day')===k?'on':''}">${l}</button>`).join('')}</div>
      <div class="daynav"><button class="ib" data-day="-1" aria-label="Previous">‹</button>
      <button class="dtitle" data-do="cal" aria-label="Pick a date"><b>${title}</b></button>
      <button class="ib" data-day="1" aria-label="Next" ${s1>today?'disabled':''}>›</button></div>${wkhd}</div>
    <div class="dv${wk?' wk':''}" style="--h:${H}px;grid-template-columns:${cols}">
      <div class="hours num">${hrs.map(h=>`<span style="top:${h*H}px">${pad(h)}:00</span>`).join('')}</div>
      ${days.map(d=>laneHtml(d,wk)).join('')}</div>`;
}
function scrollDay(){
  const lane=$('.lane');if(!lane)return;
  const now=Date.now(),wk=U.hmode==='week',s0=wk?weekStart(U.day):U.day,s1=addD(s0,wk?7:1);
  const first=S.entries.filter(x=>ov(x,s0,s1)>0).sort((p,q)=>p.s-q.s)[0];
  const mins=now>=s0&&now<s1?(now-sod(now))/6e4-150:!wk&&first?(Math.max(first.s,s0)-s0)/6e4:7*60;
  scrollTo(0,Math.max(0,lane.getBoundingClientRect().top+scrollY+mins*H/60-(wk?150:110)));
}
function openCal(cur=U.day,isSel=t=>U.hmode==='week'?weekStart(t)===weekStart(U.day):t===U.day,onPick=t=>{U.day=t;render();scrollDay()}){
  const m=new Date(cur);m.setDate(1);
  const has=new Set(S.entries.map(x=>sod(x.s)));
  const draw=form=>{
    const y=m.getFullYear(),mo=m.getMonth(),first=+new Date(y,mo,1),n=new Date(y,mo+1,0).getDate(),lead=(new Date(first).getDay()+6)%7,today=sod(Date.now());
    let cells='';for(let i=0;i<lead;i++)cells+='<span></span>';
    for(let d=1;d<=n;d++){const t=+new Date(y,mo,d);
      cells+=`<button type="button" data-pick="${t}" class="${has.has(t)?'has':''}${t===today?' td':''}${isSel(t)?' sel':''}" ${t>today?'disabled':''}>${d}</button>`}
    form.innerHTML=`<div class="calhd"><button type="button" class="ib" data-m="-1" aria-label="Previous month">‹</button>
        <h2>${m.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h2>
        <button type="button" class="ib" data-m="1" aria-label="Next month" ${first+31*DAY>today&&new Date(y,mo+1,1)>today?'disabled':''}>›</button></div>
      <div class="cal${(cells.match(/ sel/g)||[]).length>1?' wkm':''}">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<span class="wd">${w}</span>`).join('')}${cells}</div>
      <div class="btns"><button type="button" class="ghost" data-pick="${today}">Today</button></div>`;
  };
  sheet('',form=>{draw(form);form.addEventListener('click',e=>{
    const b=e.target.closest('[data-m],[data-pick]');if(!b)return;
    if(b.dataset.m){m.setMonth(m.getMonth()+ +b.dataset.m);return draw(form)}
    closeSheet();onPick(+b.dataset.pick);
  })});
}
// pemilih bulan (Jan–Des) dan tahun untuk Laporan
function openMonthPick(){
  const cur=new Date(U.anchor),now=new Date();let y=cur.getFullYear();
  const has=new Set(S.entries.map(x=>{const d=new Date(x.s);return d.getFullYear()*12+d.getMonth()}));
  const draw=form=>{
    form.innerHTML=`<div class="calhd"><button type="button" class="ib" data-y="-1" aria-label="Previous year">‹</button><h2>${y}</h2>
        <button type="button" class="ib" data-y="1" aria-label="Next year" ${y>=now.getFullYear()?'disabled':''}>›</button></div>
      <div class="mgrid">${Array.from({length:12},(_,i)=>{const k=y*12+i;
        return `<button type="button" data-mp="${i}" class="${has.has(k)?'has':''}${y===cur.getFullYear()&&i===cur.getMonth()?' sel':''}${y===now.getFullYear()&&i===now.getMonth()?' td':''}" ${k>now.getFullYear()*12+now.getMonth()?'disabled':''}>${new Date(y,i,1).toLocaleDateString('en-GB',{month:'long'})}</button>`}).join('')}</div>
      <div class="btns"><button type="button" class="ghost" data-mp="now">This month</button></div>`;
  };
  sheet('',form=>{draw(form);form.addEventListener('click',e=>{
    const b=e.target.closest('[data-y],[data-mp]');if(!b)return;
    if(b.dataset.y){y+=+b.dataset.y;return draw(form)}
    U.anchor=b.dataset.mp==='now'?Date.now():+new Date(y,+b.dataset.mp,1);closeSheet();render();
  })});
}
function openYearPick(){
  const cy=new Date().getFullYear(),sel=new Date(U.anchor).getFullYear();
  const first=Math.min(cy,...S.entries.map(x=>new Date(x.s).getFullYear()));
  const years=[];for(let y=cy;y>=first;y--)years.push(y);
  sheet(`<h2>Pick a year</h2><div class="mgrid">${years.map(y=>`<button type="button" data-yp="${y}" class="has${y===sel?' sel':''}${y===cy?' td':''}">${y}</button>`).join('')}</div>`,form=>{
    form.addEventListener('click',e=>{const b=e.target.closest('[data-yp]');if(!b)return;U.anchor=+new Date(+b.dataset.yp,0,1);closeSheet();render()});
  });
}

function range(){
  const d=new Date(U.anchor);
  if(U.period==='day'){const s=sod(d);return {s,e:addD(s,1),label:fmtDay(s)}}
  if(U.period==='week'){const s=addD(sod(d),-((d.getDay()+6)%7)),e=addD(s,7);return {s,e,label:`${fmtShort(s)} – ${fmtShort(addD(e,-1))}`}}
  if(U.period==='month'){const s=+new Date(d.getFullYear(),d.getMonth(),1),e=+new Date(d.getFullYear(),d.getMonth()+1,1);
    return {s,e,label:new Date(s).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}}
  const s=+new Date(d.getFullYear(),0,1),e=+new Date(d.getFullYear()+1,0,1);return {s,e,label:String(d.getFullYear())};
}
function repHead(label,e,now){
  return `<div class="seg" role="tablist">${[['day','Day'],['week','Week'],['month','Month'],['year','Year']].map(([k,l])=>`<button data-period="${k}" class="${U.period===k?'on':''}">${l}</button>`).join('')}</div>
    <div class="daynav"><button class="ib" data-pnav="-1" aria-label="Previous">‹</button><button class="dtitle" data-do="rpick" aria-label="Pick a period"><b>${label}</b></button><button class="ib" data-pnav="1" aria-label="Next" ${e>now?'disabled':''}>›</button></div>`;
}
function vDetail(){
  const a=act(U.detail),{s,e,label}=range(),now=Date.now();
  const es=S.entries.filter(x=>x.a===a.id&&ov(x,s,e)>0).sort((p,q)=>p.s-q.s);
  const total=es.reduce((t,x)=>t+ov(x,s,e),0);
  const nd=s>now?0:Math.max(1,Math.ceil((Math.min(e,now)-s)/DAY));
  const daysWith=new Set(es.flatMap(x=>{const r=[];for(let d=sod(Math.max(x.s,s));d<Math.min(x.e??now,e);d=addD(d,1))r.push(d);return r})).size;
  // rata-rata jam (melingkar, supaya 23:30 & 00:30 rata-ratanya 00:00)
  const circ=ts=>{if(!ts.length)return '–';let X=0,Y=0;ts.forEach(t=>{const r=(t-sod(t))/864e5*2*Math.PI;X+=Math.cos(r);Y+=Math.sin(r)});
    let m=Math.round(Math.atan2(Y,X)/(2*Math.PI)*1440);if(m<0)m+=1440;return pad(Math.floor(m/60)%24)+':'+pad(m%60)};
  const starts=es.filter(x=>x.s>=s).map(x=>x.s),ends=es.filter(x=>x.e!=null&&x.e<=e).map(x=>x.e);
  let rows='';
  for(let d=sod(Math.min(e,now)-1);d>=s;d=addD(d,-1)){
    const d1=addD(d,1),seg=es.filter(x=>ov(x,d,d1)>0);if(!seg.length)continue;
    const t=seg.reduce((q,x)=>q+ov(x,d,d1),0),dt=new Date(d);
    rows+=`<button class="drow" data-goto="${d}" style="--c:${a.color}">
      <span class="drh"><span>${dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</span><b class="num">${dur(t)}</b></span>
      <span class="strip">${seg.map(x=>`<i style="left:${(Math.max(x.s,d)-d)/DAY*100}%;width:${ov(x,d,d1)/DAY*100}%"></i>`).join('')}</span>
      <small class="num">${seg.map(x=>`${hm(x.s)}–${x.e==null?'now':hm(x.e)}`).join('  ·  ')}</small></button>`;
  }
  return `<button class="back" data-do="back">‹ All activities</button>
    <div class="dhead" style="--c:${a.color}"><span class="dico">${a.icon}</span><div><b>${esc(a.name)}</b><small>${es.length} ${es.length===1?'session':'sessions'} · ${plural(daysWith,'day','days')}</small></div></div>
    ${repHead(label,e,now)}
    <div class="kpis"><div class="kpi"><span>Total</span><b>${dur(total)}</b></div><div class="kpi"><span>Average / day</span><b>${dur(nd?total/nd:0)}</b></div>
      <div class="kpi"><span>Usually starts</span><b>${circ(starts)}</b></div><div class="kpi"><span>Usually ends</span><b>${circ(ends)}</b></div></div>
    ${rows?`<div class="tl-ax num"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div><div class="dlist">${rows}</div>`
      :`<div class="empty">No ${esc(a.name)} in this period.</div>`}`;
}
function vReport(){
  if(U.detail)return vDetail();
  const {s,e,label}=range(), now=Date.now();
  const es=S.entries.filter(x=>ov(x,s,e)>0);
  const per={}; let total=0;
  es.forEach(x=>{const v=ov(x,s,e);per[x.a]=(per[x.a]||0)+v;total+=v});
  const days=s>now?0:Math.max(1,Math.ceil((Math.min(e,now)-s)/DAY));
  // kolom: per hari (minggu/bulan) atau per bulan (tahun)
  const bk=[];
  if(U.period==='day')for(let h=0;h<24;h++)bk.push([s+h*36e5,s+(h+1)*36e5,h%6===0?pad(h):''])
  else if(U.period==='year')for(let m=0;m<12;m++){const a=+new Date(new Date(s).getFullYear(),m,1),b=+new Date(new Date(s).getFullYear(),m+1,1);bk.push([a,b,'JFMAMJJASOND'[m]])}
  else for(let t=s,i=0;t<e;t=addD(t,1),i++){const dd=new Date(t);bk.push([t,addD(t,1),U.period==='week'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dd.getDay()]:(dd.getDate()%5===1||dd.getDate()===1?dd.getDate():'')])}
  const order=Object.keys(per).sort((p,q)=>per[q]-per[p]);
  const cols=bk.map(([a,b])=>{const m={};let t=0;es.forEach(x=>{const v=ov(x,a,b);if(v){m[x.a]=(m[x.a]||0)+v;t+=v}});return {m,t,a,b}});
  const max=Math.max(...cols.map(c=>c.t),1);
  const colHtml=cols.map(c=>`<div class="col${now>=c.a&&now<c.b&&U.period!=='year'?' today':''}" title="${dur(c.t)}">${order.filter(k=>c.m[k]).map(k=>`<i style="--c:${act(k).color};height:${c.m[k]/max*100}%"></i>`).join('')}</div>`).join('');
  // waktu tidak tercatat = waktu yang sudah lewat di periode ini dikurangi yang tercatat
  const elapsed=Math.max(0,Math.min(e,now)-s),untracked=Math.max(0,elapsed-total),base=Math.max(elapsed,total,1);
  const top=Math.max(per[order[0]]||0,untracked,1),pct=v=>Math.round(v/base*100);
  const bars=order.map(k=>{const a=act(k);return `<button class="brow" data-detail="${k}" style="--c:${a.color}"><div class="bh"><span>${a.icon} ${esc(a.name)}</span><span class="num">${dur(per[k])}<small>${pct(per[k])}%</small></span></div><div class="bar"><i style="width:${per[k]/top*100}%"></i></div></button>`}).join('')
    +`<div class="untr"><div class="bh"><span>Untracked</span><span class="num">${dur(untracked)}<small>${pct(untracked)}%</small></span></div><div class="bar"><i style="width:${untracked/top*100}%"></i></div></div>`;
  return `${repHead(label,e,now)}
    ${total?`<div class="chart"><div class="cols">${colHtml}</div><div class="axl">${bk.map(b=>`<span>${b[2]}</span>`).join('')}</div></div><div class="bars">${bars}</div>`
      :`<div class="empty">No data in this period yet.</div>`}`;
}

/* ---------- pengaturan ---------- */
function ago(t){if(!t)return 'never';const m=Math.floor((Date.now()-t)/6e4);
  if(m<1)return 'just now';if(m<60)return `${m} min ago`;if(m<24*60)return `${Math.floor(m/60)} h ago`;
  if(m<7*24*60)return `${Math.floor(m/1440)} days ago`;
  return `${new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}, ${hm(t)}`}
function syncLabel(){
  if(!sync.enabled)return 'Sync is not set up';
  if(!sync.user)return 'Not signed in';
  return {syncing:'Syncing…',offline:'Offline · will send automatically when online',error:sync.error||'Sync failed',
    idle:`Synced ${ago(sync.lastSync)}`}[sync.status]||'';
}
let devCache=null;
function devicesHtml(){
  if(!sync.user)return '';
  if(!devCache){devCache='loading';Data.listDevices().then(d=>{devCache=d;if(U.view==='settings')render()}).catch(()=>{devCache=[];});}
  const list=Array.isArray(devCache)?devCache:[];
  return `<h3 class="sh">Devices</h3><div class="card">${list.length?list.map(d=>`<div class="item static"><span class="dev"><span class="dico2">${Data.isMobileName(d.name)?'📱':'💻'}</span><span><b>${esc(d.name)}${d.me?' <em class="tag">this device</em>':''}</b><small>Last synced ${ago(d.last)}</small></span></span>${d.me?'':`<button class="btn" data-rmdev="${d.id}">Remove</button>`}</div>`).join('')
    :`<div class="item static"><span><small>${devCache==='loading'?'Loading…':'No devices yet.'}</small></span></div>`}</div>`;
}
async function removeDevice(id){
  const d=Array.isArray(devCache)&&devCache.find(x=>x.id===id);if(!d)return;
  devCache=devCache.filter(x=>x.id!==id);render();
  try{await Data.removeDevice(id)}catch(e){devCache=null;render();return toast('Could not remove device: '+e.message)}
  toast(`${d.name} removed`,async()=>{await Data.restoreDevice(d).catch(()=>{});devCache=null;render()});
}
function vSettings(){
  const hidden=S.acts.filter(a=>a.hidden);
  let syncCard;
  if(!sync.enabled)syncCard=`<div class="card"><div class="item static"><span><b>Not set up</b><small>Data is stored on this device only. Fill in firebase-config.js to enable sync (see PANDUAN.md).</small></span></div></div>`;
  else if(!sync.user)syncCard=`<form class="card login" id="loginForm" novalidate>
      <div class="item static"><span><b>Sign in to sync</b><small>Use the same email & password on every device</small></span></div>
      <div class="lf"><input id="lg-email" type="email" autocomplete="username" placeholder="Email" inputmode="email">
        <input id="lg-pw" type="password" autocomplete="current-password" placeholder="Password (min. 6 characters)">
        <p class="err" id="lg-err">${esc(U.authErr||'')}</p>
        <div class="btns"><button type="button" class="ghost" data-do="signup">Sign up</button><button class="pri" data-do="signin">Sign in</button></div>
        <button type="button" class="linkb" data-do="reset">Forgot password?</button></div></form>`;
  else syncCard=`<div class="card"><div class="item static"><span><b>${esc(sync.user.email)}</b><small>${esc(syncLabel())}${sync.pending?` · ${plural(sync.pending,'change','changes')} waiting to upload`:''}</small></span><button class="btn" data-do="syncnow">Sync</button></div>
      <button class="item" data-do="signout"><span><b class="danger">Sign out</b><small>Removes data from this device; your data on the server stays safe</small></span></button></div>`;
  const lb=U.lastBackup;
  return `<button class="back" data-do="closeSettings">‹ Timer</button><h1 class="pt">Settings</h1>
    <h3 class="sh">Sync</h3>${syncCard}
    ${devicesHtml()}
    <h3 class="sh">Data</h3>
    <div class="card">
      <button class="item" data-do="csv"><span><b>Export CSV</b><small>${plural(S.entries.length,'entry','entries')} · open in Excel or Google Sheets</small></span><i>›</i></button>
      <button class="item" data-do="json"><span><b>Backup (JSON)</b><small>${lb?`Last backup ${ago(lb)}`:'Never backed up'}</small></span><i>›</i></button>
      <label class="item" for="imp"><span><b>Restore from backup</b><small>Choose a backup .json file</small></span><i>›</i></label>
      <input type="file" id="imp" accept=".json,application/json" hidden>
    </div>
    ${(!lb||Date.now()-lb>30*DAY)&&S.entries.length?`<p class="fn warn-t">Back up once a month and keep the file in Google Drive.</p>`:''}
    ${hidden.length?`<h3 class="sh">Deleted activities</h3><div class="card">${hidden.map(a=>`<div class="item static"><span><b>${a.icon} ${esc(a.name)}</b></span><button class="btn" data-restore="${a.id}">Restore</button></div>`).join('')}</div>`:''}
    <p class="fn ver">Waktu · version 1.2</p>`;
}
const fmtDT=t=>{const d=new Date(t);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function exportText(kind){
  if(kind==='json')return JSON.stringify({app:'waktu',version:1,exported:new Date().toISOString(),
    acts:S.acts.map(({id,name,icon,color,order,hidden})=>({id,name,icon,color,order,hidden:!!hidden})),
    entries:[...S.entries].sort((p,q)=>p.s-q.s).map(({id,a,s,e,n})=>({id,a,s,e:e??null,n:n||''}))});
  // koma: standar CSV, langsung terbagi ke kolom di Excel berbahasa Inggris & Google Sheets
  const cell=v=>{v=String(v??'');return /[,"\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};
  const rows=[['Date','Activity','Start','End','Duration (min)','Note']];
  [...S.entries].sort((p,q)=>p.s-q.s).forEach(x=>rows.push([fmtDT(x.s),act(x.a).name,hm(x.s),x.e==null?'':(sod(x.e)!==sod(x.s)?fmtDT(x.e)+' ':'')+hm(x.e),x.e==null?'':Math.round((x.e-x.s)/6e4),x.n]));
  return '﻿'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
async function download(kind){
  const text=exportText(kind),ext=kind==='json'?'json':'csv',name=`waktu-${kind==='json'?'backup':'entries'}-${fmtDT(Date.now())}.${ext}`;
  const type=kind==='json'?'application/json':'text/csv';
  const file=new File([text],name,{type});
  // di HP pakai menu Bagikan (bisa langsung simpan ke Files / Google Drive); di laptop unduh biasa
  if(/iPhone|iPad|Android/.test(Data.deviceName())&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:name});return done()}catch(e){if(e.name==='AbortError')return}
  }
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);done();
  function done(){if(kind==='json'){U.lastBackup=Date.now();Data.setLastBackup(U.lastBackup);render()}toast(kind==='json'?'Backup created':'CSV exported')}
}
async function importFile(file){
  try{
    const d=JSON.parse(await file.text());
    if(!Array.isArray(d.acts)||!Array.isArray(d.entries))throw 0;
    const prev={acts:S.acts.map(a=>({...a})),entries:S.entries.map(x=>({...x}))};
    const ok=d.entries.filter(x=>x&&x.id&&x.a&&typeof x.s==='number'&&(x.e==null||typeof x.e==='number'));
    d.acts.forEach(a=>{if(!a||!a.id||!a.name)return;const v={id:a.id,name:a.name,icon:a.icon||'⭐',color:a.color||COLORS[0],order:a.order??99,hidden:!!a.hidden};
      const i=S.acts.findIndex(y=>y.id===a.id);if(i<0)S.acts.push(v);else Object.assign(S.acts[i],v)});
    S.acts.sort((p,q)=>(p.order??99)-(q.order??99));
    const ids=new Map(S.entries.map((x,i)=>[x.id,i]));
    ok.forEach(x=>{const v={id:x.id,a:x.a,s:x.s,e:x.e??null,n:x.n||''};const i=ids.get(x.id);if(i==null)S.entries.push(v);else Object.assign(S.entries[i],v)});
    commit();
    toast(`${plural(ok.length,'entry','entries')} restored`,()=>{S.acts=prev.acts;S.entries=prev.entries;commit()});
  }catch{toast('This file is not a valid Waktu backup')}
}

function render(){
  if(!sync.ready)return;
  const ts=$('#todayScroll'),keep=ts?ts.scrollTop:null;
  const vals={};document.querySelectorAll('#app input[id]').forEach(i=>{if(i.type!=='file')vals[i.id]=i.value});
  const focus=document.activeElement?.id;
  $('#app').innerHTML=({timer:vTimer,history:vHistory,report:vReport,settings:vSettings})[U.view]();
  const nt=$('#todayScroll');
  if(nt)nt.scrollTop=keep??Math.max(0,((Date.now()-sod(Date.now()))/6e4-150)*H/60);
  for(const [k,v] of Object.entries(vals)){const i=document.getElementById(k);if(i)i.value=v}
  if(focus&&document.getElementById(focus)?.matches('input'))document.getElementById(focus).focus();
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===U.view));
  updateTitle();
  if(U.view==='timer')fitTiles();
}
// HP: atur tinggi ubin supaya semua ubin muat satu layar tanpa scroll,
// lalu kecilkan huruf nama yang tidak muat (kata tidak pernah dipotong di tengah).
function fitTiles(){
  const g=document.querySelector('.grid');if(!g)return;
  const tiles=[...g.children];
  if(innerWidth>=768){g.style.removeProperty('--tile-h');g.style.removeProperty('--emo');tiles.forEach(t=>{const n=t.querySelector('.nm');if(n)n.style.fontSize=''});return}
  const cols=4,rows=Math.ceil(tiles.length/cols),gap=8;
  const top=g.getBoundingClientRect().top+scrollY,nav=document.getElementById('nav').offsetHeight;
  const avail=innerHeight-top-nav-12;
  const h=Math.max(64,Math.min(120,Math.floor((avail-gap*(rows-1))/rows)));
  g.style.setProperty('--tile-h',h+'px');
  g.style.setProperty('--emo',Math.round(Math.max(18,Math.min(28,h*.3)))+'px');
  for(const t of tiles){
    const n=t.querySelector('.nm');if(!n)continue;
    let size=12.5;n.style.fontSize=size+'px';
    const over=()=>n.scrollWidth>n.clientWidth+.5||n.scrollHeight>n.clientHeight+.5||t.scrollHeight>t.clientHeight+.5;
    while(size>8.5&&over()){size-=.5;n.style.fontSize=size+'px'}
    // HP sangat sempit (mis. iPhone SE lama): kalau tetap tidak muat, baru boleh dipotong
    n.style.overflowWrap=n.scrollWidth>n.clientWidth+.5?'anywhere':'';
  }
}
let fitT;addEventListener('resize',()=>{clearTimeout(fitT);fitT=setTimeout(()=>{if(U.view==='timer')fitTiles()},120)});
document.fonts?.ready?.then(()=>{if(U.view==='timer')fitTiles()});

// judul tab & tanda di ikon aplikasi saat ada timer berjalan
let lastBadge=null;
function updateTitle(){
  const r=runs()[0];
  document.title=r?`${act(r.a).icon} ${dur(Date.now()-r.s)} · Waktu`:'Waktu';
  if(lastBadge!==!!r){lastBadge=!!r;try{r?navigator.setAppBadge?.():navigator.clearAppBadge?.()}catch{}}
}
function tick(){
  if(typeof lp!=='undefined'&&lp)return; // jangan gambar ulang saat ubin sedang ditahan/digeser
  if(U.view==='timer'&&sod(Date.now())!==U.lastDay)return render();
  const n=Date.now();
  if((U.view==='history'||(U.view==='timer'&&innerWidth>=1080))&&Math.floor(n/6e4)!==U.lastMin){U.lastMin=Math.floor(n/6e4);return render()}
  document.querySelectorAll('[data-from]').forEach(el=>{el.textContent=dur(+el.dataset.base+n-+el.dataset.from,el.dataset.sec)});
  if(n%60e3<1000)updateTitle();
}
setInterval(tick,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});

/* ---------- toast ---------- */
let tT;
function toast(msg,undo){
  const el=$('#toast');
  el.innerHTML=`<span>${esc(msg)}</span>${undo?'<button type="button">Undo</button>':''}`;
  if(undo)el.querySelector('button').onclick=()=>{undo();el.classList.remove('show')};
  el.classList.add('show');clearTimeout(tT);tT=setTimeout(()=>el.classList.remove('show'),3500);
}

/* ---------- sheet (form bawah) ---------- */
function sheet(html,bind){
  const r=$('#sheetRoot');
  r.innerHTML=`<div class="sheet"><form novalidate>${html}</form></div>`;
  const wrap=r.firstChild,form=wrap.firstChild;
  const opened=Date.now();
  wrap.addEventListener('click',e=>{if(e.target===wrap&&Date.now()-opened>450)closeSheet()});
  bind(form);
  form.querySelector('input')?.focus({preventScroll:true});
}
const closeSheet=()=>{$('#sheetRoot').innerHTML=''};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
function picker(form,sel,cb){form.addEventListener('click',e=>{const b=e.target.closest(sel);if(!b)return;form.querySelectorAll(sel).forEach(x=>x.classList.toggle('sel',x===b));cb(b)})}

function editAct(aid){
  const a=aid?act(aid):{id:uid(),name:'',icon:'⭐',color:COLORS[S.acts.length%COLORS.length],order:S.acts.length,hidden:false};
  let icon=a.icon,color=a.color;
  sheet(`<h2>${aid?'Edit activity':'New activity'}</h2>
    <label class="fld"><span>Name</span><input id="f-name" maxlength="30" value="${esc(a.name)}" placeholder="e.g. Reading"></label>
    <div class="fld"><span>Icon</span><div class="pick">${EMO.map(e=>`<button type="button" class="e${e===icon?' sel':''}" data-emo="${e}">${e}</button>`).join('')}</div></div>
    <div class="fld"><span>Color</span><div class="pick">${COLORS.map(c=>`<button type="button" class="c${c===color?' sel':''}" data-col="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
    <p class="err" id="f-err"></p>
    <div class="btns">${aid?'<button type="button" class="ghost danger" id="f-del">Delete</button>':'<button type="button" class="ghost" id="f-x">Cancel</button>'}<button class="pri">Save</button></div>`,form=>{
    picker(form,'[data-emo]',b=>icon=b.dataset.emo);
    picker(form,'[data-col]',b=>color=b.dataset.col);
    form.querySelector('#f-x')?.addEventListener('click',closeSheet);
    form.querySelector('#f-del')?.addEventListener('click',()=>{
      a.hidden=true;S.entries.forEach(x=>{if(x.a===a.id&&x.e==null)x.e=Date.now()});closeSheet();commit();
      toast(`${a.name} deleted`,()=>{a.hidden=false;commit()});
    });
    form.onsubmit=e=>{e.preventDefault();const name=form.querySelector('#f-name').value.trim();
      if(!name){form.querySelector('#f-err').textContent='Enter an activity name.';return}
      Object.assign(a,{name,icon,color});if(!aid)S.acts.push(a);closeSheet();commit()};
  });
}

// rapikan catatan lain yang bertumpuk dengan x: potong, belah, atau hapus
function resolveOverlaps(x){
  const a=x.s,b=x.e??Date.now();let n=0;const add=[];
  S.entries=S.entries.filter(y=>{
    if(y===x)return true;
    const ys=y.s,ye=y.e??Infinity;
    if(ye<=a||ys>=b)return true;                 // tidak bertumpuk
    n++;
    if(ys>=a&&ye<=b)return false;                // tertutup penuh -> hapus
    if(ys<a&&ye>b){add.push({...y,id:uid(),s:b});y.e=a;return true} // x di tengah y -> belah dua
    if(ys<a){y.e=a;return true}                  // potong bagian akhir y
    y.s=b;return true;                           // potong bagian awal y
  });
  S.entries.push(...add);
  return n;
}
function editEntry(eid,preset){
  const now=Date.now(),isNew=!eid;
  const x=eid?S.entries.find(y=>y.id===eid):preset?{a:acts()[0].id,n:'',...preset}:(U.day===sod(now)?{a:acts()[0].id,s:now-30*6e4,e:now,n:''}:{a:acts()[0].id,s:U.day+9*36e5,e:U.day+10*36e5,n:''});
  let aid=x.a;
  const tv=t=>t==null?'':hm(t);
  sheet(`<h2>${isNew?'Add entry':'Edit entry'}</h2>
    <div class="fld"><span>Activity</span><div class="pick">${acts().map(a=>`<button type="button" class="a${a.id===aid?' sel':''}" data-aid="${a.id}">${a.icon} ${esc(a.name)}</button>`).join('')}</div></div>
    <div class="two"><label class="fld"><span>Start</span><input id="f-s" type="time" value="${tv(x.s)}"></label>
      <label class="fld"><span>End${x.e==null&&!isNew?' (empty = still running)':''}</span><input id="f-e" type="time" value="${tv(x.e)}"></label></div>
    <label class="fld"><span>Note (optional)</span><input id="f-n" maxlength="80" value="${esc(x.n)}" placeholder="e.g. Project meeting"></label>
    <p class="err" id="f-err"></p>
    <div class="btns">${isNew?'<button type="button" class="ghost" id="f-x">Cancel</button>':'<button type="button" class="ghost danger" id="f-del">Delete</button>'}<button class="pri">Save</button></div>`,form=>{
    picker(form,'[data-aid]',b=>aid=b.dataset.aid);
    form.querySelector('#f-x')?.addEventListener('click',closeSheet);
    form.querySelector('#f-del')?.addEventListener('click',()=>{
      const i=S.entries.indexOf(x);S.entries.splice(i,1);closeSheet();commit();
      toast('Entry deleted',()=>{S.entries.splice(i,0,x);commit()});
    });
    form.onsubmit=e=>{e.preventDefault();
      const err=m=>form.querySelector('#f-err').textContent=m;
      const sv=form.querySelector('#f-s').value,ev=form.querySelector('#f-e').value;
      if(!sv)return err('Enter a start time.');
      const base=sod(x.s??U.day),at=v=>{const [h,m]=v.split(':').map(Number);return base+(h*60+m)*6e4};
      let s=sv===tv(x.s)?x.s:at(sv), en=null;
      if(ev){
        if(ev===sv)return err('End time must be different from start time.');
        en=ev===tv(x.e)?x.e:at(ev);
        if(en<=s){en=addD(en,1); // lewat tengah malam, mis. tidur 22:30–06:00
          if(en-s>16*36e5)return err('End time is earlier than start time. Please check the times.')}
      }
      else if(isNew||x.e!=null)return err('Enter an end time.');
      if(en!=null&&en>Date.now())return err('End time is in the future.');
      if(en==null&&s>Date.now())return err('Start time is in the future.');
      const snap=S.entries.map(y=>({...y}));
      Object.assign(x,{a:aid,s,e:en,n:form.querySelector('#f-n').value.trim()});
      if(isNew){x.id=uid();S.entries.push(x)}
      const fixed=resolveOverlaps(x);
      closeSheet();commit();
      if(fixed)toast(`${fixed} other ${fixed>1?'entries':'entry'} adjusted`,()=>{S.entries=snap;commit()});
      else toast(isNew?'Entry added':'Saved');
    };
  });
}

/* ---------- input: ketuk vs tahan ---------- */
const app=$('#app');let lp=null;
// ketuk = mulai/ganti/berhenti · tahan lalu lepas = ubah · tahan lalu geser = pindah posisi
app.addEventListener('pointerdown',e=>{
  const t=e.target.closest('.tile[data-act]');if(!t||e.button>0)return;
  const r=t.getBoundingClientRect();
  lp={el:t,id:t.dataset.act,x:e.clientX,y:e.clientY,gx:e.clientX-r.left,gy:e.clientY-r.top,pid:e.pointerId,fired:false,moved:false};
  lp.timer=setTimeout(()=>{if(!lp)return;lp.fired=true;navigator.vibrate?.(25);
    t.classList.add('lift');try{t.setPointerCapture(lp.pid)}catch{}},450);
});
app.addEventListener('pointermove',e=>{
  if(!lp)return;
  if(!lp.fired){if(Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10){clearTimeout(lp.timer);lp=null}return}
  if(!lp.moved&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)<8)return;
  lp.moved=true;
  const el=lp.el,grid=el.parentNode;if(!el.isConnected)return endPress(true);
  // cari ubin di bawah jari, lalu pindahkan posisi di grid
  const over=document.elementsFromPoint(e.clientX,e.clientY).map(n=>n.closest?.('.tile[data-act]')).find(n=>n&&n!==el);
  if(over){const tiles=[...grid.querySelectorAll('.tile[data-act]')];
    grid.insertBefore(el,tiles.indexOf(over)>tiles.indexOf(el)?over.nextSibling:over)}
  el.style.transform='none';const r=el.getBoundingClientRect();
  el.style.transform=`translate(${e.clientX-lp.gx-r.left}px,${e.clientY-lp.gy-r.top}px) scale(1.06)`;
});
// cegah layar ikut ter-scroll saat ubin sedang digeser
document.addEventListener('touchmove',e=>{if(lp&&lp.fired)e.preventDefault()},{passive:false});
function endPress(cancel){
  if(!lp)return;clearTimeout(lp.timer);const {el,id,fired,moved}=lp;lp=null;
  el.classList.remove('lift');el.style.transform='';
  if(!fired){if(!cancel)tap(id);return}
  if(!moved){if(!cancel)editAct(id);return}
  const order=[...app.querySelectorAll('.tile[data-act]')].map(n=>n.dataset.act);
  S.acts.sort((a,b)=>{const i=order.indexOf(a.id),j=order.indexOf(b.id);return (i<0?1e9:i)-(j<0?1e9:j)});
  commit();
}
app.addEventListener('change',e=>{if(e.target.id==='imp'&&e.target.files[0]){importFile(e.target.files[0]);e.target.value=''}});
app.addEventListener('pointerup',()=>endPress(false));
app.addEventListener('pointercancel',()=>endPress(true));
app.addEventListener('contextmenu',e=>{if(e.target.closest('.tile'))e.preventDefault()});
app.addEventListener('click',e=>{
  const el=e.target.closest('[data-act],[data-do],[data-day],[data-entry],[data-period],[data-pnav],[data-lane],[data-hmode],[data-goday],[data-detail],[data-goto],[data-restore],[data-rmdev]');if(!el)return;
  const d=el.dataset;
  if(d.act){if(e.detail===0)tap(d.act);return}           // keyboard Enter/Space
  if(d.do==='newAct')return editAct(null);
  if(d.do==='syncnow'){
    if(!sync.enabled||!sync.user){U.view='settings';render();return toast(sync.enabled?'Sign in first to sync':'Sync is not set up')}
    if(sync.status==='syncing'&&U.syncBusy)return;
    U.syncBusy=true;el.classList.add('spin');
    Data.syncNow().then(()=>{devCache=null;toast(`Synced · ${hm(Date.now())}`)}).catch(err=>toast(err.message)).finally(()=>{U.syncBusy=false;render()});
    return;
  }
  if(d.do==='csv')return download('csv');
  if(d.do==='json')return download('json');
  if(d.do==='signin'||d.do==='signup'||d.do==='reset'){e.preventDefault();return auth(d.do,el)}
  if(d.do==='signout')return confirmSignOut();
  if(d.do==='settings'){U.view='settings';U.detail=null;devCache=null;render();return scrollTo(0,0)}
  if(d.do==='closeSettings'){U.view='timer';render();return scrollTo(0,0)}
  if(d.rmdev)return removeDevice(d.rmdev);
  if(d.restore){act(d.restore).hidden=false;commit();return toast('Activity restored')}
  if(d.do==='cal')return openCal();
  if(d.do==='rpick'){
    if(U.period==='day')return openCal(U.anchor,t=>t===sod(U.anchor),t=>{U.anchor=t;render()});
    if(U.period==='week')return openCal(U.anchor,t=>weekStart(t)===weekStart(U.anchor),t=>{U.anchor=t;render()});
    return U.period==='month'?openMonthPick():openYearPick();
  }
  if(d.do==='back'){U.detail=null;render();return scrollTo(0,0)}
  if(d.detail){U.detail=d.detail;render();return scrollTo(0,0)}
  if(d.goto){U.view='history';U.hmode='day';U.day=+d.goto;render();return scrollDay()}
  if(d.lane!==undefined){
    if(!acts().length)return toast('Add an activity first on the Timer page');
    const mins=Math.floor((e.clientY-el.getBoundingClientRect().top)/H*60/15)*15,s=+d.lane+mins*6e4,now=Date.now();
    if(s>=now)return toast('That time is in the future');
    return editEntry(null,{s,e:Math.min(s+36e5,now)});
  }
  if(d.day){U.day=addD(U.day,(U.hmode==='week'?7:1)*d.day);if(U.day>sod(Date.now()))U.day=sod(Date.now());render();return scrollDay()}
  if(d.hmode){U.hmode=d.hmode;try{localStorage.setItem(KEY+'-mode',d.hmode)}catch{};render();return scrollDay()}
  if(d.goday){U.day=+d.goday;U.hmode='day';render();return scrollDay()}
  if(d.entry)return editEntry(d.entry);
  if(d.period){U.period=d.period;U.anchor=Date.now();return render()}
  if(d.pnav){const t=new Date(U.anchor);if(U.period==='day')t.setDate(t.getDate()+ +d.pnav);else if(U.period==='week')t.setDate(t.getDate()+7*d.pnav);else if(U.period==='month'){t.setDate(1);t.setMonth(t.getMonth()+ +d.pnav)}else t.setFullYear(t.getFullYear()+ +d.pnav);U.anchor=+t;return render()}
});
app.addEventListener('submit',e=>{if(e.target.id==='loginForm'){e.preventDefault();auth('signin',e.target.querySelector('.pri'))}});
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;
  if(b.dataset.v==='history'&&U.view==='history')U.day=sod(Date.now());
  if(b.dataset.v==='settings')devCache=null;
  U.view=b.dataset.v;U.detail=null;render();scrollTo(0,0);if(U.view==='history')scrollDay()});

/* ---------- akun ---------- */
async function auth(kind,btn){
  // normalize('NFKC'): ubah karakter lebar (mis. ＠ dari keyboard Jepang/Cina) menjadi karakter biasa
  const email=($('#lg-email')?.value||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase(),pw=$('#lg-pw')?.value||'';
  const setErr=m=>{U.authErr=m;const el=$('#lg-err');if(el)el.textContent=m};
  if(!email)return setErr('Enter your email.');
  if(kind!=='reset'&&pw.length<6)return setErr('Password must be at least 6 characters.');
  setErr('');btn.disabled=true;
  try{
    if(kind==='signin')await Data.signIn(email,pw);
    else if(kind==='signup')await Data.signUp(email,pw);
    else{await Data.resetPassword(email);toast('Password reset link sent to your email')}
    if(kind!=='reset'){U.authErr='';toast('Signed in. Syncing…')}
  }catch(err){setErr(err.message)}finally{btn.disabled=false}
}
function confirmSignOut(){
  const warn=sync.pending?`<p class="err">${sync.pending} changes have not been uploaded yet and will be lost. Sync first if you can.</p>`:'';
  sheet(`<h2>Sign out?</h2><p class="fn" style="margin:0">Data on this device will be removed. Your data on the server stays safe and comes back when you sign in again.</p>${warn}
    <div class="btns"><button type="button" class="ghost" id="f-x">Cancel</button><button type="button" class="pri danger-bg" id="f-ok">Sign out</button></div>`,form=>{
    form.querySelector('#f-x').onclick=closeSheet;
    form.querySelector('#f-ok').onclick=async()=>{form.querySelector('#f-ok').disabled=true;await Data.signOut()};
  });
}

/* ---------- mulai ---------- */
let renderQueued=false;
Data.listen(()=>{ // data baru dari perangkat lain
  if(lp||renderQueued)return;renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;if(U.view!=='settings'||!document.querySelector('#loginForm'))render()});
},()=>{ // status sinkron berubah
  const b=document.querySelector('.syncb');
  if(b){b.classList.toggle('spin',sync.status==='syncing');b.classList.toggle('warn',sync.status==='error'||sync.status==='offline');b.title=syncLabel()}
  if(U.view==='settings'&&!document.querySelector('#loginForm'))render();
  else if(U.view==='settings'&&sync.user)render();
});
Data.init().then(async()=>{
  U.lastBackup=await Data.getLastBackup();
  render();
});
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
