/* txt-tools.js — copy + download buttons for * file pages */
(function(){
  var path = document.currentScript && document.currentScript.dataset.txt;
  if(!path) return;

  var bar = document.createElement('div');
  bar.className = 'txt-tools';
  bar.innerHTML =
    '<button class="txt-btn txt-copy" title="Copy TXT to clipboard">Copy TXT</button>' +
    '<a class="txt-btn txt-dl" href="' + path + '" download title="Download TXT file">Download TXT</a>';

  var css = document.createElement('style');
  css.textContent =
    '.txt-tools{display:flex;gap:8px;margin-top:12px}' +
    '.txt-btn{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.5px;' +
    'text-transform:uppercase;padding:6px 14px;border:1px solid var(--brd2);' +
    'background:var(--bg1);color:var(--dim);cursor:pointer;text-decoration:none;' +
    'transition:.15s;border-radius:3px}' +
    '.txt-btn:hover{color:var(--fire);border-color:var(--fire)}' +
    '.txt-btn.copied{color:var(--method);border-color:var(--method)}';
  document.head.appendChild(css);

  var header = document.querySelector('header');
  if(header) header.appendChild(bar);
  else document.body.prepend(bar);

  bar.querySelector('.txt-copy').addEventListener('click', function(){
    var btn = this;
    fetch(path)
      .then(function(r){ return r.text(); })
      .then(function(t){
        return navigator.clipboard.writeText(t);
      })
      .then(function(){
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function(){ btn.textContent = 'Copy TXT'; btn.classList.remove('copied'); }, 2000);
      })
      .catch(function(){
        btn.textContent = 'Failed';
        setTimeout(function(){ btn.textContent = 'Copy TXT'; }, 2000);
      });
  });
})();
