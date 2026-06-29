/* reactions.js
 * Static rich-reactive bot layer for /bookwormcard/.
 * Provides: per-question reaction pools, keyword pattern detection,
 * length-based mirroring, age-shifted variants, stat dictionary scanning.
 *
 * No API calls. Fully local. Always-on baseline.
 * Augmented later by Gemini layer for novel content (gemini-bridge.js).
 */

(function(global){
  'use strict';

  // ============================================================
  // REACTION POOLS BY QUESTION-FIELD
  // Each field has Morpheus-flavored brief utterances.
  // These fire ONLY when Gemini API is unavailable. Gemini is the primary voice.
  // ============================================================
  var REACTIONS = {
    handle: [
      'a name.',
      'good. names matter here.',
      'received.',
      'the name is yours now.',
      'so the system can find you.'
    ],
    email: [
      'so the card finds you.',
      'a way back.',
      'the trail is set.'
    ],
    'birth-year': [
      'the calendar opens.',
      'the sky reads your year.',
      'now we know when.',
      'the traditions begin.'
    ],
    'birth-place': [
      'the ground beneath the year.',
      'the place that watched you arrive.',
      'where the stars looked down.',
      'the latitude is set.'
    ],
    animal: [
      'follow.',
      'good.',
      'the burrow chose well.',
      'a worthy mode.',
      'so it begins.'
    ],
    backstory: [
      'this is the ground you came from.',
      'the foundation, then.',
      'so this is where you start.',
      'the soil before the burrow.'
    ],
    motivation: [
      'this is the pull.',
      'the engine, then.',
      'what moves you.',
      'good. desire is fuel.'
    ],
    fear: [
      'fear is half of who you are.',
      'naming it weakens it.',
      'the thing in the dark.',
      'we know what you avoid now.'
    ],
    flaw: [
      'admitting it is half the work.',
      'the leak. you see it.',
      'most never name it.',
      'this is what character costs.'
    ],
    bond: [
      'this is what you would not let go of.',
      'the anchor, then.',
      'the line that stays.',
      'good. you have an anchor.'
    ],
    ideal: [
      'the spine of you.',
      'the rule above other rules.',
      'this is your principle.',
      'the organizing thread.'
    ],
    secret: [
      'held.',
      'the card carries it now.',
      'in the burrow, safely.',
      'the weight is acknowledged.'
    ],
    'pivotal-event': [
      'the turn.',
      'before-and-after, named.',
      'this is your discontinuity.',
      'the moment that split the timeline.'
    ],
    'smash-name': [
      'a figure of yours.',
      'you have absorbed something from this one.',
      'a teacher, then.',
      'good. influences are real.'
    ],
    'smash-quality': [
      'taken. it is yours now.',
      'absorbed.',
      'the smashing works.',
      'this quality, you keep.'
    ],
    wildcard: [
      'the unstructured layer.',
      'received.',
      'the card carries what you give it.',
      'the extra trace.'
    ],
    'smash-empty': [
      'no figures named today.',
      'the smashing waits.',
      'no clay aggregated.'
    ],
    'skip-default': [
      'kept private.',
      'the card stays empty here.',
      'a man who declines.',
      'left in the burrow.'
    ]
  };

  // Length-bucketed reactions append AFTER the field-specific reaction.
  // Compressed for Morpheus-voice — sparse, only when meaningful.
  var LENGTH_REACTIONS = {
    veryShort: ['', '', '', ''], // tight = good, no comment
    short: ['', '', '', '', ''],
    medium: ['', '', '', ''],
    long: ['you have written real depth.', 'committed answer.', '', ''],
    veryLong: ['this carries weight.', 'a full piece of you.', '', '']
  };

  // ============================================================
  // KEYWORD PATTERNS — match user input, fire Morpheus-flavored reactions
  // ============================================================
  var KEYWORD_REACTIONS = [
    { pattern:/\b(death|died|dead|dying|grief|loss|losing|funeral)\b/i, reactions:['the heaviest category.', 'this is the weight.', 'death is the substrate of every story.'] },
    { pattern:/\b(love|loved|loving|adore)\b/i, reactions:['the strongest force you carry.', 'binding.', 'the pull that does not weaken.'] },
    { pattern:/\b(god|jesus|allah|buddha|prayer|spiritual|spirit|sacred|holy)\b/i, reactions:['the higher categories.', 'you reach upward.', 'the sacred carries you.'] },
    { pattern:/\b(art|paint|paintings?|drawing|drew|music|song|dance|dancing|writing|wrote)\b/i, reactions:['the maker speaks.', 'creation is its own substrate.', 'you build worlds.'] },
    { pattern:/\b(family|mom|mother|dad|father|brother|sister|sibling|parent|grandm|grandp)\b/i, reactions:['the first bonds.', 'the foundational ties.', 'this is where you began.'] },
    { pattern:/\b(fuck|shit|damn|hell)\b/i, reactions:['raw, then.', 'unfiltered. respected.', 'the truth without performance.'] },
    { pattern:/\b(stupid|dumb|idiot|loser|worthless|hate myself)\b/i, reactions:['heavy on yourself. seen.', 'be careful with that voice.', 'the burrow is shelter, not punishment.'] },
    { pattern:/\b(strong|brave|fearless|fight|fought|stood up|stood my ground)\b/i, reactions:['the courage line.', 'you stood. that matters.', 'fierce.'] },
    { pattern:/\b(why|wonder|curious|mystery|question|figure out|trying to understand)\b/i, reactions:['the seeker.', 'questions are how bookworms eat.', 'good. the asking is the work.'] },
    { pattern:/\b(book|books|reading|read|library|literature|novel|story|stories)\b/i, reactions:['fellow worm.', 'the substrate-eater speaks.', 'you live in pages.'] }
  ];

  // ============================================================
  // STAT DICTIONARY — keywords that signal stat-dimensions
  // Each match awards +1 to the stat. Stats accumulate.
  // ============================================================
  var STAT_PATTERNS = [
    // Charisma / social pull
    { stat:'CHARISMA', patterns:[/\b(rally|gather|host|charm|charmed|persuade|persuaded|inspire|inspired|leader|led)\b/i] },
    { stat:'EMPATHY', patterns:[/\b(felt for|listen|heard them|understand them|comfort|comforted|hugged|cared for|cared about|noticed they)\b/i] },
    { stat:'LOYALTY', patterns:[/\b(stayed|loyal|stuck by|never left|always there|by their side|ride or die|never abandoned)\b/i] },

    // Cognitive
    { stat:'INTELLECT', patterns:[/\b(figured out|solved|calculated|reasoned|analyzed|deduced|understood the pattern|saw the logic)\b/i] },
    { stat:'CURIOSITY', patterns:[/\b(curious|wondered|explored|investigated|asked|questioned|kept asking)\b/i] },
    { stat:'WISDOM', patterns:[/\b(realized|learned|understood|came to see|finally saw|reflected|in hindsight)\b/i] },

    // Action
    { stat:'COURAGE', patterns:[/\b(brave|stood up|fought|refused|risked|terrified but did it|scared and did it anyway|faced)\b/i] },
    { stat:'STEALTH', patterns:[/\b(quiet|unnoticed|slipped|sneaked|sneaky|under the radar|without anyone knowing|secretly)\b/i] },
    { stat:'PERCEPTION', patterns:[/\b(noticed|saw|spotted|observed|caught|picked up on|read the room)\b/i] },
    { stat:'STRENGTH', patterns:[/\b(carried|lifted|hauled|pushed through|endured|powered through|survived)\b/i] },
    { stat:'AGILITY', patterns:[/\b(quick|fast|reflex|reflexes|dodged|jumped|leaped|sprinted|caught in time)\b/i] },

    // Creative
    { stat:'IMAGINATION', patterns:[/\b(made|built|created|designed|invented|drew|painted|wrote|composed|imagined|dreamed up)\b/i] },
    { stat:'STORY-TELLING', patterns:[/\b(told the story|narrated|story|stories|fable|myth|tale|recount)\b/i] },

    // Emotional self-knowledge
    { stat:'SELF-CRITIQUE', patterns:[/\b(my flaw|my fault|i was wrong|i messed up|my mistake|admit|regret|guilty)\b/i] },
    { stat:'VULNERABILITY', patterns:[/\b(scared|afraid|fear|terrified|cried|ashamed|embarrassed|exposed)\b/i] },
    { stat:'RESILIENCE', patterns:[/\b(came back|recovered|bounced back|got through|survived|kept going|did not give up|even when|despite|even though)\b/i] },
    { stat:'HUMOR', patterns:[/\b(funny|joke|laugh|laughing|laughed|hilarious|wisecrack|jest|comic|comedic|witty|silly|absurd)\b/i] },
    { stat:'PLAYFULNESS', patterns:[/\b(play|playful|game|games|gleeful|silly|fun|messing around|whimsy|whimsical)\b/i] },
    { stat:'VERBAL-DEXTERITY', patterns:[/\b(talk himself out|talked his way|word salad|silver tongue|smooth talker|talked around|argued)\b/i] },
    { stat:'COMMITMENT', patterns:[/\b(over (the )?(years|months|decades)|every (day|morning|night)|kept doing|never stopped|long-?term)\b/i] },
    { stat:'WITNESS', patterns:[/\b(saw what happened|witnessed|saw it all|kept watching|observed without intervening|just watched)\b/i] },

    // Moral
    { stat:'JUSTICE', patterns:[/\b(fair|unfair|justice|injustice|right thing|wrong thing|stood for|spoke up against)\b/i] },
    { stat:'HONESTY', patterns:[/\b(told the truth|honest|came clean|admitted|did not lie|truthful)\b/i] },
    { stat:'MERCY', patterns:[/\b(forgave|gave another chance|let them off|did not press|spared|showed grace)\b/i] },

    // Polymyth-flavored
    { stat:'META-AWARENESS', patterns:[/\b(this conversation|this interaction|aware that|realizing now|right now i|interesting that)\b/i] },
    { stat:'PATTERN-RECOGNITION', patterns:[/\b(pattern|recurring|always happens|similar to|reminds me of|same as)\b/i] },
    { stat:'IRREDUCIBILITY', patterns:[/\b(can not be reduced|both at once|all true|multiple things|paradox|contradiction)\b/i] }
  ];

  // ============================================================
  // PER-QUESTION EXPLANATIONS (the "why does this matter")
  // Inline taglines + on-demand "why" responses
  // ============================================================
  var EXPLANATIONS = {
    handle: {
      tagline: 'this is how the card identifies you. carries the caret.',
      why: 'your handle is the name your card carries. the caret prefix (^) marks it as identity in this world. this is the only field that has to be readable.'
    },
    email: {
      tagline: 'so the card can reach you.',
      why: 'the email is how the finished wormcard gets back to you. it is not displayed on the card itself. nobody else sees it.'
    },
    'birth-year': {
      tagline: 'unlocks the polymyth horoscope. eleven traditions read the year.',
      why: 'birth-data is the substrate the polymyth horoscope reads. eleven cosmological traditions look at the same data and produce different signs. the year alone gives you two readings (chinese animal, tibetan element-animal). adding date and time and place unlocks all twelve.'
    },
    'birth-month': {
      tagline: 'unlocks the western, celtic, hellenistic, egyptian, mesopotamian, hebrew traditions.',
      why: 'these traditions all read the position in the solar year. month-and-day together give them what they need.'
    },
    'birth-day': {
      tagline: 'completes the date readings.',
      why: 'with the day, the date-based readings finalize. mayan and aztec day-signs need the full date to compute.'
    },
    'birth-hour': {
      tagline: 'unlocks burmese mahabote (weekday), helps vedic.',
      why: 'birth-time matters for traditions that distinguish day-segments. burmese splits wednesday into morning/afternoon. vedic uses time to compute moon-position.'
    },
    'birth-place': {
      tagline: 'unlocks hegelianekitty tier (vedic-grade depth).',
      why: 'birth-place enables the deepest vedic readings. providing place + time triggers the hegelianekitty tier marker on your card. the tier is a visibility-marker only. it does not unlock content. it signals you opted into the deepest data layer available.'
    },
    animal: {
      tagline: 'the burrowing creature whose mode-of-being feels like yours.',
      why: 'in bookwormburrows, the burrowing animal is your character substrate. each one carries a way-of-being-in-the-world. the worm digs and eats. the owl waits at the burrow mouth. the polar bear digs only to mother. you are picking the mode you most operate in. this becomes your card identity.'
    },
    backstory: {
      tagline: 'three sentences. where you are from. the shaping event. what brought you here.',
      why: 'every character has a backstory. real characters too. three sentences forces compression. compression forces you to pick what mattered. the shaping event is the load-bearing one.'
    },
    motivation: {
      tagline: 'what you want most. the pull.',
      why: 'character is what you want. your behavior follows from this. naming it makes it visible to you and to anyone who reads your card.'
    },
    fear: {
      tagline: 'what you would never want to face. the shape of avoidance.',
      why: 'fear is half of character. you are also what you flee. the shape you avoid tells more than what you chase, sometimes.'
    },
    flaw: {
      tagline: 'the trait that has gotten you in trouble before. self-honest.',
      why: 'admitting the flaw is itself a stat. the inability to name it is a different kind of flaw. characters in fiction are remembered by their flaws as much as their strengths.'
    },
    bond: {
      tagline: 'a person place or thing you would die for. the anchor.',
      why: 'the bond is the non-negotiable. what stays even when everything else falls. it teaches you what you actually value. words can lie. what you would die for cannot.'
    },
    ideal: {
      tagline: 'the principle you organize your life around.',
      why: 'an ideal is a self-imposed rule. honesty. kindness. craft. courage. you are picking the one that organizes everything else. only one. this forces a hierarchy.'
    },
    secret: {
      tagline: 'something you carry that you have not told.',
      why: 'a secret reveals what you protect. it is not necessarily shameful. some secrets are precious. some are heavy. the carrying tells more than the content.'
    },
    'pivotal-event': {
      tagline: 'the moment you would point to as the turn.',
      why: 'every life has a pivot. before-and-after. naming yours is naming the discontinuity in your story. some pivots are visible. some are private. yours is yours.'
    },
    'smash-name': {
      tagline: 'name someone you admire.',
      why: 'character-smashing is a polymyth move. you build your character not from scratch but from qualities of figures you have absorbed. naming the figures makes your influences visible. the more you smash, the more clay.'
    },
    'smash-quality': {
      tagline: 'name the specific quality you would take.',
      why: 'the quality matters more than the figure. you are not idolizing them. you are extracting a specific ability or trait you want to grow. precision. courage. wit. patience. name the one quality.'
    },
    wildcard: {
      tagline: 'anything else for whoever encounters your card.',
      why: 'this is the unstructured space. a quote you live by. a current obsession. a correction to anything above. a note for the next worm. anything that does not fit the categories above.'
    },
    // ============================================================
    // DEEP QUESTIONS — only reached if player chose to go deeper at the threshold.
    // Each names what the question is for in voice, not in mechanic-language.
    // ============================================================
    trait_unlearned: {
      tagline: 'a thing you do that no one taught you.',
      why: 'inheritance you cannot trace. the unlearned move is yours but came from nowhere you can name. these are character substrate. the move you make before you have decided to make it.'
    },
    trait_avoided: {
      tagline: 'an avoidance you cannot account for.',
      why: 'the avoidances you cannot explain are character data. the room you do not enter even though nothing is in it tells the card who you are.'
    },
    trait_surfacing: {
      tagline: 'who shows up when the polish goes.',
      why: 'tired you. drunk you. three a m you. the underself the people who love you have learned to wait out. character is what surfaces, not what you compose.'
    },
    cognition: {
      tagline: 'where the actual thinking happens.',
      why: 'cognition is not abstract. it has a substrate. walking. paper. shower. talking aloud. the card needs to know which medium your mind needs. it changes how the character moves through dimensions.'
    },
    belief_loud: {
      tagline: 'the conviction you would lose friends over.',
      why: 'the belief you defend in the room knowing the cost. naming it commits you to it. characters in fiction are remembered for what they refuse to soften.'
    },
    belief_quiet: {
      tagline: 'a belief you have stopped defending out loud.',
      why: 'the position you abandoned the public case for, but kept the private hold on. these are real and unrepresented. the card gives them somewhere to live.'
    },
    belief_doubted: {
      tagline: 'a belief you suspect is wrong.',
      why: 'the conviction you keep against the evidence in your own life. holding it teaches you something about yourself. abandoning it would teach something else. naming it is the move that makes either honest.'
    },
    dilemma_friend: {
      tagline: 'love versus respect for autonomy. say what you do.',
      why: 'this is the ethics test. silence preserves the friendship and continues the harm. speech may end both. how you move tells the card what kind of friend you actually are.'
    },
    dilemma_stranger: {
      tagline: 'no information to read. only your defaults.',
      why: 'when nothing in the situation tells you yes or no, what you do is what you actually are. your default is not a choice. naming it is.'
    },
    dilemma_witness: {
      tagline: 'the wrong is real. exposing it exposes you.',
      why: 'the witness dilemma. silence preserves your cover and continues the harm. speech ends the harm and exposes you. the card records which cost you would pay.'
    },
    teach_short: {
      tagline: 'something portable. could teach a stranger in ten minutes.',
      why: 'the short gift. small, transferable, can be handed off without ceremony. the world becomes infinitesimally better the moment you name it.'
    },
    teach_long: {
      tagline: 'something only transmittable through time.',
      why: 'the depth gift. requires the receiver to already be inside the door. the lesson that needs presence, not language. and earned access. the card holds it for whoever earns the access.'
    },
    face_after: {
      tagline: 'who you want to be when the card seals.',
      why: 'the card is going to remember this version. the carapace hardens around what you say here. tell it who.'
    }
  };

  // ============================================================
  // AGE-SHIFTED REACTION VARIANTS
  // For younger players, Morpheus stays Morpheus but shorter and warmer.
  // ============================================================
  var AGE_REACTIONS = {
    'under-13': {
      handle: ['a name. good.', 'the system knows you now.', 'received.'],
      animal: ['follow.', 'good pick.', 'a strong choice.'],
      backstory: ['the ground you came from.', 'a real story.', 'good.'],
      fear: ['naming it makes it smaller.', 'brave to say.', 'the thing in the dark, named.'],
      flaw: ['most never see it. you do.', 'this is honesty.', 'the leak. seen.'],
      'smash-name': ['a teacher.', 'good.', 'a figure of yours.'],
      'smash-quality': ['absorbed.', 'taken.', 'you keep this.']
    },
    '13-17': {
      // uses defaults
    },
    '18-25': {
      // uses defaults
    },
    '26-39': {
      // uses defaults
    },
    '40-plus': {
      handle: ['a name carried long.', 'received.'],
      animal: ['the choice settles.', 'follow.'],
      backstory: ['a real piece of history.', 'the ground is deep here.']
    }
  };

  // ============================================================
  // PUBLIC API
  // ============================================================

  function pick(arr){
    if(!arr || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getAgeRange(birthYear){
    if(!birthYear) return null;
    var age = (new Date()).getFullYear() - parseInt(birthYear, 10);
    if(age < 13) return 'under-13';
    if(age < 18) return '13-17';
    if(age < 26) return '18-25';
    if(age < 40) return '26-39';
    return '40-plus';
  }

  // Smash-name detector — categorizes the named figure to pick a relevant reaction.
  // This prevents "a teacher, then." from firing on every smash even when API is offline.
  var SMASH_PATTERNS = [
    { rx:/\b(spider-?man|spiderman|peter parker)\b/i, reactions:['the friendly-neighborhood one. wisecracks under pressure.','great power, great responsibility, great anxiety.','the kid who got bit and never put it down.'] },
    { rx:/\b(superman|clark kent|kal-el)\b/i, reactions:['the boy scout from a dead planet.','god-tier with a journalist day-job. the farm-raised demigod.','strength as restraint. interesting pick.'] },
    { rx:/\b(batman|bruce wayne)\b/i, reactions:['the one who refused to use the obvious solution.','grief processed as infrastructure.','the rich kid who stayed angry productively.'] },
    { rx:/\b(jesus|christ)\b/i, reactions:['the carpenter who returned.','interesting. the one who said the meek inherit.','radical-witness category.'] },
    { rx:/\b(buddha|siddhartha|gautama)\b/i, reactions:['the prince who walked out.','seer of the chain of causes.','the one who sat until he knew.'] },
    { rx:/\b(socrates)\b/i, reactions:['the question-asker. the one they killed for it.','the gadfly. the loud refusal.','the one who knew that he did not know.'] },
    { rx:/\b(my (mom|mother|mum))\b/i, reactions:['the foundational bond. close-range smashing.','the first teacher. heaviest influence.','the one who shaped you before language.'] },
    { rx:/\b(my (dad|father))\b/i, reactions:['the foundational figure. close-range smashing.','the one whose patterns you carry, knowingly or not.','first model. heaviest influence.'] },
    { rx:/\b(my (grandm|grandma|grandmother|nana|nan))\b/i, reactions:['the one who teaches across generations.','wisdom-from-distance. respected.','the long-pattern carrier.'] },
    { rx:/\b(my (brother|sister|sibling))\b/i, reactions:['the parallel-life figure. they know what you know.','same household, different angle. interesting.','the witness from inside the same start.'] },
    { rx:/\b(beyonc|taylor swift|rihanna|madonna|prince|david bowie|bowie)\b/i, reactions:['the world-shaper. taken seriously.','platform-mythology figure. carries weight.','interesting pick. the cultural-substrate dweller.'] },
    { rx:/\b(einstein|hawking|feynman|tesla)\b/i, reactions:['the seer of structure. good model.','curiosity as discipline. respected.','the one who bent the abstractions.'] },
    { rx:/\b(martin luther king|mlk|malcolm x|gandhi|mandela)\b/i, reactions:['the one who organized refusal.','witness-courage figure. weighty.','spoke against the substrate. paid for it.'] },
    { rx:/\b(shakespeare|tolstoy|dostoyevsky|kafka|joyce|borges|woolf|baldwin|morrison|toni morrison)\b/i, reactions:['the substrate-eater you read.','word-builder. proper bookworm.','the one who burrowed into language and brought back something.'] }
  ];
  function smashNameReaction(input){
    if(!input) return null;
    for(var i = 0; i < SMASH_PATTERNS.length; i++){
      if(SMASH_PATTERNS[i].rx.test(input)){
        return pick(SMASH_PATTERNS[i].reactions);
      }
    }
    return null;
  }

  function reactionFor(field, input, birthYear){
    // Smash-name gets content-aware first
    if(field === 'smash-name'){
      var sm = smashNameReaction(input);
      if(sm) return sm;
    }

    var pool;
    var ageRange = getAgeRange(birthYear);
    if(ageRange && AGE_REACTIONS[ageRange] && AGE_REACTIONS[ageRange][field]){
      pool = AGE_REACTIONS[ageRange][field];
    } else {
      pool = REACTIONS[field] || REACTIONS['skip-default'];
    }
    var primary = pick(pool);

    // Length-based tail
    var tail = '';
    if(input && typeof input === 'string'){
      var len = input.length;
      if(len < 8) tail = pick(LENGTH_REACTIONS.veryShort);
      else if(len > 250) tail = pick(LENGTH_REACTIONS.veryLong);
      else if(len > 120) tail = pick(LENGTH_REACTIONS.long);
    }

    // Keyword reactions — append if matched
    var kw = '';
    if(input && typeof input === 'string'){
      for(var i = 0; i < KEYWORD_REACTIONS.length; i++){
        var k = KEYWORD_REACTIONS[i];
        if(k.pattern.test(input)){
          kw = pick(k.reactions);
          break;
        }
      }
    }

    // Combine: primary + (one of tail/kw, prefer kw)
    var parts = [primary];
    if(kw) parts.push(kw);
    else if(tail) parts.push(tail);
    return parts.filter(Boolean).join(' ');
  }

  function statsFor(input){
    // Delegate to DepthEngine if available (the new ~184-stat adjective ladder).
    // Returns array of stat names for backward compat with existing awardStats().
    if(!input || typeof input !== 'string') return [];
    if(global.DepthEngine && global.DepthEngine.scoreAnswer){
      var r = global.DepthEngine.scoreAnswer('legacy', input, {});
      return r.statsHit.map(function(h){ return h.stat; });
    }
    // Legacy fallback — only fires if DepthEngine failed to load
    var hits = [];
    STAT_PATTERNS.forEach(function(s){
      for(var i = 0; i < s.patterns.length; i++){
        if(s.patterns[i].test(input)){
          hits.push(s.stat);
          return;
        }
      }
    });
    return hits;
  }

  // Full scoring API for the new chat phases — returns the complete DepthEngine
  // result including xpDelta, hpDelta, quirksHit. Field name and context (age, hp)
  // are passed through so age-adjustment and HP-context apply.
  function scoreFor(field, input, ctx){
    if(!global.DepthEngine || !global.DepthEngine.scoreAnswer){
      // Legacy fallback returns minimal shape
      return { xpDelta: 0, hpDelta: 0, statsHit: [], quirksHit: [], reasons: [] };
    }
    return global.DepthEngine.scoreAnswer(field, input, ctx || {});
  }

  function explanationFor(field){
    return EXPLANATIONS[field] || null;
  }

  function whyFor(field){
    var e = EXPLANATIONS[field];
    return e ? e.why : 'this question is part of building your wormcard. you can skip it if you want.';
  }

  function taglineFor(field){
    var e = EXPLANATIONS[field];
    return e ? e.tagline : '';
  }

  global.Reactions = {
    reactionFor: reactionFor,
    statsFor: statsFor,
    scoreFor: scoreFor,
    whyFor: whyFor,
    taglineFor: taglineFor,
    getAgeRange: getAgeRange,
    explanationFor: explanationFor
  };

})(typeof window !== 'undefined' ? window : this);
