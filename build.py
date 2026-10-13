#!/usr/bin/env python3
"""
Bharat Environment Encyclopedia: static site builder (Python 3, standard library only).

    python3 build.py

Reads every article in content/*.txt and writes the finished site to encyclopedia/.
Upload the encyclopedia/ folder to the root of your website repository.
See README.md for the article file format.
"""
import datetime
import html
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "content")
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "encyclopedia")
SITE = "https://bharatenvironmentconsultants.com"
BASE = SITE + "/encyclopedia/"
FORM = "https://formspree.io/f/xzdyqpya"
BRAND = "Bharat Environment Encyclopedia"
SHOW_DRAFTS = True   # False: leave draft articles out of the built site entirely

# id, name, description
CATS = [
    ("climate", "Climate and Atmosphere", "Warming, greenhouse gases, the ozone layer and climate policy."),
    ("air", "Air Pollution and Quality", "Pollutants, standards and air quality management."),
    ("water", "Water and Oceans", "Rivers, groundwater, wastewater and the marine environment."),
    ("land", "Land, Forests and Biodiversity", "Ecosystems, species, forests and land use."),
    ("waste", "Waste, Plastics and Chemicals", "Solid and hazardous waste, plastics and toxic substances."),
    ("energy", "Energy and Industry", "Power, fuels, mining, manufacturing and the energy transition."),
    ("law", "Law, Policy and Governance", "Environmental laws, treaties, institutions and legal principles."),
    ("health", "Environment and Health", "How environmental conditions affect human health."),
    ("disasters", "Disasters and Resilience", "Floods, cyclones, droughts and industrial accidents."),
    ("agri", "Agriculture and Food", "Farming, food systems and their environmental footprint."),
    ("cities", "Cities and Transport", "The urban environment, mobility and the built environment."),
    ("reporting", "Sustainability and Reporting", "ESG, carbon accounting, standards and audits."),
]

# Topics we plan to cover. They are shown as a coverage map, not as pages.
PLANNED = {
    "climate": ["Global warming and the carbon cycle", "Sea level rise", "Heatwaves and extreme heat", "Glacier retreat", "Carbon capture and storage", "Climate adaptation", "Loss and damage", "Net zero targets", "Carbon markets", "El Nino and La Nina", "Monsoon variability"],
    "air": ["Indoor air pollution", "Stubble burning", "Vehicular emissions and Bharat Stage norms", "Industrial stack emissions", "Acid rain", "Smog and haze", "Ground-level ozone", "Black carbon", "Construction dust", "National Clean Air Programme"],
    "water": ["Groundwater depletion", "River pollution", "Ganga rejuvenation", "Wastewater treatment and zero liquid discharge", "Water scarcity", "Eutrophication", "Marine pollution", "Coral reef decline", "Coastal erosion", "Wetlands and Ramsar sites", "Desalination", "Transboundary rivers"],
    "land": ["Deforestation", "Desertification and land degradation", "Soil erosion and contamination", "Wildlife trade", "Invasive species", "Mangroves", "Protected areas", "Human-wildlife conflict", "Forest fires", "Mining and land use", "Rewilding"],
    "waste": ["Municipal solid waste", "E-waste", "Battery waste", "Biomedical waste", "Construction and demolition waste", "Microplastics", "Persistent organic pollutants", "Mercury and heavy metals", "Legacy dumpsites", "Waste-to-energy", "Marine litter", "Fly ash utilisation"],
    "energy": ["Renewable energy transition", "Coal and thermal power", "Solar and wind power", "Green hydrogen", "Energy efficiency", "Nuclear power", "Electric vehicles", "Hydropower", "Biofuels", "Mineral extraction", "Cement and steel decarbonisation"],
    "law": ["Environment (Protection) Act, 1986", "Water Act, 1974", "Air Act, 1981", "National Green Tribunal", "Public trust doctrine", "Precautionary principle", "Coastal Regulation Zone", "Wildlife Protection Act, 1972", "Biological Diversity Act, 2002", "Rio and Stockholm Declarations", "Basel Convention", "Ramsar Convention", "CITES", "UN Convention to Combat Desertification"],
    "health": ["Air pollution and health", "Water-borne disease", "Lead and heavy metal exposure", "Pesticide exposure", "Noise pollution", "Heat stress", "Climate and mental health", "Occupational exposure"],
    "disasters": ["Floods", "Cyclones", "Droughts", "Landslides", "The Bhopal gas disaster", "Oil spills", "Glacial lake outburst floods", "Disaster risk reduction"],
    "agri": ["Sustainable agriculture", "Fertiliser and nitrogen pollution", "Pesticides", "Food waste", "Livestock emissions", "Agroforestry", "Water use in agriculture", "Organic farming", "Crop residue management"],
    "cities": ["Urban heat islands", "Public transport", "Urban solid waste", "Green buildings", "Urban flooding", "Noise in cities", "Sponge cities", "Air quality in cities"],
    "reporting": ["ESG reporting", "TCFD and ISSB", "GRI Standards", "CDP", "Science-based targets", "ISO 14001", "ISO 14064", "EU CSRD", "EU CBAM", "Life cycle assessment", "Environmental audits"],
}

