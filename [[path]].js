// Prices live here (server side) so customers cannot change them. price:null = quote after scope review.
const CATALOG=[
{id:'ec-s',name:'EC Calculator signed report: small unit',desc:'Signed PDF calculation sheet with CPCB methodology notes.',price:500},
{id:'ec-l',name:'EC Calculator signed report: large unit',desc:'Signed PDF calculation sheet with CPCB methodology notes.',price:2000},
{id:'pack-1',name:'Half-yearly compliance report',desc:'Ready-to-file template pack.',price:1000},
{id:'pack-5',name:'Full compliance document pack',desc:'Half-yearly report, Form-V, hazardous waste and water cess returns.',price:5000},
{id:'iso-1',name:'ISO 14001 / 45001 legal register',desc:'Legal register in Excel.',price:3000},
{id:'iso-2',name:'ISO 14001 / 45001 full register set',desc:'Legal register, aspect-impact register and monitoring plan.',price:10000},
{id:'consent',name:'Consent applicability check',desc:'Written opinion on whether your unit needs CTE, CTO or EC.',price:null},
{id:'filing',name:'Fixed-price filing package',desc:'CTE / CTO application, renewal or compliance report.',price:null}];
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json',...h}});
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
const enc=s=>new TextEncoder().encode(s);
async function hashPw(pw,salt){const k=await crypto.subtle.importKey('raw',enc(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc(salt),iterations:100000},k,256));}
async function hmac(secret,msg){const k=await crypto.subtle.importKey('raw',enc(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc(msg)));}
const PAID=['paid','in_progress','delivered','closed'];

