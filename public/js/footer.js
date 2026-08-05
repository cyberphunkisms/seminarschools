/* 20260725-audit45-footer; evolved 20260805-predeploy-audit-footer
 * Canonical site footer. Self-styled with token fallbacks so it reads
 * consistently on any page's palette. Authored contextual footers stay in
 * place; this navigation is appended once as the site-wide wayfinding layer. */
(function () {
  function build() {
    if (document.querySelector('.ss-foot')) return;

    if (!document.getElementById('ss-foot-css')) {
      var s = document.createElement('style');
      s.id = 'ss-foot-css';
      s.textContent = [
        '.ss-foot{font-family:"JetBrains Mono",ui-monospace,monospace;color:inherit;',
        'max-width:1180px;margin:4rem auto 0;padding:1.8rem 1.6rem 2.6rem;',
        'border-top:1px solid currentColor;border-color:color-mix(in srgb,currentColor 18%,transparent);}',
        '.home .ss-foot{max-width:1280px;margin-top:1.5rem;}',
        '.ss-foot .ss-brand{font-size:.76rem;letter-spacing:.22em;text-transform:uppercase;margin-bottom:1.3rem;}',
        '.ss-foot .ss-col-title{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;margin:0 0 .45rem;font-weight:600;}',
        '.ss-foot .ss-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:1.5rem 1.2rem;}',
        '.ss-foot a{display:flex;align-items:center;min-height:44px;color:inherit;text-decoration:none;font-size:.86rem;line-height:1.45;',
        'opacity:.9;border-bottom:1px solid transparent;width:max-content;max-width:100%;overflow-wrap:normal;word-break:normal;hyphens:none;transition:opacity .15s,border-color .15s;}',
        '.ss-foot a:hover,.ss-foot a:focus-visible{opacity:1;border-bottom-color:currentColor;}',
        '.ss-foot a:focus-visible{outline:2px solid currentColor;outline-offset:3px;}',
        '.ss-foot a[aria-current="page"]{opacity:1;font-weight:700;text-decoration:underline;text-underline-offset:.3em;}',
        '.ss-foot .prototype-mark{display:inline-flex;align-items:center;justify-content:center;width:1.2em;height:1.2em;margin-left:.3em;border:1px solid currentColor;border-radius:50%;font-size:.64em;font-weight:700;vertical-align:.12em;}',
        '.ss-foot .ss-base{margin-top:1.7rem;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;}',
        '@media(max-width:460px){.ss-foot{padding-left:1rem;padding-right:1rem}.ss-foot .ss-cols{grid-template-columns:1fr}.ss-foot a{width:100%;padding:.28rem 0}}'
      ].join('');
      document.head.appendChild(s);
    }

    var rawLanguage = String(document.documentElement.lang || 'en').toLowerCase();
    var locale = rawLanguage.indexOf('zh-hant') === 0 ? 'zh-hant'
      : rawLanguage.indexOf('zh-hans') === 0 ? 'zh-hans'
      : rawLanguage.indexOf('fr') === 0 ? 'fr'
      : rawLanguage.indexOf('fa') === 0 ? 'fa'
      : 'en';
    var copy = {
      en: {
        learn: 'Learn', whatsOn: 'What\u2019s on', work: 'The work', projects: 'Projects', aboutGroup: 'About',
        teacher: 'Teacher Resources', aiTeacher: 'AI Teacher Resources', festivals: 'Festivals', nutrition: 'Nutrition',
        cv: 'Full CV', reviews: 'Reviews & references', about: 'About', sitemap: 'Sitemap', email: 'Email',
        prototype: 'Prototype', base: 'Toronto &middot; reading rooms &middot; one arrow, two birds'
      },
      fr: {
        learn: 'Apprendre', whatsOn: 'Au programme', work: 'Le travail', projects: 'Projets', aboutGroup: '\u00c0 propos',
        teacher: 'Ressources p\u00e9dagogiques', aiTeacher: 'Ressources p\u00e9dagogiques IA', festivals: 'Festivals', nutrition: 'Nutrition',
        cv: 'CV complet', reviews: 'Avis et r\u00e9f\u00e9rences', about: '\u00c0 propos', sitemap: 'Plan du site', email: 'Courriel',
        prototype: 'Prototype', base: 'Toronto &middot; salons de lecture &middot; une fl\u00e8che, deux oiseaux'
      },
      'zh-hant': {
        learn: '\u5b78\u7fd2', whatsOn: '\u6d3b\u52d5', work: '\u4f5c\u54c1', projects: '\u5c08\u6848', aboutGroup: '\u95dc\u65bc',
        teacher: '\u6559\u5e2b\u8cc7\u6e90', aiTeacher: 'AI \u6559\u5e2b\u8cc7\u6e90', festivals: '\u7bc0\u6176', nutrition: '\u71df\u990a',
        cv: '\u5b8c\u6574\u5c65\u6b77', reviews: '\u8a55\u50f9\u8207\u53c3\u8003', about: '\u95dc\u65bc', sitemap: '\u7db2\u7ad9\u5730\u5716', email: '\u96fb\u90f5',
        prototype: '\u539f\u578b', base: '\u591a\u502b\u591a &middot; \u95b1\u8b80\u7a7a\u9593 &middot; \u4e00\u7bad\u96d9\u9ce5'
      },
      'zh-hans': {
        learn: '\u5b66\u4e60', whatsOn: '\u6d3b\u52a8', work: '\u4f5c\u54c1', projects: '\u9879\u76ee', aboutGroup: '\u5173\u4e8e',
        teacher: '\u6559\u5e08\u8d44\u6e90', aiTeacher: 'AI \u6559\u5e08\u8d44\u6e90', festivals: '\u8282\u5e86', nutrition: '\u8425\u517b',
        cv: '\u5b8c\u6574\u5c65\u5386', reviews: '\u8bc4\u4ef7\u4e0e\u53c2\u8003', about: '\u5173\u4e8e', sitemap: '\u7f51\u7ad9\u5730\u56fe', email: '\u7535\u90ae',
        prototype: '\u539f\u578b', base: '\u591a\u4f26\u591a &middot; \u9605\u8bfb\u7a7a\u95f4 &middot; \u4e00\u7bad\u53cc\u9e1f'
      },
      fa: {
        learn: '\u06cc\u0627\u062f\u06af\u06cc\u0631\u06cc', whatsOn: '\u0631\u0648\u06cc\u062f\u0627\u062f\u0647\u0627', work: '\u0622\u062b\u0627\u0631', projects: '\u067e\u0631\u0648\u0698\u0647\u200c\u0647\u0627', aboutGroup: '\u062f\u0631\u0628\u0627\u0631\u0647',
        teacher: '\u0645\u0646\u0627\u0628\u0639 \u0645\u0639\u0644\u0645\u0627\u0646', aiTeacher: '\u0645\u0646\u0627\u0628\u0639 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc \u0628\u0631\u0627\u06cc \u0645\u0639\u0644\u0645\u0627\u0646', festivals: '\u062c\u0634\u0646\u0648\u0627\u0631\u0647\u200c\u0647\u0627', nutrition: '\u062a\u063a\u0630\u06cc\u0647',
        cv: '\u0631\u0632\u0648\u0645\u0647\u0654 \u06a9\u0627\u0645\u0644', reviews: '\u0646\u0638\u0631\u0647\u0627 \u0648 \u0645\u0639\u0631\u0641\u06cc\u200c\u0647\u0627', about: '\u062f\u0631\u0628\u0627\u0631\u0647', sitemap: '\u0646\u0642\u0634\u0647\u0654 \u0633\u0627\u06cc\u062a', email: '\u0627\u06cc\u0645\u06cc\u0644',
        prototype: '\u0646\u0645\u0648\u0646\u0647\u0654 \u0622\u0632\u0645\u0627\u06cc\u0634\u06cc', base: '\u062a\u0648\u0631\u0646\u062a\u0648 &middot; \u0627\u062a\u0627\u0642\u200c\u0647\u0627\u06cc \u0645\u0637\u0627\u0644\u0639\u0647 &middot; \u06cc\u06a9 \u062a\u06cc\u0631\u060c \u062f\u0648 \u067e\u0631\u0646\u062f\u0647'
      }
    }[locale];
    function localPath(project, fallback) {
      if (project === 'leizu' && locale !== 'en') return '/leizu/' + locale + '/';
      if (project === 'polymythcal' && locale === 'fr') return '/polymythseminars/fr/';
      if (project === 'saul' && locale !== 'en') return '/saul/' + locale + '/';
      return fallback;
    }
    var prototypeMark = '<span class="prototype-mark" aria-label="' + copy.prototype + '" title="' + copy.prototype + '">P</span>';
    var cols = [
      [copy.learn, [['Leizu Academy', localPath('leizu', '/leizu/')], [copy.teacher, '/teacherresources/'], [copy.aiTeacher, '/aitr/'], ['The Agora', '/agora/']]],
      [copy.whatsOn, [['Polymythcal', localPath('polymythcal', '/polymythseminars/')], ['Polymyth Commons', '/polymythcommons/'], ['Polymythlib', '/polymythlib/']]],
      [copy.work, [['Marginalia', '/marginalia/'], ['Florilegium', '/florilegium/'], ['polymorphousmythology', '/polymyth/'], ['AA*', '/aa/'], ['bookwormburrows', '/bb/']]],
      [copy.projects, [['Ohm Dome ' + prototypeMark, '/ohm-dome/'], ['Sabachtan Seminar ' + prototypeMark, '/agora/#sabachtan'], [copy.nutrition, '/nutrition/']]],
      [copy.aboutGroup, [[copy.cv, localPath('saul', '/saul/')], [copy.reviews, '/reviews/'], [copy.about, '/about/'], [copy.sitemap, '/polymyth/sitemap/'], [copy.email, 'mailto:saulnassau@protonmail.com']]]
    ];
    var html = '<div class="ss-brand">Seminar Schools.</div><div class="ss-cols">';
    cols.forEach(function (c) {
      html += '<nav class="ss-col" aria-label="' + c[0] + '"><h2 class="ss-col-title">' + c[0] + '</h2>';
      c[1].forEach(function (l) { html += '<a href="' + l[1] + '">' + l[0] + '</a>'; });
      html += '</nav>';
    });
    html += '</div><div class="ss-base">' + copy.base + '</div>';

    var foot = document.createElement('footer');
    foot.className = 'ss-foot';
    foot.setAttribute('aria-label', 'Seminar Schools site navigation');
    foot.lang = rawLanguage || 'en';
    foot.dir = locale === 'fa' ? 'rtl' : 'ltr';
    foot.innerHTML = html;
    var currentPath = location.pathname.replace(/\/+$/, '') || '/';
    foot.querySelectorAll('a[href^="/"]').forEach(function (link) {
      var linkPath = new URL(link.href, location.href).pathname.replace(/\/+$/, '') || '/';
      if (linkPath === currentPath) link.setAttribute('aria-current', 'page');
    });
    document.body.appendChild(foot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