CATD = {c[0]: c for c in CATS}
esc = lambda s: html.escape(str(s), quote=True)


def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-") or "section"


def fail(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def parse(path):
    slug = os.path.splitext(os.path.basename(path))[0]
    raw = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    if "\n---\n" not in raw:
        fail(slug + ": missing a line containing only --- between the header and the body")
    head, body = raw.split("\n---\n", 1)
    m = {"slug": slug, "infobox": [], "source": [], "related": [], "status": "draft"}
    for line in head.split("\n"):
        if not line.strip():
            continue
        if ":" not in line:
            fail(slug + ": bad header line: " + line)
        k, v = line.split(":", 1)
        k, v = k.strip().lower(), v.strip()
        if k == "infobox":
            p = [x.strip() for x in v.split("|", 1)]
            if len(p) != 2:
                fail(slug + ": infobox needs 'Label | value'")
            m["infobox"].append(p)
        elif k == "source":
            p = [x.strip() for x in v.split("|")]
            org, title = p[0], p[1] if len(p) > 1 else ""
            year, url = "", ""
            for x in p[2:]:
                if x.startswith("http"):
                    url = x
                else:
                    year = x
            m["source"].append({"org": org, "title": title, "year": year, "url": url})
        elif k == "related":
            m["related"] = [x.strip() for x in v.split(",") if x.strip()]
        else:
            m[k] = v
    for need in ("title", "category", "region", "summary", "written"):
        if not m.get(need):
            fail(slug + ": missing '" + need + ":' in the header")
    if m["category"] not in CATD:
        fail(slug + ": unknown category '" + m["category"] + "'")
    if m["status"] not in ("draft", "reviewed"):
        fail(slug + ": status must be draft or reviewed")
    if m["status"] == "reviewed" and not m.get("reviewed"):
        fail(slug + ": a reviewed article needs a 'reviewed:' date (YYYY-MM-DD)")
    m["body"] = body.strip()
    return m


ARTS = {}


def inline(t, slug):
    t = esc(t)

    def wl(m):
        target, label = m.group(1), m.group(2)
        if target not in ARTS:
            fail(slug + ": link to unknown article [[" + target + "]]")
        return '<a href="%s.html">%s</a>' % (target, label or esc(ARTS[target]["title"]))

    t = re.sub(r"\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]", wl, t)

    def el(m):
        url = m.group(2)
        ext = ' target="_blank" rel="noopener noreferrer"' if url.startswith("http") else ""
        return '<a href="%s"%s>%s</a>' % (url, ext, m.group(1))

    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", el, t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", t)
    return t


def render(body, slug):
    out, toc, ids = [], [], set()
    para, lst = [], []

    def flush():
        nonlocal para, lst
        if para:
            out.append("<p>" + inline(" ".join(para), slug) + "</p>")
            para = []
        if lst:
            out.append("<ul>" + "".join("<li>" + inline(x, slug) + "</li>" for x in lst) + "</ul>")
            lst = []

    for line in body.split("\n"):
        if line.startswith("## "):
            flush()
            text = line[3:].strip()
            i, n = slugify(text), 2
            base = i
            while i in ids:
                i = base + "-" + str(n)
                n += 1
            ids.add(i)
            toc.append((i, text))
            out.append('<h2 id="%s">%s</h2>' % (i, inline(text, slug)))
        elif line.startswith("### "):
            flush()
            out.append("<h3>" + inline(line[4:].strip(), slug) + "</h3>")
        elif line.startswith("- "):
            if para:
                flush()
            lst.append(line[2:].strip())
        elif not line.strip():
            flush()
        else:
            if lst:
                flush()
            para.append(line.strip())
    flush()
    return "\n".join(out), toc


def fmt_date(s):
    try:
        return datetime.date.fromisoformat(s).strftime("%d %B %Y").lstrip("0")
    except Exception:
        return s


HEAD_LINKS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">'
    '<link rel="stylesheet" href="wiki.css">'
)


