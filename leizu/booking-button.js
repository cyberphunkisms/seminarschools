/*
 * Leizu course selection → intake handoff.
 *
 * Every intake-bound action carries the current course, ESL, and pathway choices.
 * Stripe and Cal.com remain server-verified downstream of the intake form.
 */
(function(){
  function config(){ return window.LEIZU_PAYMENT_CONFIG; }
  function productFor(key){
    var c = config();
    return c && c.getProduct ? c.getProduct(key) : null;
  }
  function sanitizeIds(ids){
    return (ids || []).filter(function(id){ return /^[a-z0-9-]{1,80}$/i.test(String(id)); });
  }
  function readSelectedSet(name){
    var value = null;
    if(name === 'selected' && typeof selected !== 'undefined') value = selected;
    if(name === 'eslSelected' && typeof eslSelected !== 'undefined') value = eslSelected;
    return value instanceof Set ? Array.from(value) : [];
  }
  function currentPickerState(){
    var courseIds = readSelectedSet('selected');
    var eslCourseIds = readSelectedSet('eslSelected').filter(function(id){ return courseIds.indexOf(id) !== -1; });
    var path = String((window.LEIZU_CURRENT_ROUTE || document.documentElement.getAttribute('data-current-route') || 'all')).toLowerCase();
    if(['forest','ib','ossd'].indexOf(path) === -1) path = '';
    var lang = String(document.documentElement.getAttribute('data-lang') || 'en').toLowerCase();
    if(['en','fr','zh','zhs','fa'].indexOf(lang) === -1) lang = 'en';
    return {courseIds:courseIds, eslCourseIds:eslCourseIds, path:path, lang:lang};
  }
  function buildIntakeUrl(options){
    options = options || {};
    var params = new URLSearchParams();
    if(productFor(options.tier)) params.set('tier', options.tier);
    var source = String(options.source || '').toLowerCase();
    if(['seminar','mulberry','contact'].indexOf(source) !== -1) params.set('source', source);
    var courses = sanitizeIds(options.courseIds);
    var esl = sanitizeIds(options.eslCourseIds);
    var path = String(options.path || '').toLowerCase();
    var lang = String(options.lang || '').toLowerCase();
    if(courses.length) params.set('courses', courses.join(','));
    if(esl.length) params.set('esl_courses', esl.join(','));
    if(['forest','ib','ossd'].indexOf(path) !== -1) params.set('path', path);
    if(['fr','zh','zhs','fa'].indexOf(lang) !== -1) params.set('lang', lang);
    return '/leizu/intake/' + (params.toString() ? '?' + params.toString() : '');
  }
  function getPaymentKeyForCart(selectedCourseIds, options){
    if(options === true) return 'forest_year_monthly';
    options = options || {};
    if(options.yearTier === 'forest'){
      var mode = options.yearMode || 'monthly';
      var key = 'forest_year_' + mode;
      return productFor(key) ? key : 'forest_year_monthly';
    }
    return null;
  }
  function intentForLink(link){
    var raw = link.getAttribute('href') || '';
    var parsed;
    try { parsed = new URL(raw, window.location.origin); } catch(e){ parsed = new URL('/leizu/intake/', window.location.origin); }
    return {
      tier: link.dataset.paymentKey || parsed.searchParams.get('tier') || '',
      source: link.dataset.intakeSource || parsed.searchParams.get('source') || ''
    };
  }
  function refreshIntakeCtas(){
    var state = currentPickerState();
    document.querySelectorAll('a[data-payment-key],a[data-intake-source],a[href^="/leizu/intake"]').forEach(function(link){
      var intent = intentForLink(link);
      if(intent.tier && !productFor(intent.tier)) return;
      link.href = buildIntakeUrl({
        tier:intent.tier,
        source:intent.source,
        courseIds:state.courseIds,
        eslCourseIds:state.eslCourseIds,
        path:state.path,
        lang:state.lang
      });
    });
  }
  function buildBookingHandler(){
    var bookButton = document.querySelector('[data-action="book"]');
    if(!bookButton || bookButton.dataset.leizuWired === 'true') return;
    bookButton.dataset.leizuWired = 'true';
    bookButton.removeAttribute('href');
    bookButton.addEventListener('click', function(e){
      e.preventDefault();
      var state = currentPickerState();
      var yearTier = state.path === 'forest' ? 'forest' : null;
      var modeElement = document.querySelector('[data-year-payment-mode]');
      var yearMode = modeElement && /^(upfront|two|term|monthly)$/.test(modeElement.value) ? modeElement.value : 'monthly';
      var paymentKey = getPaymentKeyForCart(state.courseIds, {yearTier:yearTier, yearMode:yearMode});
      if(!paymentKey && state.courseIds.length === 0 && state.eslCourseIds.length === 0 && !state.path){
        var notice = document.getElementById('selection-notice');
        if(notice){ notice.hidden=false; notice.textContent='Choose at least one subject before continuing.'; }
        var subjects = document.getElementById('subjects');
        if(subjects) subjects.scrollIntoView({behavior:'smooth', block:'start'});
        return;
      }
      var notice = document.getElementById('selection-notice');
      if(notice) notice.hidden=true;
      window.location.assign(buildIntakeUrl({tier:paymentKey,courseIds:state.courseIds,eslCourseIds:state.eslCourseIds,path:state.path,lang:state.lang}));
    });
  }
  window.LEIZU_BUILD_INTAKE_URL = buildIntakeUrl;
  window.LEIZU_REFRESH_INTAKE_CTAS = refreshIntakeCtas;
  window.getPaymentKeyForCart = getPaymentKeyForCart;
  document.addEventListener('leizu:pickerchange', refreshIntakeCtas);
  document.addEventListener('DOMContentLoaded', function(){
    refreshIntakeCtas();
    window.setTimeout(buildBookingHandler, 100);
  });
})();
