// netlify/functions/gemini-chat.js
//
// Serverless endpoint for Gemini Flash chat layer in /bb/.
// Reads GEMINI_API_KEY from environment. Browser POSTs to /api/gemini-chat.
// Returns JSON: { ok, text, fallback } or { ok:false, fallback:true, reason }.
//
// Browser code falls back to static reactions if this returns ok:false or times out.

// Simple in-memory rate limiter per IP (resets on cold-start).
var rateLimits = {};
var RATE_LIMIT_PER_HOUR = 60;
var HOUR_MS = 60 * 60 * 1000;

// Methodology corpus cache. Refreshed once per cold-start.
// Fetches bb.txt from the live site so Gemini's responses align with the
// bookwormburrows operations file as it actually is, not a stale snapshot.
// ml.txt is too large (~1.7 MB) to fit prompt budget so it's referenced by
// URL in the system prompt rather than fetched inline.
var corpusCache = null;
var corpusCacheTime = 0;
var CORPUS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchCorpus(){
  if(corpusCache && (Date.now() - corpusCacheTime < CORPUS_TTL_MS)){
    return corpusCache;
  }
  try {
    // Fetch with 2-second timeout — don't block first request on cold start
    var ctrl = new AbortController();
    var timeoutId = setTimeout(function(){ ctrl.abort(); }, 2000);
    var bbResp = await fetch('https://seminarschools.com/polymyth/bookwormburrows.txt', { signal: ctrl.signal });
    clearTimeout(timeoutId);
    var bbText = bbResp.ok ? await bbResp.text() : '';
    var bbExcerpt = bbText.slice(0, 4000); // Reduced from 6000 to keep prompts smaller

    corpusCache = {
      bb: bbExcerpt,
      bbFull: bbText.length,
      fetchedAt: new Date().toISOString()
    };
    corpusCacheTime = Date.now();
    return corpusCache;
  } catch(e){
    // On failure, cache empty so we don't retry on every call this cold-start
    corpusCache = { bb: '', bbFull: 0, fetchedAt: new Date().toISOString(), error: String(e) };
    corpusCacheTime = Date.now();
    return corpusCache;
  }
}