export async function onRequest({request,env}){
const url=new URL(request.url),p=url.pathname.replace(/^\/api\//,'').split('/'),m=request.method,db=env.DB;
const body=async()=>{try{return await request.json()}catch{return{}}};
const sid=(request.headers.get('cookie')||'').match(/sid=([a-f0-9]+)/)?.[1];
const me=sid?await db.prepare('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid=? AND s.exp>?').bind(sid,Date.now()).first():null;
const login=async u=>{const s=rnd();await db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(s,u.id,Date.now()+6048e5).run();return J({user:{name:u.name,email:u.email,role:u.role}},200,{'set-cookie':`sid=${s};HttpOnly;Secure;SameSite=Strict;Path=/;Max-Age=604800`});};
const owns=async id=>{const o=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();return o&&me&&(me.role==='admin'||o.user_id===me.id)?o:null;};

if(p[0]==='catalog')return J(CATALOG);
if(p[0]==='me')return J({user:me});
if(p[0]==='register'&&m==='POST'){const b=await body();const email=(b.email||'').trim().toLowerCase();
 if(!b.name||!/^\S+@\S+\.\S+$/.test(email)||(b.password||'').length<8)return J({error:'Enter your name, a valid email and a password of 8+ characters.'},400);
 if(await db.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first())return J({error:'This email already has an account. Sign in instead.'},409);
 const salt=rnd(),role=email===(env.ADMIN_EMAIL||'').toLowerCase()?'admin':'customer';
 const r=await db.prepare('INSERT INTO users(name,email,salt,hash,role) VALUES(?,?,?,?,?)').bind(b.name,email,salt,await hashPw(b.password,salt),role).run();
 return login({id:r.meta.last_row_id,name:b.name,email,role});}
if(p[0]==='login'&&m==='POST'){const b=await body();const u=await db.prepare('SELECT * FROM users WHERE email=?').bind((b.email||'').trim().toLowerCase()).first();
 if(!u||u.hash!==await hashPw(b.password||'',u.salt))return J({error:'Email or password is incorrect.'},401);return login(u);}
if(p[0]==='logout'){if(sid)await db.prepare('DELETE FROM sessions WHERE sid=?').bind(sid).run();return J({ok:1},200,{'set-cookie':'sid=;Path=/;Max-Age=0'});}
if(!me)return J({error:'Sign in to continue.'},401);

if(p[0]==='orders'&&!p[1]){
 if(m==='POST'){const b=await body();const items=(b.items||[]).map(i=>{const c=CATALOG.find(x=>x.id===i.id);return c&&{id:c.id,name:c.name,price:c.price,qty:Math.min(Math.max(+i.qty||1,1),20)}}).filter(Boolean);
  if(!items.length)return J({error:'Add at least one service.'},400);
  const quote=items.some(i=>i.price===null),total=quote?null:items.reduce((a,i)=>a+i.price*i.qty,0);
  const r=await db.prepare('INSERT INTO orders(user_id,items,total,status,note,created) VALUES(?,?,?,?,?,?)').bind(me.id,JSON.stringify(items),total,quote?'under_review':'awaiting_payment',(b.note||'').slice(0,1000),Date.now()).run();
  return J({id:r.meta.last_row_id});}
 const q=me.role==='admin'?db.prepare('SELECT o.*,u.name cname,u.email cemail FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 200'):db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').bind(me.id);
 const rows=(await q.all()).results;
 for(const o of rows){o.items=JSON.parse(o.items);o.files=PAID.includes(o.status)||me.role==='admin'?(await db.prepare('SELECT id,name FROM files WHERE order_id=?').bind(o.id).all()).results:[];delete o.rzp_order;}
 return J(rows);}

if(p[0]==='orders'&&p[1]){const o=await owns(+p[1]);if(!o)return J({error:'Order not found.'},404);const act=p[2];
 if(act==='pay'&&m==='POST'){if(!['awaiting_payment','quoted'].includes(o.status)||!o.total)return J({error:'This order is not ready for payment.'},400);
  const r=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{authorization:'Basic '+btoa(env.RZP_KEY+':'+env.RZP_SECRET),'content-type':'application/json'},body:JSON.stringify({amount:o.total*100,currency:'INR',receipt:'BEC-'+(1000+o.id)})});
  const d=await r.json();if(!r.ok)return J({error:'Payment could not start. Try again.'},502);
  await db.prepare('UPDATE orders SET rzp_order=? WHERE id=?').bind(d.id,o.id).run();return J({key:env.RZP_KEY,order_id:d.id,amount:d.amount});}
 if(act==='verify'&&m==='POST'){const b=await body();
  if(!o.rzp_order||await hmac(env.RZP_SECRET,o.rzp_order+'|'+b.razorpay_payment_id)!==b.razorpay_signature)return J({error:'Payment could not be verified.'},400);
  await db.prepare("UPDATE orders SET status='paid',rzp_payment=? WHERE id=?").bind(b.razorpay_payment_id,o.id).run();return J({ok:1});}
 if(act==='files'&&m==='GET'){return J({})}
 if(me.role==='admin'&&m==='PATCH'){const b=await body();
  if(b.quote>0)await db.prepare("UPDATE orders SET total=?,status='quoted' WHERE id=?").bind(+b.quote,o.id).run();
  if(b.status)await db.prepare('UPDATE orders SET status=? WHERE id=?').bind(b.status,o.id).run();
  if(b.admin_note!==undefined)await db.prepare('UPDATE orders SET admin_note=? WHERE id=?').bind(b.admin_note,o.id).run();return J({ok:1});}
 if(me.role==='admin'&&act==='files'&&m==='POST'){const name=(url.searchParams.get('name')||'file').replace(/[^\w.\-]/g,'_'),key=`${o.id}/${rnd()}-${name}`;
  await env.FILES.put(key,request.body);await db.prepare('INSERT INTO files(order_id,name,key) VALUES(?,?,?)').bind(o.id,name,key).run();
  await db.prepare("UPDATE orders SET status='delivered' WHERE id=? AND status IN ('paid','in_progress')").bind(o.id).run();return J({ok:1});}
}
if(p[0]==='files'&&p[1]&&m==='GET'){const f=await db.prepare('SELECT * FROM files WHERE id=?').bind(+p[1]).first();const o=f&&await owns(f.order_id);
 if(!o||(me.role!=='admin'&&!PAID.includes(o.status)))return J({error:'File not available.'},403);
 const obj=await env.FILES.get(f.key);return new Response(obj.body,{headers:{'content-disposition':`attachment; filename="${f.name}"`,'content-type':'application/octet-stream'}});}
return J({error:'Not found.'},404);}
