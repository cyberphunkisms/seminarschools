(function(){
  var supported=['en','fr','zh','zhs','fa'];
  var labels={
    fr:{notice:'Votre préférence de langue est enregistrée. Cette page d’information est actuellement en anglais.',back:'Retour à l’accueil Leizu'},
    zh:{notice:'已記住您的語言偏好。此資訊頁目前提供英文版本。',back:'返回嫘祖首頁'},
    zhs:{notice:'已记住您的语言偏好。此信息页目前提供英文版本。',back:'返回嫘祖首页'},
    fa:{notice:'ترجیح زبانی شما ذخیره شده است. این صفحهٔ اطلاعاتی اکنون به انگلیسی ارائه می‌شود.',back:'بازگشت به صفحهٔ اصلی لیزو'}
  };
  function read(){
    try{
      var query=new URLSearchParams(window.location.search).get('lang');
      if(supported.indexOf(query)>-1) return query;
      var stored=localStorage.getItem('leizu-lang');
      if(supported.indexOf(stored)>-1) return stored;
    }catch(e){}
    return 'en';
  }
  var lang=read();
  try{localStorage.setItem('leizu-lang',lang);}catch(e){}
  var root=document.documentElement;
  root.setAttribute('lang',lang==='zh'?'zh-Hant':lang==='zhs'?'zh-Hans':lang);
  root.setAttribute('dir',lang==='fa'?'rtl':'ltr');
  root.setAttribute('data-leizu-language-preference',lang);
  function preserveLinks(){
    document.querySelectorAll('a[href]').forEach(function(link){
      var raw=link.getAttribute('href');
      if(!raw || raw.charAt(0)==='#' || raw.indexOf('mailto:')===0 || raw.indexOf('tel:')===0) return;
      var url;
      try{url=new URL(raw,window.location.origin);}catch(e){return;}
      if(url.origin!==window.location.origin || url.pathname.indexOf('/leizu')!==0) return;
      if(lang==='en') url.searchParams.delete('lang'); else url.searchParams.set('lang',lang);
      link.setAttribute('href',url.pathname+(url.search||'')+(url.hash||''));
    });
  }
  function showNotice(){
    if(lang==='en' || window.location.pathname==='/leizu/' || window.location.pathname==='/leizu/index.html') return;
    var copy=labels[lang]; if(!copy || document.getElementById('leizu-language-note')) return;
    var note=document.createElement('aside');
    note.id='leizu-language-note'; note.setAttribute('role','status');
    note.style.cssText='margin:0 0 1rem;padding:.65rem .8rem;border:1px solid currentColor;border-radius:.45rem;font:500 .82rem/1.45 system-ui,sans-serif;opacity:.85;';
    note.dir=lang==='fa'?'rtl':'ltr';
    var back='/leizu/?lang='+encodeURIComponent(lang);
    note.innerHTML='<span>'+copy.notice+'</span> <a href="'+back+'" style="color:inherit">'+copy.back+'</a>';
    var target=document.querySelector('main, .page, .wrap, body > div, body');
    if(target) target.insertBefore(note,target.firstChild);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){preserveLinks();showNotice();});
  else {preserveLinks();showNotice();}
})();
