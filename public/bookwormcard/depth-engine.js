/* depth-engine.js
 * Bookwormburrows depth-progression engine.
 *
 * Public surface (all on window.DepthEngine):
 *   scoreAnswer(field, input, ctx)  → { xpDelta, hpDelta, statsHit:[...], quirksHit:[...], reasons:[...] }
 *   tierFor(xp)                     → 'worm' | 'silkworm' | 'cocoon' | 'animal'
 *   levelFor(xp)                    → 1..4   (only meaningful at animal tier)
 *   thresholdsBetween(tier)         → { lowerXP, upperXP }  (the bar's domain at this tier)
 *   normalizedBar(xp, tier)         → 0..1   (where the bar should fill within the current tier)
 *   THRESHOLDS                      → { silkworm:20, cocoon:50, animal:85 }
 *
 * Scoring philosophy (locked with user):
 *   - Stats are ADJECTIVES. A character IS ironic. Not HAS irony.
 *   - All positive stats add XP and write to data.stats.
 *   - Negative stats (PLATITUDE_PRONE, VAGUE_PRONE, DISENGAGED, LOW_CONTENT) damage HP.
 *     They DO NOT subtract XP. They DO get recorded as character quirks.
 *   - Pure noise (fails gobbledygook gate) — already handled upstream by retry; engine never sees it.
 *   - The engine moralizes about NOTHING. Edginess, narcissism, bombast etc. are all positive
 *     character markers — the question is only whether the answer contributes to the
 *     collective imagination of who this character is.
 *
 * Stat weights (XP per detected hit):
 *   Tier-1 (cognitive depth, image-making, specificity, structural craft): +3 XP
 *   Tier-2 (character substance, voice, register, stance, action shape): +2 XP
 *   Tier-3 (light-craft markers — only structural quality of writing): +1 XP, capped at 5/answer
 *
 * HP starts at 100. Heals +1 per Tier-1 hit. Damage scales per quirk weight.
 */
