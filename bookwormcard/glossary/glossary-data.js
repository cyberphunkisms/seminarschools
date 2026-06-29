/* glossary-data.js
 * Definitions for every cluster, trait, quirk, and mood in the
 * bookwormburrows depth-engine. Edit freely — the glossary page
 * (index.html) reads from this object at runtime. The keys are
 * namespaced: cluster:ID, trait:STAT, mood:ID, weight:STAT.
 *
 * Voice guideline: tight one-liners. lowercase. pedagogical but
 * not academic. concrete where possible. no hedging.
 */
window.GLOSSARY_DATA = {

  // ============================================================
  // WEIGHTS — the engine's award magnitude per trait
  // ============================================================
  'weight:IRREDUCIBLE':3, 'weight:META-AWARE':3, 'weight:PATTERN-SEEING':3,
  'weight:DIALECTICAL':3, 'weight:SELF-CRITICAL':3, 'weight:NEGATIVELY-CAPABLE':3,
  'weight:SYSTEMS-MINDED':3, 'weight:COUNTERFACTUAL':3, 'weight:ANALOGICAL':3,
  'weight:GENEALOGICAL':3, 'weight:PHENOMENOLOGICAL':3, 'weight:SPECIFIC':3,
  'weight:IMAGE-MAKING':3, 'weight:COMPRESSED':3, 'weight:STRUCTURED':3,
  'weight:CONCRETE':3, 'weight:SENSORY':3,
  'weight:ANACHRONIC':3, 'weight:ESCHATOLOGICAL':3, 'weight:EMBODIED':3,
  'weight:DISEMBODIED':3, 'weight:DIALOGICAL':3, 'weight:MEPHISTOPHELEAN':3,
  'weight:VARIED-VOCAB':1, 'weight:COMPLETE-SENTENCED':1, 'weight:PUNCTUATING':1,
  'weight:PLATITUDE_PRONE':2, 'weight:VAGUE_PRONE':1, 'weight:DISENGAGED':1,
  'weight:LOW_CONTENT':2, 'weight:PERFORMATIVE_PRONE':1, 'weight:DEFENSIVE_PRONE':1,

  // ============================================================
  // CLUSTERS
  // ============================================================
  'cluster:crown':         "the character who is convinced of their own importance. could be earned, could be performed, could be both.",
  'cluster:mortarboard':   "credentialed, trained, located inside an institution of learning. either as student or as keeper.",
  'cluster:cap':           "street-wise, plain, allergic to the formal register. the worker, the watcher, the deflator.",
  'cluster:tophat':        "the formal-ornate register. lives well, lives ornately, was raised on the long table.",
  'cluster:halo':          "the gentle one. open, soft, deferring, willing to be wrong out loud.",
  'cluster:devil':         "the productive opponent. the friend who refuses to let the easy answer stand.",
  'cluster:shades':        "the unimpressed eye. detached, dry, slightly above the moment.",
  'cluster:glasses':       "the analytical eye. sees the structure underneath. asks how it works before asking what it is.",
  'cluster:meditator':     "the body knows. the somatic register that comes online before the brain catches up.",
  'cluster:sparkles':      "the open-throated affect. wonder, delight, undefended pleasure.",
  'cluster:rain':          "the held sorrow. weighted, not sharp. the climate of loss as a habitable room.",
  'cluster:fire':          "the heat-up affect. anger, defiance, appetite, the moves that break through.",
  'cluster:sun':           "the warm-bright affect. structurally optimistic, gentle, oriented forward.",
  'cluster:moon':          "the night register. quiet, withdrawn, oblique, lit from a distance.",
  'cluster:hourglass':     "the time-traveler. moves easily between centuries. the current moment is one of many.",
  'cluster:sunset':        "the end-times eye. the meaning of the present comes from how the story ends.",
  'cluster:thought':       "the deep cognitive register. thinking that holds tension, looks at itself, doubts on purpose.",
  'cluster:heart':         "the warm-relational register. thinking-with-others, carrying-of-others, staying-close.",
  'cluster:skull':         "the death-side register. the gothic, the morbid, the no-meaning. thinking with the skull on the desk.",
  'cluster:mask':          "the playful register. comedy, irony, surreal. wears the face that is not the face.",
  'cluster:mirror':        "the self-seeing register. looks at self, criticizes self, makes self the image.",
  'cluster:ghost':         "the abstracted-from-the-body register. lives in the form, the principle, the idea.",
  'cluster:speech':        "the dialogue-capable register. moved by what the other says. real conversation, not parallel monologue.",
  'cluster:sword':         "the cutting-instrument register. willing to harm, to call out, to remember the score.",
  'cluster:shield':        "the defensive-instrument register. protects, endures, holds the line, watches for harm.",
  'cluster:book':          "the carried text. reading-as-method, line-keeping, the inheritance of words.",
  'cluster:tools':         "the maker's hand. builds, cultivates, tests. moves through the world by working it.",
  'cluster:flag':          "the dissident's banner. against the order, opposed on principle.",
  'cluster:mic':           "the public-voice register. the confessor, the orator, the one whose speech reaches.",
  'cluster:scales':        "the principled stance. willing to lose for the position. the cost is part of what makes it a position.",
  'cluster:handshake':     "the deal-maker. willing to compromise for outcome. picks battles. lives in the workable.",
  'cluster:flowers':       "the soft-pastoral register. the home-garden, the small-town, the held-warm.",
  'cluster:cityscape':     "the urban-cosmopolitan register. fluent in subway, alley, rooftop. dense-modern.",
  'cluster:wheat':         "the slow-stoic register. the long patience, the field-work, the inheritance of doing-the-thing-anyway.",
  'cluster:cards':         "the trickster's deck. the surreal-playful environment of cards-shuffled-and-dealt.",
  'cluster:wolf':          "the loner-companion. the figure who travels solitary through their own land.",
  'cluster:globe':         "the multi-rooted register. between two countries, the old country, two heads at once.",
  'cluster:sapling':       "the green-futurist register. the regenerative imaginary, the commons, the hopeful-new-thing.",
  'cluster:brick':         "the severe-as-style register. raw concrete, no decoration, just the structure showing.",
  'cluster:rose':          "the offering. the ornament-with-meaning. the romantic-confessional gift.",
  'cluster:compass':       "the wayfinder. the figure with a clear direction, an investigative habit, an internal north.",
  'cluster:spiral':        "the entangled-route. the figure whose path turns back on itself, oblique, inside the labyrinth.",
  'cluster:backpack':      "the carrier-of-things. the journey-going register. the figure mid-passage.",
  'cluster:tree':          "the rooted-in-place register. born here. never left. the same town, the same street.",
  'cluster:fly':           "the recycled-phrase. the answer reaches for a saying that is doing the thinking instead of the speaker.",
  'cluster:fog':           "the all-abstraction answer. nothing in it is concrete enough to hold.",
  'cluster:zzz':           "the throwaway answer. the speaker did not show up to write it.",
  'cluster:hollow':        "low-content. fewer than four unique tokens. the form is filled but the answer is not.",
  'cluster:tv':            "the performed stance. the speaker is performing a position they are not actually inhabiting.",
  'cluster:barrier':       "the closure-instead-of-engagement. the answer pushes back against the question's terms with friction rather than with one's own answer.",

  // ============================================================
  // MOODS — the room tint
  // ============================================================
  'mood:rage':       "the room turns red. the character's heat rises into the climate around them.",
  'mood:melancholy': "the room turns deep blue. sorrow held long enough to become weather.",
  'mood:edge':       "the room turns purple-shadow. the gothic-nihilist climate of refused meaning.",
  'mood:wonder':     "the room turns warm gold. delight has gone systemic, lit the space.",
  'mood:tender':     "the room turns soft peach. the gentleness of holding-other is in the air.",

  // ============================================================
  // TRAITS — TIER-1 COGNITIVE DEPTH (+3)
  // ============================================================
  'trait:IRREDUCIBLE':         "holds two truths at once without resolving them. paradox is the home position, not an obstacle.",
  'trait:META-AWARE':          "notices the conversation noticing itself. the act of speaking is part of what is being said.",
  'trait:PATTERN-SEEING':      "the same shape keeps showing up. names the recurrence rather than the instance.",
  'trait:DIALECTICAL':         "thinks by moving. what i used to believe, what i believe now, what comes next. the change of mind is the thought.",
  'trait:SELF-CRITICAL':       "my fault, my error, my limit. names own contribution to the trouble.",
  'trait:NEGATIVELY-CAPABLE':  "comfortable not knowing. holds open questions without rushing to close them. (keats)",
  'trait:SYSTEMS-MINDED':      "the parts make a whole that feeds back into itself. the structure is the actor.",
  'trait:COUNTERFACTUAL':      "what if it had gone the other way. plays the alternative.",
  'trait:ANALOGICAL':          "makes meaning by mapping one thing onto another. the shape transfers.",
  'trait:GENEALOGICAL':        "the line going back. what was inherited, what was passed down. (foucault)",
  'trait:PHENOMENOLOGICAL':    "the texture of how it felt. the weight of the thing as experienced, before the abstract. (husserl)",

  // CRAFT (+3)
  'trait:SPECIFIC':            "names the day, the place, the proper noun. resists the abstract.",
  'trait:IMAGE-MAKING':        "gives the reader something to see.",
  'trait:COMPRESSED':          "more meaning in fewer words. weight, not volume.",
  'trait:STRUCTURED':          "the answer has a shape — not just sentences but architecture.",
  'trait:CONCRETE':            "the thing itself, not the category it belongs to.",
  'trait:SENSORY':             "smell, taste, touch, sound, light. enters through the body.",

  // AUDIT-PASS (+3)
  'trait:ANACHRONIC':          "moves across periods. lets centuries layer on the present moment.",
  'trait:ESCHATOLOGICAL':      "the end determines the meaning. final-things thinking.",
  'trait:EMBODIED':            "somatic anchoring. the body knows before the brain catches up.",
  'trait:DISEMBODIED':         "abstracts from the body. lives in the form, the principle, the idea.",
  'trait:DIALOGICAL':          "willing to be moved by the other. they showed me. changed my mind.",
  'trait:MEPHISTOPHELEAN':     "productive opposition. refuses easy agreement on principle. forces the other to defend.",

  // LIGHT-CRAFT (+1)
  'trait:VARIED-VOCAB':        "range of words. does not repeat the same handful.",
  'trait:COMPLETE-SENTENCED':  "the answer has caps and stops. the form respects the form.",
  'trait:PUNCTUATING':         "uses the mark. comma, semicolon, em-dash. the structure shows.",

  // ============================================================
  // AFFECT MARKERS (+2)
  // ============================================================
  'trait:WONDROUS':            "the world is strange in a way that opens, not closes.",
  'trait:ENCHANTED':           "lit up by something. the thing has a glow on it.",
  'trait:DELIGHTED':           "pure pleasure response. no ambivalence.",
  'trait:JOYFUL':              "open-throated, undefended happiness.",
  'trait:ECSTATIC':            "out-of-self. the joy exceeds the container.",
  'trait:NAIVE':               "does not yet know the catch. the trust is unscarred.",
  'trait:CHILDLIKE':           "the smallness, the seeing-fresh, the play-as-method.",
  'trait:FASCINATED':          "held by an interest. the eye stays on the object.",
  'trait:ANTICIPATING':        "leans into what is coming. the future has tension.",
  'trait:HOPEFUL':             "future-leaning. believes the door opens.",
  'trait:OPTIMISTIC':          "structurally confident. the world tends toward good.",
  'trait:CONTENT':             "at rest in what is. nothing missing in this moment.",
  'trait:PEACEFUL':            "no internal war. settled in the body and the mind.",
  'trait:GRATEFUL':            "receives what is given. names the gift.",
  'trait:TENDER':              "handles others carefully. the touch is soft.",
  'trait:MELANCHOLIC':         "held by a sorrow that has weight, not edge. lived in the loss.",
  'trait:GRIEVING':            "in the active loss. the thing is gone and the gone is present.",
  'trait:LONGING':             "wants what is not here. the wanting is the relation.",
  'trait:NOSTALGIC':           "the past is colored. what was is more vivid than what is.",
  'trait:BLEAK':               "the world is sparse and cold. the glow has been turned down.",
  'trait:ASHAMED':             "the self is the source of the problem. eyes down.",
  'trait:DREADING':            "anticipates the bad thing. the future has a shadow.",
  'trait:TERRIFIED':           "the body is afraid. flight is in reach.",
  'trait:NUMB':                "feeling has gone offline. the lights are out inside.",
  'trait:BORED':               "the world has gone gray. nothing claims attention.",
  'trait:ANGRY':               "the heat is up. moved against something.",
  'trait:RAGEFUL':             "anger gone past the container. the heat is out of control.",
  'trait:DEFIANT':             "refuses what is required. plants the foot.",
  'trait:RECKLESS':            "moves without measuring the cost. the leap precedes the look.",
  'trait:APPETITIVE':          "wants — food, sex, attention, more. the want is the engine.",
  'trait:TRANSGRESSIVE':       "crosses the line on purpose. the line is part of the meal.",
  'trait:HYPERBOLIC':          "the dial is at eleven. always. the everything-of-everything register.",
  'trait:SHAMELESS':           "refuses the shame circuit entirely. the eyes stay up.",
  'trait:IMPATIENT':           "time is the enemy. waiting is suffering.",
  'trait:ENVIOUS':             "wants what they have. the want has a name.",
  'trait:CYNICAL':             "assumes the worst motive. trust has been retired.",
  'trait:DEADPAN':             "flat affect on charged content. the joke is in the missing inflection.",
  'trait:POKER-FACED':         "gives nothing away. the inside is sealed off.",
  'trait:NIHILIST':            "nothing carries weight. the meaning has been refused.",
  'trait:GALLOWS-HUMORED':     "jokes from the dark. laughs because the cry would not stop.",
  'trait:MORBID':              "drawn to death-thinking. the skull at the table.",
  'trait:WITHDRAWING':         "pulls back. closes the door.",
  'trait:DETACHED':            "not in the scene. watches from outside the frame.",
  'trait:OBLIQUE':             "approaches sideways. avoids the direct line.",
  'trait:UNDERSTATED':         "says less than is meant. the volume is dialed down.",
  'trait:GRAVE':                "weight-of-the-thing seriousness. the voice is lowered.",
  'trait:DOUBTING':            "second-guesses on principle. assumes own conviction is incomplete.",
  'trait:QUESTION-PRONE':      "asks more than answers. the question is the move.",
  'trait:EDGY':                "enjoys provocation. courts the sharp edge of the room.",

  // ============================================================
  // SELF-PRESENTATION (+2)
  // ============================================================
  'trait:BOMBASTIC':           "large in volume and gesture. fills the room sonically.",
  'trait:GRANDIOSE':           "claims unusual scale for self. the destined one, the only one.",
  'trait:NARCISSISTIC':        "the self is the recurring subject. every story arrives back at me.",
  'trait:CONVICTED':           "acts on settled belief. no hedge in the voice.",
  'trait:HUMBLEBRAGGY':        "lifts self up by claiming a flaw that flatters. i just care too much.",
  'trait:PROUD':               "stands by what they have done. shoulders back posture.",
  'trait:HUMBLE':              "does not claim more than is due. the shoulders are level.",
  'trait:MODEST':              "downplays own contribution. anyone could have done it.",
  'trait:SELF-EFFACING':       "disappears self from the foreground. apologizes for taking the floor.",
  'trait:OVERSHARING':         "tells more than was asked. the length itself is the move.",

  // ============================================================
  // AESTHETIC REGISTERS (+2)
  // ============================================================
  'trait:MAXIMALIST':          "more is more. lists, layers, ornaments stack until full.",
  'trait:MINIMALIST':          "spare. the answer is short on purpose.",
  'trait:BAROQUE':             "ornament for its own sake. the more curlicues the better.",
  'trait:DECADENT':            "the ripe-late aesthetic. silk, sugar, end-of-empire.",
  'trait:UTILITARIAN':         "does the job. function before form.",
  'trait:ROMANTIC':            "love is the engine. the heart leads the foot.",
  'trait:CLASSICAL':           "symmetry, balance, proportion. the line that has been drawn before.",
  'trait:GOTHIC':              "crumbling, shadowed, cathedral. the haunted aesthetic.",
  'trait:PASTORAL':            "field, meadow, cottage. the rural-gentle aesthetic.",
  'trait:URBAN':               "subway, bodega, alley, rooftop. the city as native ground.",
  'trait:COSMOPOLITAN':        "at home in many cities. the passport is full.",
  'trait:PROVINCIAL':          "the small town, the village, the place they came from.",
  'trait:FUTURIST':            "neon, chrome, simulation. the imagined-coming-time.",
  'trait:LYRICAL':             "song-shaped speech. the rhythm carries.",
  'trait:RAMBLING':            "long, branching, returns to the start. the wander is the route.",
  'trait:DECLARATIVE':         "states it. no hedge.",
  'trait:CONFESSIONAL':        "tells what most would hide. the disclosure as method.",
  'trait:APHORISTIC':          "speaks in compressed truths. one line, one whole.",
  'trait:IRONIC':              "means the opposite. the surface is the cover.",
  'trait:PUNNING':             "plays on the word. two meanings at once.",
  'trait:ABSURDIST':           "the world is incoherent. names the incoherence.",
  'trait:SLAPSTICK':           "physical comedy. the body is the joke.",
  'trait:MOCKING':             "imitates to deflate. the mimicry is the move.",
  'trait:SURREAL':             "the dream-rule. associative leaps that resist logic.",
  'trait:WHIMSICAL':           "light fancy. the playful turn for its own sake.",
  'trait:NONSENSICAL':         "refuses the logical sequence on purpose.",
  'trait:SELF-DEPRECATING':    "jokes against self. the laugh begins at home.",
  'trait:DARK-PLAYFUL':        "play that has teeth. the joke is also a knife.",
  'trait:DECEPTIVE':           "misleads on purpose. the surface and the truth are different.",
  'trait:WRY':                 "drily amused. the smile is at half-mast.",
  'trait:OBSERVATIONAL':       "notices what others miss. comments at the angle.",
  'trait:ECCENTRIC':           "off-axis from the room. moves to a private rhythm.",
  'trait:BLUNT':               "says it plain. softens nothing.",
  'trait:INSURGENT':           "opposes the order from inside it. the underminer with intent.",
  'trait:ICONOCLASTIC':        "breaks the icons. refuses the held thing.",
  'trait:CONTRARIAN':          "disagrees with the room as a default.",
  'trait:TABOO-DRAWN':         "attracted to the forbidden subject. the shadow side has gravity.",
  'trait:INDULGENT':           "says yes to the second helping. forgives the appetite.",
  'trait:LIGHT':               "moves with low weight. the touch is feathered.",
  'trait:ASCETIC':             "refuses comfort on purpose. the spare life as discipline.",
  'trait:SINCERE':             "means it. no air-quotes around what is said.",
  'trait:EARNEST':             "tries hard, declares the trying. no irony shield.",
  'trait:HONEST':               "says what is true even when it costs.",
  'trait:OPEN':                "lets the other in without auditing first.",
  'trait:TRUSTING':            "extends the credit before it is earned.",
  'trait:LENIENT':             "soft on enforcement. lets the line move.",
  'trait:DEFERENTIAL':         "yields to authority. you go first.",
  'trait:CONFORMIST':          "moves with the group. the wave is the ride.",
  'trait:MERCIFUL':            "when they could exact the cost, they do not.",
  'trait:FORGIVING':           "lets the wrong go. carries no ledger.",
  'trait:COMPOSED':            "the inside and outside match. no leak.",
  'trait:GENEROUS':            "gives without measuring. open hand.",
  'trait:HOSPITABLE':          "opens the door. sets the place.",

  // ============================================================
  // ACTION SHAPES (+2)
  // ============================================================
  'trait:PURSUING':            "went after it. tracking. hunting.",
  'trait:ESCAPING':            "fled. ran from. broke free.",
  'trait:ENDURING':            "held on. outlasted. kept going past the point others stopped.",
  'trait:BUILDING':            "made it. constructed it. raised it from nothing.",
  'trait:DESTROYING':          "tears down. burns. ends.",
  'trait:CULTIVATING':         "grew it. tended it. gardened it into being.",
  'trait:PROTECTING':          "stands between. keeps them safe.",
  'trait:PREDATORY':           "stalks, hunts, traps. the ambush as method.",
  'trait:INVESTIGATIVE':       "figured it out. tracked it down. pieced it together.",
  'trait:CARETAKING':          "looks after, feeds, tends. the daily work of keeping someone going.",

  // KNOWLEDGE STANCES (+2)
  'trait:EXPERT':              "has the skill, names it, will demonstrate.",
  'trait:APPRENTICE-LIKE':     "still learning. names the gap between current ability and target.",
  'trait:DILETTANTE':          "tries many things, sticks with none. the surface is the territory.",
  'trait:GENERALIST':          "a bit of everything. the breadth is the strategy.",
  'trait:SPECIALIST':          "one subject, deep. would rather know one thing fully.",
  'trait:INTUITIVE':           "knows without showing the work. the gut is in the lead.",
  'trait:EMPIRICIST':          "tested it. measured it. evidence first.",
  'trait:BOOKISH':             "reads. reads to think. reads instead of doing first.",
  'trait:STREET-SMART':        "knows how the actual world works. school did not teach this.",
  'trait:CRAFT-WISE':          "by hand. with the tools. trade knowledge.",
  'trait:INSTITUTIONAL':       "thinks through the structure that hosts them. the school, the org, the body.",
  'trait:TRADITIONALIST':      "the way it has been done is the way to do it.",
  'trait:STUDENT-LIKE':        "positions self as receiver. someone taught me. someone showed me.",
  'trait:MENTORING':           "teaches by example, by patience, by attention to the other.",
  'trait:DISCIPLINED':         "repeats the practice. shows up daily.",

  // MORAL POSTURES (+2)
  'trait:MORALLY-CLEAR':       "right and wrong are sortable. no question.",
  'trait:MORALLY-AMBIGUOUS':   "depends on. gray area. complicated. both sides.",
  'trait:STRICT-CODED':        "my rule. always. never. absolutely.",
  'trait:SITUATIONAL':         "case by case. depends on the context.",
  'trait:VENGEFUL-MEMORIED':   "never forgot. carries the receipts.",
  'trait:SCORE-KEEPING':       "my turn now. owe me one. the ledger is open.",
  'trait:CALL-OUT-PRONE':      "names the wrong. spoke up. did not let it slide.",
  'trait:LOOK-AWAY-PRONE':     "declines to address. lets the moment pass without naming it.",
  'trait:JUST':                "measures by what is fair. the impartial standard.",
  'trait:SEVERE':              "harsh in tone, posture, judgment. the line is sharp.",
  'trait:COURAGEOUS':          "moves toward the danger. fear is present and crossed.",
  'trait:CALCULATING':         "runs the numbers before the act. the move is precise.",
  'trait:CURIOUS':             "moves toward the unknown. the question pulls the foot.",
  'trait:ENTANGLED':           "the strands cross. cannot be sorted clean.",
  'trait:DISLOYAL':            "switches sides. the bond does not hold under pressure.",
  'trait:GUARDED':             "does not let in easily. the door has a lock.",
  'trait:PRUDENT':             "measures before moving. the wise caution.",
  'trait:CAUTIOUS':            "tests the floor before stepping. the slow approach.",
  'trait:PATIENT':             "lets the time do the work.",
  'trait:LOYAL':               "stays through the trouble. does not switch sides.",
  'trait:DEVOTED':             "gives self to. the loyalty has religious shape.",

  // RELATIONAL STANCES (+2)
  'trait:LONERIST':            "prefers their own. solitary by choice.",
  'trait:GREGARIOUS':          "crowd-loving. the more the better.",
  'trait:KIN-BOUND':           "family is the unit. the bond is non-negotiable.",
  'trait:COMMUNAL':            "we, us, ours. the unit is the group.",
  'trait:ENGAGED':             "actively in the room. responsive to what is happening.",

  // AUDIT-PASS PLACE-PLURALITY + STANCE BINARY (+2)
  'trait:DIASPORIC':           "plural belonging. back home, our people, two countries shape one head.",
  'trait:ROOTED':              "singular-place anchoring. born here, never left, the same house since.",
  'trait:PRINCIPLED':          "pays the cost for the line they hold. would not bend even if it cost.",
  'trait:PRAGMATIC':           "for now, good enough. picks battles. makes it work.",

  // AUDIT-PASS AESTHETIC (+2)
  'trait:SOLARPUNK':           "regenerative, commons, mutual aid. the future could be hopeful and ecological at once.",
  'trait:BRUTALIST':           "no decoration. just the structure. stripped down. unsentimental.",

  // ============================================================
  // QUIRKS (negative — cost HP)
  // ============================================================
  'trait:PLATITUDE_PRONE':     "everything happens for a reason. live laugh love. trust the process. the canned phrase replaces the actual answer.",
  'trait:VAGUE_PRONE':         "all-generic. no specific noun, no specific verb, no anchor in the world.",
  'trait:DISENGAGED':          "\"idk\", \"whatever\", \"i guess\". null-participation.",
  'trait:LOW_CONTENT':         "few unique words. the answer is mostly repetition or filler.",
  'trait:PERFORMATIVE_PRONE':  "\"as one does\", \"obviously\", \"it is what it is\". affect-stack without the work the affect implies.",
  'trait:DEFENSIVE_PRONE':     "\"i already said\", \"not what i meant\", \"loaded question\". refusing the question without addressing it."

};