def header(hub=False):
    sub = "" if hub else (
        '<div class="subbar"><form action="index.html" method="get" role="search">'
        '<input name="q" placeholder="Search the encyclopedia" aria-label="Search the encyclopedia">'
        '<button>Search</button></form></div>')
    return (
        '<header class="top"><a class="brand" href="/">Bharat Environment Consultants<small>Environmental experts since 2005</small></a>'
        '<nav aria-label="Site"><a href="index.html">Encyclopedia</a><a href="/news.html">News</a>'
        '<a href="/#services">Services</a><a href="/quotation.html">Instant Quote</a>'
        '<a class="cta" href="/portal.html">Client Login</a></nav></header>' + sub)


FOOTER = (
    '<footer><div>' + BRAND + ' is an editorial reference published by Bharat Environment Consultants for general information. '
    'It is not legal or professional advice. Check the primary sources listed on each article, and the current text of any law or standard, before relying on it.</div>'
    '<div style="margin-top:8px"><a href="/">Home</a> &nbsp;|&nbsp; <a href="/news.html">News</a> &nbsp;|&nbsp; '
    '<a href="/privacy-policy.html">Privacy Policy</a> &nbsp;|&nbsp; <a href="/terms.html">Terms</a> &nbsp;|&nbsp; <a href="/#contact">Contact</a></div></footer>')


def page(title, desc, canonical, body, robots="index, follow", hub=False, extra=""):
    return (
        '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>%s</title><meta name="description" content="%s"><meta name="robots" content="%s">'
        '<link rel="canonical" href="%s"><meta property="og:title" content="%s"><meta property="og:description" content="%s">'
        '<meta property="og:type" content="website"><meta property="og:url" content="%s"><meta property="og:site_name" content="%s">%s%s</head>\n'
        '<body><a class="skip" href="#main">Skip to content</a>%s\n%s\n%s\n<script src="wiki.js" defer></script></body></html>\n'
        % (esc(title), esc(desc), robots, canonical, esc(title), esc(desc), canonical, esc(BRAND), HEAD_LINKS, extra,
           header(hub), body, FOOTER))


def suggest_form(subject, page_id, label):
    return (
        '<details class="suggest-wrap"><summary>%s</summary>'
        '<form class="suggest" data-subject="%s"><input type="hidden" name="page" value="%s">'
        '<label>Your email (optional)<input type="email" name="email" autocomplete="email"></label>'
        '<label>Your message. Please include a source if you are suggesting a change.<textarea name="message" rows="4" required></textarea></label>'
        '<input class="hp" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">'
        '<button class="btn">Send</button><p class="msg" role="status"></p></form></details>'
        % (esc(label), esc(subject), esc(page_id)))


