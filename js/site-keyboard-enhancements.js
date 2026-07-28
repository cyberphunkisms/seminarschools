/* CL_SELF_KEYBOARD_HELPERS — small keyboard affordances for dense routes. */
(function(){
  if(window.__ssKeyboardEnhancementsMounted)return;
  window.__ssKeyboardEnhancementsMounted=true;
  function editable(el){
    return el && el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  }
  function interactive(el){
    return el && el.closest('a[href], button, summary, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="slider"]');
  }
  function available(el){
    return !!(el && !el.disabled && !el.hidden && el.getAttribute('aria-hidden') !== 'true' &&
      el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }
  function firstSearch(){
    var candidates = document.querySelectorAll('input[type="search"], input[id*="search" i], input[role="searchbox"], input');
    for(var i = 0; i < candidates.length; i++){
      var input = candidates[i];
      var name = [
        input.id || '',
        input.name || '',
        input.placeholder || '',
        input.getAttribute('aria-label') || ''
      ].join(' ').toLowerCase();
      if(available(input) && (input.type === 'search' || name.indexOf('search') !== -1)) return input;
    }
    return null;
  }
  function announce(msg){
    var live = document.getElementById('clKeyboardLive');
    if(!live){ live = document.createElement('div'); live.id='clKeyboardLive'; live.className='sr-only'; live.setAttribute('aria-live','polite'); document.body.appendChild(live); }
    live.textContent = '';
    window.setTimeout(function(){ live.textContent = msg; }, 20);
  }
  function scrollHorizontal(dir){
    var candidates = document.querySelectorAll('[data-keyboard-scroll], .cloud-stage, .views-grid, .timeline, .calendar-shell, .cal-grid, .graph-stage, .map-stage, .scroll-shell');
    var scroller = null;
    for(var i = 0; i < candidates.length; i++){
      if(available(candidates[i]) && candidates[i].scrollWidth > candidates[i].clientWidth + 1){
        scroller = candidates[i];
        break;
      }
    }
    if(scroller && scroller.scrollBy){ scroller.scrollBy({left: dir * Math.max(180, Math.floor(window.innerWidth * .42)), behavior:'auto'}); return true; }
    return false;
  }
  function focusHelp(help){
    if(!help) return;
    var temporary = !help.hasAttribute('tabindex');
    if(temporary){
      help.setAttribute('tabindex','-1');
      help.setAttribute('data-temporary-keyboard-focus','true');
      help.addEventListener('blur', function cleanup(){
        help.removeEventListener('blur', cleanup);
        if(help.getAttribute('data-temporary-keyboard-focus') === 'true'){
          help.removeAttribute('tabindex');
          help.removeAttribute('data-temporary-keyboard-focus');
        }
      });
    }
    try { help.focus({preventScroll:true}); }
    catch(error){ help.focus(); }
    help.scrollIntoView({block:'center', behavior:'auto'});
  }
  document.documentElement.setAttribute('data-keyboard-enhanced','true');
  document.addEventListener('keydown', function(ev){
    if(ev.defaultPrevented) return;
    if(ev.isComposing) return;
    if(editable(ev.target)) return;
    if(ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey){
      var s = firstSearch();
      if(s){ ev.preventDefault(); s.focus(); announce('Search focused.'); }
    }
    if((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')
      && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey
      && !interactive(ev.target)
      && (document.querySelector('.cloud-stage, .views-grid, .graph-stage, .map-stage, .scroll-shell') || document.body.dataset.routeType === 'calendar')){
      if(scrollHorizontal(ev.key === 'ArrowRight' ? 1 : -1)) ev.preventDefault();
    }
    if(ev.key === '?' && !ev.ctrlKey && !ev.metaKey){
      var help = document.querySelector('.keyboard-hint');
      if(help){ ev.preventDefault(); focusHelp(help); announce('Keyboard help shown.'); }
    }
  });
})();
