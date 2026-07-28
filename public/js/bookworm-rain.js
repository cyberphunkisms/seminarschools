(function () {
  'use strict';

  var canvas = document.getElementById('rain-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  var color = canvas.dataset.rainColor || '#ff3ee0';
  var fade = canvas.dataset.rainFade || 'rgba(8,7,13,0.06)';
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var width = 0;
  var height = 0;
  var drops = [];
  var animationFrame = 0;
  var resizeFrame = 0;
  var previousDraw = 0;
  var running = false;

  function resize() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    var columns = Math.ceil(width / 16);
    drops = [];
    for (var index = 0; index < columns; index += 1) drops[index] = Math.random() * height;
  }

  function draw() {
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.font = '14px monospace';
    for (var index = 0; index < drops.length; index += 1) {
      var character = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(character, index * 16, drops[index]);
      drops[index] += 16;
      if (drops[index] > height && Math.random() > 0.975) drops[index] = 0;
    }
  }

  function tick(timestamp) {
    if (!running) return;
    if (timestamp - previousDraw >= 80) {
      previousDraw = timestamp;
      draw();
    }
    animationFrame = window.requestAnimationFrame(tick);
  }

  function motionAllowed() {
    return document.documentElement.dataset.motion !== 'calm' && !(motionQuery && motionQuery.matches);
  }

  function stop() {
    running = false;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function sync() {
    if (!motionAllowed() || document.hidden) {
      stop();
      return;
    }
    if (!running) {
      running = true;
      previousDraw = 0;
      animationFrame = window.requestAnimationFrame(tick);
    }
  }

  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(function () {
      resizeFrame = 0;
      resize();
    });
  }

  resize();
  sync();
  window.addEventListener('resize', scheduleResize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('pagehide', stop);
  if (motionQuery) {
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', sync);
    else if (motionQuery.addListener) motionQuery.addListener(sync);
  }
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion']
  });
})();
