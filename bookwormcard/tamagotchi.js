/* tamagotchi.js
 * CSS-pixel emoji creature for bookwormburrows.
 *
 * Public API (window.Tamagotchi):
 *   init(containerId)                — mount the box into a DOM element
 *   updateState({xp, hp, tier, level}) — re-render bars + creature for current state
 *   reactToTyping()                  — call on each keystroke for idle bounce
 *   reactToStatHit(stats)            — call when stats fired, shows reaction bubble
 *   reactToHpDamage(quirks)          — call when HP took damage, shows sad-face bubble
 *   reactToTierUp(newTier, oldTier)  — play tier transition
 *   sleep()                          — manual put-to-sleep (idle 60s+ also triggers)
 *   wake()                           — wake from sleep
 *
 * Visual behavior contract (animation budget B):
 *   - Idle: gentle bounce/wiggle on a 1.6s cycle
 *   - Typing: bounce switches to active rhythm
 *   - Cursor near box: looks toward cursor
 *   - Stat hit: reaction-emoji bubble appears near creature for 1.5s
 *   - HP damage: 😖 bubble + creature dims briefly
 *   - 60s no input: creature sleeps (Z bubble), wakes on next input
 *   - Tier up: creature does a small bounce-cinematic in the box
 */
(function(global){
  'use strict';

  // ============================================================
  // CREATURE EMOJI MAP
  // The creature shown depends on tier + the chosen animal (for animal-stage).
  // ============================================================
  var TIER_EMOJI = {
    worm:     '🪱',
    silkworm: '🐛',
    cocoon:   '🥚',
    animal:   null  // resolved from data.animal at runtime
  };

  // Animal emoji ladder — fall back through phylum/class/order labels from
  // animal-taxonomy.js if available. Otherwise default to silkworm-mature 🦋.
  function resolveAnimalEmoji(animalName){
    if(!animalName) return '🦋';
    var name = String(animalName).toLowerCase();
    // Authoritative path — exact slug lookup against the global map maintained
    // in bb/index.html. This is the single source of truth for sprite mapping.
    if(global.ANIMAL_EMOJI && global.ANIMAL_EMOJI[name]){
      return global.ANIMAL_EMOJI[name];
    }
    // Legacy fallback — substring map for free-form animal names that don't
    // exist in the canonical slug list. Kept for backward compatibility but
    // should rarely fire now.
    var DIRECT = {
      'fennec fox':'🦊', 'fox':'🦊', 'red fox':'🦊', 'desert fox':'🦊',
      'burrowing owl':'🦉', 'owl':'🦉',
      'rabbit':'🐰', 'hare':'🐰', 'jackrabbit':'🐰',
      'badger':'🦡', 'honey badger':'🦡',
      'mole':'🐭', 'naked mole rat':'🐭', 'mole rat':'🐭',
      'meerkat':'🐾', 'mongoose':'🐾',
      'wombat':'🐨', 'koala':'🐨',
      'gopher':'🐹', 'hamster':'🐹', 'chipmunk':'🐿️', 'squirrel':'🐿️',
      'beaver':'🦫', 'capybara':'🦫',
      'prairie dog':'🐹', 'groundhog':'🐹', 'marmot':'🐹',
      'aardvark':'🦔', 'pangolin':'🦔', 'hedgehog':'🦔', 'porcupine':'🦔',
      'earthworm':'🪱', 'worm':'🪱', 'nightcrawler':'🪱',
      'snake':'🐍', 'cobra':'🐍', 'python':'🐍', 'viper':'🐍',
      'lizard':'🦎', 'gecko':'🦎', 'salamander':'🦎',
      'frog':'🐸', 'toad':'🐸',
      'crab':'🦀', 'crayfish':'🦞', 'lobster':'🦞',
      'spider':'🕷️', 'tarantula':'🕷️', 'scorpion':'🦂',
      'ant':'🐜', 'termite':'🐜',
      'bee':'🐝', 'wasp':'🐝',
      'butterfly':'🦋', 'moth':'🦋',
      'beetle':'🪲', 'ladybug':'🐞',
      'cricket':'🦗', 'grasshopper':'🦗',
      'centipede':'🐛', 'millipede':'🐛',
      'octopus':'🐙', 'squid':'🦑',
      'turtle':'🐢', 'tortoise':'🐢',
      'rat':'🐀', 'mouse':'🐭',
      'duck':'🦆', 'goose':'🦢',
      'penguin':'🐧',
      'platypus':'🦫'
    };
    for(var key in DIRECT){
      if(name.indexOf(key) !== -1) return DIRECT[key];
    }
    return '🦋';  // metamorphosis default
  }

  // ============================================================
  // STATE
  // ============================================================
  var container = null;
  var state = {
    xp: 0, hp: 100, tier: 'worm', level: 0, animal: '', stats: {}, quirks: {}
  };
  var lastInputAt = Date.now();
  var sleeping = false;
  var bubbleTimer = null;
  var feedingStatusTimer = null;
  var cursorOffsetX = 0;  // -1 to 1, where the cursor is relative to box center
  var cursorOffsetY = 0;
  var idleCheckInterval = null;

  // ============================================================
  // BUILD DOM — call init() once
  // ============================================================
  function init(containerId){
    container = document.getElementById(containerId);
    if(!container) return false;

    // Inject CSS once
    if(!document.getElementById('tamagotchi-style')){
      var style = document.createElement('style');
      style.id = 'tamagotchi-style';
      style.textContent = TAMAGOTCHI_CSS;
      document.head.appendChild(style);
    }

    container.innerHTML = TAMAGOTCHI_HTML;

    // Attach listeners. Cursor tracking only — the typing/feeding
    // reaction is no longer driven by per-keystroke events. Feeding
    // fires once per Enter via the external Tamagotchi.reactToFeed call.
    document.addEventListener('mousemove', handleMouseMove);

    // Idle check tick
    if(idleCheckInterval) clearInterval(idleCheckInterval);
    idleCheckInterval = setInterval(checkIdle, 5000);

    render();
    return true;
  }

  function destroy(){
    document.removeEventListener('mousemove', handleMouseMove);
    if(idleCheckInterval) clearInterval(idleCheckInterval);
    container = null;
  }

  // ============================================================
  // STATE UPDATE — called from outside whenever data.xp/hp/tier change
  // ============================================================
  function updateState(s){
    var prevTier = state.tier;
    if(s.xp != null) state.xp = s.xp;
    if(s.hp != null) state.hp = s.hp;
    if(s.tier) state.tier = s.tier;
    if(s.level != null) state.level = s.level;
    // For animal: allow explicit null/undefined to clear (used by the
    // animal-cycle picker when the player scrolls back to the worm position).
    if('animal' in s) state.animal = s.animal || null;
    // Stats — the running per-trait accumulation from awardStats.
    // Drives the accessory layer that individualises the creature
    // visually (sunglasses for edge clusters, crown for grandiose
    // clusters, sparkles for wonder, rain for melancholy, and so on).
    if(s.stats) state.stats = s.stats;
    // Quirks — accumulated negative markers (PLATITUDE_PRONE,
    // VAGUE_PRONE, DISENGAGED, LOW_CONTENT). Each lives in a
    // dedicated bottom-left slot so it never displaces the player's
    // earned positive accessories. Both layers coexist on screen.
    if(s.quirks) state.quirks = s.quirks;
    render();
    if(prevTier !== state.tier){
      reactToTierUp(state.tier, prevTier);
    }
  }

  // ============================================================
  // ACCESSORY LAYER — visual individualisation from trait clusters.
  //
  // The character profile from `data.stats` is a quantitative shape
  // — COMMUNAL: 7, IRREDUCIBLE: 9, MELANCHOLIC: 5, and so on across
  // up to 183 axes. The accessory layer maps named trait clusters
  // onto emoji sprites that orbit the creature. Cluster weight is
  // the sum of constituent stat scores; weight gates appearance,
  // and weight beyond the gate scales size and opacity.
  //
  // Slots are six fixed positions around the creature so accessories
  // do not stack on each other: top-centre, top-left, top-right,
  // left, right, bottom-right. One accessory per slot maximum. When
  // multiple rules compete for the same slot the highest-weight rule
  // wins so the creature stays legible as it accumulates traits.
  //
  // The mood filter is screen-level: a single dominant affect
  // cluster recolours the whole CRT box so a melancholic character
  // reads cool blue, a rageful one reads hot red, an enchanted one
  // glows. The filter is layered on the screen, not the creature,
  // so it tints the world the creature lives in rather than the
  // creature itself.
  // ============================================================
  var ACCESSORY_RULES = [
    // ── slot: top (headwear) ────────────────────────────────────
    { id:'crown',     emoji:'👑', slot:'top',         min:5,
      traits:['BOMBASTIC','GRANDIOSE','NARCISSISTIC','CONVICTED','HUMBLEBRAGGY','PROUD','MAXIMALIST','HYPERBOLIC'] },
    { id:'mortarboard', emoji:'🎓', slot:'top',       min:5,
      traits:['INSTITUTIONAL','BOOKISH','EXPERT','SPECIALIST','TRADITIONALIST','APPRENTICE-LIKE','STUDENT-LIKE','MENTORING','GENERALIST'] },
    { id:'cap',       emoji:'🧢', slot:'top',         min:5,
      traits:['STREET-SMART','ECCENTRIC','BLUNT','INSURGENT','ICONOCLASTIC','WRY','OBSERVATIONAL'] },
    { id:'tophat',    emoji:'🎩', slot:'top',         min:5,
      traits:['BAROQUE','DECADENT','CLASSICAL','ROMANTIC','COSMOPOLITAN','INDULGENT','FASCINATED','LIGHT'] },
    { id:'halo',      emoji:'😇', slot:'top',         min:5,
      traits:['HUMBLE','MODEST','SELF-EFFACING','MERCIFUL','TENDER','FORGIVING','COMPOSED','CONTENT','GRATEFUL','GENEROUS','HONEST','OPEN','TRUSTING','LENIENT','DEFERENTIAL','CONFORMIST'] },

    // ── slot: face (over the eyes) ──────────────────────────────
    { id:'shades',    emoji:'🕶️', slot:'face',        min:4,
      traits:['BLEAK','EDGY','CYNICAL','DEADPAN','POKER-FACED','NIHILIST','GALLOWS-HUMORED','MORBID','WITHDRAWING','NUMB','BORED','UNDERSTATED','LOOK-AWAY-PRONE'] },
    { id:'glasses',   emoji:'🤓', slot:'face',        min:5,
      traits:['META-AWARE','SYSTEMS-MINDED','PATTERN-SEEING','DIALECTICAL','PHENOMENOLOGICAL','BOOKISH','ANALOGICAL','OBSERVATIONAL','INTUITIVE','DILETTANTE','SENSORY'] },

    // ── slot: top-left (weather) ────────────────────────────────
    { id:'sparkles',  emoji:'✨', slot:'top-left',    min:4,
      traits:['WONDROUS','ENCHANTED','DELIGHTED','JOYFUL','ECSTATIC','NAIVE','CHILDLIKE','FASCINATED','ANTICIPATING','TRUSTING'] },
    { id:'rain',      emoji:'🌧️', slot:'top-left',    min:4,
      traits:['MELANCHOLIC','GRIEVING','LONGING','NOSTALGIC','BLEAK','ASHAMED','DREADING','TERRIFIED','NUMB'] },
    { id:'fire',      emoji:'🔥', slot:'top-left',    min:4,
      traits:['ANGRY','RAGEFUL','DEFIANT','RECKLESS','APPETITIVE','TRANSGRESSIVE','HYPERBOLIC','SHAMELESS','IMPATIENT','ENVIOUS'] },
    { id:'sun',       emoji:'☀️', slot:'top-left',    min:5,
      traits:['JOYFUL','ECSTATIC','DELIGHTED','HOPEFUL','OPTIMISTIC','PEACEFUL','CONTENT','GRATEFUL'] },
    { id:'moon',      emoji:'🌙', slot:'top-left',    min:5,
      traits:['MELANCHOLIC','LONGING','NOSTALGIC','GRIEVING','DETACHED','OBLIQUE','WITHDRAWING'] },

    // ── slot: top-right (companion or thought) ──────────────────
    { id:'thought',   emoji:'💭', slot:'top-right',   min:5,
      traits:['IRREDUCIBLE','META-AWARE','PATTERN-SEEING','DIALECTICAL','NEGATIVELY-CAPABLE','COUNTERFACTUAL','ANALOGICAL','SELF-CRITICAL','DOUBTING','QUESTION-PRONE'] },
    { id:'heart',     emoji:'💗', slot:'top-right',   min:5,
      traits:['TENDER','CARETAKING','HOSPITABLE','LOYAL','DEVOTED','SINCERE','EARNEST','HOPEFUL','GENEROUS','KIN-BOUND','FORGIVING','OPEN','COMMUNAL','TRUSTING'] },
    { id:'skull',     emoji:'💀', slot:'top-right',   min:4,
      traits:['MORBID','NIHILIST','BLEAK','GALLOWS-HUMORED','TRANSGRESSIVE','GOTHIC','DREADING','TERRIFIED','GRAVE'] },
    { id:'mask',      emoji:'🎭', slot:'top-right',   min:5,
      traits:['IRONIC','PUNNING','ABSURDIST','SLAPSTICK','MOCKING','SURREAL','WHIMSICAL','SELF-DEPRECATING','DARK-PLAYFUL','DECEPTIVE','WRY'] },
    { id:'mirror',    emoji:'🪞', slot:'top-right',   min:5,
      traits:['SELF-CRITICAL','ASHAMED','DOUBTING','ANALOGICAL','IMAGE-MAKING'] },

    // ── slot: right (what they carry) ───────────────────────────
    { id:'sword',     emoji:'🗡️', slot:'right',       min:5,
      traits:['DESTROYING','PREDATORY','SEVERE','VENGEFUL-MEMORIED','RECKLESS','COURAGEOUS','CALCULATING','CALL-OUT-PRONE','SCORE-KEEPING'] },
    { id:'shield',    emoji:'🛡️', slot:'right',       min:5,
      traits:['PROTECTING','ENDURING','LOYAL','GUARDED','PRUDENT','CAUTIOUS','JUST','KIN-BOUND','WITHDRAWING'] },
    { id:'book',      emoji:'📚', slot:'right',       min:5,
      traits:['BOOKISH','EXPERT','SPECIALIST','GENEALOGICAL','TRADITIONALIST','PHENOMENOLOGICAL','APHORISTIC','GENERALIST','VARIED-VOCAB','COMPLETE-SENTENCED'] },
    { id:'tools',     emoji:'🔧', slot:'right',       min:5,
      traits:['BUILDING','CULTIVATING','CRAFT-WISE','UTILITARIAN','EMPIRICIST','DISCIPLINED','STRUCTURED','SPECIFIC','CONCRETE','IMAGE-MAKING'] },
    { id:'flag',      emoji:'🏴', slot:'right',       min:5,
      traits:['INSURGENT','DEFIANT','ICONOCLASTIC','CONTRARIAN','TRANSGRESSIVE','TABOO-DRAWN'] },
    { id:'mic',       emoji:'🎤', slot:'right',       min:5,
      traits:['CONFESSIONAL','OVERSHARING','BOMBASTIC','LYRICAL','RAMBLING','ENGAGED','DECLARATIVE','HYPERBOLIC','PROUD','PUNCTUATING','QUESTION-PRONE'] },

    // ── slot: left (environmental marker) ───────────────────────
    { id:'flowers',   emoji:'🌸', slot:'left',        min:5,
      traits:['PASTORAL','PROVINCIAL','ROMANTIC','TENDER','HOSPITABLE','PEACEFUL','LIGHT'] },
    { id:'cityscape', emoji:'🏙️', slot:'left',        min:5,
      traits:['URBAN','COSMOPOLITAN','FUTURIST','ENGAGED','GREGARIOUS','MAXIMALIST'] },
    { id:'wheat',     emoji:'🌾', slot:'left',        min:5,
      traits:['PASTORAL','ASCETIC','ENDURING','PATIENT','GENEALOGICAL','PROVINCIAL','UNDERSTATED','COMPRESSED','MINIMALIST','COMPOSED'] },
    { id:'cards',     emoji:'🃏', slot:'left',        min:5,
      traits:['PUNNING','ABSURDIST','SLAPSTICK','SURREAL','NONSENSICAL','WHIMSICAL','DARK-PLAYFUL','SHAMELESS'] },
    { id:'wolf',      emoji:'🐺', slot:'left',        min:5,
      traits:['LONERIST','WITHDRAWING','GUARDED','ECCENTRIC','DETACHED'] },

    // ── slot: bottom-right (ground decoration) ──────────────────
    { id:'rose',      emoji:'🌹', slot:'bottom-right', min:5,
      traits:['ROMANTIC','LYRICAL','LONGING','BAROQUE','CONFESSIONAL','INDULGENT','LIGHT'] },
    { id:'compass',   emoji:'🧭', slot:'bottom-right', min:5,
      traits:['CURIOUS','PURSUING','INVESTIGATIVE','MORALLY-CLEAR','STRICT-CODED','INTUITIVE','OBSERVATIONAL'] },
    { id:'spiral',    emoji:'🌀', slot:'bottom-right', min:5,
      traits:['ENTANGLED','ESCAPING','OBLIQUE','SURREAL','CONTRARIAN','MORALLY-AMBIGUOUS','SITUATIONAL','DISLOYAL'] },
    { id:'backpack',  emoji:'🎒', slot:'bottom-right', min:5,
      traits:['STUDENT-LIKE','APPRENTICE-LIKE','CURIOUS','GENERALIST'] },

    // ── slot: bottom-left (negative quirks) ─────────────────────
    // The four negative quirks live in a dedicated slot so they
    // never displace the positive trait accessories. Each is its
    // own rule because the quirks don't naturally cluster — each
    // marks a distinct failure mode of the answer-writing.
    { id:'fly',       emoji:'🪰', slot:'bottom-left', min:2, source:'quirks',
      traits:['PLATITUDE_PRONE'] },
    { id:'fog',       emoji:'🌫️', slot:'bottom-left', min:2, source:'quirks',
      traits:['VAGUE_PRONE'] },
    { id:'zzz',       emoji:'💤', slot:'bottom-left', min:2, source:'quirks',
      traits:['DISENGAGED'] },
    { id:'hollow',    emoji:'🫥', slot:'bottom-left', min:2, source:'quirks',
      traits:['LOW_CONTENT'] },
    { id:'tv',        emoji:'📺', slot:'bottom-left', min:2, source:'quirks',
      traits:['PERFORMATIVE_PRONE'] },
    { id:'barrier',   emoji:'🚧', slot:'bottom-left', min:2, source:'quirks',
      traits:['DEFENSIVE_PRONE'] },

    // ── AXIS EXPANSION — characteristics added in the audit pass ──
    // Time-orientation, embodiment, dialogical capacity, place-
    // plurality, stance binary, and two aesthetic registers. Rules
    // are slotted to overlay the existing layout without crowding
    // any single slot. New rules can outweigh existing rules in
    // their slot when the new cluster genuinely dominates.

    // Temporality — joins weather/time (top-left) where the
    // hourglass and sunset semantically belong. The earlier
    // placement in top-right created a nine-rule pile-up in the
    // thought slot that punished the player on cluster competition.
    { id:'hourglass', emoji:'⏳', slot:'top-left', min:5,
      traits:['ANACHRONIC'] },
    { id:'sunset',    emoji:'🌅', slot:'top-left', min:5,
      traits:['ESCHATOLOGICAL'] },

    // Embodiment — split across face (somatic anchoring readable on
    // creature face) and top-right (abstraction is a thought-mode).
    { id:'meditator', emoji:'🧘', slot:'face',       min:5,
      traits:['EMBODIED'] },
    { id:'ghost',     emoji:'👻', slot:'top-right',  min:5,
      traits:['DISEMBODIED'] },

    // Dialogical capacity — top-right joins the cognitive cluster.
    // MEPHISTOPHELEAN goes in top because it is a stance the
    // character wears like a hat, not a thought they have.
    { id:'speech',    emoji:'💬', slot:'top-right',  min:5,
      traits:['DIALOGICAL'] },
    { id:'devil',     emoji:'😈', slot:'top',        min:5,
      traits:['MEPHISTOPHELEAN'] },

    // Place-plurality — left and bottom-right split. DIASPORIC
    // belongs with environmental markers (left); ROOTED to ground
    // (bottom-right) since rootedness is a literal ground-position.
    // This also relieves the nine-rule pile-up in the left slot.
    { id:'globe',     emoji:'🌍', slot:'left',         min:5,
      traits:['DIASPORIC'] },
    { id:'tree',      emoji:'🌳', slot:'bottom-right', min:5,
      traits:['ROOTED'] },

    // Stance binary — right slot, what they carry.
    { id:'scales',    emoji:'⚖️', slot:'right',      min:5,
      traits:['PRINCIPLED'] },
    { id:'handshake', emoji:'🤝', slot:'right',      min:5,
      traits:['PRAGMATIC'] },

    // Aesthetic expansion — left slot, environmental.
    { id:'sapling',   emoji:'🌿', slot:'left',       min:5,
      traits:['SOLARPUNK'] },
    { id:'brick',     emoji:'🧱', slot:'left',       min:5,
      traits:['BRUTALIST'] }
  ];

  // Mood filters — one wins, applied to the whole CRT box. Order
  // matters: the rule with the highest cluster weight wins. The
  // filter is mild so the creature and accessories remain legible.
  var MOOD_FILTERS = [
    // Mood is now a backdrop tint, not a CSS filter. The earlier
    // filter approach hue-rotated the entire screen including the
    // accessories — green wheat got rotated red on rage, purple on
    // edge. Tints sit behind the creature/accessory layer instead,
    // so the room turns red when the character is enraged but the
    // wheat icon stays its actual colour.
    { id:'rage',       min:6, tint:'rgba(255, 80, 60, 0.18)',
      traits:['ANGRY','RAGEFUL','DEFIANT','TRANSGRESSIVE','RECKLESS'] },
    { id:'melancholy', min:6, tint:'rgba(80, 110, 200, 0.22)',
      traits:['MELANCHOLIC','GRIEVING','LONGING','NOSTALGIC'] },
    { id:'edge',       min:6, tint:'rgba(150, 100, 200, 0.18)',
      traits:['NIHILIST','BLEAK','MORBID','GOTHIC','CYNICAL','GALLOWS-HUMORED'] },
    { id:'wonder',     min:6, tint:'rgba(255, 220, 100, 0.20)',
      traits:['WONDROUS','ENCHANTED','JOYFUL','ECSTATIC','DELIGHTED','NAIVE'] },
    { id:'tender',     min:6, tint:'rgba(255, 180, 140, 0.18)',
      traits:['TENDER','CARETAKING','HOSPITABLE','MERCIFUL','HUMBLE'] }
  ];

  function clusterWeight(rule, stats, quirks){
    var src = (rule.source === 'quirks') ? quirks : stats;
    if(!src) return 0;
    var traits = rule.traits || [];
    var total = 0;
    for(var i=0;i<traits.length;i++){
      total += (src[traits[i]] || 0);
    }
    return total;
  }

  function pickWinnerPerSlot(stats, quirks){
    // For each accessory rule, claim the slot. Returns three buckets:
    // confident winners (at or above threshold) and ghosts (within
    // 2 weight of threshold). Ghosts let the player see a register
    // brewing before it crosses the cliff — a +4 cluster at min:5
    // shows a faint hint of what is coming, instead of nothing.
    var confidentBySlot = {};
    var ghostBySlot = {};
    ACCESSORY_RULES.forEach(function(rule){
      var src = (rule.source === 'quirks') ? quirks : stats;
      var w = clusterWeight(rule, stats, quirks);
      if(w <= 0) return;
      var topTrait = null, topW = 0;
      if(src){
        for(var i=0;i<rule.traits.length;i++){
          var v = src[rule.traits[i]] || 0;
          if(v > topW){ topW = v; topTrait = rule.traits[i]; }
        }
      }
      var entry = {
        rule: rule, weight: w,
        dominantTrait: topTrait,
        dominantWeight: topW,
        isSingleDominant: (topW >= 12) && (topW / Math.max(1,w) >= 0.6)
      };
      if(w >= rule.min){
        if(!confidentBySlot[rule.slot] || confidentBySlot[rule.slot].weight < w){
          confidentBySlot[rule.slot] = entry;
        }
      } else if(w >= rule.min - 2){
        // Brewing — close to threshold but not yet over. Only the
        // closest-to-threshold ghost survives per slot so the screen
        // does not fill with translucent half-accessories.
        var headroom = rule.min - w;
        if(!ghostBySlot[rule.slot] || ghostBySlot[rule.slot].headroom > headroom){
          entry.isGhost = true;
          entry.headroom = headroom;
          ghostBySlot[rule.slot] = entry;
        }
      }
    });
    var winners = [];
    for(var slot in confidentBySlot){ winners.push(confidentBySlot[slot]); }
    // Only render a ghost if the slot has no confident winner.
    // Confident accessory always claims the slot fully.
    for(var gslot in ghostBySlot){
      if(!confidentBySlot[gslot]) winners.push(ghostBySlot[gslot]);
    }
    return winners;
  }

  function pickMood(stats){
    var best = null;
    MOOD_FILTERS.forEach(function(rule){
      var w = clusterWeight(rule, stats, null);
      if(w < rule.min) return;
      if(!best || best.weight < w){
        best = { rule: rule, weight: w };
      }
    });
    return best;
  }

  function renderAccessories(stats, quirks){
    if(!container) return;
    var screenEl = container.querySelector('.tama-screen');
    if(!screenEl) return;
    // Wipe previous accessories. The layer is reconstructed from
    // scratch each render so accessories that fall under threshold
    // (hp damage erasing stats, or a reset) cleanly disappear.
    var existing = screenEl.querySelectorAll('.tama-accessory');
    for(var i=0;i<existing.length;i++){ existing[i].remove(); }

    var winners = pickWinnerPerSlot(stats, quirks);
    winners.forEach(function(w){
      var rule = w.rule;
      var headroom = w.weight - rule.min;
      var scale, opacity, isGhost = !!w.isGhost;
      if(isGhost){
        // Ghost — brewing below threshold. Tiny, translucent,
        // no animation. Player sees the register approaching.
        scale = 0.55;
        opacity = 0.22;
      } else if(headroom <= 25){
        scale = 1 + headroom * 0.04;
        opacity = Math.min(1, 0.7 + Math.min(headroom, 18) * 0.025);
      } else {
        scale = 2.0 + Math.log(headroom - 24) * 0.12;
        opacity = 1;
      }
      var el = document.createElement('span');
      var cls = 'tama-accessory tama-accessory-' + rule.slot;
      if(rule.source === 'quirks') cls += ' tama-accessory-quirk';
      if(isGhost) cls += ' tama-accessory-ghost';
      if(!isGhost && w.isSingleDominant) cls += ' tama-accessory-dominant';
      if(!isGhost && headroom >= 30) cls += ' tama-accessory-extreme';
      el.className = cls;
      el.textContent = rule.emoji;
      el.setAttribute('data-rule', rule.id);
      var titleParts;
      if(isGhost){
        titleParts = [rule.id + ' brewing — needs ' + w.headroom + ' more weight'];
      } else {
        titleParts = [rule.id + ' (cluster ' + w.weight + ')'];
        if(w.isSingleDominant && w.dominantTrait){
          titleParts.push('dominant: ' + w.dominantTrait + ' +' + w.dominantWeight);
        }
      }
      el.setAttribute('title', titleParts.join(' · '));
      el.style.transform = 'scale(' + scale.toFixed(2) + ')';
      el.style.opacity = opacity.toFixed(2);
      screenEl.appendChild(el);

      if(!isGhost && w.isSingleDominant && w.dominantTrait){
        var lbl = document.createElement('span');
        lbl.className = 'tama-accessory-label tama-accessory-label-' + rule.slot;
        lbl.textContent = w.dominantTrait.toLowerCase().replace(/_/g,' ');
        screenEl.appendChild(lbl);
      }
    });

    // Mood — apply as a backdrop tint behind the creature and
    // accessories, NOT as a screen-wide filter that hue-rotates
    // them. Backdrop is a single span that lives at z-index 0 of
    // the screen, the creature and accessories sit above it.
    var mood = pickMood(stats);
    var backdrop = screenEl.querySelector('.tama-mood-backdrop');
    if(!backdrop){
      backdrop = document.createElement('span');
      backdrop.className = 'tama-mood-backdrop';
      // Inserting first so it sits at the back of the stacking
      // context. The class itself sets z-index 0; everything else
      // in the screen has higher z-index by default.
      screenEl.insertBefore(backdrop, screenEl.firstChild);
    }
    if(mood){
      backdrop.style.background = mood.rule.tint;
      screenEl.setAttribute('data-mood', mood.rule.id);
    } else {
      backdrop.style.background = 'transparent';
      screenEl.removeAttribute('data-mood');
    }
    // Clear any leftover screen-level filter from the prior approach.
    screenEl.style.filter = '';
  }

  function render(){
    if(!container) return;
    var creatureEl = container.querySelector('.tama-creature');
    var xpFillEl = container.querySelector('.tama-xp-fill');
    var hpFillEl = container.querySelector('.tama-hp-fill');
    var xpNumEl  = container.querySelector('.tama-xp-num');
    var hpNumEl  = container.querySelector('.tama-hp-num');
    var statusEl = container.querySelector('.tama-status');
    var tierEl = container.querySelector('.tama-tier-label');

    if(creatureEl){
      // Picking the animal sets the destiny. The current sprite still
      // tracks the player's developmental stage. The chosen-animal sprite
      // takes over only at the final tier. Until then the player sees
      // the worm growing through silkworm and cocoon into the animal
      // they picked. Each Enter feeds the worm one step further.
      var emoji;
      if(state.tier === 'animal' && state.animal){
        emoji = resolveAnimalEmoji(state.animal);
      } else {
        emoji = TIER_EMOJI[state.tier] || '🪱';
      }
      creatureEl.textContent = emoji;
    }

    if(xpFillEl){
      var pct = 0;
      if(global.DepthEngine){
        pct = global.DepthEngine.normalizedBar(state.xp, state.tier) * 100;
      }
      xpFillEl.style.width = pct.toFixed(1) + '%';
    }
    if(xpNumEl){
      xpNumEl.textContent = state.xp;
    }
    if(hpFillEl){
      hpFillEl.style.width = state.hp + '%';
      // Color shifts as HP drops
      if(state.hp > 60)      hpFillEl.style.background = '#5fb96b';
      else if(state.hp > 30) hpFillEl.style.background = '#d6a83a';
      else                   hpFillEl.style.background = '#c44';
    }
    if(hpNumEl){
      hpNumEl.textContent = state.hp;
    }

    if(statusEl){
      var status = sleeping ? 'sleeping' : computeStatus();
      statusEl.textContent = status;
    }

    if(tierEl){
      // The tier label tracks the player's CURRENT developmental stage, not
      // the animal-destiny they picked. Per the bookwormburrows arc (bw-004):
      // character creation is Stage 1 (bookworm) for the entire flow. The
      // animal sprite shows the chosen destiny — what they will grow into —
      // while the label keeps reading "worm" because that's where they ARE.
      // Tier label only changes at the seal animation (which forecasts the
      // arc) and via explicit tier updates from DepthEngine progression.
      var label = state.tier;
      if(state.tier === 'animal' && state.level > 0) label = 'lvl ' + state.level;
      tierEl.textContent = label;
    }

    // Set HP-low body class for visual dimming
    container.classList.toggle('tama-hp-low', state.hp <= 30);
    container.classList.toggle('tama-hp-critical', state.hp <= 0);

    // Accessory layer — re-derive from current stats every render.
    // Cheap because the rule set is small and the dom rewrite per
    // tick is bounded by the slot count.
    renderAccessories(state.stats || {}, state.quirks || {});
  }

  function computeStatus(){
    if(state.hp <= 0) return 'fainted';
    if(state.hp <= 20) return 'damaged';
    if(state.tier === 'cocoon' && state.xp >= 80) return 'evolving';
    if(state.tier === 'animal') return 'awake';
    if(state.tier === 'cocoon') return 'forming';
    if(state.tier === 'silkworm') return 'spinning';
    return 'feeding';
  }

  // ============================================================
  // BEHAVIOR HOOKS
  // ============================================================
  function reactToTyping(){
    // Lightweight idle-keepalive only. Resets the sleep timer and lets
    // the cursor-tracking stay live while the player composes. No status
    // change, no bubble, no bounce. Feeding fires once per Enter via
    // reactToFeed. Calling reactToTyping during composition keeps the
    // creature awake without claiming the worm is eating yet.
    lastInputAt = Date.now();
    if(sleeping) wake();
  }

  // ============================================================
  // FEEDING — fires once per Enter. A piece of food is thrown across
  // the box toward the creature, the creature does its eating bounce,
  // and the status reads "eating" briefly. The food sprite varies by
  // current developmental stage so the game-feel of feeding the
  // creature feels textured rather than the same icon repeated.
  // ============================================================
  var FOOD_BY_TIER = {
    worm:     ['🍃','🌱','🥬','🍂'],
    silkworm: ['🍃','🌿','🥬','🌱'],
    cocoon:   ['📖','📜','🍯','💧'],
    animal:   ['📖','🍎','🍇','🌾','🥜']
  };
  function pickFood(){
    var bag = FOOD_BY_TIER[state.tier] || FOOD_BY_TIER.worm;
    return bag[Math.floor(Math.random()*bag.length)];
  }
  function reactToFeed(textPayload){
    if(!container) return;
    lastInputAt = Date.now();
    if(sleeping) wake();
    var screenEl = container.querySelector('.tama-screen');
    var creatureEl = container.querySelector('.tama-creature');
    if(!screenEl || !creatureEl) return;

    // Spawn a food projectile. The trajectory is sized to the box,
    // not to the viewport. Earlier versions used vw units which on
    // desktop flung the food past the right edge of a narrow preview
    // pane and into nothing. Now the screen's actual width is read
    // at spawn-time and written into CSS variables that the keyframes
    // consume, so the food always lands on the creature regardless
    // of layout.
    var screenW = screenEl.clientWidth || 300;
    var startLeft = screenW * 0.06;     // matches CSS left:6%
    var creatureCenter = screenW * 0.50;
    var travel = creatureCenter - startLeft;
    var travelMid = travel * 0.85;
    var food = document.createElement('span');
    food.className = 'tama-food';
    food.textContent = pickFood();
    food.style.setProperty('--tama-travel', travel + 'px');
    food.style.setProperty('--tama-travel-mid', travelMid + 'px');
    screenEl.appendChild(food);
    // Force reflow so the animation starts fresh even on rapid feeds.
    void food.offsetWidth;
    food.classList.add('tama-food-fly');
    setTimeout(function(){ if(food.parentNode) food.parentNode.removeChild(food); }, 700);

    // Eating bounce on the creature itself, slightly delayed so the
    // food appears to land before the creature reacts.
    setTimeout(function(){
      creatureEl.classList.remove('tama-bounce-active');
      void creatureEl.offsetWidth;
      creatureEl.classList.add('tama-bounce-active');
      setTimeout(function(){ creatureEl.classList.remove('tama-bounce-active'); }, 400);
    }, 380);

    // Status flash — short, ends back at the computed status.
    var statusEl = container.querySelector('.tama-status');
    if(statusEl){
      statusEl.textContent = 'eating';
      if(feedingStatusTimer) clearTimeout(feedingStatusTimer);
      feedingStatusTimer = setTimeout(function(){
        if(statusEl) statusEl.textContent = sleeping ? 'sleeping' : computeStatus();
      }, 1100);
    }
  }

  function reactToStatHit(stats){
    if(!container || !stats || !stats.length) return;
    // Pick reaction emoji based on stat content
    var emoji = pickStatEmoji(stats);
    showBubble(emoji, 1500);
  }

  function reactToHpDamage(quirks){
    if(!container) return;
    showBubble('😖', 1200);
    var creatureEl = container.querySelector('.tama-creature');
    if(creatureEl){
      creatureEl.classList.remove('tama-shake');
      void creatureEl.offsetWidth;
      creatureEl.classList.add('tama-shake');
      setTimeout(function(){ creatureEl.classList.remove('tama-shake'); }, 600);
    }
  }

  function reactToTierUp(newTier, oldTier){
    if(!container) return;
    showBubble('✨', 2400);
    var creatureEl = container.querySelector('.tama-creature');
    if(creatureEl){
      creatureEl.classList.add('tama-tier-up');
      setTimeout(function(){
        creatureEl.classList.remove('tama-tier-up');
      }, 2000);
    }
    var statusEl = container && container.querySelector('.tama-status');
    if(statusEl){
      statusEl.textContent = 'evolving';
      statusEl.classList.add('tama-status-flash');
      setTimeout(function(){ statusEl.classList.remove('tama-status-flash'); }, 2200);
    }
  }

  // ============================================================
  // playSealAnimation — runs at card-seal time.
  // The animal devolves back to a worm, then grows again through
  // worm → silkworm → cocoon → animal, returning personalized
  // with the player's top adjective stats as a banner.
  //
  // The "personalized" state is persistent: once the animation runs,
  // the animal stays with its banner across reloads.
  //
  // Sequence (~3.7s total):
  //   t=0      pulse animal sprite (preparation flash)
  //   t=400    swap to worm + status "feeding" + XP/HP bars empty
  //   t=1200   swap to silkworm + status "spinning" + XP partial
  //   t=2000   swap to cocoon + status "forming" + XP nearly full
  //   t=2800   swap back to animal + status "awake" + banner reveals
  //
  // opts.topStats: array of strings to display as the personalized banner
  //                (e.g. ['DIALECTICAL','DEADPAN','COMPRESSED']).
  // opts.onComplete: callback fired at end of sequence.
  // ============================================================
  var sealAnimationPlaying = false;
  function playSealAnimation(opts){
    if(!container) return;
    if(sealAnimationPlaying) return;  // guard against re-entrance
    if(!state.animal) return;          // nothing to devolve from
    sealAnimationPlaying = true;
    opts = opts || {};
    var topStats = opts.topStats || [];

    var creatureEl = container.querySelector('.tama-creature');
    var statusEl   = container.querySelector('.tama-status');
    var tierEl     = container.querySelector('.tama-tier-label');
    var xpFillEl   = container.querySelector('.tama-xp-fill');
    var hpFillEl   = container.querySelector('.tama-hp-fill');

    // Snapshot the personalized animal sprite for the final reveal.
    var animalSprite = resolveAnimalEmoji(state.animal);

    // Step 0 — flash
    if(creatureEl) creatureEl.classList.add('tama-seal-flash');

    // Step 1 — devolve to worm
    setTimeout(function(){
      if(creatureEl){
        creatureEl.classList.remove('tama-seal-flash');
        creatureEl.textContent = TIER_EMOJI.worm;
        creatureEl.classList.add('tama-seal-morph');
      }
      if(statusEl) statusEl.textContent = 'feeding';
      if(tierEl)   tierEl.textContent   = 'worm';
      if(xpFillEl) xpFillEl.style.width = '5%';
    }, 400);

    // Step 2 — silkworm
    setTimeout(function(){
      if(creatureEl) creatureEl.textContent = TIER_EMOJI.silkworm;
      if(statusEl) statusEl.textContent = 'spinning';
      if(tierEl)   tierEl.textContent   = 'silkworm';
      if(xpFillEl) xpFillEl.style.width = '40%';
    }, 1200);

    // Step 3 — cocoon
    setTimeout(function(){
      if(creatureEl) creatureEl.textContent = TIER_EMOJI.cocoon;
      if(statusEl) statusEl.textContent = 'forming';
      if(tierEl)   tierEl.textContent   = 'cocoon';
      if(xpFillEl) xpFillEl.style.width = '78%';
    }, 2000);

    // Step 4 — emerge as the personalized animal
    setTimeout(function(){
      if(creatureEl){
        creatureEl.textContent = animalSprite;
        creatureEl.classList.remove('tama-seal-morph');
        creatureEl.classList.add('tama-tier-up');
      }
      if(statusEl) statusEl.textContent = 'awake';
      if(tierEl)   tierEl.textContent   = state.animal.replace(/-/g,' ');
      if(xpFillEl) xpFillEl.style.width = '100%';
      showBubble('✨', 1800);

      // Reveal the personalized banner with top stats
      if(topStats.length){
        var bannerEl = container.querySelector('.tama-banner');
        if(!bannerEl){
          bannerEl = document.createElement('div');
          bannerEl.className = 'tama-banner';
          var frame = container.querySelector('.tama-frame');
          if(frame) frame.appendChild(bannerEl);
        }
        bannerEl.textContent = topStats.slice(0, 3).join(' · ').toLowerCase();
        bannerEl.classList.add('tama-banner-reveal');
      }

      setTimeout(function(){
        if(creatureEl) creatureEl.classList.remove('tama-tier-up');
        sealAnimationPlaying = false;
        if(typeof opts.onComplete === 'function') opts.onComplete();
      }, 2000);
    }, 2800);
  }

  // Render the personalized banner if it was set in a prior session
  // (so it persists across reloads after seal-time).
  function applyPersonalizedBanner(topStats){
    if(!container || !topStats || !topStats.length) return;
    var bannerEl = container.querySelector('.tama-banner');
    if(!bannerEl){
      bannerEl = document.createElement('div');
      bannerEl.className = 'tama-banner tama-banner-reveal';
      var frame = container.querySelector('.tama-frame');
      if(frame) frame.appendChild(bannerEl);
    }
    bannerEl.textContent = topStats.slice(0, 3).join(' · ').toLowerCase();
  }

  // ============================================================
  // FLASH STAT HITS — trait awards (+3 IRREDUCIBLE etc.) pop on
  // the picture-portion, NOT in the chat. Chat is for the
  // conversation; the visual layer is for the worm's growth
  // feedback. Multi-hit answers stack vertically along the
  // lower-left of the screen with stagger so each one is readable
  // before the next arrives. The card preview (right pane) is the
  // persistent record of accumulated stats.
  // ============================================================
  function flashStatHits(hits){
    if(!container) return;
    if(!hits || !hits.length) return;
    var screenEl = container.querySelector('.tama-screen');
    if(!screenEl) return;
    var capped = hits.slice(0, 4);
    capped.forEach(function(hit, idx){
      setTimeout(function(){
        var pop = document.createElement('span');
        var isQuirk = !!hit.isQuirk;
        pop.className = 'tama-stat-pop' + (isQuirk ? ' tama-stat-pop-quirk' : '');
        var w = (hit.weight !== undefined) ? hit.weight : 1;
        var stat = (hit.stat || hit.quirk || hit) + '';
        // Quirks show as -W to mark the cost; positive stats as +W.
        var sign = isQuirk ? '-' : '+';
        pop.textContent = sign + w + ' ' + stat;
        pop.style.bottom = (12 + idx * 22) + 'px';
        screenEl.appendChild(pop);
        setTimeout(function(){
          if(pop.parentNode) pop.parentNode.removeChild(pop);
        }, 1700);
      }, idx * 140);
    });
  }

  function pickStatEmoji(stats){
    // Resolve the best-match accessory emoji from the same rule
    // table the creature wears. Each rule's traits are checked
    // against the stats fired on this answer; the rule with the
    // strongest hit count wins. This guarantees the bubble emoji
    // matches the visual vocabulary of the accessory layer instead
    // of falling through to a generic plus on the 130+ stats the
    // older regex set never covered.
    if(!stats || !stats.length) return '+';
    var hitNames = {};
    for(var i=0;i<stats.length;i++){
      hitNames[String(stats[i]).toUpperCase()] = true;
    }
    var bestRule = null;
    var bestHits = 0;
    for(var j=0;j<ACCESSORY_RULES.length;j++){
      var rule = ACCESSORY_RULES[j];
      if(rule.source === 'quirks') continue;  // bubbles are positive
      var hits = 0;
      for(var k=0;k<rule.traits.length;k++){
        if(hitNames[rule.traits[k]]) hits++;
      }
      if(hits > bestHits){
        bestHits = hits;
        bestRule = rule;
      }
    }
    return bestRule ? bestRule.emoji : '+';
  }

  function showBubble(text, durationMs){
    if(!container) return;
    var bubble = container.querySelector('.tama-bubble');
    if(!bubble) return;
    if(bubbleTimer) clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.classList.add('tama-bubble-show');
    bubbleTimer = setTimeout(function(){
      bubble.classList.remove('tama-bubble-show');
    }, durationMs || 1500);
  }

  function sleep(){
    if(sleeping) return;
    sleeping = true;
    var creatureEl = container && container.querySelector('.tama-creature');
    if(creatureEl) creatureEl.classList.add('tama-sleeping');
    showBubble('💤', 99999);
    render();
  }

  function wake(){
    if(!sleeping) return;
    sleeping = false;
    var creatureEl = container && container.querySelector('.tama-creature');
    if(creatureEl) creatureEl.classList.remove('tama-sleeping');
    var bubble = container && container.querySelector('.tama-bubble');
    if(bubble) bubble.classList.remove('tama-bubble-show');
    render();
  }

  function checkIdle(){
    var idleMs = Date.now() - lastInputAt;
    if(idleMs > 60000 && !sleeping){
      sleep();
    }
  }

  function handleMouseMove(e){
    if(!container) return;
    var rect = container.getBoundingClientRect();
    var cx = rect.left + rect.width/2;
    var cy = rect.top + rect.height/2;
    var dx = (e.clientX - cx) / Math.max(1, rect.width/2);
    var dy = (e.clientY - cy) / Math.max(1, rect.height/2);
    cursorOffsetX = Math.max(-1, Math.min(1, dx));
    cursorOffsetY = Math.max(-1, Math.min(1, dy));
    var creatureEl = container.querySelector('.tama-creature');
    if(creatureEl && !sleeping){
      // Subtle eye-tracking effect: shift creature ±3px toward cursor
      var ox = cursorOffsetX * 3;
      var oy = cursorOffsetY * 2;
      creatureEl.style.transform = 'translate(' + ox.toFixed(1) + 'px, ' + oy.toFixed(1) + 'px)';
    }
  }

  // handleKeydown was removed. The previous implementation called
  // reactToTyping on every printable keystroke which made the worm
  // "eat" while the player was still composing the answer. Feeding
  // is now an Enter-only event handled by reactToFeed, called from
  // the host page when an answer is committed.

  // ============================================================
  // CSS — pixel-art-inspired but emoji-based.
  // CRT-frame surrounds an LCD-style box. XP/HP bars below.
  // ============================================================
  var TAMAGOTCHI_CSS = '\n' +
    '.tamagotchi-pane {\n' +
    '  font-family: VT323, monospace;\n' +
    '  margin-top: 2.4rem;\n' +
    '  margin-bottom: 1rem;\n' +
    '  padding-bottom: 0.8rem;\n' +
    '  border-bottom: 1px dashed var(--fg-darker);\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '.tama-frame {\n' +
    '  position: relative;\n' +
    '  width: 100%;\n' +
    '  background: rgba(0,0,0,0.6);\n' +
    '  border: 1px solid var(--fg-darker);\n' +
    '  border-radius: 0;\n' +
    '  box-shadow: none;\n' +
    '  padding: 0.6rem 0.8rem;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  gap: 0.4rem;\n' +
    '}\n' +
    '.tama-screen {\n' +
    '  position: relative;\n' +
    '  width: 100%;\n' +
    '  height: clamp(220px, 38vh, 360px);\n' +
    '  background: #000;\n' +
    '  border: 1px solid var(--fg-darker);\n' +
    '  border-radius: 0;\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    '.tama-screen::before {\n' +
    '  content: "";\n' +
    '  position: absolute;\n' +
    '  inset: 0;\n' +
    '  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px);\n' +
    '  pointer-events: none;\n' +
    '  z-index: 2;\n' +
    '}\n' +
    '.tama-creature {\n' +
    '  font-size: clamp(110px, 18vw, 180px);\n' +
    '  line-height: 1;\n' +
    '  filter: drop-shadow(0 2px 4px rgba(255,176,0,0.3));\n' +
    '  animation: tama-bounce-idle 1.6s ease-in-out infinite;\n' +
    '  transition: transform 0.15s ease-out, filter 0.3s;\n' +
    '  z-index: 1;\n' +
    '  user-select: none;\n' +
    '}\n' +
    /* Accessory slots — six positions around the creature. Each slot
       is fixed so accessories never overlap each other. Slots that
       are empty contribute nothing. The base size is independent of
       the creature size; the renderer scales each accessory up from
       its rule weight via inline transform. */
    '.tama-accessory {\n' +
    '  position: absolute;\n' +
    '  font-size: clamp(28px, 5vw, 52px);\n' +
    '  line-height: 1;\n' +
    '  z-index: 2;\n' +
    '  pointer-events: none;\n' +
    '  transition: opacity 0.4s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
    '  filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));\n' +
    '  user-select: none;\n' +
    '  transform-origin: center;\n' +
    '  animation: tama-accessory-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
    '}\n' +
    '@keyframes tama-accessory-pop {\n' +
    '  0%   { opacity: 0; transform: scale(0.2) rotate(-25deg); }\n' +
    '  60%  { opacity: 1; transform: scale(1.15) rotate(5deg); }\n' +
    '  100% { opacity: inherit; transform: scale(1) rotate(0); }\n' +
    '}\n' +
    /* Top — sits above the creature, centred. Hats and crowns. */
    '.tama-accessory-top {\n' +
    '  top: 8%;\n' +
    '  left: 50%;\n' +
    '  margin-left: calc(clamp(28px, 5vw, 52px) * -0.5);\n' +
    '}\n' +
    /* Face — overlaid on the creature face area, slightly down from
       the top so it sits over the eyes of an animal-stage emoji. */
    '.tama-accessory-face {\n' +
    '  top: 38%;\n' +
    '  left: 50%;\n' +
    '  margin-left: calc(clamp(28px, 5vw, 52px) * -0.5);\n' +
    '  font-size: clamp(34px, 6vw, 64px);\n' +
    '  z-index: 3;\n' +
    '}\n' +
    /* Top-left — weather over the creature, sky-side. */
    '.tama-accessory-top-left {\n' +
    '  top: 6%;\n' +
    '  left: 8%;\n' +
    '}\n' +
    /* Top-right — companion or thought-bubble. */
    '.tama-accessory-top-right {\n' +
    '  top: 6%;\n' +
    '  right: 8%;\n' +
    '}\n' +
    /* Right — at the creature\'s side, things they carry. */
    '.tama-accessory-right {\n' +
    '  top: 50%;\n' +
    '  right: 6%;\n' +
    '  transform: translateY(-50%);\n' +
    '}\n' +
    /* Left — companion or environmental marker. */
    '.tama-accessory-left {\n' +
    '  top: 50%;\n' +
    '  left: 6%;\n' +
    '  transform: translateY(-50%);\n' +
    '}\n' +
    /* Bottom-right — ground decoration, smaller. */
    '.tama-accessory-bottom-right {\n' +
    '  bottom: 8%;\n' +
    '  right: 8%;\n' +
    '  font-size: clamp(24px, 4vw, 40px);\n' +
    '}\n' +
    /* Bottom-left — quirks slot. Negative markers live here so they
       never compete with positive accessories for the same slot.
       Slightly smaller, slightly desaturated by default to read as
       a residue rather than a feature. */
    '.tama-accessory-bottom-left {\n' +
    '  bottom: 8%;\n' +
    '  left: 8%;\n' +
    '  font-size: clamp(22px, 3.6vw, 36px);\n' +
    '}\n' +
    '.tama-accessory-quirk {\n' +
    '  filter: drop-shadow(0 0 4px rgba(0,0,0,0.7)) saturate(0.7) brightness(0.85);\n' +
    '}\n' +
    /* Single-trait dominance — one characteristic carries 60%+ of
       the cluster and is itself heavy. The accessory pulses on a
       slow cycle and gains a soft glow ring so the eye lands on it
       and reads the character as obsessive about that register. */
    '.tama-accessory-dominant {\n' +
    '  filter: drop-shadow(0 0 12px rgba(255,176,0,0.85))\n' +
    '          drop-shadow(0 0 4px rgba(255,176,0,1));\n' +
    '  animation: tama-accessory-pulse 1.8s ease-in-out infinite;\n' +
    '}\n' +
    '@keyframes tama-accessory-pulse {\n' +
    '  0%, 100% { filter: drop-shadow(0 0 8px rgba(255,176,0,0.7));  }\n' +
    '  50%      { filter: drop-shadow(0 0 18px rgba(255,176,0,1)) drop-shadow(0 0 6px rgba(255,176,0,1)); }\n' +
    '}\n' +
    /* Extreme weight — the runaway character. Cluster has exceeded
       30 weight beyond threshold. The accessory radiates and
       shimmers. Reserved for genuinely extreme single-register
       commitment. */
    '.tama-accessory-extreme {\n' +
    '  animation: tama-accessory-extreme 2.4s linear infinite;\n' +
    '}\n' +
    '@keyframes tama-accessory-extreme {\n' +
    '  0%   { filter: drop-shadow(0 0 18px rgba(255,176,0,0.95)) hue-rotate(0); }\n' +
    '  50%  { filter: drop-shadow(0 0 26px rgba(255,176,0,1))    hue-rotate(8deg); }\n' +
    '  100% { filter: drop-shadow(0 0 18px rgba(255,176,0,0.95)) hue-rotate(0); }\n' +
    '}\n' +
    /* Dominant-trait label — small text below the accessory that
       names the specific characteristic carrying the cluster. Lets
       the player tell COMMUNAL-dominant from KIN-BOUND-dominant
       even though both wear the heart. Per-slot positioning so the
       label sits near the accessory it describes. */
    '.tama-accessory-label {\n' +
    '  position: absolute;\n' +
    '  font-family: "VT323", monospace;\n' +
    '  font-size: clamp(10px, 1.4vw, 13px);\n' +
    '  color: var(--accent);\n' +
    '  text-shadow: 0 0 4px rgba(255,176,0,0.8);\n' +
    '  letter-spacing: 0.5px;\n' +
    '  z-index: 4;\n' +
    '  pointer-events: none;\n' +
    '  user-select: none;\n' +
    '  white-space: nowrap;\n' +
    '  text-transform: lowercase;\n' +
    '  opacity: 0.9;\n' +
    '}\n' +
    '.tama-accessory-label-top         { top: 14%; left: 50%; transform: translateX(-50%); }\n' +
    '.tama-accessory-label-face        { top: 56%; left: 50%; transform: translateX(-50%); }\n' +
    '.tama-accessory-label-top-left    { top: 18%; left: 4%;  }\n' +
    '.tama-accessory-label-top-right   { top: 18%; right: 4%; text-align: right; }\n' +
    '.tama-accessory-label-right       { top: 68%; right: 4%; text-align: right; }\n' +
    '.tama-accessory-label-left        { top: 68%; left: 4%;  }\n' +
    '.tama-accessory-label-bottom-right{ bottom: 2%; right: 4%; text-align: right; }\n' +
    '.tama-accessory-label-bottom-left { bottom: 2%; left: 4%;  }\n' +
    '@media (prefers-reduced-motion: reduce) {\n' +
    '  .tama-accessory-dominant,\n' +
    '  .tama-accessory-extreme { animation: none; }\n' +
    '}\n' +
    /* Trait-hit popup — when a stat fires (e.g. +3 IRREDUCIBLE),
       it pops on the picture-portion as a small chip rather than
       being printed in the chat. Stacks vertically along the
       lower-left of the screen with stagger so multi-hit answers
       show all hits in sequence. */
    '.tama-stat-pop {\n' +
    '  position: absolute;\n' +
    '  left: 6%;\n' +
    '  font-family: "VT323", monospace;\n' +
    '  font-size: clamp(11px, 1.4vw, 14px);\n' +
    '  color: var(--accent);\n' +
    '  background: rgba(0,0,0,0.55);\n' +
    '  border: 1px solid var(--accent);\n' +
    '  border-radius: 2px;\n' +
    '  padding: 1px 6px;\n' +
    '  letter-spacing: 0.4px;\n' +
    '  z-index: 6;\n' +
    '  pointer-events: none;\n' +
    '  user-select: none;\n' +
    '  white-space: nowrap;\n' +
    '  text-transform: uppercase;\n' +
    '  animation: tama-stat-pop 1.6s ease-out forwards;\n' +
    '}\n' +
    '@keyframes tama-stat-pop {\n' +
    '  0%   { opacity: 0; transform: translateY(8px); }\n' +
    '  15%  { opacity: 1; transform: translateY(0); }\n' +
    '  75%  { opacity: 1; transform: translateY(-4px); }\n' +
    '  100% { opacity: 0; transform: translateY(-32px); }\n' +
    '}\n' +
    /* Quirk-pop variant — same shape as the stat pop but in
       damage colour so the player can read at a glance whether
       the answer added substance or cost HP. */
    '.tama-stat-pop-quirk {\n' +
    '  color: #ff7a4a;\n' +
    '  border-color: #c4441f;\n' +
    '  background: rgba(80,20,8,0.7);\n' +
    '  text-shadow: 0 0 6px rgba(255,80,40,0.6);\n' +
    '}\n' +
    /* Ghost accessory — brewing register that has not yet crossed
       its threshold. Faint and small. The player sees a hint of the
       symbol arriving, no animation, no glow. Once it hits min the
       ghost class drops and the confident accessory takes over. */
    '.tama-accessory-ghost {\n' +
    '  filter: blur(0.5px) brightness(0.7);\n' +
    '  animation: tama-ghost-flicker 4s ease-in-out infinite;\n' +
    '}\n' +
    '@keyframes tama-ghost-flicker {\n' +
    '  0%, 100% { opacity: 0.18; }\n' +
    '  50%      { opacity: 0.32; }\n' +
    '}\n' +
    /* Mood backdrop — sits at z-index 0 of the tama-screen so it
       lives behind creature, accessories, and bubbles. The mood
       tints the room without recolouring the inhabitants of the
       room. */
    '.tama-mood-backdrop {\n' +
    '  position: absolute;\n' +
    '  inset: 0;\n' +
    '  z-index: 0;\n' +
    '  pointer-events: none;\n' +
    '  background: transparent;\n' +
    '  transition: background 0.6s ease-in-out;\n' +
    '  mix-blend-mode: screen;\n' +
    '}\n' +
    '@media (prefers-reduced-motion: reduce) {\n' +
    '  .tama-stat-pop,\n' +
    '  .tama-accessory-ghost { animation-duration: 250ms; }\n' +
    '}\n' +
    /* Filter on .tama-screen is no longer used for mood (the
       backdrop tint handles that now). The transition stays for
       any incidental filter use elsewhere in the codebase. */
    '.tama-screen { transition: filter 0.6s ease-in-out; }\n' +
    '@media (prefers-reduced-motion: reduce) {\n' +
    '  .tama-accessory { animation: none; transition: none; }\n' +
    '  .tama-screen { transition: none; }\n' +
    '}\n' +
    '@keyframes tama-bounce-idle {\n' +
    '  0%, 100% { translate: 0 0; }\n' +
    '  50%      { translate: 0 -3px; }\n' +
    '}\n' +
    '.tama-bounce-active {\n' +
    '  animation: tama-bounce-active 0.4s ease-out !important;\n' +
    '}\n' +
    '@keyframes tama-bounce-active {\n' +
    '  0%   { translate: 0 0; }\n' +
    '  30%  { translate: 0 -10px; scale: 1.05; }\n' +
    '  60%  { translate: 0 -2px; scale: 1.0; }\n' +
    '  100% { translate: 0 0; }\n' +
    '}\n' +
    '.tama-shake {\n' +
    '  animation: tama-shake 0.6s !important;\n' +
    '}\n' +
    '@keyframes tama-shake {\n' +
    '  0%, 100% { translate: 0 0; }\n' +
    '  20%      { translate: -4px 0; }\n' +
    '  40%      { translate: 4px 0; }\n' +
    '  60%      { translate: -3px 0; }\n' +
    '  80%      { translate: 3px 0; }\n' +
    '}\n' +
    '.tama-tier-up {\n' +
    '  animation: tama-tier-up 2s ease-out !important;\n' +
    '}\n' +
    '@keyframes tama-tier-up {\n' +
    '  0%   { scale: 1; filter: drop-shadow(0 0 0 rgba(255,176,0,0)); }\n' +
    '  20%  { scale: 1.3; filter: drop-shadow(0 0 16px rgba(255,176,0,0.9)); }\n' +
    '  60%  { scale: 1.1; filter: drop-shadow(0 0 8px rgba(255,176,0,0.6)); }\n' +
    '  100% { scale: 1; filter: drop-shadow(0 2px 4px rgba(255,176,0,0.3)); }\n' +
    '}\n' +
    '.tama-seal-flash {\n' +
    '  animation: tama-seal-flash 380ms ease-out !important;\n' +
    '}\n' +
    '@keyframes tama-seal-flash {\n' +
    '  0%   { scale: 1; filter: drop-shadow(0 0 0 rgba(51,255,102,0)); }\n' +
    '  50%  { scale: 1.4; filter: drop-shadow(0 0 22px rgba(51,255,102,1)); }\n' +
    '  100% { scale: 0.7; filter: drop-shadow(0 0 4px rgba(51,255,102,0.3)); }\n' +
    '}\n' +
    '.tama-seal-morph {\n' +
    '  animation: tama-seal-morph 800ms ease-in-out !important;\n' +
    '}\n' +
    '@keyframes tama-seal-morph {\n' +
    '  0%   { scale: 0.7; opacity: 1; }\n' +
    '  40%  { scale: 0.9; opacity: 0.7; }\n' +
    '  100% { scale: 1; opacity: 1; }\n' +
    '}\n' +
    '.tama-banner {\n' +
    '  margin-top: 0.5rem;\n' +
    '  padding: 0.3rem 0.4rem;\n' +
    '  border-top: 1px dashed var(--fg-darker);\n' +
    '  font-family: VT323, monospace;\n' +
    '  font-size: 0.85rem;\n' +
    '  color: var(--accent);\n' +
    '  text-shadow: 0 0 4px rgba(255,176,0,0.5);\n' +
    '  letter-spacing: 1px;\n' +
    '  text-align: center;\n' +
    '  text-transform: uppercase;\n' +
    '  opacity: 0;\n' +
    '  transition: opacity 1.4s ease-in;\n' +
    '}\n' +
    '.tama-banner.tama-banner-reveal {\n' +
    '  opacity: 1;\n' +
    '}\n' +
    '.tama-sleeping { animation: tama-sleep 3s ease-in-out infinite !important; opacity: 0.7; }\n' +
    '@keyframes tama-sleep {\n' +
    '  0%, 100% { translate: 0 0; }\n' +
    '  50%      { translate: 0 1px; opacity: 0.55; }\n' +
    '}\n' +
    '.tama-food {\n' +
    '  position: absolute;\n' +
    '  left: 6%;\n' +
    '  top: 50%;\n' +
    '  font-size: clamp(28px, 5vw, 48px);\n' +
    '  z-index: 4;\n' +
    '  pointer-events: none;\n' +
    '  transform: translate(0, -50%) scale(0.4);\n' +
    '  opacity: 0;\n' +
    '  filter: drop-shadow(0 0 6px rgba(51,255,102,0.5));\n' +
    '}\n' +
    '.tama-food-fly {\n' +
    '  animation: tama-food-fly 700ms cubic-bezier(0.4, -0.2, 0.6, 1.2) forwards;\n' +
    '}\n' +
    '@keyframes tama-food-fly {\n' +
    '  0%   { transform: translate(0, -50%) scale(0.5) rotate(0deg); opacity: 0; }\n' +
    '  15%  { transform: translate(0, -90%) scale(1) rotate(-20deg); opacity: 1; }\n' +
    '  60%  { transform: translate(var(--tama-travel-mid, 35vw), -30%) scale(1) rotate(180deg); opacity: 1; }\n' +
    '  85%  { transform: translate(var(--tama-travel, 40vw), -50%) scale(0.8) rotate(320deg); opacity: 1; }\n' +
    '  100% { transform: translate(var(--tama-travel, 40vw), -50%) scale(0.1) rotate(360deg); opacity: 0; }\n' +
    '}\n' +
    '@media (prefers-reduced-motion: reduce) {\n' +
    '  .tama-food-fly { animation-duration: 250ms; }\n' +
    '}\n' +
    '.tama-bubble {\n' +
    '  position: absolute;\n' +
    '  top: 6px;\n' +
    '  right: 8px;\n' +
    '  background: rgba(255, 245, 220, 0.95);\n' +
    '  color: #2a2a2a;\n' +
    '  border: 1px solid #555;\n' +
    '  border-radius: 8px;\n' +
    '  padding: 0.1rem 0.4rem;\n' +
    '  font-size: 16px;\n' +
    '  z-index: 3;\n' +
    '  opacity: 0;\n' +
    '  transform: scale(0.5);\n' +
    '  transition: opacity 0.2s, transform 0.2s;\n' +
    '  pointer-events: none;\n' +
    '  box-shadow: 0 2px 4px rgba(0,0,0,0.3);\n' +
    '}\n' +
    '.tama-bubble-show {\n' +
    '  opacity: 1 !important;\n' +
    '  transform: scale(1) !important;\n' +
    '}\n' +
    '.tama-status {\n' +
    '  position: absolute;\n' +
    '  top: 4px;\n' +
    '  left: 6px;\n' +
    '  font-size: 0.65rem;\n' +
    '  color: var(--fg-dim);\n' +
    '  text-shadow: none;\n' +
    '  letter-spacing: 1px;\n' +
    '  text-transform: uppercase;\n' +
    '  z-index: 3;\n' +
    '}\n' +
    '.tama-status-flash { color: var(--accent); animation: tama-status-flash 0.4s 5; }\n' +
    '@keyframes tama-status-flash {\n' +
    '  0%, 100% { opacity: 1; }\n' +
    '  50%      { opacity: 0.3; }\n' +
    '}\n' +
    '.tama-tier-label {\n' +
    '  position: absolute;\n' +
    '  bottom: 4px;\n' +
    '  right: 6px;\n' +
    '  font-size: 0.65rem;\n' +
    '  color: var(--fg-darker);\n' +
    '  letter-spacing: 1px;\n' +
    '  z-index: 3;\n' +
    '  text-transform: uppercase;\n' +
    '}\n' +
    '.tama-bars { display: flex; flex-direction: column; gap: 0.25rem; }\n' +
    '.tama-bar {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 0.4rem;\n' +
    '  font-size: 0.7rem;\n' +
    '  color: var(--fg-dim);\n' +
    '  text-shadow: none;\n' +
    '  letter-spacing: 1px;\n' +
    '}\n' +
    '.tama-bar-label { width: 18px; flex-shrink: 0; text-align: left; }\n' +
    '.tama-bar-track {\n' +
    '  flex: 1;\n' +
    '  height: 8px;\n' +
    '  background: rgba(0,0,0,0.6);\n' +
    '  border: 1px solid var(--fg-darker);\n' +
    '  border-radius: 1px;\n' +
    '  overflow: hidden;\n' +
    '  position: relative;\n' +
    '}\n' +
    '.tama-bar-fill {\n' +
    '  height: 100%;\n' +
    '  width: 0;\n' +
    '  transition: width 0.6s ease-out, background 0.3s;\n' +
    '  image-rendering: pixelated;\n' +
    '}\n' +
    '.tama-xp-fill { background: var(--accent); }\n' +
    '.tama-hp-fill { background: #5fb96b; }\n' +
    '.tama-bar-num { font-size: 0.65rem; color: var(--fg-darker); width: 28px; text-align: right; flex-shrink: 0; }\n' +
    '.tama-hp-low .tama-creature { filter: drop-shadow(0 0 0 transparent) saturate(0.6) brightness(0.85); }\n' +
    '.tama-hp-critical .tama-creature { filter: saturate(0.3) brightness(0.6); }\n' +
    '@media (prefers-reduced-motion: reduce) {\n' +
    '  .tama-creature, .tama-bounce-active, .tama-shake, .tama-tier-up, .tama-sleeping { animation: none !important; }\n' +
    '}\n' +
    '@media (max-width: 760px) {\n' +
    '  .tama-screen { height: clamp(220px, 46vh, 320px); }\n' +
    '  .tama-creature { font-size: clamp(120px, 30vw, 200px); }\n' +
    '}\n' +
    '';

  // ============================================================
  // HTML — single mount target
  // ============================================================
  var TAMAGOTCHI_HTML =
    '<div class="tama-frame">' +
      '<div class="tama-screen">' +
        '<div class="tama-status">feeding</div>' +
        '<div class="tama-creature">🪱</div>' +
        '<div class="tama-bubble">+</div>' +
        '<div class="tama-tier-label">worm</div>' +
      '</div>' +
      '<div class="tama-bars">' +
        '<div class="tama-bar">' +
          '<span class="tama-bar-label">XP</span>' +
          '<div class="tama-bar-track"><div class="tama-bar-fill tama-xp-fill"></div></div>' +
          '<span class="tama-bar-num tama-xp-num">0</span>' +
        '</div>' +
        '<div class="tama-bar">' +
          '<span class="tama-bar-label">HP</span>' +
          '<div class="tama-bar-track"><div class="tama-bar-fill tama-hp-fill"></div></div>' +
          '<span class="tama-bar-num tama-hp-num">100</span>' +
        '</div>' +
      '</div>' +
    '</div>';

  // ============================================================
  // EXPORTS
  // ============================================================
  // ============================================================
  // PUBLIC ACCESSORY RESOLVER — used by the SVG card exporter so
  // the artifact at the end shows the same accessories the player
  // saw on the live tamagotchi. Without this, the chosen animal
  // would seal as a bare emoji and the individualisation built
  // across the form would vanish from the card the player keeps.
  // Returns array of { emoji, slot, weight, ruleId } sorted by
  // weight descending, plus a `mood` filter id if a dominant affect
  // cluster qualifies.
  // ============================================================
  function computeAccessories(stats, quirks){
    var winners = pickWinnerPerSlot(stats || {}, quirks || {});
    var mood = pickMood(stats || {});
    return {
      accessories: winners.map(function(w){
        return {
          emoji: w.rule.emoji,
          slot:  w.rule.slot,
          weight: w.weight,
          ruleId: w.rule.id,
          source: w.rule.source || 'stats'
        };
      }),
      mood: mood ? { id: mood.rule.id, filter: mood.rule.filter, weight: mood.weight } : null
    };
  }

  global.Tamagotchi = {
    init: init,
    destroy: destroy,
    updateState: updateState,
    reactToTyping: reactToTyping,
    reactToFeed: reactToFeed,
    reactToStatHit: reactToStatHit,
    reactToHpDamage: reactToHpDamage,
    reactToTierUp: reactToTierUp,
    flashStatHits: flashStatHits,
    // Single read-only source of truth for the accessory rule
    // table. Hosts (SVG card export, the legend panel, anything
    // else that needs to enumerate accessory rules) read from here
    // instead of duplicating the table or re-deriving it. The
    // returned array is a defensive copy so callers cannot mutate
    // the canonical rule set.
    getAccessoryRules: function(){
      return ACCESSORY_RULES.map(function(r){
        return {
          id: r.id, emoji: r.emoji, slot: r.slot,
          min: r.min, source: r.source || 'stats',
          traits: (r.traits || []).slice()
        };
      });
    },
    getMoodRules: function(){
      return MOOD_FILTERS.map(function(m){
        return { id: m.id, min: m.min, tint: m.tint, traits: (m.traits || []).slice() };
      });
    },
    playSealAnimation: playSealAnimation,
    applyPersonalizedBanner: applyPersonalizedBanner,
    sleep: sleep,
    wake: wake,
    resolveAnimalEmoji: resolveAnimalEmoji,
    computeAccessories: computeAccessories
  };
})(typeof window !== 'undefined' ? window : globalThis);
