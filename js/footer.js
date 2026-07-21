/* Canonical site footer. One source of truth, injected on every page so the
 * footer is identical site-wide. Self-styled with token fallbacks so it reads
 * the same on any page's palette. Removes any pre-existing <footer> first. */
(function () {
  function build() {
    // remove any footer the page shipped with, so there is exactly one
    document.querySelectorAll('footer').forEach(function (f) { f.remove(); });

    if (!document.getElementById('ss-foot-css')) {
      var s = document.createElement('style');
      s.id = 'ss-foot-css';
      s.textContent = [
        '.ss-foot{font-family:"JetBrains Mono",ui-monospace,monospace;color:var(--ink,var(--fg,#2A1A14));',
        'max-width:1180px;margin:4rem auto 0;padding:1.8rem 1.6rem 2.6rem;',
        'border-top:1px solid currentColor;border-color:color-mix(in srgb,currentColor 18%,transparent);}',
        '.ss-foot .ss-brand{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;opacity:.85;margin-bottom:1.3rem;}',
        '.ss-foot .ss-col-title{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin:0 0 .45rem;font-weight:600;}',
        '.ss-foot .ss-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:1.5rem 1.2rem;}',
        '.ss-foot a{display:block;color:inherit;text-decoration:none;font-size:.86rem;line-height:1.95;',
        'opacity:.82;border-bottom:1px solid transparent;width:max-content;max-width:100%;overflow-wrap:normal;word-break:normal;hyphens:none;transition:opacity .15s,border-color .15s;}',
        '.ss-foot a:hover,.ss-foot a:focus-visible{opacity:1;border-bottom-color:currentColor;}',
        '.ss-foot .prototype-mark{display:inline-flex;align-items:center;justify-content:center;width:1.2em;height:1.2em;margin-left:.3em;border:1px solid currentColor;border-radius:50%;font-size:.64em;font-weight:700;vertical-align:.12em;}',
        '.ss-foot .ss-base{margin-top:1.7rem;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;opacity:.5;}',
        '@media(max-width:460px){.ss-foot{padding-left:1rem;padding-right:1rem}.ss-foot .ss-cols{grid-template-columns:1fr}.ss-foot a{width:100%;line-height:1.65;padding:.28rem 0}}'
      ].join('');
      document.head.appendChild(s);
    }

    var cols = [
      ['Learn', [['Leizu Academy', '/leizu'], ['Teacher Resources', '/teacherresources/'], ['AI Teacher Resources', '/aitr/'], ['The Agora', '/agora/']]],
      ['What\u2019s on', [['polymythcalendar', '/polymythseminars/'], ['Marginalia', '/marginalia']]],
      ['The work', [['polymorphousmythology', '/polymyth/methodologylist'], ['bookwormburrows', '/bookwormcard/']]],
      ['Projects', [['Ohm Dome <span class="prototype-mark" aria-label="Prototype" title="Prototype">P</span>', '/ohm-dome/'], ['Festivals', '/polymythseminars/'], ['Florilegium', '/florilegium/'], ['Nutrition', '/nutrition/']]],
      ['About', [['Full CV', '/saul'], ['Reviews & references', '/reviews/'], ['About', '/about/'], ['Sitemap', '/polymyth/sitemap/'], ['Email', 'mailto:saulnassau@protonmail.com']]]
    ];
    var html = '<div class="ss-brand">Seminar Schools.</div><div class="ss-cols">';
    cols.forEach(function (c) {
      html += '<nav class="ss-col" aria-label="' + c[0] + '"><h2 class="ss-col-title">' + c[0] + '</h2>';
      c[1].forEach(function (l) { html += '<a href="' + l[1] + '">' + l[0] + '</a>'; });
      html += '</nav>';
    });
    html += '</div><div class="ss-base">Toronto &middot; reading rooms &middot; one arrow, two birds</div>';

    var foot = document.createElement('footer');
    foot.className = 'ss-foot';
    foot.innerHTML = html;
    document.body.appendChild(foot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
