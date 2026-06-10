<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="UTF-8" indent="yes"
    doctype-system="about:legacy-compat"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/></title>
        <style>
          :root { --paper:#f4ece2; --ink:#2b2622; --dim:#6f655c; --hair:#d8ccbd; --accent:#7c2d3a; }
          * { box-sizing:border-box; }
          body { margin:0; padding:2.4rem 1.4rem 5rem; background:var(--paper); color:var(--ink);
                 font-family:Georgia,'Times New Roman',serif; line-height:1.55; }
          .wrap { max-width:760px; margin:0 auto; }
          h1 { font-size:2rem; margin:0 0 .4rem; letter-spacing:-.01em; }
          .desc { color:var(--dim); margin:0 0 1.2rem; font-size:1rem; }
          .note { font-family:'Helvetica Neue',Arial,sans-serif; font-size:.74rem; letter-spacing:.04em;
                  color:var(--dim); background:rgba(124,45,58,.06); border:1px solid var(--hair);
                  border-radius:8px; padding:.7rem .9rem; margin:0 0 1.8rem; }
          .note a { color:var(--accent); }
          .item { border-top:1px solid var(--hair); padding:1rem 0; }
          .item a.title { font-size:1.12rem; color:var(--ink); text-decoration:none; font-weight:600; }
          .item a.title:hover { color:var(--accent); }
          .item .meta { font-family:'Helvetica Neue',Arial,sans-serif; font-size:.7rem; text-transform:uppercase;
                        letter-spacing:.1em; color:var(--dim); margin:.25rem 0 .35rem; }
          .item .body { color:var(--dim); font-size:.95rem; }
          footer { margin-top:2.5rem; font-family:'Helvetica Neue',Arial,sans-serif; font-size:.72rem;
                   letter-spacing:.06em; color:var(--dim); }
          footer a { color:var(--accent); }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1><xsl:value-of select="rss/channel/title"/></h1>
          <p class="desc"><xsl:value-of select="rss/channel/description"/></p>
          <p class="note">This is an RSS feed. To follow it, paste this page's address into a feed reader.
            To read the events in your browser, <a href="/polymythseminars/">open the calendar</a>.</p>
          <xsl:for-each select="rss/channel/item">
            <div class="item">
              <a class="title" href="{link}"><xsl:value-of select="title"/></a>
              <div class="meta"><xsl:value-of select="pubDate"/></div>
              <div class="body"><xsl:value-of select="description"/></div>
            </div>
          </xsl:for-each>
          <footer>
            <a href="/polymythseminars/">Calendar</a> ·
            <a href="/">Seminar Schools</a>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
