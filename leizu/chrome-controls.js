/* ============================================================
 * Leizu chrome controls hardening.
 * Makes the EN/ESL, A-/A+, and light/dark controls deterministic
 * even if a page-level render or older handler is interrupted.
 * ============================================================ */
(function(){
  'use strict';
  var root = document.documentElement;

  function safeLocalSet(key, value){ try{ localStorage.setItem(key, value); }catch(e){} }
  function safeLocalGet(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
  function lang(){ return root.getAttribute('data-lang') || 'en'; }

  function syncThemeButton(theme){
    var btn = document.querySelector('.theme-btn[data-theme-toggle]');
    if(!btn) return;
    var dark = theme === 'dark';
    btn.textContent = dark ? '☾' : '☀';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('data-theme-state', theme);
  }
  function applyThemeHard(theme){
    theme = theme === 'dark' ? 'dark' : 'light';
    root.classList.remove('dark','light');
    root.classList.add(theme);
    if(theme === 'dark') root.setAttribute('data-theme','dark');
    else root.removeAttribute('data-theme');
    safeLocalSet('leizu-theme', theme);
    safeLocalSet('ss-theme', theme);
    if(typeof window.applyTheme === 'function'){
      try{ window.applyTheme(theme); }catch(e){}
      root.classList.remove(theme === 'dark' ? 'light' : 'dark');
      root.classList.add(theme);
      if(theme === 'dark') root.setAttribute('data-theme','dark');
      else root.removeAttribute('data-theme');
    }
    syncThemeButton(theme);
  }

  function syncEslButton(state){
    var btn = document.querySelector('.esl-btn[data-esl-toggle]');
    if(!btn) return;
    var on = state === 'on';
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function applyEslHard(state){
    state = state === 'on' ? 'on' : 'off';
    if(state === 'on' && lang() !== 'en'){
      if(typeof window.applyLang === 'function'){
        try{ window.applyLang('en'); }catch(e){ root.setAttribute('data-lang','en'); }
      } else {
        root.setAttribute('data-lang','en');
        root.setAttribute('lang','en');
        root.setAttribute('dir','ltr');
      }
    }
    if(typeof window.applyESL === 'function'){
      try{ window.applyESL(state); }catch(e){ root.setAttribute('data-esl', state); }
    } else {
      root.setAttribute('data-esl', state);
      var banner = document.getElementById('esl-banner');
      if(banner){ banner.classList.toggle('dismissed', state !== 'on'); }
    }
    root.setAttribute('data-esl', state);
    root.setAttribute('data-esl-banner-dismissed', state === 'on' ? 'false' : 'true');
    safeLocalSet('leizu-esl', state);
    syncEslButton(state);
  }

  function applyTypeHard(scale){
    scale = parseFloat(scale);
    if(!isFinite(scale)) scale = 1;
    scale = Math.max(0.85, Math.min(1.45, Math.round(scale * 10) / 10));
    root.style.setProperty('--type-scale', String(scale));
    safeLocalSet('leizu-type-scale', String(scale));
    if(typeof window.applyTypeSize === 'function'){
      try{ window.applyTypeSize(scale); }catch(e){}
    }
    document.querySelectorAll('.size-btn[data-size-step]').forEach(function(btn){
      var step = parseInt(btn.getAttribute('data-size-step'),10);
      if(step < 0) btn.disabled = scale <= 0.85;
      if(step > 0) btn.disabled = scale >= 1.45;
      btn.setAttribute('aria-pressed','false');
    });
  }
  function currentScale(){
    var stored = parseFloat(safeLocalGet('leizu-type-scale'));
    if(isFinite(stored)) return stored;
    var v = parseFloat(getComputedStyle(root).getPropertyValue('--type-scale'));
    return isFinite(v) ? v : 1;
  }

  function syncAll(){
    var theme = safeLocalGet('leizu-theme') || safeLocalGet('ss-theme') || (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    applyThemeHard(theme === 'dark' ? 'dark' : 'light');
    applyTypeHard(currentScale());
    syncEslButton(root.getAttribute('data-esl') === 'on' ? 'on' : 'off');
  }

  document.addEventListener('click', function(event){
    var themeBtn = event.target.closest && event.target.closest('.theme-btn[data-theme-toggle]');
    var eslBtn = event.target.closest && event.target.closest('.esl-btn[data-esl-toggle]');
    var sizeBtn = event.target.closest && event.target.closest('.size-btn[data-size-step]');
    if(!themeBtn && !eslBtn && !sizeBtn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(themeBtn){
      var current = root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark') ? 'dark' : 'light';
      applyThemeHard(current === 'dark' ? 'light' : 'dark');
      return;
    }
    if(eslBtn){
      var next = root.getAttribute('data-esl') === 'on' ? 'off' : 'on';
      applyEslHard(next);
      return;
    }
    if(sizeBtn){
      var step = parseInt(sizeBtn.getAttribute('data-size-step'),10);
      if(!isNaN(step)) applyTypeHard(currentScale() + (step * 0.1));
    }
  }, true);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll);
  else syncAll();
})();
