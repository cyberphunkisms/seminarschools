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
        '.ss-foot .ss-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1.5rem 1.2rem;}',
        '.ss-foot a{display:block;color:inherit;text-decoration:none;font-size:.86rem;line-height:1.95;',
        'opacity:.82;border-bottom:1px solid transparent;width:max-content;max-width:100%;transition:opacity .15s,border-color .15s;}',
        '.ss-foot a:hover,.ss-foot a:focus-visible{opacity:1;border-bottom-color:currentColor;}',
        '.ss-foot .ss-base{margin-top:1.7rem;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;opacity:.5;}'
      ].join('');
      document.head.appendChild(s);
    }

    var cols = [
      ['Learn', [['Leizu Academy', '/leizu'], ['Teacher Resources', '/teacherresources/'], ['The Agora', '/agora/']]],
      ['What\u2019s on', [['Lecture Calendar', '/polymythseminars/'], ['Marginalia', '/marginalia']]],
      ['The work', [['polymorphousmythology', '/polymyth/methodologylist'], ['bookwormburrows', '/bookwormcard/']]],
      ['Projects', [['Ohm Dome', '/ohm-dome/'], ['Festivals', '/polymythseminars/'], ['Florilegium', '/florilegium/'], ['Nutrition', '/nutrition/']]],
      ['About', [['Full CV', '/saul'], ['Main', '/main'], ['Sitemap', '/polymyth/sitemap/'], ['Email', 'mailto:saulnassau@protonmail.com']]]
    ];
    var html = '<div class="ss-brand">Seminar Schools.</div><div class="ss-cols">';
    cols.forEach(function (c) {
      html += '<div>';
      c[1].forEach(function (l) { html += '<a href="' + l[1] + '">' + l[0] + '</a>'; });
      html += '</div>';
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
