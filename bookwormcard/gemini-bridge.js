/* gemini-bridge.js
 * Client-side wrapper for /api/gemini-chat Netlify Function.
 * Each call has a hard timeout (3s). On any failure, returns null
 * so caller can fall through to static Reactions.
 */

(function(global){
  'use strict';

  var ENDPOINT = '/api/gemini-chat';
  var TIMEOUT_MS = 6000; // 6s — covers cold-start latency on Netlify Functions
  var MAX_FAILURES_BEFORE_GIVING_UP = 5;
  var failureCount = 0;
  var givenUp = false;

  function callGemini(mode, prompt){
    if(givenUp) {
      console.log('[GeminiBridge] givenUp — using static fallback');
      return Promise.resolve(null);
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, TIMEOUT_MS);

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode, prompt: prompt }),
      signal: controller.signal
    }).then(function(resp){
      clearTimeout(timeoutId);
      if(!resp.ok){
        console.warn('[GeminiBridge] HTTP', resp.status, 'from', ENDPOINT);
        throw new Error('http-' + resp.status);
      }
      return resp.json();
    }).then(function(json){
      if(!json.ok || !json.text){
        console.warn('[GeminiBridge] no text returned. reason:', json.reason || 'unknown', 'mode:', mode);
        failureCount++;
        if(failureCount >= MAX_FAILURES_BEFORE_GIVING_UP) {
          givenUp = true;
          console.error('[GeminiBridge] Giving up after', MAX_FAILURES_BEFORE_GIVING_UP, 'failures. Static fallback for rest of session.');
        }
        return null;
      }
      // Reset failure count on success
      failureCount = 0;
      console.log('[GeminiBridge] success. mode:', mode, 'text:', json.text.slice(0, 60));
      return json.text;
    }).catch(function(err){
      clearTimeout(timeoutId);
      console.warn('[GeminiBridge] exception:', err.message || err);
      failureCount++;
      if(failureCount >= MAX_FAILURES_BEFORE_GIVING_UP) {
        givenUp = true;
        console.error('[GeminiBridge] Giving up after', MAX_FAILURES_BEFORE_GIVING_UP, 'failures.');
      }
      return null;
    });
  }

  // Generate an async reaction. Returns null if API unavailable.
  function getReactionAsync(field, userInput, context){
    if(!userInput || typeof userInput !== 'string') return Promise.resolve(null);
    var prompt = 'Field being answered: ' + field + '\n';
    if(context) prompt += 'Context: ' + context + '\n';
    prompt += 'User answered: "' + userInput.slice(0, 1500) + '"\n';
    prompt += 'Generate one warm Morpheus-style line acknowledging this specifically.';
    return callGemini('reaction', prompt);
  }

  // Generate an async "why does this matter" explanation
  function getWhyAsync(field, context){
    var prompt = 'Field: ' + field + '\n';
    if(context) prompt += 'Context: ' + context + '\n';
    prompt += 'Explain why this question matters for self-character-construction.';
    return callGemini('why', prompt);
  }

  // Generate an async stat-name from a substantive answer
  function getStatAsync(userInput, context){
    if(!userInput || typeof userInput !== 'string' || userInput.length < 15) return Promise.resolve(null);
    var prompt = '';
    if(context) prompt += 'Context: ' + context + '\n';
    prompt += 'User answered: "' + userInput.slice(0, 1000) + '"\n';
    prompt += 'Output a single uppercase stat-name that this answer demonstrates.';
    return callGemini('stat-eval', prompt);
  }

  // Generate a Morpheus reply to off-script user input (questions, rambles, pushback)
  function getMorpheusAsync(userInput, currentQuestion){
    if(!userInput || typeof userInput !== 'string') return Promise.resolve(null);
    var prompt = 'Current question being asked: ' + currentQuestion + '\n';
    prompt += 'User said off-script: "' + userInput.slice(0, 1500) + '"\n';
    prompt += 'Respond warmly and redirect to the question.';
    return callGemini('morpheus', prompt);
  }

  // ============================================================
  // AUGMENT-STATS — depth-grading pass. Sends the player input plus
  // the regex hits to Gemini; receives ADD (registers the regex
  // missed) and REMOVE (false positives caught by accident). The
  // taxonomy lives in the system prompt at the function backend, so
  // the bridge sends only the runtime payload. Cached in
  // localStorage on (input, regex-hits) so repeating the form
  // does not re-burn tokens. Returns {add:[...], remove:[...]} or
  // null on any failure (caller should treat null as "no augment,
  // ship regex hits as is").
  // ============================================================
  var AUGMENT_CACHE_PREFIX = 'bb-augment:';
  var AUGMENT_CACHE_MAX_ENTRIES = 60;
  var AUGMENT_CACHE_KEY_INDEX = 'bb-augment-index';

  function djb2(str){
    // Stable hash for cache keys. Compact, deterministic, no deps.
    var h = 5381;
    for(var i=0;i<str.length;i++){ h = ((h<<5)+h+str.charCodeAt(i))|0; }
    return (h >>> 0).toString(36);
  }

  function cacheKeyFor(input, regexHits){
    var hitsKey = (regexHits || [])
      .map(function(h){ return (h.stat || h.quirk) + ':' + (h.weight || 1); })
      .sort()
      .join(',');
    return AUGMENT_CACHE_PREFIX + djb2(input + '||' + hitsKey);
  }

  function readAugmentCache(key){
    try {
      var raw = localStorage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(_){ return null; }
  }

  function writeAugmentCache(key, value){
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Maintain a FIFO index so the cache cannot grow unbounded
      // across many sessions. When the index exceeds MAX, evict the
      // oldest entries.
      var idxRaw = localStorage.getItem(AUGMENT_CACHE_KEY_INDEX);
      var idx = idxRaw ? JSON.parse(idxRaw) : [];
      // Move-to-back semantics: dedupe before appending.
      idx = idx.filter(function(k){ return k !== key; });
      idx.push(key);
      while(idx.length > AUGMENT_CACHE_MAX_ENTRIES){
        var evict = idx.shift();
        localStorage.removeItem(evict);
      }
      localStorage.setItem(AUGMENT_CACHE_KEY_INDEX, JSON.stringify(idx));
    } catch(_){ /* quota exceeded — silently drop */ }
  }

  function tryParseAugmentJson(text){
    if(!text) return null;
    // Strip markdown code-fences if Gemini wraps despite instruction.
    var cleaned = text.replace(/```(?:json)?\s*/g,'').replace(/```/g,'').trim();
    try {
      var parsed = JSON.parse(cleaned);
      if(typeof parsed !== 'object' || parsed === null) return null;
      var add = Array.isArray(parsed.add) ? parsed.add : [];
      var remove = Array.isArray(parsed.remove) ? parsed.remove : [];
      // Defensive normalization: stat names uppercased, weights bounded
      add = add.filter(function(a){ return a && typeof a.stat === 'string'; })
               .map(function(a){
                 var w = parseInt(a.weight, 10);
                 if(!w || w < 1) w = 2;
                 if(w > 3) w = 3;
                 return { stat: a.stat.toUpperCase().replace(/[^A-Z_\-]/g,''),
                          weight: w,
                          reason: typeof a.reason === 'string' ? a.reason.slice(0,140) : '' };
               })
               .filter(function(a){ return a.stat.length >= 4 && a.stat.length <= 30; });
      remove = remove.filter(function(s){ return typeof s === 'string'; })
                     .map(function(s){ return s.toUpperCase().replace(/[^A-Z_\-]/g,''); })
                     .filter(function(s){ return s.length >= 4 && s.length <= 30; });
      // Cap to prevent runaway adds/removes from a hallucinating model
      if(add.length > 8) add = add.slice(0, 8);
      if(remove.length > 8) remove = remove.slice(0, 8);
      return { add: add, remove: remove };
    } catch(_){ return null; }
  }

  function augmentStatsAsync(input, regexHits, ageRange){
    if(!input || typeof input !== 'string' || input.length < 30){
      // Below 30 chars there is rarely enough material for the
      // depth pass to work with. The regex layer suffices.
      return Promise.resolve(null);
    }
    var key = cacheKeyFor(input, regexHits);
    var cached = readAugmentCache(key);
    if(cached){
      console.log('[GeminiBridge] augment cache hit');
      return Promise.resolve(cached);
    }
    var hitsLine = (regexHits || []).map(function(h){
      return (h.stat || h.quirk) + ' +' + (h.weight || 1);
    }).join(', ') || '(none)';
    var prompt =
      'WHAT THE PERSON WROTE\n=====================\n"""\n' +
      input.slice(0, 2000) +
      '\n"""\n\n' +
      'WHAT THE FIRST READER CAUGHT\n============================\n' +
      hitsLine +
      (ageRange ? ('\n\nage range of writer: ' + ageRange) : '');
    return callGemini('augment-stats', prompt).then(function(text){
      var parsed = tryParseAugmentJson(text);
      if(parsed){
        writeAugmentCache(key, parsed);
      }
      return parsed;
    });
  }

  function isAvailable(){
    return !givenUp;
  }

  function getStatus(){
    if(givenUp) return 'offline (using static)';
    if(failureCount > 0) return 'unstable (' + failureCount + ' failures)';
    return 'online';
  }

  function disable(){
    givenUp = true;
  }

  global.GeminiBridge = {
    getReactionAsync: getReactionAsync,
    getWhyAsync: getWhyAsync,
    getStatAsync: getStatAsync,
    getMorpheusAsync: getMorpheusAsync,
    augmentStatsAsync: augmentStatsAsync,
    isAvailable: isAvailable,
    getStatus: getStatus,
    disable: disable,
    // Exposed for tests
    _internal: {
      tryParseAugmentJson: tryParseAugmentJson,
      cacheKeyFor: cacheKeyFor
    }
  };

})(typeof window !== 'undefined' ? window : this);
