/* tier-prose.js
 * Three-depth phrasings of every chat question, plus pedagogical
 * "I don't know" rephrasings, in the existing Morpheus voice.
 *
 * Public API (window.TierProse):
 *   pickPrompt(field, depthScore, lastIndexUsed) → { prompt, tier, index }
 *   pickIdkRephrase(field) → string (handles "i don't know" / "idk" replies)
 *   FIELDS → array of all PDF-mapped field keys this module knows about
 *
 * Tier resolution:
 *   depthScore < 4   → 'easy'         (Beginner-equivalent — concrete, scaffolded)
 *   depthScore 4-9   → 'middle'       (Intermediate — direct, less hand-held)
 *   depthScore >= 10 → 'deep'         (Advanced — raw, philosophically loaded)
 *
 * The chat picks the tier when about to ask the NEXT question, based on
 * cumulative depth-stat hits across the running session. The tier reflects
 * trust the chat has earned in the player; it deepens or eases based on
 * how the player has been answering.
 *
 * "depthScore" is a derived running counter — count of tier-1 stat hits
 * (cognitive depth, image-making, specificity) over the last ~6 answers.
 * Exposed via DepthEngine — fed in by caller. This module just maps it.
 *
 * Variants alternate to avoid recording-feel: same player answering same
 * field at the same depth on a re-attempt should hear different phrasing.
 *
 * Voice contract:
 *   - lower-case, no apologies, no warmth-padding
 *   - second-person, but the player IS the worm — never address them as separate
 *   - mythic-declarative or imperative
 *   - examples in idk-rephrasings are concrete, drawn from felt experience
 *   - no labels (Beginner/Intermediate/Advanced) ever surface to the player
 */
