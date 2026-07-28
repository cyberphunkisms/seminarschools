(function(){
  'use strict';
  var supported=['en','fr','zh','zhs','fa'];
  var segments={fr:'fr',zh:'zh-hant',zhs:'zh-hans',fa:'fa'};
  var segmentLang={fr:'fr','zh-hant':'zh','zh-hans':'zhs',fa:'fa'};
  var documentLang={en:'en',fr:'fr',zh:'zh-Hant',zhs:'zh-Hans',fa:'fa'};
  var labels={
    fr:{notice:'Cette page auxiliaire reste en anglais. La page est correctement marquée en anglais; votre préférence française est conservée.',back:'Retour à Leizu en français'},
    zh:{notice:'此辅助页面仍为英文。页面已正确标记为英文；您的繁体中文偏好会保留。',back:'返回繁體中文版嫘祖'},
    zhs:{notice:'此辅助页面仍为英文。页面已正确标记为英文；您的简体中文偏好会保留。',back:'返回简体中文版嫘祖'},
    fa:{notice:'این صفحهٔ کمکی هنوز انگلیسی است. زبان صفحه درست علامت‌گذاری شده و ترجیح فارسی شما حفظ می‌شود.',back:'بازگشت به لیزو به فارسی'}
  };
  function normal(value){value=String(value||'').toLowerCase();return supported.indexOf(value)>-1?value:'en'}
  function fromPath(){
    var match=location.pathname.match(/^\/leizu\/(fr|zh-hant|zh-hans|fa)(?:\/|$)/);
    return match?segmentLang[match[1]]:'';
  }
  function read(){
    try{
      var path=fromPath();if(path)return path;
      var query=new URLSearchParams(location.search).get('lang');
      if(supported.indexOf(query)>-1)return query;
      var stored=localStorage.getItem('leizu-lang');
      if(supported.indexOf(stored)>-1)return stored;
    }catch(e){}
    return 'en';
  }
  function route(path,lang){
    var clean=String(path||'/leizu/').replace(/\/index\.html$/,'/');
    var english=clean.replace(/^\/leizu\/(?:fr|zh-hant|zh-hans|fa)(?=\/|$)/,'/leizu');
    if(lang==='en')return english==='/leizu'?'/leizu/':english;
    var suffix=english.replace(/^\/leizu\/?/,'');
    return '/leizu/'+segments[lang]+'/'+suffix;
  }
  var requested=normal(read());
  try{localStorage.setItem('leizu-lang',requested)}catch(e){}
  var root=document.documentElement;
  var complete=root.getAttribute('data-leizu-localized')==='complete'||Boolean(fromPath());
  var pageLang=complete?requested:'en';
  root.setAttribute('lang',pageLang==='zh'?'zh-Hant':pageLang==='zhs'?'zh-Hans':pageLang);
  root.setAttribute('dir',pageLang==='fa'?'rtl':'ltr');
  root.setAttribute('data-leizu-language-preference',requested);
  function preserveLinks(){
    document.querySelectorAll('a[href]').forEach(function(link){
      var raw=link.getAttribute('href');
      if(!raw||raw.charAt(0)==='#'||raw.indexOf('mailto:')===0||raw.indexOf('tel:')===0)return;
      var url;try{url=new URL(raw,location.origin)}catch(e){return}
      if(url.origin!==location.origin||url.pathname.indexOf('/leizu')!==0)return;
      url.searchParams.delete('lang');
      url.pathname=route(url.pathname,requested);
      link.setAttribute('href',url.pathname+(url.search||'')+(url.hash||''));
    });
    document.querySelectorAll('form').forEach(function(form){
      var preferred=form.querySelector('input[name="preferred_language"]');
      var language=form.querySelector('input[name="language"]');
      if(preferred)preferred.value=documentLang[requested]||'en';
      else if(language)language.value=requested;
      else{
        preferred=document.createElement('input');
        preferred.type='hidden';
        preferred.name='preferred_language';
        preferred.value=documentLang[requested]||'en';
        form.appendChild(preferred);
      }
      if(form.action&&form.action.indexOf(location.origin+'/leizu')===0){
        var url=new URL(form.action);url.pathname=route(url.pathname,requested);url.searchParams.delete('lang');form.action=url.pathname+(url.search||'');
      }
    });
  }
  function showNotice(){
    if(complete||requested==='en'||!labels[requested]||document.getElementById('leizu-language-note'))return;
    var copy=labels[requested],note=document.createElement('aside');
    note.id='leizu-language-note';note.setAttribute('role','status');note.lang=requested==='zh'?'zh-Hant':requested==='zhs'?'zh-Hans':requested;
    note.dir=requested==='fa'?'rtl':'ltr';
    note.style.cssText='position:fixed;z-index:2000;inset:auto 1rem 1rem 1rem;max-width:48rem;margin:auto;padding:.75rem .9rem;border:1px solid currentColor;border-radius:.5rem;background:Canvas;color:CanvasText;box-shadow:0 .4rem 1.4rem rgba(0,0,0,.22);font:500 .84rem/1.45 system-ui,sans-serif;';
    note.append(document.createTextNode(copy.notice+' '));
    var back=document.createElement('a');back.href=route('/leizu/',requested);back.textContent=copy.back;back.style.color='inherit';note.appendChild(back);
    document.body.appendChild(note);
  }
  function init(){preserveLinks();showNotice()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
