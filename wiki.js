(function(){
 var FORM="https://formspree.io/f/xzdyqpya";
 document.addEventListener("submit",function(ev){
  var f=ev.target.closest("form.suggest");if(!f)return;
  ev.preventDefault();
  var msg=f.querySelector(".msg"),btn=f.querySelector("button"),d={};
  new FormData(f).forEach(function(v,k){d[k]=v});
  if(d._gotcha)return;
  d._subject=f.getAttribute("data-subject")||"Encyclopedia suggestion";
  btn.disabled=true;msg.textContent="Sending";
  fetch(FORM,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(d)})
   .then(function(r){if(!r.ok)throw 0;msg.textContent="Thank you. Our editors will review this.";f.reset()})
   .catch(function(){msg.textContent="We could not send this. Please email us through the contact page."})
   .then(function(){btn.disabled=false});
 });
 var el=document.getElementById("idx");if(!el)return;
 var D=JSON.parse(el.textContent),R=document.getElementById("results"),C=document.getElementById("count"),Q=document.getElementById("q"),RG=document.getElementById("rg"),CT=document.getElementById("ct"),LT=document.getElementById("letters");
 var S={q:"",rg:"",ct:"",l:""};
 function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
 var letters=[];D.forEach(function(a){var l=a.t.charAt(0).toUpperCase();if(letters.indexOf(l)<0)letters.push(l)});letters.sort();
 function drawLetters(){LT.innerHTML=letters.map(function(l){return'<button type="button" data-l="'+l+'" aria-pressed="'+(S.l===l)+'">'+l+'</button>'}).join("")}
 function match(a){
  if(S.rg&&a.r!==S.rg)return false;
  if(S.ct&&a.c!==S.ct)return false;
  if(S.l&&a.t.charAt(0).toUpperCase()!==S.l)return false;
  var w=S.q.toLowerCase().split(/\s+/).filter(Boolean);
  for(var i=0;i<w.length;i++){if(a.k.indexOf(w[i])<0)return false}
  return true;
 }
 function score(a){
  var q=S.q.toLowerCase();if(!q)return 0;
  if(a.t.toLowerCase().indexOf(q)>=0||a.ac===q)return 0;
  var words=a.k.split(/[^a-z0-9]+/),w=q.split(/\s+/).filter(Boolean);
  return w.every(function(x){return words.some(function(y){return y.indexOf(x)===0})})?1:2;
 }
 function draw(){
  var r=D.filter(match);
  r.sort(function(a,b){return score(a)-score(b)||a.t.localeCompare(b.t)});
  C.textContent=r.length+(r.length===1?" article":" articles")+(S.q?' for "'+S.q+'"':"");
  R.innerHTML=r.length?r.map(function(a){return'<article class="res"><h3><a href="'+a.s+'.html">'+esc(a.t)+'</a>'+(a.dr?'<span class="tag">Draft</span>':"")+'</h3><p class="meta">'+esc(a.cn)+' &middot; '+esc(a.r)+'</p><p>'+esc(a.d)+'</p></article>'}).join(""):'<p>No articles match yet. Try fewer words, or <a href="#request">request an article</a>.</p>';
  drawLetters();
 }
 Q.addEventListener("input",function(){S.q=Q.value.trim();draw()});
 RG.addEventListener("change",function(){S.rg=RG.value;draw()});
 CT.addEventListener("change",function(){S.ct=CT.value;draw()});
 LT.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;S.l=S.l===b.dataset.l?"":b.dataset.l;draw()});
 document.getElementById("sf").addEventListener("submit",function(e){e.preventDefault();S.q=Q.value.trim();draw();R.scrollIntoView()});
 var p=new URLSearchParams(location.search);if(p.get("q")){Q.value=p.get("q");S.q=Q.value.trim()}
 if(p.get("cat")){CT.value=p.get("cat");S.ct=CT.value}
 draw();
})();