(function(global){
  'use strict';

  // ============================================================
  // PROMPTS — keyed by PDF section field, then by tier, then array of variants
  // ============================================================
  var PROMPTS = {

    // ---- existing wormhole questions (8) ----

    backstory: {
      easy: [
        'three sentences about where you came from. where you grew up. what mattered there. what got you here.',
        'three sentences. your hometown. the thing that shaped you. how you ended up in this room.',
        'three sentences. opening of your story. the city or the kitchen or the road. then the turn.'
      ],
      middle: [
        'backstory in three sentences. where you are from. the shaping event. what brought you here.',
        'compress your origin into three sentences. place. event. arrival.',
        'three sentences. the place. the moment that bent the line. the path to now.'
      ],
      deep: [
        'three sentences for the part of your life before you were the one telling the story. place. rupture. consequence.',
        'origin in three sentences. resist the obvious one. pick the one that still shapes how you read rooms.',
        'three sentences that name what made you the kind of person who would build a card like this.'
      ]
    },

    motivation: {
      easy: [
        'what do you want?',
        'what is the thing you want most. just one.',
        'what do you want more than other things you also want?'
      ],
      middle: [
        'what do you want most?',
        'name the want that organizes your life.',
        'one thing. you would burn the rest for it. what is it.'
      ],
      deep: [
        'name the want you have stopped admitting out loud.',
        'the want that survives you saying it is silly.',
        'what you reach for in the moment before you remember to be reasonable.'
      ]
    },

    fear: {
      easy: [
        'what scares you?',
        'name something you avoid.',
        'what do you not want to think about right now?'
      ],
      middle: [
        'what do you fear most?',
        'the shape of what you flee.',
        'what would you not want to find at the end of the hallway.'
      ],
      deep: [
        'the fear that makes you small in front of yourself.',
        'the fear you hide by performing competence.',
        'the one you suspect you carry but cannot quite name.'
      ]
    },

    flaw: {
      easy: [
        'name something you do that gets you in trouble.',
        'what is a thing you keep doing wrong?',
        'one habit you wish you did not have.'
      ],
      middle: [
        'your fatal flaw.',
        'the trait that has cost you.',
        'the thing other people see in you that you wish they did not.'
      ],
      deep: [
        'the flaw you have stopped trying to fix.',
        'the one you are now defending as a feature.',
        'the part of you that is going to keep showing up no matter what you do about it.'
      ]
    },

    bond: {
      easy: [
        'name a person, place, or thing you would protect first.',
        'what would you protect before yourself?',
        'who or what comes before you in your own life?'
      ],
      middle: [
        'a person place or thing you would die for.',
        'the anchor. what stays when everything else moves.',
        'name the bond that does not negotiate.'
      ],
      deep: [
        'name the bond you have not told anyone is the load-bearing one.',
        'the bond you measure other bonds against without admitting it.',
        'what you would step in front of without thinking.'
      ]
    },

    ideal: {
      easy: [
        'name a principle you try to live by.',
        'what is one rule you give yourself?',
        'a value you put above the others.'
      ],
      middle: [
        'the principle you organize your life around.',
        'one ideal that organizes the rest. just one.',
        'the rule you self-impose. honesty. craft. mercy. kindness. name it. just one.'
      ],
      deep: [
        'the ideal you protect even when it costs you the room.',
        'the principle you suspect is wrong but cannot let go of.',
        'the value that survived your last attempt to abandon it.'
      ]
    },

    secret: {
      easy: [
        'name something you have not told someone close to you.',
        'a small thing you keep to yourself.',
        'something you would leave out of an autobiography.'
      ],
      middle: [
        'a secret you carry.',
        'something you protect by not saying.',
        'a thing about you that nobody around you currently knows.'
      ],
      deep: [
        'the secret that, if revealed, would change how you are read.',
        'the one you have stopped being sure should stay secret.',
        'the load you carry whose weight is the hiding itself.'
      ]
    },

    pivotalEvent: {
      easy: [
        'the moment your life changed. before and after.',
        'name a turning point. one specific moment.',
        'when did your story bend?'
      ],
      middle: [
        'the pivotal event of your life so far.',
        'the moment after which you were a different person.',
        'name the discontinuity in your line.'
      ],
      deep: [
        'the pivot you only saw in retrospect.',
        'the one nobody around you noticed but you did.',
        'the moment that did not look like the moment until much later.'
      ]
    },

    // ---- new PDF sections (6) ----

    // Personality Traits — what the character does that they did not learn
    trait_unlearned: {
      easy: [
        'name something you do that nobody taught you.',
        'a habit that just appeared in you.',
        'something you do that you cannot remember learning.'
      ],
      middle: [
        'name a thing you do that no one taught you.',
        'the move you make instinctively that surprises you.',
        'a behavior of yours with no obvious origin.'
      ],
      deep: [
        'the thing you do that even you cannot account for.',
        'the move you make before you have decided to make it.',
        'the gesture in you that came from nowhere and stayed.'
      ]
    },

    trait_avoided: {
      easy: [
        'name something you avoid without a clear reason.',
        'what is a thing you steer around?',
        'a place or activity you will not approach.'
      ],
      middle: [
        'name a thing you avoid that you cannot explain.',
        'the avoidance with no defensible reason.',
        'name the room you do not enter even though nothing is in it.'
      ],
      deep: [
        'the avoidance whose explanation you have stopped looking for.',
        'the thing you do not approach, that you also no longer ask why.',
        'the corner of your life that has gone dark by quiet agreement.'
      ]
    },

    trait_surfacing: {
      easy: [
        'when you are tired, what comes out of you?',
        'after a long day, what shows up in how you behave?',
        'what part of you appears when you have no energy left?'
      ],
      middle: [
        'when you are tired the surface comes off. what surfaces?',
        'tired version of you. who is that.',
        'name the self that shows up at three in the morning.'
      ],
      deep: [
        'when the polish goes, what remains. name that.',
        'the version of you the people who love you have learned to wait out.',
        'the underself. say what is there.'
      ]
    },

    // Cognitive Diagram — how the mind works
    cognition: {
      easy: [
        'where does your thinking happen? on paper. in walking. in talking. in sleep. say which.',
        'how do you actually think? out loud. on a page. while moving. say where.',
        'when you have to think hard, what do you do with your body?'
      ],
      middle: [
        'when you think hard about something, where does the thinking happen. on paper. in pacing. in conversation. in sleep. say which.',
        'name the medium your mind needs to actually move.',
        'where do your thoughts get clearer. say the place. the activity. the form.'
      ],
      deep: [
        'name the substrate without which you do not actually think — only react.',
        'the conditions under which your cognition turns from reflex into work.',
        'where the thinking happens. before the answer arrives. say the room.'
      ]
    },

    // What They Believe — three convictions
    belief_loud: {
      easy: [
        'what do you really believe? something you would say in an argument.',
        'name a belief you would defend.',
        'one thing you think is true that other people argue about.'
      ],
      middle: [
        'the conviction you would lose friends over.',
        'the belief you would defend in a room of people who disagree.',
        'name the one you would not soften for the sake of comfort.'
      ],
      deep: [
        'the belief you have already lost people over.',
        'the conviction whose social cost you have paid and would pay again.',
        'the one you stand behind even when it makes the room awkward.'
      ]
    },

    belief_quiet: {
      easy: [
        'a belief you used to argue for, but stopped.',
        'something you used to defend out loud, but no longer do.',
        'name a thing you still believe but have stopped pushing on.'
      ],
      middle: [
        'the conviction you have stopped defending out loud.',
        'a belief you keep, but not in public anymore.',
        'name the position you hold privately and have given up on persuading anyone of.'
      ],
      deep: [
        'the belief you carry without representation.',
        'the position you abandoned the public case for, but kept the private hold on.',
        'a quiet conviction. you stopped arguing for it. you did not stop having it.'
      ]
    },

    belief_doubted: {
      easy: [
        'a belief you have that you suspect might be wrong.',
        'name something you believe but are not sure of.',
        'what is one of your opinions you would not bet money on?'
      ],
      middle: [
        'the conviction you suspect is wrong but cannot let go of.',
        'a belief you defend even though some part of you knows.',
        'name the position you cannot quite trust but cannot abandon.'
      ],
      deep: [
        'the belief whose foundation you can already see eroding.',
        'a conviction you keep against the evidence in your own life.',
        'the one you hold even though you can argue the other side better.'
      ]
    },

    // Three Dilemmas — concrete scenes from PDF
    dilemma_friend: {
      easy: [
        'a close friend is making a choice that is hurting them. they have not asked your opinion. what do you do?',
        'someone you love is hurting themselves slowly. you can see it. they cannot. say what you do.',
        'a friend is going down a road that ends badly. they have not asked. do you speak.'
      ],
      middle: [
        'a close friend is making a choice that is harming them. they have not asked. you decide whether to speak. say what you do, and why.',
        'a person you love is in slow trouble of their own making. you have not been asked. say what you do.',
        'name the move. when love and respect for autonomy point opposite directions, which way do you go.'
      ],
      deep: [
        'someone you love is harming themselves on a schedule you can almost predict. you have not been invited in. name the move you make and the cost you accept.',
        'a friend will resent you for telling them, and they will be wrong but it will hurt anyway. you know all this. say what you do and what it costs.',
        'the friend, the harm, the silence, the speech. each option has a price. say which price you pay.'
      ]
    },

    dilemma_stranger: {
      easy: [
        'a stranger asks for shelter. you have no reason to trust them and no reason to distrust them. what do you do?',
        'someone you do not know needs a place to sleep. they have not threatened you. they have not earned anything. say what you do.',
        'a stranger asks for help. nothing tells you yes or no. you decide. say it.'
      ],
      middle: [
        'a stranger asks for shelter. you have no reason to trust them and no reason to distrust them. say what you do.',
        'an unknown person, an unbiased night. the choice has no easy frame. name the move.',
        'a stranger appears at the door. nothing about them resolves the question. say what you decide.'
      ],
      deep: [
        'a stranger asks for shelter and the data is mute. say what you do. then say what your move tells you about who you have become.',
        'the door, the night, the stranger, the choice. the choice teaches you what you actually carry. say what you do and what you learn.',
        'no signs to read. only your defaults. name the default. own it.'
      ]
    },

    dilemma_witness: {
      easy: [
        'you witness something wrong. stopping it requires you to expose something about yourself. what do you do?',
        'to stop a harm, you have to tell on yourself first. say what you do.',
        'the cost of doing the right thing here is your own privacy. do you pay it.'
      ],
      middle: [
        'you witness wrong. to stop it you must expose your own secret. say what you do, and which you protect.',
        'the wrong is real. the cost of stopping it is your cover. name the move.',
        'silence preserves you and continues the harm. speech ends the harm and exposes you. say what you choose.'
      ],
      deep: [
        'a wrong unfolds. ending it requires sacrificing your own privacy. name what you do, and name what kind of person each choice would make you.',
        'witness, harm, secret, cost. the math is brutal and the answer is in your bones. say it.',
        'the wrong does not require you. it would continue without you. you are choosing whether to make it your problem at the price of your cover. say the choice.'
      ]
    },

    // What They Could Teach — the gift-back
    teach_short: {
      easy: [
        'something you could teach a stranger in ten minutes.',
        'name a thing you know that you could quickly show another person.',
        'a small skill or piece of knowledge you carry. quick to pass on.'
      ],
      middle: [
        'something you could teach a stranger in ten minutes.',
        'the small thing you can transmit fast. name it.',
        'name the gift you can hand over to a person you just met.'
      ],
      deep: [
        'the thing you carry that fits in a stranger\'s pocket.',
        'a piece of you that travels light and can be handed off without ceremony.',
        'the small transferable thing. name it. the world becomes infinitesimally better the moment it does.'
      ]
    },

    teach_long: {
      easy: [
        'something you could teach only someone who knows you well.',
        'a deeper thing you carry. it would take time to share. say what.',
        'name something you would only pass to someone close.'
      ],
      middle: [
        'something you could only teach someone who already loved you.',
        'the long-form gift. only transmittable through trust. name it.',
        'name the thing in you that takes years to show another person.'
      ],
      deep: [
        'the thing you cannot hand to a stranger because they would not survive the receiving.',
        'the depth-gift. it requires the receiver to already be inside the door.',
        'name the lesson that requires presence, not language. and time. and earned access.'
      ]
    },

    // The Face After — post-emergence reflection
    face_after: {
      easy: [
        'who do you want to be when you come out the other side of this?',
        'when the card is finished, who do you hope is holding it?',
        'on the far side of being made — who do you want to be there?'
      ],
      middle: [
        'who do you want to be on the other side of being made?',
        'the card seals soon. name the self you want it to seal in.',
        'the version of you the card will fix in place. who is that.'
      ],
      deep: [
        'name the self you would be willing to become permanent.',
        'the face you want fixed when the carapace hardens. say it now or it sets without you.',
        'the card is going to remember this version. tell it who.'
      ]
    }
  };

  // ============================================================
  // IDK REPHRASINGS — fired when player types "i don't know" / "idk"
  // Each has the structure: re-frame + 3 concrete examples + skip option.
  // Embedded Professor-Oak-style explanation, kept in Morpheus voice.
  // ============================================================
  var IDK_REPHRASINGS = {

    backstory: 'three sentences. they do not have to be true sentences. they have to be load-bearing ones.\n' +
               'try: a place (a city, a kitchen, a school hallway). then a moment (the day something broke or began). then how you got from there to this room.\n' +
               'or skip and the burrow asks the next thing.',

    motivation: 'what you want is rarely abstract. it has a shape.\n' +
                'try: a thing you would build. a place you would live. a way of being you reach for. a person you would want to become.\n' +
                'or skip.',

    fear: 'fear is rarely absent. it is usually unnamed.\n' +
          'think small first. the silence after a question. being read while reading. a phone call you keep not returning. the shape of what you avoid is fear taking form.\n' +
          'or skip and the burrow asks the next thing.',

    flaw: 'the flaw you cannot name is itself a flaw shape. start somewhere lower.\n' +
          'try: a thing you keep apologizing for. a way you have hurt people. a habit you have given up trying to fix.\n' +
          'or skip.',

    bond: 'name the call you would answer at three in the morning.\n' +
          'or the place you would buy a ticket back to. or the thing you would not sell at any price. these all point at the bond.\n' +
          'or skip.',

    ideal: 'one principle. just one.\n' +
           'try: kindness. honesty. craft. courage. mercy. justice. precision. devotion. play. these are the shapes. pick the one that organizes the others.\n' +
           'or skip.',

    secret: 'a secret does not have to be shameful. some are precious. some are heavy.\n' +
            'try: something you have stopped saying out loud. a feeling you have not given a name. an event nobody around you currently knows happened.\n' +
            'or skip.',

    pivotalEvent: 'the pivot is the discontinuity. before-and-after.\n' +
                  'try: a death. a phone call. a leaving. an arrival. a sentence someone said. a book you closed and could not open the same way again.\n' +
                  'or skip.',

    trait_unlearned: 'something you do that you cannot remember learning.\n' +
                     'try: how you greet strangers. how you treat animals. how you sit when you are tired. these are things nobody taught you.\n' +
                     'or skip.',

    trait_avoided: 'an avoidance with no clean reason.\n' +
                   'try: a kind of conversation. a kind of room. a kind of person. a kind of question. you steer around it. you cannot say why.\n' +
                   'or skip.',

    trait_surfacing: 'tired version. when the polish goes.\n' +
                     'try: do you get sharper, slower, kinder, meaner, funnier, quieter? what comes out when there is no energy left to hold it back?\n' +
                     'or skip.',

    cognition: 'where does the actual thinking happen.\n' +
               'try: walking, showering, driving, doing dishes, writing, drawing, talking aloud, talking to a specific person, in a specific chair.\n' +
               'or skip.',

    belief_loud: 'a conviction you would defend in a room.\n' +
                 'try: about people, work, justice, art, money, parenting, time, attention, what is owed, what is sacred. the one you would say even when nobody else would.\n' +
                 'or skip.',

    belief_quiet: 'a belief you have stopped arguing for in public.\n' +
                  'try: something you stopped saying because of how it landed. or because you got tired. or because the room got worse. you did not stop believing it.\n' +
                  'or skip.',

    belief_doubted: 'a belief you suspect is wrong.\n' +
                    'try: a position you took young and have not revised. an opinion you defend more loudly than the evidence warrants. a thing you teach but do not actually practice.\n' +
                    'or skip.',

    dilemma_friend: 'silence preserves the friendship and continues the harm. speech may end both. say what you would do.\n' +
                    'or write the move you have actually made in a real version of this.\n' +
                    'or skip.',

    dilemma_stranger: 'no information to read. only your defaults. say what your default is.\n' +
                      'or refuse to name a default and say why.\n' +
                      'or skip.',

    dilemma_witness: 'the wrong is real. exposing it exposes you. say what you do.\n' +
                     'or name the cost of either choice and which cost you would pay.\n' +
                     'or skip.',

    teach_short: 'something portable.\n' +
                 'try: how to chop an onion. how to read a contract. how to listen. how to start a conversation with someone older. how to apologize. how to disagree.\n' +
                 'or skip.',

    teach_long: 'something only transmittable through time.\n' +
                'try: how to sit with somebody. how to be in love. how to grieve. how to fail. how to come back. how to see another person.\n' +
                'or skip.',

    face_after: 'the version of you the card freezes.\n' +
                'try: someone steady. someone unfinished. someone honest about being mid-becoming. someone who survived the questions. someone who refused to perform an answer.\n' +
                'or skip.'
  };

  // ============================================================
  // TIER RESOLUTION
  // ============================================================
  function tierForDepthScore(score){
    if(score >= 10) return 'deep';
    if(score >= 4)  return 'middle';
    return 'easy';
  }

  // ============================================================
  // PROMPT PICKER — picks tier + variant, avoiding the last-used variant
  // ============================================================
  function pickPrompt(field, depthScore, lastIndexUsed){
    var prompts = PROMPTS[field];
    if(!prompts){
      return { prompt: '', tier: 'easy', index: -1 };
    }
    var tier = tierForDepthScore(depthScore || 0);
    var variants = prompts[tier];
    if(!variants || !variants.length){
      tier = 'middle';
      variants = prompts.middle || prompts.easy || [];
    }
    if(!variants.length){
      return { prompt: '', tier: tier, index: -1 };
    }
    // Pick a variant index different from last
    var idx;
    if(variants.length === 1){
      idx = 0;
    } else {
      do {
        idx = Math.floor(Math.random() * variants.length);
      } while(idx === lastIndexUsed && variants.length > 1);
    }
    return { prompt: variants[idx], tier: tier, index: idx };
  }

  function pickIdkRephrase(field){
    return IDK_REPHRASINGS[field] || 'try a smaller version. or skip.';
  }

  // ============================================================
  // EXPORTS
  // ============================================================
  global.TierProse = {
    pickPrompt: pickPrompt,
    pickIdkRephrase: pickIdkRephrase,
    tierForDepthScore: tierForDepthScore,
    FIELDS: Object.keys(PROMPTS),
    _internals: { PROMPTS: PROMPTS, IDK_REPHRASINGS: IDK_REPHRASINGS }
  };
})(typeof window !== 'undefined' ? window : globalThis);
