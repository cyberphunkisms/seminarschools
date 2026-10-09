/* Shared, deterministic teacher-resource search. No network or inferred learner labels. */
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TeacherSearch = api;
})(typeof window !== 'undefined' ? window : this, function() {
  'use strict';
  function normalize(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function words(s) { return normalize(s).split(/\s+/).filter(Boolean); }
  function compact(s) { return normalize(s).replace(/^the /, '').replace(/\s/g, ''); }
  function distance(a,b) {
    if (Math.abs(a.length-b.length)>2) return 99;
    if(a.length===b.length){var dif=[];for(var k=0;k<a.length;k++)if(a[k]!==b[k])dif.push(k);if(dif.length===2 && dif[1]===dif[0]+1 && a[dif[0]]===b[dif[1]] && a[dif[1]]===b[dif[0]])return 1;}
    var p=Array.from({length:b.length+1},function(_,i){return i;});
    for(var i=1;i<=a.length;i++) { var c=[i]; for(var j=1;j<=b.length;j++) c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; }
    return p[b.length];
  }
  function whole(q,field) { var ws=words(field); return q.every(function(w){return ws.indexOf(w)>=0;}); }
  function titleWords(value) {
    var tokens=words(value);
    return tokens.concat(tokens.slice(0,-1).map(function(w,i){return w+tokens[i+1];}));
  }
  function fileTypes(value) {
    if (/^PDF and webpage$/i.test(value || '')) return ['PDF','Webpage'];
    return [value || 'Webpage / unrecorded'];
  }
  function fileMatches(value, selected) { return value === selected || fileTypes(value).indexOf(selected) >= 0; }
  function match(entry,query) {
    var q=words(query), t=normalize(entry.title), a=normalize(entry.author), qc=compact(query);
    if (!q.length) return {score:1,reason:''};
    if(t===normalize(query)) return {score:100,reason:'Exact title'};
    if(qc && qc===compact(t)) return {score:98,reason:'Title variant'};
    if((entry.aliases||[]).some(function(x){return compact(x)===qc;})) return {score:97,reason:'Title variant'};
    if(whole(q,a)) return {score:90,reason:'Author match'};
    if(whole(q,t)) return {score:85,reason:'Title match'};
    // Join adjacent title tokens, accepting “telltale” without broad substring matching.
    var tw=words(t), joined=titleWords(t);
    (entry.aliases||[]).forEach(function(alias){joined=joined.concat(titleWords(alias));});
    joined=Array.from(new Set(joined));
    if(q.every(function(w){return joined.indexOf(w)>=0;})) return {score:84,reason:'Title variant'};
    if(q.every(function(w){return joined.concat(words(a)).indexOf(w)>=0;})) return {score:80,reason:'Title and author match'};
    if(q.every(function(w){return tw.some(function(x){return w.length>=4 && x.indexOf(w)===0;});})) return {score:70,reason:'Partial title'};
    if(whole(q,entry.keywords||'')) return {score:60,reason:'Topic or teaching-purpose match'};
    var descriptionWords=joined.concat(words(a+' '+(entry.keywords||'')+' '+(entry.notes||'')));
    if(q.every(function(w){return descriptionWords.indexOf(w)>=0;})) return {score:45,reason:'Resource description match'};
    var fileWords=words(entry.file || entry.file_type || '');
    var resourceWords=descriptionWords.concat(fileWords);
    if(fileWords.length && q.some(function(w){return fileWords.indexOf(w)>=0;}) && q.every(function(w){return resourceWords.indexOf(w)>=0;})) return {score:40,reason:'Resource and file-format match'};
    // Approximate matches are explicit, lower ranked, and restricted to title words.
    if(q.every(function(w){return resourceWords.indexOf(w)>=0 || joined.some(function(x){return w.length>=5 && distance(w,x)<=1;});})) return {score:25,reason:'Close title — check spelling'};
    return {score:0,reason:''};
  }
  function workKey(e) {
    if(e.workId || e.work_id) return e.workId || e.work_id;
    return normalize(e.title)+'|'+normalize(e.author);
  }
  var textFormats=['holt-worktext','pearson-notebook','mcdougal-littell','full-book','openstax-book','ck12-book','textbook','anthology','clean-text','gutenberg-text','primary-source','french-text'];
  function materialMatches(format,kind) {
    if(kind==='anthology') return textFormats.indexOf(format)>=0;
    if(kind==='practice') return ['holt-worktext','pearson-notebook','mcdougal-littell','worksheet'].indexOf(format)>=0;
    if(kind==='assessment' && format==='assessment-guide') return true;
    return false;
  }
  return {normalize:normalize,match:match,workKey:workKey,materialMatches:materialMatches,distance:distance,fileTypes:fileTypes,fileMatches:fileMatches};
});
