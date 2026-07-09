/* CL_SELF_KEYBOARD_HELPERS — small keyboard affordances for dense routes. */
(function(){
  function editable(el){ return el && (el.closest('input, textarea, select, [contenteditable="true"]')); }
  function firstSearch(){ return document.querySelector('input[type="search"], input[id*="search"], input[placeholder*="Search"], input[aria-label*="Search"]'); }
  function announce(msg){
    var live = document.getElementById('clKeyboardLive');
    if(!live){ live = document.createElement('div'); live.id='clKeyboardLive'; live.className='sr-only'; live.setAttribute('aria-live','polite'); document.body.appendChild(live); }
    live.textContent = msg;
  }
  function scrollHorizontal(dir){
    var scroller = document.querySelector('[data-keyboard-scroll], .cloud-stage, .views-grid, .timeline, .calendar-shell, .cal-grid, .graph-stage, .map-stage, .scroll-shell');
    if(scroller && scroller.scrollBy){ scroller.scrollBy({left: dir * Math.max(180, Math.floor(window.innerWidth * .42)), behavior:'smooth'}); return true; }
    return false;
  }
  document.documentElement.setAttribute('data-keyboard-enhanced','true');
  document.addEventListener('keydown', function(ev){
    if(editable(ev.target)) return;
    if(ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey){
      var s = firstSearch();
      if(s){ ev.preventDefault(); s.focus(); announce('Search focused.'); }
    }
    if((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && (document.querySelector('.cloud-stage, .views-grid, .graph-stage, .map-stage, .scroll-shell') || document.body.dataset.routeType === 'calendar')){
      if(scrollHorizontal(ev.key === 'ArrowRight' ? 1 : -1)) ev.preventDefault();
    }
    if(ev.key === '?' && !ev.ctrlKey && !ev.metaKey){
      var help = document.querySelector('.keyboard-hint');
      if(help){ ev.preventDefault(); help.focus && help.focus(); help.scrollIntoView({block:'center', behavior:'smooth'}); announce('Keyboard help shown.'); }
    }
  });
})();
