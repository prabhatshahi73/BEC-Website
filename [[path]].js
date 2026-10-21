// BEC portal API: Cloudflare Pages Function for every /papi/* route (kept apart from the existing /api function).
// Needs a D1 binding named PDB, and the secrets ADMIN_EMAIL and ADMIN_PASSWORD (used once to create the admin account).
const GST=.18,enc=new TextEncoder(),ST=["Quote sent","Awaiting payment","Paid","In progress","Delivered"];
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json","cache-control":"no-store",...h}});
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""),rnd=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const hash=async(pw,salt)=>hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:enc.encode(salt),iterations:100000},await crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveBits"]),256));
const inr=n=>"₹"+Math.round(n).toLocaleString("en-IN"),fd=t=>new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"});
const wd=(t,n)=>{const d=new Date(t);while(n>0){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()%6)n--}return d.getTime()};
const str=(v,max)=>typeof v=="string"?v.trim().slice(0,max):"",tot=s=>Math.round(s*(1+GST)*100)/100;
const OS="SELECT 'BEC'||printf('%04d',o.n) id,o.uid,u.name uname,o.items,o.st,o.sub,o.total,o.days,o.at,o.due,o.pay,o.rep_name FROM orders o JOIN users u ON u.id=o.uid";
const shape=o=>{const{rep_name,...r}=o;return{...r,items:JSON.parse(o.items),rep:rep_name?{n:rep_name}:null}};
const start=async(db,u)=>{const t=rnd(32);await db.prepare("INSERT INTO sessions VALUES(?,?,?)").bind(t,u.id,Date.now()+6048e5).run();return J(u,200,{"set-cookie":`bec_s=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`})};
export async function onRequest({request,env,params}){
 const db=env.PDB,m=request.method,p=[].concat(params.path||[]),r=p[0];
 if(!db)return J({error:"The database is not connected yet."},500);
 if(m!="GET"&&!(request.headers.get("content-type")||"").includes("application/json"))return J({error:"Unsupported request."},415);
 const b=m=="GET"?{}:await request.json().catch(()=>({}));
 if(env.ADMIN_EMAIL&&env.ADMIN_PASSWORD&&!(await db.prepare("SELECT 1 FROM users WHERE role='admin'").first())){const s=rnd(16);await db.prepare("INSERT INTO users(role,name,email,salt,hash,at) VALUES('admin','BEC Admin',?,?,?,?)").bind(env.ADMIN_EMAIL.trim().toLowerCase(),s,await hash(env.ADMIN_PASSWORD,s),Date.now()).run()}
 if(r=="catalog"&&m=="GET")return J((await db.prepare("SELECT id,name,d,p,days,q FROM catalog ORDER BY rowid").all()).results);
 if(r=="register"&&m=="POST"){const em=str(b.email,120).toLowerCase(),name=str(b.name,80),pw=typeof b.pw=="string"?b.pw:"";
  if(!name||!/^\S+@\S+\.\S+$/.test(em)||pw.length<8)return J({error:"Enter your name, a valid email and a password of at least 8 characters."},400);
  if(await db.prepare("SELECT 1 FROM users WHERE email=?").bind(em).first())return J({error:"This email already has an account. Sign in instead."},409);
  const s=rnd(16),x=await db.prepare("INSERT INTO users(role,name,company,phone,email,salt,hash,at) VALUES('client',?,?,?,?,?,?,?)").bind(name,str(b.company,120),str(b.phone,30),em,s,await hash(pw,s),Date.now()).run();
  return start(db,{id:x.meta.last_row_id,role:"client",name,email:em})}
 if(r=="login"&&m=="POST"){const u=await db.prepare("SELECT * FROM users WHERE email=?").bind(str(b.email,120).toLowerCase()).first();
  if(!u||(u.role=="admin")!=!!b.admin||u.hash!=await hash(typeof b.pw=="string"?b.pw:"",u.salt))return J({error:"Email or password is not correct for this login type."},401);
  return start(db,{id:u.id,role:u.role,name:u.name,email:u.email})}
 const tok=(request.headers.get("cookie")||"").match(/bec_s=([a-f0-9]+)/)?.[1];
 if(r=="logout"&&m=="POST"){if(tok)await db.prepare("DELETE FROM sessions WHERE token=?").bind(tok).run();return J({ok:1},200,{"set-cookie":"bec_s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"})}
 const me=tok&&await db.prepare("SELECT u.id,u.role,u.name,u.email FROM sessions s JOIN users u ON u.id=s.uid WHERE s.token=? AND s.exp>?").bind(tok,Date.now()).first();
 if(!me)return J({error:"Please sign in."},401);
 const adm=me.role=="admin";
 if(r=="me")return J(me);
 if(r=="catalog"&&m=="PUT"){if(!adm)return J({error:"Admins only."},403);if(!Array.isArray(b)||b.length>100)return J({error:"Invalid catalogue."},400);
  const seen=new Set(),q=[db.prepare("DELETE FROM catalog")];
  for(const x of b){let id=str(x.id,40).replace(/[^\w-]/g,"")||"s"+rnd(4);while(seen.has(id))id+="x";seen.add(id);
   q.push(db.prepare("INSERT INTO catalog VALUES(?,?,?,?,?,?)").bind(id,str(x.name,120)||"Service",str(x.d,400),Math.max(0,+x.p||0),Math.max(1,Math.round(+x.days)||1),x.q?1:0))}
  await db.batch(q);return J({ok:1})}
 if(r!="orders")return J({error:"Not found."},404);
 if(!p[1]){
  if(m=="GET")return J((await db.prepare(OS+(adm?"":" WHERE o.uid=?")+" ORDER BY o.n DESC").bind(...(adm?[]:[me.id])).all()).results.map(shape));
  if(m!="POST")return J({error:"Not found."},404);
  let items=[],st,sub=0,days=1,first="";
  if(b.quote){const s=await db.prepare("SELECT * FROM catalog WHERE id=? AND q=1").bind(str(b.quote,40)).first();first=str(b.text,2000);
   if(!s||!first)return J({error:"Describe your project to request a quote."},400);items=[{id:s.id,name:s.name,qty:1,p:0}];st="Quote requested";days=s.days}
  else{for(const x of(Array.isArray(b.items)?b.items.slice(0,30):[])){const s=await db.prepare("SELECT * FROM catalog WHERE id=? AND q=0").bind(str(x.id,40)).first();if(!s)continue;
    const qt=Math.min(99,Math.max(1,Math.round(+x.qty)||1));items.push({id:s.id,name:s.name,qty:qt,p:s.p});sub+=s.p*qt;days=Math.max(days,s.days)}
   if(!items.length)return J({error:"Your cart has no orderable services."},400);st="Awaiting payment"}
  const x=await db.prepare("INSERT INTO orders(uid,items,st,sub,total,days,at) VALUES(?,?,?,?,?,?,?)").bind(me.id,JSON.stringify(items),st,sub,tot(sub),days,Date.now()).run(),nn=x.meta.last_row_id;
  if(first)await db.prepare("INSERT INTO msgs(n,f,t,at) VALUES(?,'c',?,?)").bind(nn,first,Date.now()).run();
  return J(shape(await db.prepare(OS+" WHERE o.n=?").bind(nn).first()))}
 const n=parseInt(String(p[1]).slice(3)),a=p[2],o=n&&await db.prepare(OS+" WHERE o.n=?").bind(n).first();
 if(!o||(!adm&&o.uid!=me.id))return J({error:"Order not found."},404);
 const say=(f,t)=>db.prepare("INSERT INTO msgs(n,f,t,at) VALUES(?,?,?,?)").bind(n,f,t,Date.now()).run();
 if(!a&&m=="GET")return J({...shape(o),msgs:(await db.prepare("SELECT f,t,at FROM msgs WHERE n=? ORDER BY id").bind(n).all()).results});
 if(a=="report"&&m=="GET"){const f=await db.prepare("SELECT rep_name n,rep_data d FROM orders WHERE n=?").bind(n).first();return f&&f.d?J(f):J({error:"No report yet."},404)}
 if(a=="msg"&&m=="POST"){const t=str(b.t,3000);if(!t)return J({error:"Write a message first."},400);await say(adm?"a":"c",t);return J({ok:1})}
 if(!adm||m!="POST")return J({error:"Admins only."},403);
 if(a=="quote"){const amt=+b.amount,d=Math.round(+b.days);if(o.st!="Quote requested"||!(amt>0)||!(d>0))return J({error:"Enter an amount and delivery days for a new quote request."},400);
  const it=JSON.parse(o.items);it[0].p=amt;await db.prepare("UPDATE orders SET sub=?,total=?,days=?,items=?,st='Quote sent' WHERE n=?").bind(amt,tot(amt),d,JSON.stringify(it),n).run();
  await say("a","Your quote is "+inr(tot(amt))+" including GST, with delivery in about "+d+" working days after payment.");return J({ok:1})}
 if(a=="status"){if(!ST.includes(b.st))return J({error:"Unknown status."},400);const paid=b.st=="Paid";
  await db.prepare("UPDATE orders SET st=?,due=?,pay=? WHERE n=?").bind(b.st,paid&&!o.due?wd(Date.now(),o.days):o.due,paid&&!o.pay?"Confirmed by BEC":o.pay,n).run();
  await say("s","Status changed to "+b.st+(paid&&!o.due?". Expected delivery by "+fd(wd(Date.now(),o.days))+".":"."));return J({ok:1})}
 if(a=="due"){const t=Date.parse(str(b.due,10)+"T12:00:00+05:30");if(isNaN(t))return J({error:"Enter a valid date."},400);
  await db.prepare("UPDATE orders SET due=? WHERE n=?").bind(t,n).run();await say("s","Delivery date updated to "+fd(t)+".");return J({ok:1})}
 if(a=="report"){const d=typeof b.d=="string"?b.d:"";if(!d.startsWith("data:")||d.length>1400000)return J({error:"The file is missing or larger than 1 MB."},400);
  await db.prepare("UPDATE orders SET rep_name=?,rep_data=?,st='Delivered' WHERE n=?").bind(str(b.n,150)||"report",d,n).run();await say("a","Your final report is ready to download on this page.");return J({ok:1})}
 return J({error:"Not found."},404)}
