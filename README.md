# Bharat Environment Encyclopedia kit

## Put it on the website
1. Copy the `encyclopedia/` folder into the root of your website repository, next to `index.html`.
2. Commit and push. The encyclopedia is then at `/encyclopedia/`.
3. Add a link on the homepage menu: `<li><a href="encyclopedia/">Encyclopedia</a></li>`
4. After you have reviewed articles, add `Sitemap: https://bharatenvironmentconsultants.com/encyclopedia/sitemap.xml` to your robots.txt and submit it in Google Search Console.

## Add or change an article
1. Add a text file to `content/`. The file name becomes the page address, for example `water-act-1974.txt` becomes `/encyclopedia/water-act-1974.html`.
2. Run `python3 build.py` (Python 3, nothing to install). It rebuilds `encyclopedia/`.
3. Upload the new `encyclopedia/` folder.

## Article file format
    title: Water Act, 1974
    category: law            (climate, air, water, land, waste, energy, law, health, disasters, agri, cities, reporting)
    region: India            (India or Global)
    status: draft            (draft or reviewed)
    written: 2026-10-13
    reviewed: 2026-11-02     (required when status is reviewed)
    reviewer: Name           (optional)
    summary: One or two sentences. Shown in search results and Google.
    keywords: words people might search for, separated by commas
    infobox: Label | Value   (repeat for each key fact)
    related: other-slug, another-slug
    source: Publisher | Document title | Year | https://publisher-website/
    ---
    ## Heading
    Paragraph text. Link to another article like [[paris-agreement]] or [[paris-agreement|this text]].
    - Bullet points start with a dash.
    **Bold** and *italic* work. External links: [text](https://example.org)

## Review rule (important)
Every article starts as `draft`. Draft pages show a warning banner, are marked noindex so Google will not list them, and are left out of the sitemap.
After a qualified person has checked each fact against the listed primary sources, change `status:` to `reviewed`, add the `reviewed:` date and rebuild.
To keep drafts off the live site entirely, set `SHOW_DRAFTS = False` in `build.py`.