def article_page(a):
    cat = CATD[a["category"]]
    html_body, toc = render(a["body"], a["slug"])
    draft = a["status"] == "draft"
    url = BASE + a["slug"] + ".html"
    rows = [("Category", '<a href="category-%s.html">%s</a>' % (cat[0], esc(cat[1]))), ("Region", esc(a["region"]))]
    rows += [(esc(k), esc(v)) for k, v in a["infobox"]]
    infobox = '<aside class="infobox" aria-label="Key facts"><h2>Key facts</h2><table>%s</table></aside>' % "".join(
        "<tr><th scope=\"row\">%s</th><td>%s</td></tr>" % (k, v) for k, v in rows)
    toc_html = ""
    if len(toc) >= 3:
        toc_html = '<nav class="toc" aria-label="Contents"><b>Contents</b><ol>%s</ol></nav>' % "".join(
            '<li><a href="#%s">%s</a></li>' % (i, esc(t)) for i, t in toc)
    see = ""
    if a["related"]:
        for r in a["related"]:
            if r not in ARTS:
                fail(a["slug"] + ": related article '" + r + "' does not exist")
        see = '<section class="see"><h2>See also</h2><ul>%s</ul></section>' % "".join(
            '<li><a href="%s.html">%s</a></li>' % (r, esc(ARTS[r]["title"])) for r in a["related"])
    srcs = ""
    if a["source"]:
        items = []
        for s in a["source"]:
            link = ""
            if s["url"]:
                host = re.sub(r"^https?://(www\.)?", "", s["url"]).split("/")[0]
                link = ' <a href="%s" target="_blank" rel="noopener noreferrer">%s</a>' % (esc(s["url"]), esc(host))
            items.append("<li>%s. <em>%s</em>%s.%s</li>" % (
                esc(s["org"]), esc(s["title"]), (", " + esc(s["year"])) if s["year"] else "", link))
        srcs = ('<section class="srcs"><h2>Sources and further reading</h2><ol>%s</ol>'
                '<p class="note" style="font-size:.85rem;color:var(--mute)">Links go to the publisher\'s website. Search there for the named document.</p></section>' % "".join(items))
    written = fmt_date(a["written"])
    if draft:
        stamp = "Draft written %s. Not yet reviewed." % written
    else:
        by = (" by " + esc(a["reviewer"])) if a.get("reviewer") else ""
        stamp = "Last reviewed %s%s." % (fmt_date(a["reviewed"]), by)
    banner = ('<div class="draft" role="note"><b>Draft.</b> This article has not completed editorial review. '
              'Check the sources before relying on it.</div>') if draft else ""
    cite = esc('%s. "%s". %s. %s. %s' % ("Bharat Environment Consultants", a["title"], BRAND,
                                        fmt_date(a.get("reviewed") or a["written"]), url))
    meta = ('<div class="metabox"><p>%s</p>%s'
            '<details><summary>Cite this page</summary><p class="cite">%s</p></details></div>' % (
                stamp, suggest_form("Correction or addition: " + a["title"] + " (" + a["slug"] + ")", a["slug"],
                                    "Suggest a correction or addition"), cite))
    ld = {
        "@context": "https://schema.org", "@type": "Article", "headline": a["title"], "description": a["summary"],
        "datePublished": a["written"], "dateModified": a.get("reviewed") or a["written"],
        "mainEntityOfPage": url, "inLanguage": "en",
        "author": {"@type": "Organization", "name": "Bharat Environment Consultants"},
        "publisher": {"@type": "Organization", "name": "Bharat Environment Consultants", "url": SITE},
    }
    bc = {
        "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": BRAND, "item": BASE},
            {"@type": "ListItem", "position": 2, "name": cat[1], "item": BASE + "category-" + cat[0] + ".html"},
            {"@type": "ListItem", "position": 3, "name": a["title"], "item": url}]}
    extra = '<script type="application/ld+json">%s</script><script type="application/ld+json">%s</script>' % (
        json.dumps(ld, ensure_ascii=False).replace("</", "<\\/"), json.dumps(bc, ensure_ascii=False).replace("</", "<\\/"))
    body = (
        '<main id="main"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Encyclopedia</a> &rsaquo; '
        '<a href="category-%s.html">%s</a> &rsaquo; %s</nav>%s<article><h1>%s</h1><p class="lead">%s</p>%s%s'
        '<div class="body">%s</div>%s%s</article>%s</main>' % (
            cat[0], esc(cat[1]), esc(a["title"]), banner, esc(a["title"]), esc(a["summary"]), toc_html, infobox,
            html_body, see, srcs, meta))
    return page(a["title"] + " | " + BRAND, a["summary"], url, body, "noindex, follow" if draft else "index, follow", extra=extra)


def result_item(a):
    return ('<article class="res"><h3><a href="%s.html">%s</a>%s</h3><p class="meta">%s &middot; %s</p><p>%s</p></article>' % (
        a["slug"], esc(a["title"]), '<span class="tag">Draft</span>' if a["status"] == "draft" else "",
        esc(CATD[a["category"]][1]), esc(a["region"]), esc(a["summary"])))


def planned_html(cid):
    items = PLANNED.get(cid, [])
    if not items:
        return ""
    return ('<section class="planned panel"><h2>Planned articles</h2><p>These topics are on our list. They are not published yet.</p><ul>%s</ul>'
            '%s</section>' % ("".join("<li>%s</li>" % esc(x) for x in items),
                               suggest_form("Article request: " + CATD[cid][1], "request-" + cid, "Request an article in this category")))