(function(global){
  'use strict';

  // ============================================================
  // THRESHOLDS — XP gates between life-stages of the creature
  // ============================================================
  var THRESHOLDS = {
    worm:     0,
    silkworm: 20,
    cocoon:   50,
    animal:   85
  };
  // Above 85 XP, level brackets within animal stage:
  // L1: 85-129  L2: 130-174  L3: 175-219  L4: 220+
  var LEVEL_STEP = 45;

  function tierFor(xp){
    if(xp >= THRESHOLDS.animal)   return 'animal';
    if(xp >= THRESHOLDS.cocoon)   return 'cocoon';
    if(xp >= THRESHOLDS.silkworm) return 'silkworm';
    return 'worm';
  }
  function levelFor(xp){
    if(xp < THRESHOLDS.animal) return 0;  // not yet at level-1
    var over = xp - THRESHOLDS.animal;
    return Math.min(4, 1 + Math.floor(over / LEVEL_STEP));
  }
  function thresholdsBetween(tier){
    if(tier === 'worm')     return { lowerXP: 0, upperXP: THRESHOLDS.silkworm };
    if(tier === 'silkworm') return { lowerXP: THRESHOLDS.silkworm, upperXP: THRESHOLDS.cocoon };
    if(tier === 'cocoon')   return { lowerXP: THRESHOLDS.cocoon, upperXP: THRESHOLDS.animal };
    return { lowerXP: THRESHOLDS.animal, upperXP: THRESHOLDS.animal + LEVEL_STEP * 4 };
  }
  function normalizedBar(xp, tier){
    var t = tier || tierFor(xp);
    var b = thresholdsBetween(t);
    if(b.upperXP === b.lowerXP) return 1;
    return Math.max(0, Math.min(1, (xp - b.lowerXP) / (b.upperXP - b.lowerXP)));
  }

  // ============================================================
  // POSITIVE STAT DICTIONARY
  // Each rule fires regex against input, awards XP at given weight,
  // and records the named adjective stat onto data.stats[stat].
  //
  // weight 3 = cognitive depth & image-making — moves bar significantly
  // weight 2 = character substance, voice, register, stance — fleshes out character
  // weight 1 = light-craft markers — bonus only, capped per-answer
  //
  // Patterns are deliberately broad. Cards get richer with overlap.
  // The patterns can be wrong on edge cases — that's fine, you read the
  // qualityHistory log later and refine. The engine does not need to be perfect;
  // it needs to be RICH.
  // ============================================================

  var POSITIVE_RULES = [

    // ---- COGNITIVE DEPTH (+3) ----
    { stat:'IRREDUCIBLE',          w:3, p:[/\b(both at once|all (?:are )?true|paradox|contradiction|cannot be reduced|and yet|but also|yet (?:also|still)|both .*and|neither .*nor)\b/i] },
    { stat:'META-AWARE',           w:3, p:[/\b(this conversation|this interaction|right now i|i am realizing|noticing as i type|interesting that i|even saying|even writing|the act of)\b/i] },
    { stat:'PATTERN-SEEING',       w:3, p:[/\b(every time|always happens|same pattern|reminds me of|similar to|recurring|like every|same as before|the same .*again)\b/i] },
    { stat:'DIALECTICAL',          w:3, p:[/\b(i thought .*but |i used to .*now|first .*then .*so|thought i wanted .*but actually|believed .*until)\b/i] },
    { stat:'SELF-CRITICAL',        w:3, p:[/\b(my (?:flaw|fault|mistake)|i was wrong|i admit|i regret|i should have|looking back|in hindsight|i messed up|my failing)\b/i] },
    { stat:'NEGATIVELY-CAPABLE',   w:3, p:[/\b(i (?:am )?not sure|uncertain|don'?t fully know|still working|cannot say|hard to say|not yet figured)\b.*\w{4,}/i] },
    { stat:'SYSTEMS-MINDED',       w:3, p:[/\b(the system|the structure|the pattern (?:is|of)|the way (?:it|they|things) work|emergent|feedback loop|reinforces|sustains itself)\b/i] },
    { stat:'COUNTERFACTUAL',       w:3, p:[/\b(if i had|if it had|would have|could have been|in another life|alternate|what if|had i|imagine if)\b/i] },
    { stat:'ANALOGICAL',           w:3, p:[/\b(like a |as if|the way (?:a|an|the).* does|reminds me of how|kind of like)\b/i] },
    { stat:'GENEALOGICAL',         w:3, p:[/\b(my (?:mother|father|grandmother|grandfather) used to|grew up (?:in|with)|inherited|passed down|family of)\b/i] },
    { stat:'PHENOMENOLOGICAL',     w:3, p:[/\b(the feeling of|what it (?:feels|felt) like|the way it (?:tastes|smells|looks|sounds)|the texture of|the weight of)\b/i] },

    // ---- CRAFT MARKERS (+3) ----
    { stat:'SPECIFIC',             w:3, p:[/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|am|pm|o'?clock)\b/i, /\b(19|20)\d{2}\b/, /\b(at|in) [A-Z][a-z]+/] },
    { stat:'IMAGE-MAKING',         w:3, p:[/\blike (?:a|an|the) \w+\b/i, /\bas if\b/i, /\b(?:looks|sounds|feels|smells|tastes) like\b/i, /\b(?:reminds|resembles)\b/i, /\b(?:left|gave) me\b/i] },
    { stat:'COMPRESSED',           w:3, p:[/^.{1,80}\.\s*$/], note:'short answer ending in period — weight only fires for terse-and-loaded' },
    { stat:'STRUCTURED',           w:3, p:[/\b(first[, ].*then|before .*after|because .*so|when .*then)\b/i] },
    { stat:'CONCRETE',             w:3, p:[/\b\d+ (?:years|months|weeks|days|hours|minutes|miles|feet|dollars|times)\b/i, /\b(red|blue|green|yellow|black|white|brown|orange|purple|pink|grey|gray) [a-z]+/i] },
    { stat:'SENSORY',              w:3, p:[/\b(smell(?:ed|s)?|taste(?:d|s)?|touched|heard|saw|felt|skin|hands|breath|warm|cold|loud|quiet|bright|dark|sharp|smooth)\b/i] },

    // ---- VOICE & RHETORIC (+2) ----
    { stat:'GRAVE',                w:2, p:[/\b(weight|gravity|sober|solemn|the cost of|the price of)\b/i] },
    { stat:'LIGHT',                w:2, p:[/\b(light|airy|easy|breezy|bright)\b/i] },
    { stat:'IRONIC',               w:2, p:[/\b(of course|naturally|how convenient|imagine that|wouldn'?t you know|funny enough|the irony)\b/i] },
    { stat:'SINCERE',              w:2, p:[/\b(i mean (?:it|that)|truly|honestly|genuinely|for real|no joke)\b/i] },
    { stat:'DEADPAN',              w:2, p:[/^[a-z][^!?]*\.\s*$/], note:'flat declarative, no exclamation' },
    { stat:'EARNEST',              w:2, p:[/\b(i care|matters to me|i (?:really|truly) believe|important to me)\b/i] },
    { stat:'WRY',                  w:2, p:[/\b(somehow|apparently|allegedly|sort of|kind of|i guess)\b.*[a-z]/i] },
    { stat:'BOMBASTIC',            w:2, p:[/!{2,}/, /[A-Z]{4,}/, /\b(magnificent|extraordinary|tremendous|colossal|monumental|epochal)\b/i] },
    { stat:'UNDERSTATED',          w:2, p:[/\b(a (?:bit|little)|somewhat|rather|fairly|not too)\b/i] },
    { stat:'HYPERBOLIC',           w:2, p:[/\b(literally (?:dying|crying|dead)|the (?:best|worst) ever|every single|completely|absolutely)\b/i] },
    { stat:'BLUNT',                w:2, p:[/^(no|yes|never|always|done|enough|stop|fuck|shit)\b/i] },
    { stat:'OBLIQUE',              w:2, p:[/\b(in a way|sort of|something like|hard to put|cannot quite say)\b/i] },
    { stat:'LYRICAL',              w:2, p:[/\b\w+ing\b.*\b\w+ing\b/i, /,\s*\w+,\s*\w+/], note:'multi-clause flow' },
    { stat:'RAMBLING',             w:2, p:[/^.{300,}/s], note:'long answer' },
    { stat:'APHORISTIC',           w:2, p:[/^[^.!?]{10,80}\.$/], note:'single sentence with weight' },
    { stat:'CONFESSIONAL',         w:2, p:[/\b(i have never told|never said this|nobody knows|i carry|in secret)\b/i] },
    { stat:'DECLARATIVE',          w:2, p:[/^(?:i am|this is|that is|it is|they are|we are)\b/i] },
    { stat:'QUESTION-PRONE',       w:2, p:[/\?/, /\b(why (?:does|do|is|are)|what if|how come|but who)\b/i] },

    // ---- STANCE (+2) ----
    { stat:'DEFIANT',              w:2, p:[/\b(i refuse|will not|never will|fuck (?:that|them|it)|told them no|stood my ground)\b/i] },
    { stat:'DEFERENTIAL',          w:2, p:[/\b(i listen|i defer|they know better|gave way|stepped aside)\b/i] },
    { stat:'INSURGENT',            w:2, p:[/\b(against|tear down|burn it|the system is|fight back|resist)\b/i] },
    { stat:'INSTITUTIONAL',        w:2, p:[/\b(the institution|proper channels|by the book|protocol|formal)\b/i] },
    { stat:'TRADITIONALIST',       w:2, p:[/\b(my (?:family|culture) always|the old way|tradition|how it has always|ancestors)\b/i] },
    { stat:'ICONOCLASTIC',         w:2, p:[/\b(break the|smash the|reject the|new way|throw out the old)\b/i] },
    { stat:'CONFORMIST',           w:2, p:[/\b(everyone (?:does|says)|the way it is|that'?s how|expected of)\b/i] },
    { stat:'ECCENTRIC',            w:2, p:[/\b(weird|strange|odd|peculiar|nobody else|just me|on my own)\b/i] },
    { stat:'CONTRARIAN',           w:2, p:[/\b(actually no|the opposite|other way around|disagree|but really)\b/i] },
    { stat:'WITHDRAWING',          w:2, p:[/\b(stepped back|pulled away|retreated|left the|got out)\b/i] },
    { stat:'ENGAGED',              w:2, p:[/\b(jumped in|got involved|threw myself|in the middle of|right there)\b/i] },
    { stat:'DETACHED',              w:2, p:[/\b(at a distance|did not feel|cool about|removed|impersonal)\b/i] },
    { stat:'ENTANGLED',            w:2, p:[/\b(caught up in|wrapped up|cannot separate|all tangled|bound up)\b/i] },

    // ---- CHARACTER SUBSTANCE (+2) ----
    { stat:'LOYAL',                w:2, p:[/\b(stayed with|never left|stood by|by their side|always there)\b/i] },
    { stat:'DISLOYAL',             w:2, p:[/\b(walked away|cut off|left them|betrayed|gave up on)\b/i] },
    { stat:'DEVOTED',              w:2, p:[/\b(every day|for years|my whole|kept doing|never stopped|over and over)\b/i] },
    { stat:'GENEROUS',             w:2, p:[/\b(gave (?:them|her|him|it)|shared|offered|paid for|let them have)\b/i] },
    { stat:'CALCULATING',          w:2, p:[/\b(played the long|figured out|worked out the|leveraged|positioned)\b/i] },
    { stat:'MERCIFUL',             w:2, p:[/\b(forgave|let (?:it|them) go|gave another chance|spared|did not press)\b/i] },
    { stat:'SEVERE',               w:2, p:[/\b(no mercy|did not forgive|never forgot|held it|punished)\b/i] },
    { stat:'JUST',                 w:2, p:[/\b(fair|unfair|justice|injustice|the right thing|stood for)\b/i] },
    { stat:'LENIENT',              w:2, p:[/\b(let it slide|easy on|gave a pass|did not push)\b/i] },
    { stat:'HONEST',               w:2, p:[/\b(told the truth|came clean|did not lie|admitted|confessed)\b/i] },
    { stat:'DECEPTIVE',            w:2, p:[/\b(lied|made up|covered up|hid the truth|misled|told them what they wanted)\b/i] },
    { stat:'COURAGEOUS',           w:2, p:[/\b(scared but|afraid but|did it anyway|despite (?:fear|the risk)|stepped up)\b/i] },
    { stat:'PRUDENT',              w:2, p:[/\b(thought about|measured|careful (?:with|about)|weighed|considered)\b/i] },
    { stat:'RECKLESS',             w:2, p:[/\b(without thinking|just did|jumped|threw caution|consequences be|damn the)\b/i] },
    { stat:'CAUTIOUS',             w:2, p:[/\b(took my time|moved slowly|did not rush|tested first|step by step)\b/i] },
    { stat:'PATIENT',              w:2, p:[/\b(waited|took time|slow|let it (?:come|happen)|in time)\b/i] },
    { stat:'IMPATIENT',            w:2, p:[/\b(could not wait|right now|immediately|already|too slow)\b/i] },
    { stat:'DISCIPLINED',          w:2, p:[/\b(every (?:morning|night|day)|practice|routine|stuck to|kept at)\b/i] },
    { stat:'INDULGENT',            w:2, p:[/\b(treated myself|why not|whole thing|all of it|spoiled)\b/i] },
    { stat:'ASCETIC',              w:2, p:[/\b(without|gave up|fasted|simple|bare|nothing more)\b/i] },
    { stat:'APPETITIVE',           w:2, p:[/\b(more|hungry for|craved|wanted (?:more|all)|could not stop)\b/i] },
    { stat:'HOSPITABLE',           w:2, p:[/\b(welcomed|made room|took (?:them|her|him) in|came over|stayed with us)\b/i] },
    { stat:'GUARDED',              w:2, p:[/\b(kept (?:to myself|it close)|did not (?:say|tell)|held back|private)\b/i] },
    { stat:'OPEN',                 w:2, p:[/\b(told (?:everyone|them all)|shared|let (?:them|him|her) in|nothing to hide)\b/i] },
    { stat:'CURIOUS',              w:2, p:[/\b(wondered|i wonder|asked (?:why|how|what)|wanted to know|tried to find out)\b/i] },
    { stat:'DOUBTING',             w:2, p:[/\b(not sure|cannot trust|skeptical|doubted|questioned)\b/i] },
    { stat:'CONVICTED',            w:2, p:[/\b(i know|i am certain|no question|absolutely|without a doubt)\b/i] },

    // ---- EMOTIONAL REGISTERS (+2) — adjectives. registers, not health-status. ----
    { stat:'JOYFUL',               w:2, p:[/\b(joy|joyful|delighted|elated|sang|laughed|grinning)\b/i] },
    { stat:'MELANCHOLIC',          w:2, p:[/\b(melancholy|melancholic|wistful|bittersweet|the sadness of|blue)\b/i] },
    { stat:'ANGRY',                w:2, p:[/\b(angry|furious|pissed|mad at|ticked|seething)\b/i] },
    { stat:'GRIEVING',             w:2, p:[/\b(grief|grieving|lost|missing|since they|the ache of)\b/i] },
    { stat:'TENDER',               w:2, p:[/\b(tender|gentle|soft with|held|stroked|cradled)\b/i] },
    { stat:'LONGING',              w:2, p:[/\b(longing|yearned|ache for|miss(?:ed)? terribly|wanted (?:so badly|desperately))\b/i] },
    { stat:'CONTENT',              w:2, p:[/\b(content|at peace|enough|good where i am|settled)\b/i] },
    { stat:'RAGEFUL',              w:2, p:[/\b(rage|raged|incandescent|see red|wanted to break)\b/i] },
    { stat:'PEACEFUL',             w:2, p:[/\b(peace|peaceful|calm|still inside|quiet inside)\b/i] },
    { stat:'TERRIFIED',            w:2, p:[/\b(terror|terrified|petrified|frozen with|sheer fear)\b/i] },
    { stat:'FASCINATED',           w:2, p:[/\b(fascinated|could not look away|drawn to|captivated|spellbound)\b/i] },
    { stat:'BORED',                w:2, p:[/\b(bored|nothing happened|same old|tedious|dull)\b/i] },
    { stat:'ECSTATIC',             w:2, p:[/\b(ecstatic|euphoric|out of my body|highest|on fire)\b/i] },
    { stat:'NUMB',                 w:2, p:[/\b(numb|did not feel|nothing felt|empty|just gone)\b/i] },
    { stat:'COMPOSED',             w:2, p:[/\b(kept it together|composed|did not flinch|steady|level)\b/i] },
    { stat:'ENVIOUS',              w:2, p:[/\b(envy|envious|jealous|wanted what|couldn'?t bear that)\b/i] },
    { stat:'GRATEFUL',             w:2, p:[/\b(grateful|thank|thankful|blessed|appreciate)\b/i] },
    { stat:'PROUD',                w:2, p:[/\b(proud|made me proud|stood tall|chest out|earned it)\b/i] },
    { stat:'HUMBLE',               w:2, p:[/\b(small in front of|nothing|just lucky|did not deserve|do not deserve)\b/i] },
    { stat:'ASHAMED',              w:2, p:[/\b(ashamed|shame|embarrassed|wanted to disappear|hid my face)\b/i] },
    { stat:'SHAMELESS',            w:2, p:[/\b(no shame|did not care who|right out in the open|brazen|unapologetic)\b/i] },
    { stat:'NOSTALGIC',            w:2, p:[/\b(used to|back then|those days|when i was|simpler times)\b/i] },
    { stat:'ANTICIPATING',         w:2, p:[/\b(cannot wait|coming up|soon|looking forward|building toward)\b/i] },
    { stat:'DREADING',             w:2, p:[/\b(dread|dreading|coming for me|knew it was coming|the worst part is coming)\b/i] },
    { stat:'HOPEFUL',              w:2, p:[/\b(hopeful|hope|maybe|might still|could be)\b/i] },

    // ---- WIT & HUMOR (+2) ----
    { stat:'PUNNING',              w:2, p:[/\b\w+ing\W+\w+ing\W/i], note:'rhyme/repetition pattern (loose proxy)' },
    { stat:'ABSURDIST',            w:2, p:[/\b(makes no sense|absurd|nonsense|wild|deranged)\b/i] },
    { stat:'SLAPSTICK',            w:2, p:[/\b(fell|tripped|crashed|smashed|spilled)\b.*\b(funny|laughed|hilarious|laughing)\b/i] },
    { stat:'GALLOWS-HUMORED',      w:2, p:[/\b(might as well laugh|nothing else to do|laugh or cry|funny in a way)\b/i, /\b(death|dying|grave)\b.*\b(funny|joke|laugh)\b/i] },
    { stat:'OBSERVATIONAL',        w:2, p:[/\b(have you noticed|isn'?t it weird|why do people|the way (?:we|they) all)\b/i] },
    { stat:'SELF-DEPRECATING',     w:2, p:[/\b(of course i|naturally i|me being me|typical me|i am the one who)\b/i] },
    { stat:'MOCKING',              w:2, p:[/\b(oh sure|right\.|yeah right|brilliant|genius|of all things)\b/i] },
    { stat:'WHIMSICAL',            w:2, p:[/\b(silly|whimsy|fancy|gleeful|bouncing|skipping)\b/i] },
    { stat:'NONSENSICAL',          w:2, p:[/\b(blarghum|bloop|wibble|squidge|blorp)\b/i, /\b\w*[xz]\w*[xz]\w*\b/i] },
    { stat:'SURREAL',              w:2, p:[/\b(dream(?:ed|t|y)|melting|inside out|the floor became|nothing made)\b/i] },

    // ---- EDGES (+2) — POSITIVE. Engine does not moralize. ----
    { stat:'EDGY',                 w:2, p:[/\b(fucked|fucking|shit|hell|damn|piss)\b/i] },
    { stat:'BLEAK',                w:2, p:[/\b(no point|pointless|the void|emptied|hollow|nothing matters)\b/i] },
    { stat:'NIHILIST',             w:2, p:[/\b(meaning(?:less)?|no purpose|nothing means|all empty|all dust)\b/i] },
    { stat:'TRANSGRESSIVE',        w:2, p:[/\b(crossed (?:a |the )?line|broke (?:a |the )?rule|forbidden|taboo|should not have)\b/i] },
    { stat:'TABOO-DRAWN',          w:2, p:[/\b(curious about|drawn to|fascinated by) .*(forbidden|wrong|dark|taboo)\b/i] },
    { stat:'MORBID',               w:2, p:[/\b(death|dying|corpse|body|funeral|grave|buried|ashes)\b/i] },
    { stat:'DARK-PLAYFUL',         w:2, p:[/\b(funny because)\b.*\b(awful|terrible|wrong|dark)\b/i] },
    { stat:'CYNICAL',              w:2, p:[/\b(of course they did|typical|always the same|never changes|knew it all along)\b/i] },

    // ---- LIGHT REGISTERS (+2) ----
    { stat:'WONDROUS',             w:2, p:[/\b(wonder|wondrous|marvelous|amazed|in awe|astonished)\b/i] },
    { stat:'DELIGHTED',            w:2, p:[/\b(delighted|delight|charmed|tickled|grin)\b/i] },
    { stat:'NAIVE',                w:2, p:[/\b(i thought everyone|did not know|had no idea|simple|innocent (?:to|of))\b/i] },
    { stat:'ENCHANTED',            w:2, p:[/\b(enchanted|spellbound|under (?:a |the )?spell|magic of|magical)\b/i] },
    { stat:'CHILDLIKE',            w:2, p:[/\b(reminded me of being (?:a )?(?:kid|child)|like a kid|when i was little|playground|recess)\b/i] },
    { stat:'OPTIMISTIC',           w:2, p:[/\b(it'?ll work out|everything is going to|believe in|things will|going to be okay|will figure it out)\b/i] },
    { stat:'TRUSTING',             w:2, p:[/\b(trust(?:ed)? (?:them|her|him)|believed (?:them|her|him)|gave (?:them|her|him) the benefit)\b/i] },

    // ---- SELF-PRESENTATION (+2) — all positive, all character moves ----
    { stat:'HUMBLEBRAGGY',         w:2, p:[/\b(i (?:just|only) work too hard|i care too much|people say i am too)\b/i] },
    { stat:'GRANDIOSE',            w:2, p:[/\b(i was (?:always|born to)|destined|the one who|nobody else can|only i)\b/i] },
    { stat:'MODEST',               w:2, p:[/\b(it was nothing|anyone would have|just lucky|no big deal|i am not special)\b/i] },
    { stat:'SELF-EFFACING',        w:2, p:[/\b(probably wrong|forget i said|nobody asked|sorry to bring|maybe i am off)\b/i] },
    { stat:'OVERSHARING',          w:2, p:[/^.{200,}$/s], note:'long answer where length itself is the move' },
    { stat:'POKER-FACED',          w:2, p:[/^[a-z]{1,40}\.\s*$/], note:'minimal flat affect on prompt that invited more' },
    { stat:'NARCISSISTIC',         w:2, p:[], _customCheck:'sustainedFirstPerson', note:'3+ first-person pronouns' },
    { stat:'COMMUNAL',             w:2, p:[/\b(we|us|our|together|the group|community|family)\b/i] },

    // ---- AESTHETIC REGISTERS (+2) ----
    { stat:'MAXIMALIST',           w:2, p:[/(\w+,\s+){3,}\w+/, /[,;:].*[,;:].*[,;:]/], note:'comma-list of 4+ items or 3+ punct breaks' },
    { stat:'MINIMALIST',           w:2, p:[/^.{1,40}$/s], note:'short answer (replaces TERSE — same idea)' },
    { stat:'BAROQUE',              w:2, p:[/\b(velvet|gilded|ornate|elaborate|filigree|brocade|crystalline)\b/i] },
    { stat:'DECADENT',             w:2, p:[/\b(luxurious|silk|champagne|caviar|excess|opulent|sumptuous)\b/i] },
    { stat:'UTILITARIAN',          w:2, p:[/\b(works|does the job|practical|useful|functional|gets it done)\b/i] },
    { stat:'ROMANTIC',             w:2, p:[/\b(love|beloved|sweep(?:s|ing) me|destiny|two souls|made for)\b/i] },
    { stat:'CLASSICAL',            w:2, p:[/\b(symmetry|balance|proportion|order|harmony|measured)\b/i] },
    { stat:'GOTHIC',               w:2, p:[/\b(haunted|crumbling|ruined|shadowed|fog|moonlit|crypts?|cathedral)\b/i] },
    { stat:'PASTORAL',             w:2, p:[/\b(field|meadow|cottage|farm|countryside|stream|hillside|orchard)\b/i] },
    { stat:'URBAN',                w:2, p:[/\b(subway|bodega|alley|skyscraper|elevator|sidewalk|rooftop|fire escape)\b/i] },
    { stat:'COSMOPOLITAN',         w:2, p:[/\b(paris|tokyo|berlin|new york|london|istanbul|cairo|mumbai|rio)\b/i] },
    { stat:'PROVINCIAL',           w:2, p:[/\b(my (?:hometown|village|small town)|where i grew up|local|down the road)\b/i] },
    { stat:'FUTURIST',             w:2, p:[/\b(neon|chrome|cyber|the year [0-9]{4}|simulation|server|interface)\b/i] },

    // ---- ACTION SHAPES (+2) ----
    { stat:'PURSUING',             w:2, p:[/\b(chased|pursued|went after|tracking|hunting)\b/i] },
    { stat:'ESCAPING',             w:2, p:[/\b(escaped|fled|ran from|got out|broke free)\b/i] },
    { stat:'ENDURING',             w:2, p:[/\b(endured|kept going|held on|stayed standing|outlasted)\b/i] },
    { stat:'BUILDING',             w:2, p:[/\b(built|constructed|made|created|raised|put up|assembled)\b/i] },
    { stat:'DESTROYING',           w:2, p:[/\b(destroyed|tore down|burned|smashed|broke|wrecked)\b/i] },
    { stat:'CULTIVATING',          w:2, p:[/\b(grew|tended|nurtured|raised|cared for the|grew up with)\b/i] },
    { stat:'PROTECTING',           w:2, p:[/\b(protected|guarded|stood between|kept (?:them|her|him) safe|sheltered)\b/i] },
    { stat:'PREDATORY',            w:2, p:[/\b(stalked|hunted|cornered|trapped|circled|moved in)\b/i] },
    { stat:'INVESTIGATIVE',        w:2, p:[/\b(figured out|investigated|tracked down|pieced together|found out|dug up)\b/i] },
    { stat:'CARETAKING',           w:2, p:[/\b(took care of|looked after|fed|bathed|tended to)\b/i] },

    // ---- KNOWLEDGE STANCES (+2) ----
    { stat:'EXPERT',               w:2, p:[/\b(i know how|i can|i learned to|professional|trained|certified)\b/i] },
    { stat:'APPRENTICE-LIKE',      w:2, p:[/\b(learning|studying|trying to get|still figuring|practicing)\b/i] },
    { stat:'DILETTANTE',           w:2, p:[/\b(dabbled|tried (?:a few|several)|never stuck with|here and there|jack of)\b/i] },
    { stat:'GENERALIST',           w:2, p:[/\b(a bit of everything|across (?:domains|fields)|all kinds|many things)\b/i] },
    { stat:'SPECIALIST',           w:2, p:[/\b(only|just one thing|deep into|one subject|the thing i do)\b/i] },
    { stat:'INTUITIVE',            w:2, p:[/\b(felt it|just knew|gut|sensed|something told me)\b/i] },
    { stat:'EMPIRICIST',           w:2, p:[/\b(tested|measured|the data|evidence|proven|tried it)\b/i] },
    { stat:'BOOKISH',              w:2, p:[/\b(read|in a book|the author|a chapter|library|reading)\b/i] },
    { stat:'STREET-SMART',         w:2, p:[/\b(on the street|in the wild|out in the world|practical|in real life)\b/i] },
    { stat:'CRAFT-WISE',           w:2, p:[/\b(by hand|with my hands|tools|workshop|the craft|the trade)\b/i] },

    // ---- MORAL POSTURES (+2) ----
    { stat:'MORALLY-CLEAR',        w:2, p:[/\b(right and wrong|black and white|simple|clear cut|no question)\b/i] },
    { stat:'MORALLY-AMBIGUOUS',    w:2, p:[/\b(it depends|gray area|complicated|both sides|not so simple)\b/i] },
    { stat:'STRICT-CODED',         w:2, p:[/\b(my (?:code|rule|principle)|always|never|absolutely|under no)\b/i] },
    { stat:'SITUATIONAL',          w:2, p:[/\b(case by case|depends on|in that situation|sometimes|other times)\b/i] },
    { stat:'VENGEFUL-MEMORIED',    w:2, p:[/\b(never forgot|kept the receipts|owe (?:me|them) one|remembered every|carried that)\b/i] },
    { stat:'FORGIVING',            w:2, p:[/\b(let it go|water under|moved on|past is past|forgave)\b/i] },
    { stat:'SCORE-KEEPING',        w:2, p:[/\b(my turn|owe me|even now|paid back|squared up)\b/i] },
    { stat:'CALL-OUT-PRONE',       w:2, p:[/\b(told them|spoke up|called (?:it|them) out|named it|did not let it slide)\b/i] },
    { stat:'LOOK-AWAY-PRONE',      w:2, p:[/\b(pretended not to|looked away|did not say anything|kept walking|let it slide)\b/i] },

    // ---- RELATIONAL STANCES (+2) ----
    { stat:'LONERIST',             w:2, p:[/\b(alone|by myself|on my own|solitary|prefer (?:my own|the quiet))\b/i] },
    { stat:'GREGARIOUS',           w:2, p:[/\b(crowd|people|party|love being around|the more the)\b/i] },
    { stat:'MENTORING',            w:2, p:[/\b(taught|showed (?:them|her|him) how|mentored|guided|coached)\b/i] },
    { stat:'STUDENT-LIKE',         w:2, p:[/\b(taught me|showed me|learned from|my (?:teacher|mentor)|under)\b/i] },
    { stat:'KIN-BOUND',            w:2, p:[/\b(my (?:family|brother|sister|mother|father|cousin|aunt|uncle|grandmother|grandfather))\b/i] },

    // ---- LIGHT-CRAFT (+1, capped at 5/answer) ----
    { stat:'COMPLETE-SENTENCED',   w:1, p:[/^[A-Z][^.!?]*[.!?]\s*$/], note:'cap-and-period' },
    { stat:'VARIED-VOCAB',         w:1, p:[], _customCheck:'vocabRange' },
    { stat:'PUNCTUATING',          w:1, p:[/[,;:—-].*[.!?]/] },

    // ============================================================
    // AXIS EXPANSION — registers the original taxonomy missed.
    // Each entry below fills a structural gap identified during the
    // characteristic audit. Twelve positive rules across five axes:
    // temporality, embodiment, dialogical capacity, place-plurality,
    // stance binary, plus two aesthetic registers with explicit
    // personal investment. Patterns are deliberately broad so the
    // engine can catch the registers across many phrasings; the
    // rule fires once per answer regardless of pattern frequency.
    // ============================================================

    // ---- TEMPORALITY (+3) — time-orientation, previously absent ----
    { stat:'ANACHRONIC',           w:3, p:[/\b(in the (?:\d{4}s|\d{1,2}th century)|back when|in (?:those|that) days?|generations? of|centuries? ago|ancient|antique|across the centuries)\b/i] },
    { stat:'ESCHATOLOGICAL',       w:3, p:[/\b(the end of|final |coming collapse|what comes after|the last (?:days|of)|apocaly|extinction|after the world|end[- ]times)\b/i] },

    // ---- EMBODIMENT (+3) — body-knowing vs body-abstracted ----
    { stat:'EMBODIED',             w:3, p:[/\b(in my body|muscle memory|my hands knew|breathed it in|the weight of it physically|in my bones|gut tightened|jaw clenched|shoulders drop)\b/i] },
    { stat:'DISEMBODIED',          w:3, p:[/\b(in principle|conceptually|in the abstract|pure idea|above the material|in theory|on paper|the form of)\b/i] },

    // ---- DIALOGICAL (+3) — moved-by-the-other, distinct from internal DIALECTICAL ----
    { stat:'DIALOGICAL',           w:3, p:[/\b(they showed me|changed my mind|hadn'?t seen it that way|convinced me|let them in|i was wrong and they|they made me see)\b/i] },
    { stat:'MEPHISTOPHELEAN',      w:3, p:[/\b(i had to push back|the counterfactual|refused to (?:agree|concede)|made them defend|productive opposition|would not let it stand|disagreed before agreeing)\b/i] },

    // ---- PLACE-PLURALITY (+2) — diaspora and rootedness ----
    { stat:'DIASPORIC',            w:2, p:[/\b(back home|where i (?:come|came) from|our people|two countries|between (?:two|cultures)|my parents'? country|the old country)\b/i] },
    { stat:'ROOTED',               w:2, p:[/\b(born here|never left|four generations|this is my (?:land|home|place)|the same (?:house|town|street) since)\b/i] },

    // ---- STANCE BINARY (+2) — pay-the-cost vs willing-to-deal ----
    { stat:'PRINCIPLED',           w:2, p:[/\b(even if (?:i lose|it costs)|had to (?:lose|give up)|would not bend|the line i (?:drew|hold)|could not in good conscience|on principle)\b/i] },
    { stat:'PRAGMATIC',            w:2, p:[/\b(for now|get the win|pick (?:the|my) battles?|good enough|livable|made it work|the deal was)\b/i] },

    // ---- AESTHETIC EXPANSION (+2) ----
    { stat:'SOLARPUNK',            w:2, p:[/\b(regenerative|commons|the garden|community garden|guerrilla garden|seed library|repair (?:cafe|culture)|mutual aid|the future could be|hopeful future|degrowth)\b/i] },
    { stat:'BRUTALIST',            w:2, p:[/\b(no decoration|just the structure|stripped down|unsentimental|the bare (?:fact|truth|frame)|raw concrete|austere|no ornament)\b/i] }
  ];

  // ============================================================
  // NEGATIVE STAT DICTIONARY — these damage HP, do not subtract XP.
  // Recorded as character quirks (separate field on data.stats).
  // ============================================================

  var PLATITUDES = [
    /everything happens for a reason/i,
    /no regrets/i,
    /\blive,? laugh,? love\b/i,
    /just be yourself/i,
    /follow your dreams/i,
    /good vibes only/i,
    /love wins/i,
    /stay strong/i,
    /you do you/i,
    /trust the process/i,
    /keep grinding/i,
    /everything is connected/i,
    /^be the change\b/i,
    /work hard play hard/i,
    /^carpe diem\b/i,
    /life is short/i,
    /no pain no gain/i,
    /it is what it is/i,
    /everything will work out/i
  ];

  var GENERIC_TOKENS = new Set([
    'thing','things','stuff','situation','person','people','idea','ideas',
    'problem','reason','moment','place','time','question','answer',
    'subject','object','matter','topic','story','experience','feeling',
    'something','someone','somewhere','sometime','anything','anyone'
  ]);

  var NULL_PARTICIPATION_REGEX = /^(lol|lmao|haha|hahaha|idk|i dunno|dunno|k|kk|ok|okay|meh|w\/e|whatever|🤷[\s\S]*?)$/i;

  // ============================================================
  // HELPERS
  // ============================================================

  function tokenize(s){
    return s.toLowerCase().match(/[a-z'']{1,}/g) || [];
  }
  function uniqueTokenRatio(s){
    var tokens = tokenize(s);
    if(tokens.length < 4) return 0;
    var set = {};
    tokens.forEach(function(t){ set[t]=1; });
    return Object.keys(set).length / tokens.length;
  }
  function vocabRange(s){
    // Reward distinct vocabulary above small threshold
    var ratio = uniqueTokenRatio(s);
    var tokens = tokenize(s);
    return tokens.length >= 8 && ratio >= 0.7;
  }
  function spellingClean(s){
    // Cheap heuristic: no token has 4+ consecutive consonants except known words.
    // Very loose — bad spelling does NOT punish, only good spelling rewards.
    var tokens = tokenize(s);
    if(tokens.length < 5) return false;
    var bad = 0;
    tokens.forEach(function(t){
      if(/[bcdfghjklmnpqrstvwxz]{5,}/.test(t)) bad++;
    });
    return bad === 0 && tokens.length >= 5;
  }
  function sustainedFirstPerson(s){
    // 3+ first-person pronouns AND no second-person — character is talking about self
    var firstP = (s.match(/\b(i|me|my|mine|myself)\b/gi) || []).length;
    return firstP >= 3;
  }
  function isAllGeneric(s){
    var tokens = tokenize(s);
    if(tokens.length === 0) return false;
    var nonGeneric = tokens.filter(function(t){
      // remove single-letter, articles, pronouns, common verbs from generic check
      if(t.length <= 2) return false;
      if(/^(the|and|but|for|that|this|with|from|have|had|was|were|are|been|being|its|out|not|yes|all|any|one|two|new|old)$/i.test(t)) return false;
      return !GENERIC_TOKENS.has(t);
    });
    return nonGeneric.length === 0;
  }
  function countUniqueTokens(s){
    var tokens = tokenize(s);
    var set = {};
    tokens.forEach(function(t){ set[t]=1; });
    return Object.keys(set).length;
  }

  // ============================================================
  // SCORING — main entry point
  //
  // The live-preview path runs scoreAnswer on every keystroke
  // (debounced 150ms). Most consecutive calls for an answer-in-
  // progress hit identical or near-identical input, so a small
  // LRU cache keyed on (field, ageRange, input) avoids re-running
  // 195 regex patterns on identical input. Cache size is small;
  // entries evict FIFO. Entries are deep-copied on read so
  // callers cannot mutate cached arrays.
  // ============================================================

  var SCORE_CACHE_MAX = 50;
  var scoreCache = {};
  var scoreCacheKeys = [];  // FIFO order

  function cloneScoreResult(r){
    return {
      xpDelta: r.xpDelta,
      hpDelta: r.hpDelta,
      statsHit: r.statsHit.map(function(h){ return {stat:h.stat, weight:h.weight}; }),
      quirksHit: r.quirksHit.map(function(h){ return {quirk:h.quirk, weight:h.weight}; }),
      reasons: r.reasons.slice()
    };
  }

  function scoreAnswer(field, input, ctx){
    ctx = ctx || {};
    var ageRange = ctx.ageRange || 'adult';
    var prevHp = (typeof ctx.hp === 'number') ? ctx.hp : 100;

    // Cache lookup. Note that ctx.hp does not affect statsHit or
    // quirksHit results; it only affects death-flag bookkeeping
    // outside this function. So hp is excluded from the cache key.
    var cacheKey = null;
    if(typeof input === 'string' && input.length < 4000){
      cacheKey = field + '\x1f' + ageRange + '\x1f' + input;
      if(scoreCache.hasOwnProperty(cacheKey)){
        return cloneScoreResult(scoreCache[cacheKey]);
      }
    }

    var result = {
      xpDelta: 0,
      hpDelta: 0,
      statsHit: [],   // [{stat, weight}]
      quirksHit: [],  // [{quirk, weight}]
      reasons: []
    };

    if(!input || typeof input !== 'string'){
      return result;
    }
    var s = input.trim();
    if(!s){
      if(cacheKey){
        scoreCache[cacheKey] = cloneScoreResult(result);
        scoreCacheKeys.push(cacheKey);
        if(scoreCacheKeys.length > SCORE_CACHE_MAX){
          var oldest = scoreCacheKeys.shift();
          delete scoreCache[oldest];
        }
      }
      return result;
    }

    // ---- NEGATIVE CHECKS (HP damage) ----

    // PLATITUDE
    var hitPlatitude = false;
    for(var i = 0; i < PLATITUDES.length; i++){
      if(PLATITUDES[i].test(s)){ hitPlatitude = true; break; }
    }
    if(hitPlatitude){
      result.quirksHit.push({ quirk:'PLATITUDE_PRONE', weight:2 });
      result.hpDelta -= 2;
      result.reasons.push('platitude detected');
    }

    // EMPTY-SIGNAL — composed entirely of generic abstractions
    if(isAllGeneric(s) && tokenize(s).length >= 3){
      result.quirksHit.push({ quirk:'VAGUE_PRONE', weight:1 });
      result.hpDelta -= 1;
      result.reasons.push('all-generic answer');
    }

    // NULL-PARTICIPATION — entire answer is throwaway
    if(NULL_PARTICIPATION_REGEX.test(s)){
      result.quirksHit.push({ quirk:'DISENGAGED', weight:1 });
      result.hpDelta -= 1;
      result.reasons.push('null-participation');
    }

    // LOW-CONTENT — fewer than 4 unique tokens regardless of length
    var unique = countUniqueTokens(s);
    if(unique < 4 && s.length >= 10){
      result.quirksHit.push({ quirk:'LOW_CONTENT', weight:2 });
      result.hpDelta -= 2;
      result.reasons.push('low unique-token count');
    }

    // PERFORMATIVE — the speaker is performing a stance rather than
    // inhabiting it. The answer reads as posed for an audience: a
    // chain of as-one-does, of-course, clearly, obviously markers
    // without the substance the markers imply. Distinct from
    // PLATITUDE_PRONE (recycled phrases) and LOW_CONTENT (empty);
    // this hits when the form is high-affect but the content is
    // performance.
    if(/\b(as one does|clearly|obviously|of course|naturally|needless to say)\b.*\b(as one does|clearly|obviously|of course|naturally|needless to say)\b/i.test(s)
       || /\b(it is what it is|read the room|do better|the audacity|let me tell you)\b/i.test(s)){
      result.quirksHit.push({ quirk:'PERFORMATIVE_PRONE', weight:1 });
      result.hpDelta -= 1;
      result.reasons.push('performative register without substance');
    }

    // DEFENSIVE — the speaker is closing off rather than engaging.
    // Distinct from GUARDED (a positive boundary stance); this is
    // the move of refusing the question's terms with friction rather
    // than stating one's own.
    if(/\b(i already (?:said|told)|not what i meant|you('?re| are) misread|that('?s| is) not the point|never mind|forget it|moving on)\b/i.test(s)
       || /\b(why are you (?:asking|even)|what kind of question|loaded question)\b/i.test(s)){
      result.quirksHit.push({ quirk:'DEFENSIVE_PRONE', weight:1 });
      result.hpDelta -= 1;
      result.reasons.push('defensive closure');
    }

    // ---- POSITIVE STAT DETECTION ----

    var lightCraftCount = 0;
    var seen = {};

    POSITIVE_RULES.forEach(function(rule){
      if(seen[rule.stat]) return;  // one hit per stat per answer

      var matched = false;

      // Custom checks
      if(rule._customCheck === 'vocabRange'){ matched = vocabRange(s); }
      else if(rule._customCheck === 'spellingClean'){ matched = spellingClean(s); }
      else if(rule._customCheck === 'sustainedFirstPerson'){ matched = sustainedFirstPerson(s); }
      else if(rule._customCheck === 'uniqueTokenRatio'){
        matched = (countUniqueTokens(s) >= 6 && uniqueTokenRatio(s) >= 0.6);
      } else if(rule.p && rule.p.length){
        for(var j = 0; j < rule.p.length; j++){
          if(rule.p[j].test(s)){ matched = true; break; }
        }
      }

      if(!matched) return;

      // Light-craft cap (5 per answer)
      if(rule.w === 1){
        if(lightCraftCount >= 5) return;
        lightCraftCount++;
      }

      seen[rule.stat] = true;
      result.statsHit.push({ stat:rule.stat, weight:rule.w });
      result.xpDelta += rule.w;

      // Heal HP a little for tier-1 hits
      if(rule.w === 3) result.hpDelta += 1;
    });

    // Age adjustment — under-13 thresholds are softer; engine awards a small bonus
    if(ageRange === 'under-13' && result.xpDelta > 0){
      result.xpDelta = Math.ceil(result.xpDelta * 1.15);
      result.reasons.push('age-adjusted +15%');
    }
    if(ageRange === '18+' && result.xpDelta > 0 && result.statsHit.length < 2){
      // Adults get tighter scoring on shallow answers
      result.xpDelta = Math.max(0, result.xpDelta - 1);
    }

    // Cap HP between 0 and 100 (clamping done by caller — engine just reports delta)
    if(cacheKey){
      scoreCache[cacheKey] = cloneScoreResult(result);
      scoreCacheKeys.push(cacheKey);
      if(scoreCacheKeys.length > SCORE_CACHE_MAX){
        var oldest = scoreCacheKeys.shift();
        delete scoreCache[oldest];
      }
    }
    return result;
  }

  // ============================================================
  // TIER1_STATS — exposed publicly so the chat can compute depthScore
  // without duplicating the list. Derived by scanning POSITIVE_RULES for
  // weight-3 entries. Single source of truth.
  // ============================================================
  function getTier1Stats(){
    return POSITIVE_RULES.filter(function(r){ return r.w === 3; }).map(function(r){ return r.stat; });
  }

  // ============================================================
  // EXPORTS
  // ============================================================
  global.DepthEngine = {
    scoreAnswer: scoreAnswer,
    tierFor: tierFor,
    levelFor: levelFor,
    thresholdsBetween: thresholdsBetween,
    normalizedBar: normalizedBar,
    getTier1Stats: getTier1Stats,
    THRESHOLDS: THRESHOLDS,
    LEVEL_STEP: LEVEL_STEP,
    // Exposed for test harnesses
    _internals: {
      POSITIVE_RULES: POSITIVE_RULES,
      PLATITUDES: PLATITUDES,
      tokenize: tokenize,
      uniqueTokenRatio: uniqueTokenRatio,
      isAllGeneric: isAllGeneric
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