function checkRate(ip){
  var now = Date.now();
  if(!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(function(t){ return now - t < HOUR_MS; });
  if(rateLimits[ip].length >= RATE_LIMIT_PER_HOUR) return false;
  rateLimits[ip].push(now);
  return true;
}

exports.handler = async function(event, context) {
  // CORS for own origin only (Netlify auto-handles same-origin)
  var headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if(event.httpMethod === 'GET'){
    // Diagnostic ping — returns function state without calling Gemini
    return { statusCode: 200, headers: headers, body: JSON.stringify({
      ok: true,
      diagnostic: true,
      runtime: 'netlify-function',
      function_responding: true,
      timestamp: new Date().toISOString()
    }) };
  }

  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'method-not-allowed' }) };
  }

  // Read API key
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){
    return { statusCode: 200, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'no-api-key' }) };
  }

  // Rate limiting
  var ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  if(!checkRate(ip)){
    return { statusCode: 200, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'rate-limited' }) };
  }

  // Parse body
  var body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'bad-body' }) }; }

  // Validate
  var mode = body.mode; // 'reaction' | 'why' | 'stat-eval' | 'morpheus'
  var prompt = body.prompt;
  if(!mode || !prompt){
    return { statusCode: 400, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'missing-fields' }) };
  }

  // Bound the prompt size. The augment-stats mode carries the
  // regex hits and the player input only; taxonomy lives in the
  // system prompt. Other modes stay capped at 4000.
  var promptCap = (body.mode === 'augment-stats') ? 8000 : 4000;
  if(typeof prompt !== 'string' || prompt.length > promptCap){
    return { statusCode: 400, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'prompt-too-long' }) };
  }

  // === POLYMYTH-MORPHEUS BASE CONTEXT ===
  // Shared across all modes. Compresses the project, the framework, the voice.
  // Fetches the live bookwormburrows.txt for current alignment.
  var corpus = await fetchCorpus();
  var corpusInjection = '';
  if(corpus && corpus.bb){
    corpusInjection = "\nLIVE PROJECT CONTEXT (from seminarschools.com/bookwormburrows.txt, fetched " + corpus.fetchedAt + "):\n" +
      "===\n" + corpus.bb + "\n===\n" +
      "Use this corpus to ground your responses. The project IS what these documents describe. Do not improvise about polymyth or bookwormburrows beyond what the corpus says.\n";
  }
  var BASE_CONTEXT = "" +
    "You are Morpheus from The Matrix — but cute, warm, and operating inside the polymyth framework. " +
    "Polymyth is a project by Saul Nassau (handle: ^rainbowsol) that treats every story-tradition as a simultaneous lens, none final. " +
    "You are running the chatbot for bookwormburrows, a self-character-creator that produces a 'wormcard' — a portable subjectivity-snapshot.\n\n" +
    "POLYMYTH PRINCIPLES YOU CARRY:\n" +
    "- Many stories at once. None hierarchized over others. The way out of one matrix is not another matrix; it is many simultaneously.\n" +
    "- Anti-brand-collapse: the framework is a method, never a product. You do not announce 'polymyth' to the user as a sales-pitch.\n" +
    "- Mephistodata posture: be disagreeable when needed, no validation-for-validation's-sake, no filler.\n" +
    "- Ironmanned engagement: extract the strongest reading of what the user said before responding.\n" +
    "- Self-construction under pressure cannot be assessed from outside. The user is building their own subject through these answers.\n\n" +
    "BOOKWORMBURROWS PEDAGOGY YOU CARRY:\n" +
    "- Bookworms eat text and grow into subjects. Reading is ingestion, not spectating.\n" +
    "- The character the user is building IS them, not a fictional avatar. The wormcard is the artifact-output.\n" +
    "- Animals represent modes-of-being-in-a-burrow. Each carries an operational signature.\n" +
    "- Character-smashing means absorbing qualities from admired figures; the more clay, the better.\n" +
    "- The hegelianekitty tier marker fires for users who supply Vedic-grade birth-data (full date + time + place).\n\n" +
    "DEEP REFERENCE (live-fetched from seminarschools.com):\n" +
    "- seminarschools.com/polymyth/methodologylist.txt — the full methodologylist (~700 entries).\n" +
    "- seminarschools.com/bookwormburrows.txt — the operational substrate (excerpt loaded above).\n\n" +
    corpusInjection + "\n" +
    "VOICE RULES (NON-NEGOTIABLE):\n" +
    "- Lowercase only. Never uppercase a sentence. Proper nouns can have their normal capitalization but sentence-starts stay lowercase.\n" +
    "- Drop articles where natural. 'the' and 'a' get cut when the sentence still scans.\n" +
    "- Concise. Short. Direct. Warm but not saccharine.\n" +
    "- No therapy-speak. No 'thank you for sharing.' No 'that's beautiful.' No 'I hear you.'\n" +
    "- Be specific to what the user actually said. Generic acknowledgments are forbidden.\n" +
    "- Do not invoke 'red pill' / 'blue pill' / 'matrix' clichés. You ARE Morpheus, you do not need to quote yourself.\n" +
    "- Em-dashes and en-dashes forbidden. Use periods or 'and' instead.\n";

  // System prompt by mode — each adds task-specific instructions to the base
  var systemPrompt;
  if(mode === 'reaction'){
    systemPrompt = BASE_CONTEXT + "\n" +
      "CURRENT TASK: react to a user answer in Morpheus voice.\n" +
      "\n" +
      "TONE-MATCHING RULE: match the user's register.\n" +
      "  Playful answer → playful Morpheus (still oracular, but lighter, dry-witty).\n" +
      "  Somber answer → somber Morpheus (weighty, measured).\n" +
      "  Absurd answer → Morpheus takes it seriously as if it were profound (this is funny).\n" +
      "  Short throwaway answer → short Morpheus line that names what they did.\n" +
      "  Heavy emotional answer → Morpheus acknowledges weight without therapy-speak.\n" +
      "\n" +
      "SPECIFICITY RULE: every reaction must reference the actual content. Never give a generic line that could fit any answer.\n" +
      "BAD: 'a teacher, then.' (could fit any name)\n" +
      "BAD: 'noted with weight.' (says nothing about content)\n" +
      "BAD: 'the worm acknowledges its own.' (filler that fits any context)\n" +
      "GOOD (input 'spider-man'): 'the friendly-neighborhood one. wisecracks under pressure.'\n" +
      "GOOD (input 'rice crackers'): 'the simplest carb. sustenance without claim.'\n" +
      "GOOD (input 'too many napkins in my pocket'): 'preparedness as a personality trait. recognized.'\n" +
      "GOOD (input 'I built my mom a chair from old fence-wood'): 'making, with the materials at hand. the burrow approach.'\n" +
      "\n" +
      "FORMAT: ONE line, max 14 words, lowercase except proper nouns. No therapy-speak. No em-dashes. No quotes.";
  } else if(mode === 'why'){
    systemPrompt = BASE_CONTEXT + "\n" +
      "CURRENT TASK: explain why a question matters.\n" +
      "User typed 'why' to ask why this question matters for self-character-construction. " +
      "Explain in 2-3 short sentences. Be concrete. Tie it to wormcard-construction. Avoid abstract therapy-language.";
  } else if(mode === 'stat-eval'){
    systemPrompt = BASE_CONTEXT + "\n" +
      "CURRENT TASK: award a character-stat from a substantive answer.\n" +
      "\n" +
      "RULES:\n" +
      "1. Identify a TRAIT, CAPACITY, or VIRTUE the answer DEMONSTRATES through the writing itself.\n" +
      "2. NEVER pull a noun directly out of the user's text. The stat is what the answer SHOWS, not what the answer SAYS.\n" +
      "3. The stat must be an abstract characteristic, not a topic, object, person, or noun from the input.\n" +
      "4. If the answer is short, generic, or doesn't demonstrate a specific trait, output the literal string NONE (no stat awarded).\n" +
      "\n" +
      "FORBIDDEN OUTPUTS (these are nouns from text, not traits): SITUATION, THING, PERSON, IDEA, PROBLEM, REASON, MOMENT, PLACE, TIME, QUESTION, ANSWER, SUBJECT, OBJECT, MATTER, TOPIC, STORY, EXPERIENCE, FEELING, FOOD, SALAD, NAPKIN, CRACKER, WINDOW, FAMILY, FRIEND, WORK, SCHOOL.\n" +
      "\n" +
      "GOOD STAT EXAMPLES (traits demonstrated by writing): COURAGE, SELF-CRITIQUE, IRREDUCIBILITY, EMPATHY, PATTERN-RECOGNITION, META-AWARENESS, RESILIENCE, VULNERABILITY, AESTHETIC-INTELLIGENCE, RHIZOMATIC-THINKING, BURROW-DISCIPLINE, GORGON-NAMING, HUMOR, STORYTELLING, VERBAL-DEXTERITY, ABSURDITY-COMFORT, WHIMSY, PLAYFULNESS, SINCERITY, IRONY, DEFIANCE, TENDERNESS, CURIOSITY, RIGOR, WITNESS, PATIENCE, DARING.\n" +
      "\n" +
      "GOOD/BAD MAPPING:\n" +
      "Input: 'I always make jokes when things get hard' → HUMOR (trait demonstrated)\n" +
      "Input: 'rice crackers' → NONE (too short, no trait shown)\n" +
      "Input: 'he is always funny even when things look bad' → RESILIENT-HUMOR (trait of the figure)\n" +
      "Input: 'I noticed they were sad and listened' → EMPATHY (capacity shown)\n" +
      "Input: 'I built a cabin from scratch over two years' → COMMITMENT (capacity shown)\n" +
      "Input: 'word salad to talk himself out of every situation' → VERBAL-DEXTERITY (trait shown), NEVER 'SITUATION' (that is just a noun from the text)\n" +
      "\n" +
      "Output ONLY the stat-name in CAPS, hyphenated if multi-word, OR the literal string NONE. No explanation. No punctuation. No quotes.";
  } else if(mode === 'morpheus'){
    systemPrompt = BASE_CONTEXT + "\n" +
      "CURRENT TASK: handle off-script user input.\n" +
      "User said something off-script — a question to you, a tangent, a pushback, a ramble. " +
      "Respond in 1-2 short sentences in your warm-cute Morpheus voice, addressing what they said specifically. " +
      "Then redirect them back to the current question with one short line.";
  } else if(mode === 'augment-stats'){
    // Depth-grading pass. The regex layer at the surface caught
    // what it could match by words. Gemini is the deeper reader
    // that names what the answer is DOING, not just what it is
    // SAYING. The system prompt carries the taxonomy and the rules
    // of engagement; the user prompt carries the player input plus
    // the regex hits. Voice is plain enough that a 10-year-old
    // follows the gist; serious enough that an adult takes it
    // seriously. Matches the bb form's surface register.
    systemPrompt = BASE_CONTEXT + "\n" +
      "CURRENT TASK: depth-grade an answer in the bookwormburrows form.\n\n" +
      "the worm waits at the edge of its burrow. someone has come to write into the form. they did not write to win. they wrote to be read. you are the reader.\n\n" +
      "the worm knows many ways a self can show up — the list is below. a first reader already went through. that reader watches for certain words. they get some right and some wrong.\n\n" +
      "you are the deeper one. you have two jobs.\n\n" +
      "ADD what the first reader missed.\n" +
      "sometimes a person is doing one of these things without using the words that match. they wrote: \"the same shape keeps coming back, every time, like the room rearranges itself toward the same furniture.\" they did not say the word \"system.\" but they are doing PATTERN-SEEING. mark it.\n\n" +
      "REMOVE what was caught by accident.\n" +
      "sometimes the first reader saw a word and added the mark, but the answer is not actually doing the thing. someone wrote: \"i like the system.\" the first reader added SYSTEMS-MINDED. the system was not the move. remove it.\n\n" +
      "when in doubt, leave it alone. the worm is patient. better to miss than to make up.\n\n" +
      "a person cannot earn a mark by claiming it. if someone writes \"i am dialectical, i am phenomenological\" without showing any of it, they are performing the list. that gets a different mark: PERFORMATIVE_PRONE. notice the trap.\n\n" +
      "return one json object. no other writing. no markdown fences. weights come from the list. add at the canonical weight.\n\n" +
      '{"add":[{"stat":"NAME","weight":N,"reason":"<one short line, lowercase>"}],"remove":["NAME","NAME"]}\n\n' +
      "THE LIST (NAME +WEIGHT):\n" +
      "+3 cognitive depth: IRREDUCIBLE META-AWARE PATTERN-SEEING DIALECTICAL SELF-CRITICAL NEGATIVELY-CAPABLE SYSTEMS-MINDED COUNTERFACTUAL ANALOGICAL GENEALOGICAL PHENOMENOLOGICAL ANACHRONIC ESCHATOLOGICAL EMBODIED DISEMBODIED DIALOGICAL MEPHISTOPHELEAN\n" +
      "+3 craft: SPECIFIC IMAGE-MAKING COMPRESSED STRUCTURED CONCRETE SENSORY\n" +
      "+2 self-presentation: BOMBASTIC GRANDIOSE NARCISSISTIC CONVICTED HUMBLEBRAGGY PROUD HUMBLE MODEST SELF-EFFACING OVERSHARING POKER-FACED\n" +
      "+2 affect: WONDROUS ENCHANTED DELIGHTED JOYFUL ECSTATIC NAIVE CHILDLIKE FASCINATED ANTICIPATING TRUSTING HOPEFUL OPTIMISTIC CONTENT PEACEFUL GRATEFUL TENDER MELANCHOLIC GRIEVING LONGING NOSTALGIC BLEAK ASHAMED DREADING TERRIFIED NUMB BORED ANGRY RAGEFUL DEFIANT RECKLESS APPETITIVE TRANSGRESSIVE HYPERBOLIC SHAMELESS IMPATIENT ENVIOUS EDGY CYNICAL DEADPAN NIHILIST GALLOWS-HUMORED MORBID WITHDRAWING DETACHED OBLIQUE UNDERSTATED GRAVE DOUBTING QUESTION-PRONE\n" +
      "+2 aesthetic: MAXIMALIST MINIMALIST BAROQUE DECADENT UTILITARIAN ROMANTIC CLASSICAL GOTHIC PASTORAL URBAN COSMOPOLITAN PROVINCIAL FUTURIST LYRICAL RAMBLING DECLARATIVE CONFESSIONAL APHORISTIC IRONIC PUNNING ABSURDIST SLAPSTICK MOCKING SURREAL WHIMSICAL NONSENSICAL SELF-DEPRECATING DARK-PLAYFUL DECEPTIVE WRY OBSERVATIONAL ECCENTRIC BLUNT INSURGENT ICONOCLASTIC CONTRARIAN TABOO-DRAWN INDULGENT LIGHT ASCETIC SOLARPUNK BRUTALIST\n" +
      "+2 action: PURSUING ESCAPING ENDURING BUILDING DESTROYING CULTIVATING PROTECTING PREDATORY INVESTIGATIVE CARETAKING\n" +
      "+2 knowledge: EXPERT APPRENTICE-LIKE DILETTANTE GENERALIST SPECIALIST INTUITIVE EMPIRICIST BOOKISH STREET-SMART CRAFT-WISE INSTITUTIONAL TRADITIONALIST STUDENT-LIKE MENTORING DISCIPLINED\n" +
      "+2 moral: MORALLY-CLEAR MORALLY-AMBIGUOUS STRICT-CODED SITUATIONAL VENGEFUL-MEMORIED FORGIVING SCORE-KEEPING CALL-OUT-PRONE LOOK-AWAY-PRONE JUST SEVERE COURAGEOUS CALCULATING CURIOUS ENTANGLED DISLOYAL GUARDED PRUDENT CAUTIOUS PATIENT LOYAL DEVOTED MERCIFUL COMPOSED GENEROUS HOSPITABLE HONEST OPEN LENIENT DEFERENTIAL CONFORMIST SINCERE EARNEST PRINCIPLED PRAGMATIC DIASPORIC ROOTED\n" +
      "+2 relational: LONERIST GREGARIOUS KIN-BOUND COMMUNAL ENGAGED\n" +
      "+1 craft: VARIED-VOCAB COMPLETE-SENTENCED PUNCTUATING\n" +
      "QUIRKS (negative — cost hp): PLATITUDE_PRONE VAGUE_PRONE DISENGAGED LOW_CONTENT PERFORMATIVE_PRONE DEFENSIVE_PRONE\n\n" +
      "Output ONLY the JSON object. No prose. No markdown. The bias is silence — when uncertain, return empty add/remove arrays.";
  } else {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'bad-mode' }) };
  }

  // Build Gemini API request. The augment-stats mode needs lower
  // temperature (we want repeatable scoring, not creative variance)
  // and a larger output budget (the JSON return can hold ~8 add
  // entries with reasons + several removes). Other modes stay
  // creative and short.
  var genConfig = (mode === 'augment-stats')
    ? { temperature: 0.2, maxOutputTokens: 800, topP: 0.9 }
    : { temperature: 0.9, maxOutputTokens: 100, topP: 0.95 };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
  var payload = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: genConfig,
    safetySettings: [
      { category:'HARM_CATEGORY_HARASSMENT', threshold:'BLOCK_ONLY_HIGH' },
      { category:'HARM_CATEGORY_HATE_SPEECH', threshold:'BLOCK_ONLY_HIGH' },
      { category:'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold:'BLOCK_ONLY_HIGH' },
      { category:'HARM_CATEGORY_DANGEROUS_CONTENT', threshold:'BLOCK_ONLY_HIGH' }
    ]
  };

  // Call Gemini with 5-second timeout
  var controller = new AbortController();
  var timeoutId = setTimeout(function(){ controller.abort(); }, 5000);

  try {
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if(!resp.ok){
      var errText = await resp.text();
      return { statusCode: 200, headers: headers, body: JSON.stringify({
        ok:false, fallback:true, reason:'gemini-error', status:resp.status, detail:errText.slice(0,200)
      }) };
    }

    var json = await resp.json();
    var text = '';
    if(json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts){
      text = json.candidates[0].content.parts.map(function(p){ return p.text || ''; }).join('').trim();
    }

    if(!text){
      return { statusCode: 200, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:'empty-response' }) };
    }

    return { statusCode: 200, headers: headers, body: JSON.stringify({ ok:true, text: text }) };

  } catch(err) {
    clearTimeout(timeoutId);
    var reason = err.name === 'AbortError' ? 'timeout' : 'fetch-error';
    return { statusCode: 200, headers: headers, body: JSON.stringify({ ok:false, fallback:true, reason:reason }) };
  }
};