def hub_page(arts):
    idx = []
    for a in arts:
        k = " ".join([a["title"], a["summary"], a.get("keywords", ""), CATD[a["category"]][1], a["region"]] +
                     [v for _, v in a["infobox"]]).lower()
        core = re.sub(r"\([^)]*\)", "", a["title"])
        ac = "".join(w[0] for w in re.findall(r"[A-Za-z0-9]+", core) if w.lower() not in ("of", "the", "and", "to", "in", "a", "for")).lower()
        idx.append({"ac": ac, "t": a["title"], "s": a["slug"], "c": a["category"], "cn": CATD[a["category"]][1], "r": a["region"],
                    "d": a["summary"], "k": k, "dr": a["status"] == "draft"})
    idx.sort(key=lambda x: x["t"].lower())
    cards = []
    for cid, name, desc in CATS:
        n = sum(1 for a in arts if a["category"] == cid)
        p = len(PLANNED.get(cid, []))
        cards.append('<a class="cat" href="category-%s.html"><h3>%s</h3><p>%s</p><small>%d published, %d planned</small></a>' % (
            cid, esc(name), esc(desc), n, p))
    regions = sorted({a["region"] for a in arts})
    body = (
        '<section class="hero"><div><h1>The environment, explained</h1>'
        '<p>Plain-language, sourced explanations of environmental issues, laws and science, with a focus on India and the wider world. '
        'Published by the team behind Bharat Environment News.</p>'
        '<form id="sf" action="index.html" method="get" role="search"><input id="q" name="q" placeholder="Search, for example air quality, EPR or ozone" aria-label="Search the encyclopedia" autocomplete="off">'
        '<button class="btn">Search</button></form></div></section>'
        '<main id="main"><h2 class="sec">Browse by subject</h2><div class="cats">%s</div>'
        '<h2 class="sec" id="all">All articles</h2>'
        '<div class="filters"><label>Subject<select id="ct"><option value="">All subjects</option>%s</select></label>'
        '<label>Region<select id="rg"><option value="">All regions</option>%s</select></label></div>'
        '<div class="letters" id="letters" aria-label="Filter by first letter"></div>'
        '<p class="count" id="count" aria-live="polite"></p><div id="results"></div>'
        '<section class="panel" id="request"><h2>Missing something?</h2><p>This encyclopedia grows through reader requests and corrections reviewed by our editors.</p>%s</section>'
        '<script id="idx" type="application/json">%s</script></main>' % (
            "".join(cards), "".join('<option value="%s">%s</option>' % (c[0], esc(c[1])) for c in CATS),
            "".join('<option>%s</option>' % esc(r) for r in regions),
            suggest_form("Article request (general)", "request", "Request an article or suggest a topic"),
            json.dumps(idx, ensure_ascii=False).replace("</", "<\\/")))
    return page(BRAND + " | Environmental issues, laws and science explained",
                "A sourced, plain-language encyclopedia of environmental issues, laws and science, with a focus on India and the world. By Bharat Environment Consultants.",
                BASE, body, hub=True)


def category_page(cid, arts):
    _, name, desc = CATD[cid]
    mine = sorted([a for a in arts if a["category"] == cid], key=lambda a: a["title"].lower())
    body = ('<main id="main"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Encyclopedia</a> &rsaquo; %s</nav>'
            '<h1>%s</h1><p class="lead" style="border:0;padding:0">%s</p><h2 class="sec">Articles</h2>%s%s</main>' % (
                esc(name), esc(name), esc(desc),
                "".join(result_item(a) for a in mine) or "<p>No articles are published in this subject yet.</p>",
                planned_html(cid)))
    robots = "index, follow" if any(a["status"] == "reviewed" for a in mine) else "noindex, follow"
    return page(name + " | " + BRAND, desc, BASE + "category-" + cid + ".html", body, robots)


def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".txt"))
    if not files:
        fail("no article files found in content/")
    for f in files:
        a = parse(os.path.join(SRC, f))
        ARTS[a["slug"]] = a
    arts = [a for a in ARTS.values() if SHOW_DRAFTS or a["status"] == "reviewed"]
    if not SHOW_DRAFTS:
        for k in [k for k, v in ARTS.items() if v["status"] != "reviewed"]:
            del ARTS[k]
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for n in ("wiki.css", "wiki.js"):
        shutil.copy(os.path.join(ASSETS, n), os.path.join(OUT, n))
    w = lambda name, txt: open(os.path.join(OUT, name), "w", encoding="utf-8").write(txt)
    w("index.html", hub_page(arts))
    for cid, _, _ in CATS:
        w("category-%s.html" % cid, category_page(cid, arts))
    for a in arts:
        w(a["slug"] + ".html", article_page(a))
    urls = [(BASE, datetime.date.today().isoformat())]
    for cid, _, _ in CATS:
        if any(a["category"] == cid and a["status"] == "reviewed" for a in arts):
            urls.append((BASE + "category-" + cid + ".html", datetime.date.today().isoformat()))
    for a in arts:
        if a["status"] == "reviewed":
            urls.append((BASE + a["slug"] + ".html", a["reviewed"]))
    w("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % "".join(
        "  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (u, d) for u, d in urls))
    drafts = sum(1 for a in arts if a["status"] == "draft")
    print("Built %d articles (%d draft, %d reviewed), %d subject pages." % (len(arts), drafts, len(arts) - drafts, len(CATS)))
    print("Output: " + OUT)


if __name__ == "__main__":
    main()
