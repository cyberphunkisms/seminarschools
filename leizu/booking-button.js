/*
 * Leizu course selection → intake handoff.
 *
 * The form owns the payment handoff. This file only carries a selected plan and
 * selected course IDs to that form. It never sends users from browser storage to
 * Stripe or Cal.com.
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
    // The curriculum declares these Sets before this file loads. Reading them
    // directly avoids evaluating a string from the page.
    var value = null;
    if(name === 'selected' && typeof selected !== 'undefined') value = selected;
    if(name === 'eslSelected' && typeof eslSelected !== 'undefined') value = eslSelected;
    return value instanceof Set ? Array.from(value) : [];
  }

  function buildIntakeUrl(options){
    var params = new URLSearchParams();
    if(options && productFor(options.tier)) params.set('tier', options.tier);
    var courses = sanitizeIds(options && options.courseIds);
    var esl = sanitizeIds(options && options.eslCourseIds);
    if(courses.length) params.set('courses', courses.join(','));
    if(esl.length) params.set('esl_courses', esl.join(','));
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

  function buildBookingHandler(){
    var bookButton = document.querySelector('[data-action="book"]');
    if(!bookButton || bookButton.dataset.leizuWired === 'true') return;
    bookButton.dataset.leizuWired = 'true';
    bookButton.removeAttribute('href');

    bookButton.addEventListener('click', function(e){
      e.preventDefault();
      var selectedCourseIds = readSelectedSet('selected');
      var eslCourseIds = readSelectedSet('eslSelected');
      var yearTier = selectedCourseIds.indexOf('forest-year-flagship') !== -1 ? 'forest' : null;
      var modeElement = document.querySelector('[data-year-payment-mode]');
      var yearMode = modeElement && /^(upfront|two|term|monthly)$/.test(modeElement.value) ? modeElement.value : 'monthly';
      var paymentKey = getPaymentKeyForCart(selectedCourseIds, {yearTier: yearTier, yearMode: yearMode});

      if(!paymentKey && selectedCourseIds.length === 0 && eslCourseIds.length === 0){
        var notice = document.getElementById('selection-notice');
        if(notice){
          notice.hidden = false;
          notice.textContent = 'Choose at least one subject before continuing.';
        }
        var subjects = document.getElementById('subjects');
        if(subjects) subjects.scrollIntoView({behavior:'smooth', block:'start'});
        return;
      }
      var notice = document.getElementById('selection-notice');
      if(notice) notice.hidden = true;
      window.location.assign(buildIntakeUrl({
        tier: paymentKey,
        courseIds: selectedCourseIds,
        eslCourseIds: eslCourseIds
      }));
    });
  }

  function wireTileCtas(){
    document.querySelectorAll('a[data-payment-key]').forEach(function(link){
      var key = link.dataset.paymentKey;
      if(!productFor(key)){
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        return;
      }
      link.href = buildIntakeUrl({tier:key});
    });
  }

  window.LEIZU_BUILD_INTAKE_URL = buildIntakeUrl;
  window.getPaymentKeyForCart = getPaymentKeyForCart;

  document.addEventListener('DOMContentLoaded', function(){
    wireTileCtas();
    window.setTimeout(buildBookingHandler, 100);
  });
})();
