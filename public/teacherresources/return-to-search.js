(function(){
  'use strict';
  try {
    var saved=JSON.parse(sessionStorage.getItem('teacher-search-return'));
    if(!saved || !/^\/teacherresources\/(?:\?|#|$)/.test(saved.path))return;
    var url=new URL(saved.path,location.origin);
    if(url.origin!==location.origin)return;
    document.querySelectorAll('.search-return').forEach(function(a){a.href=url.pathname+url.search+url.hash;});
  }catch(e){}
})();
