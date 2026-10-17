#!/usr/bin/env python3
"""Build world-water-wildlife-atlas.html from atlas-data.json.
Usage: python3 build_atlas.py [atlas-data.json] [output.html]
Images: set "img" (e.g. images/atlas/nile.webp), "credit", "license", "source_url" per entry."""
import json,re,sys,html as H,os
SRC=sys.argv[1] if len(sys.argv)>1 else 'atlas-data.json'
OUT=sys.argv[2] if len(sys.argv)>2 else 'world-water-wildlife-atlas.html'
BASE='https://bharatenvironmentconsultants.com/'
DATA=json.load(open(SRC,encoding='utf-8'))
D={k:(v['title'],v['items']) for k,v in DATA.items()}
def fig(e,name,place):
    if not e.get('img'): return ''
    if not (e.get('credit') and e.get('license')): print('WARNING: image without credit/license:',name)
    if not os.path.exists(e['img']): print('WARNING: file not found:',e['img'])
    alt=H.escape(e.get('alt') or f'{name}, {place}',quote=True)
    cap=H.escape(e.get('credit',''))
    if e.get('source_url'): cap=f'<a href="{H.escape(e["source_url"],quote=True)}" rel="noopener">{cap}</a>'
    cap=f'Photo: {cap}, {H.escape(e.get("license",""))}'
    return f'<figure><img loading="lazy" decoding="async" src="{H.escape(e["img"],quote=True)}" alt="{alt}" width="{e.get("w",1200)}" height="{e.get("h",800)}"><figcaption>{cap}</figcaption></figure>'
slug=lambda s:re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
U="https://bharatenvironmentconsultants.com/world-water-wildlife-atlas.html"
secs="";tabs='<button class="tab on" data-c="all">All</button>';items=[];n=0
for k,(t,L) in D.items():
    tabs+=f'<button class="tab" data-c="{k}">{t if len(t)<20 else t.split(" and ")[0]}</button>'
    secs+=f'<section id="{k}" class="cat" data-c="{k}"><h2>{t}</h2><div class="az"></div>'
    for e in sorted(L,key=lambda x:x["name"]):
        name,place,txt=e["name"],e["place"],e["text"]
        n+=1;s=slug(name)
        li={"@type":"ListItem","position":n,"name":name,"url":f"{U}#{s}"}
        if e.get("img"): li["image"]=BASE+e["img"]
        items.append(li)
        secs+=f'<details class="it" id="{s}" data-l="{name[0].upper()}"><summary><span class="nm">{name}</span><span class="pl">{place}</span></summary>{fig(e,name,place)}<p>{txt}</p></details>'
    secs+='</section>'
ld=json.dumps({"@context":"https://schema.org","@type":"CollectionPage","name":"World Water and Wildlife Atlas","url":U,"isPartOf":{"@type":"WebSite","name":"Bharat Environment Consultants","url":"https://bharatenvironmentconsultants.com/"},"mainEntity":{"@type":"ItemList","numberOfItems":n,"itemListElement":items}},ensure_ascii=False)
first=next((e for k in DATA for e in DATA[k]['items'] if e.get('img')),None)
OG=f'<meta property="og:image" content="{BASE+first["img"]}"><meta name="twitter:card" content="summary_large_image">' if first else ''
html=f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>World Atlas of Oceans, Rivers, Lakes, Wildlife Sanctuaries and Canals | Bharat Environment Consultants</title>
<meta name="description" content="Browse oceans, major rivers, lakes, wildlife sanctuaries and canals of the world with key facts. Click any entry to open its details.">
<meta name="robots" content="index, follow"><link rel="canonical" href="{U}">
<meta property="og:type" content="website"><meta property="og:title" content="World Atlas of Oceans, Rivers, Lakes, Wildlife Sanctuaries and Canals"><meta property="og:description" content="Click-through reference to the world’s oceans, rivers, lakes, protected areas and canals."><meta property="og:url" content="{U}">{OG}
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">{ld}</script>
<style>
:root{{--gd:#0d3b1e;--gm:#1a5c32;--gb:#2e7d52;--gp:#d4edda;--gold:#c9a84c;--gl:#e8c97a;--cream:#f8f5ef;--gray:#5a5a5a;--line:#e8e8e8}}
*{{box-sizing:border-box;margin:0;padding:0}}html{{scroll-behavior:smooth}}
body{{font-family:'DM Sans',sans-serif;background:var(--cream);color:#1c1c1c;line-height:1.6}}
.top{{background:var(--gd);border-bottom:1px solid rgba(201,168,76,.3);padding:1rem 5vw;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}}
.top a{{color:var(--gl);text-decoration:none;font-size:.85rem}}.top .b{{font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:600;color:#fff}}
.hero{{background:var(--gd);color:#fff;padding:3.5rem 5vw 2.5rem}}
.hero h1{{font-family:'Cormorant Garamond',serif;font-size:clamp(2.2rem,5vw,3.8rem);font-weight:600;line-height:1.05;max-width:20ch}}
.hero p{{color:rgba(255,255,255,.7);max-width:62ch;margin-top:1rem;font-weight:300}}
.wrap{{max-width:980px;margin:0 auto;padding:0 5vw}}
.bar{{position:sticky;top:0;z-index:5;background:var(--cream);padding:1rem 0;border-bottom:1px solid var(--line)}}
.tabs{{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem}}
.tab{{font:500 .85rem 'DM Sans',sans-serif;padding:.45rem 1rem;border:1px solid var(--gb);background:#fff;color:var(--gm);border-radius:20px;cursor:pointer}}
.tab.on{{background:var(--gd);color:var(--gl);border-color:var(--gd)}}
#q{{width:100%;padding:.75rem 1rem;border:1px solid #cfcfcf;border-radius:6px;font:400 .95rem 'DM Sans',sans-serif}}
:focus-visible{{outline:2px solid var(--gold);outline-offset:2px}}
.cat{{padding:2.2rem 0 .5rem}}.cat h2{{font-family:'Cormorant Garamond',serif;font-size:2rem;color:var(--gd);margin-bottom:.6rem}}
.az{{display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.8rem}}.az button{{min-width:2rem;padding:.2rem .5rem;border:1px solid var(--line);background:#fff;border-radius:4px;color:var(--gm);cursor:pointer;font:500 .8rem 'DM Sans',sans-serif}}.az button.on{{background:var(--gold);border-color:var(--gold);color:var(--gd)}}
.it{{background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:.5rem}}.it[hidden]{{display:none}}
.it summary{{padding:.9rem 1.1rem;cursor:pointer;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;list-style:none}}
.it summary::-webkit-details-marker{{display:none}}.nm{{font-weight:600;color:var(--gd)}}.pl{{color:var(--gray);font-size:.85rem}}
.it[open]{{border-color:var(--gb)}}.it p{{padding:0 1.1rem 1rem;color:var(--gray);font-weight:300}}
.it figure{{margin:0 1.1rem .8rem}}.it img{{width:100%;height:auto;max-height:440px;object-fit:cover;border-radius:6px;display:block;background:var(--gp)}}.it figcaption{{font-size:.75rem;color:var(--gray);margin-top:.35rem}}.it figcaption a{{color:var(--gm)}}
.note,.empty{{margin:2rem 0;font-size:.85rem;color:var(--gray)}}.empty{{display:none}}
footer{{background:#060f09;color:rgba(255,255,255,.5);text-align:center;padding:2rem;font-size:.8rem;margin-top:3rem}}
</style></head><body>
<div class="top"><a class="b" href="/">Bharat Environment Consultants</a><a href="/#contact">Contact</a></div>
<header class="hero"><h1>World atlas of waters, wildlife and canals</h1><p>Oceans, rivers, lakes, wildlife sanctuaries and canals in one place. Pick a category, filter by letter or search, then click any entry to open its facts.</p></header>
<div class="wrap">
<div class="bar"><div class="tabs">{tabs}</div><input id="q" type="search" placeholder="Search by name or country" aria-label="Search the atlas"></div>
{secs}
<p class="empty" id="empty">No entries match. Clear the search or choose another letter.</p>
<p class="note">Figures are rounded and approximate; lengths and areas vary by source. Check primary sources before citing in reports.</p>
</div>
<footer>Bharat Environment Consultants, Gurugram, India</footer>
<script>
(function(){{
var cats=[].slice.call(document.querySelectorAll('.cat')),tabs=[].slice.call(document.querySelectorAll('.tab')),q=document.getElementById('q'),cur='all',lt={{}};
cats.forEach(function(c){{var s={{}};[].forEach.call(c.querySelectorAll('.it'),function(i){{s[i.dataset.l]=1}});
var az=c.querySelector('.az');Object.keys(s).sort().forEach(function(L){{var b=document.createElement('button');b.textContent=L;b.onclick=function(){{lt[c.id]=lt[c.id]===L?'':L;run()}};az.appendChild(b)}})}});
function run(){{var t=q.value.toLowerCase().trim(),any=0;
cats.forEach(function(c){{var show=cur==='all'||cur===c.dataset.c,n=0;
[].forEach.call(c.querySelectorAll('.it'),function(i){{var ok=(!t||i.textContent.toLowerCase().indexOf(t)>-1)&&(!lt[c.id]||i.dataset.l===lt[c.id]);i.hidden=!ok;if(ok)n++}});
[].forEach.call(c.querySelectorAll('.az button'),function(b){{b.classList.toggle('on',lt[c.id]===b.textContent)}});
c.style.display=show&&(n||!t)?'':'none';if(show)any+=n}});
document.getElementById('empty').style.display=any?'none':'block'}}
tabs.forEach(function(b){{b.onclick=function(){{cur=b.dataset.c;tabs.forEach(function(x){{x.classList.toggle('on',x===b)}});run()}}}});
q.oninput=run;
function deep(){{var h=location.hash.slice(1),e=h&&document.getElementById(h);if(e&&e.tagName==='DETAILS'){{e.open=true;e.scrollIntoView()}}}}
document.querySelectorAll('.it').forEach(function(d){{d.addEventListener('toggle',function(){{if(d.open)history.replaceState(null,'','#'+d.id)}})}});
addEventListener('hashchange',deep);deep();
}})();
</script></body></html>'''
open(OUT,'w',encoding='utf-8').write(html)
imgs=sum(1 for k in DATA for e in DATA[k]['items'] if e.get('img'))
print(f'{n} entries, {imgs} with images ->',OUT)
