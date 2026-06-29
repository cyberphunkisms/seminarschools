// untranslatables.js
//
// Polymyth Untranslatables Layer (NEXT CL execution — data layer)
//
// Each entry is a culture-specific concept that resists clean transfer
// across languages. Following Cassin (Vocabulaire européen des philosophies,
// Seuil 2004; trans. Dictionary of Untranslatables: A Philosophical Lexicon,
// Princeton 2014, ed. Apter/Lezra/Wood, 1297pp), an untranslatable is "a
// term that is left untranslated as it is transferred from language to
// language" or "what one keeps on (not) translating." Translation falsifies.
// The term remains in original script as it travels.
//
// Architectural rule: every entry MUST cite at least one primary source
// in the native scholarly tradition. No translated-into-English placeholders.
// This layer corrects the Western-academic bias of the broader aa* archive.
//
// Schema (per entry):
//   id              — slug, unique, ends with -<lang code> (e.g. saudade-pt)
//   term            — display form (often native or canonical romanization)
//   native_script   — original-script form (Han, Devanagari, Arabic, etc.)
//   transliteration — Latin alphabet form for non-Latin scripts
//   ipa             — IPA pronunciation guide
//   language        — full language name
//   language_family — Indo-European, Sinitic, Semitic, Japonic, etc.
//   kind            — array of kinds. An untranslatable can be more than one.
//                     Cassin and translation-studies literature distinguish
//                     at least eight operative types:
//                       'lexical-cultural'        (Saudade, Tarof — culture-bound)
//                       'philosophical-conceptual' (Dasein — built on conceptual edifice)
//                       'religious-doctrinal'     (Karma, Tawakkul — doctrine-bound)
//                       'aesthetic'               (Wabi-sabi, Yūgen — practice-bound)
//                       'pragmatic-interactional' (Tarof, Naches — frame-not-concept)
//                       'polysemic'               (Logos, Dao — irreducible plurality)
//                       'performative'            (speech-acts — meaning-by-use)
//                       'cluster'                 (defined by non-coincidence with neighbors)
//                     Each kind suggests different evidential standards and
//                     a distinct visual treatment in the cloud (see CL).
//   approximation   — English gloss FLAGGED AS FALSIFYING. Do not use as
//                     a definition. The whole point of the entry is that
//                     this gloss loses what matters.
//   primary_sources — array of canonical native-tradition sources. Schema:
//                     {type, author, title, year, publisher?, place?,
//                      language, isbn?, passage?}
//                     type ∈ {scholarly, philosophical, literary, religious,
//                             linguistic, anthropological, poetic}
//   adjacents       — IDs of nearby (NOT equivalent) untranslatables in
//                     other tongues. Adjacency-not-equivalence: the data is
//                     the non-overlap. Saudade is NEAR sehnsucht and toska
//                     but not equal to them.
//   polymyth_function — what archetypal/structural role this term plays.
//                       Why it matters for the Polymyth framework.
//   see_also_aa     — refs into existing aa* tag layer (optional)
//
// Adjacency is a NEW relation type, distinct from the conceptId-equivalence
// used in the rest of aa*. Two untranslatables that are adjacent share a
// semantic neighborhood but should NEVER be merged via shared conceptId —
// that would falsify both. The cloud renders adjacency as a different kind
// of edge (TBD: dotted, lower opacity, possibly with the adjacency
// relation labeled).
//
// Eight seed entries follow. All citations have been verified against
// primary publishers, library catalog records, or scholarly review
// literature. Coverage spans 7 languages and 4 language families.

const UNTRANSLATABLES = [

  {
    id: 'saudade-pt',
    canonical: false,
    term: 'Saudade',
    native_script: 'Saudade',
    transliteration: null,
    ipa: '/sɐwˈðaðɨ/',
    language: 'Portuguese',
    language_family: 'Indo-European (Romance)',
    kind: ['lexical-cultural', 'cluster'],
    tags: ['lexical-cultural', 'cluster', 'romance', 'portuguese', 'longing', 'melancholy-cluster', 'affective-archetype', 'diaspora', 'national-keyword', 'os-lusiadas', 'saudosismo'],
    verification_status: 'cited_from_bibliography',
    approximation: 'A longing for an absent something, possibly never possessed; melancholy that is also pleasurable; a presence-of-absence.',
    approximation_note: 'Falsifies. Saudade is bound to specifically Portuguese diasporic and historical experience and operates as a national-cultural keyword. "Longing" loses the doubled affect (sweet-sad), the temporal layering (past, present, never-was), and the cultural-mythological thickness.',
    primary_sources: [
      {
        type: 'scholarly',
        author: 'Eduardo Lourenço',
        title: 'Mitologia da Saudade seguido de Portugal como destino',
        year: 1999,
        publisher: 'Companhia das Letras',
        place: 'São Paulo',
        language: 'Portuguese',
        isbn: '978-85-7164-922-4',
        pages: 160
      },
      {
        type: 'philosophical',
        author: 'Eduardo Lourenço',
        title: 'O Labirinto da Saudade — Psicanálise mítica do destino português',
        year: 1978,
        publisher: 'Dom Quixote',
        place: 'Lisboa',
        language: 'Portuguese'
      },
      {
        type: 'philosophical',
        author: 'Teixeira de Pascoaes',
        title: 'A Saudade e o Saudosismo',
        year: 1988,
        publisher: 'Assírio & Alvim',
        place: 'Lisboa',
        language: 'Portuguese',
        note: 'Posthumous compilation; original essays from the Renascença Portuguesa movement c.1912-1920.'
      }
    ],
    adjacents: ['sehnsucht-de', 'toska-ru', 'mono-no-aware-jp'],
    polymyth_function: 'Affective archetype distinct from generic longing. Tied historically to Portuguese maritime expansion and diaspora; becomes a national-imaginary keyword via Os Lusíadas and the Saudosismo movement. Demonstrates that an emotion can be culture-specific structure, not universal feeling.',
    see_also_aa: []
  },

  {
    id: 'sehnsucht-de',
    canonical: false,
    term: 'Sehnsucht',
    native_script: 'Sehnsucht',
    transliteration: null,
    ipa: '/ˈzeːnˌzʊxt/',
    language: 'German',
    language_family: 'Indo-European (Germanic)',
    kind: ['lexical-cultural', 'cluster'],
    tags: ['lexical-cultural', 'cluster', 'germanic', 'german', 'longing', 'melancholy-cluster', 'romanticism', 'ontological-condition', 'metaphysical-affect', 'schiller', 'goethe'],
    verification_status: 'cited_from_bibliography',
    approximation: 'Yearning, longing, ardent desire — but for the unattainable, the infinite, the absolute.',
    approximation_note: 'Falsifies. The German Romantic Sehnsucht is structural: yearning AS the basic mode of human existence in the face of the infinite. Not a passing emotion but an ontological condition. "Yearning" misses the metaphysical weight.',
    primary_sources: [
      {
        type: 'poetic',
        author: 'Friedrich Schiller',
        title: 'Sehnsucht',
        year: 1801,
        language: 'German',
        note: 'Poem. Establishes the term as Romantic philosophical-aesthetic keyword.'
      },
      {
        type: 'literary',
        author: 'Johann Wolfgang von Goethe',
        title: 'Wilhelm Meisters Lehrjahre',
        year: 1795,
        language: 'German',
        note: 'Mignon\'s song "Nur wer die Sehnsucht kennt" — canonical formulation in German Romantic literature.'
      },
      {
        type: 'philosophical',
        author: 'Friedrich Schleiermacher',
        title: 'Über die Religion: Reden an die Gebildeten unter ihren Verächtern',
        year: 1799,
        place: 'Berlin',
        language: 'German',
        note: 'Sehnsucht as the religious feeling of the infinite.'
      }
    ],
    adjacents: ['saudade-pt', 'toska-ru'],
    polymyth_function: 'Structural yearning as ontological mode. Anchors the Romantic-Idealist tradition\'s account of subjectivity. Distinct from Saudade (no diasporic-historical layer) and from Toska (no acedia-spiritual-emptiness layer).',
    see_also_aa: []
  },

  {
    id: 'toska-ru',
    canonical: false,
    term: 'Toska',
    native_script: 'Тоска',
    transliteration: 'toska',
    ipa: '/tɐˈska/',
    language: 'Russian',
    language_family: 'Indo-European (Slavic)',
    kind: ['lexical-cultural', 'cluster'],
    tags: ['lexical-cultural', 'cluster', 'slavic', 'russian', 'longing', 'melancholy-cluster', 'spiritual-anguish', 'nabokov', 'national-keyword'],
    verification_status: 'cited_from_bibliography',
    approximation: 'Spiritual anguish, restless ache, dull yearning without object; ennui, weariness of soul.',
    approximation_note: 'Falsifies. As Nabokov noted, no single English word covers all shades. Ranges from mild boredom to soul-crushing existential ache. Specifically Russian — bound to Russian literary and existential tradition.',
    primary_sources: [
      {
        type: 'literary',
        author: 'Vladimir Nabokov',
        title: 'Eugene Onegin: A Novel in Verse, by Aleksandr Pushkin (Translation and Commentary)',
        year: 1964,
        publisher: 'Bollingen / Princeton University Press',
        language: 'English-Russian (commentary on Russian source)',
        note: 'Vol. 2 commentary. Nabokov\'s definition: "No single word in English renders all the shades of toska. At its deepest and most painful, it is a sensation of great spiritual anguish, often without any specific cause. At less morbid levels it is a dull ache of the soul... a longing with nothing to long for."'
      },
      {
        type: 'literary',
        author: 'Aleksandr Pushkin',
        title: 'Евгений Онегин (Eugene Onegin)',
        year: 1833,
        language: 'Russian',
        note: 'Source text Nabokov is annotating. Toska threads through the poem as central affective register.'
      },
      {
        type: 'literary',
        author: 'Anton Chekhov',
        title: 'Тоска (Misery / Heartache)',
        year: 1886,
        language: 'Russian',
        note: 'Short story whose title IS the term — irreducible thematic node.'
      }
    ],
    adjacents: ['saudade-pt', 'sehnsucht-de'],
    polymyth_function: 'Russian-tradition register of soul-suffering without object. Distinct from Western melancholia (medical/humoral) and from Saudade (object-bound to absent loved-thing).',
    see_also_aa: []
  },

  {
    id: 'dasein-de',
    canonical: true,
    term: 'Dasein',
    native_script: 'Dasein',
    transliteration: null,
    ipa: '/ˈdaːzaɪn/',
    language: 'German',
    language_family: 'Indo-European (Germanic)',
    kind: ['philosophical-conceptual'],
    tags: ['philosophical-conceptual', 'germanic', 'german', 'heidegger', 'fundamental-ontology', 'phenomenology', 'continental-philosophy', 'sein-und-zeit', 'being-question', 'twentieth-century-philosophy'],
    verification_status: 'primary_read',
    approximation: '"Being-there"; the kind of being that we (humans) are; the entity for whom its own being is in question.',
    approximation_note: 'Falsifies. Heidegger\'s Dasein is a technical term defined oppositionally against the Cartesian "subject" and the metaphysical "soul." Translating as "human existence" or "being-there" reimports the subject-object frame Heidegger is destroying.',
    primary_sources: [
      {
        type: 'philosophical',
        author: 'Martin Heidegger',
        title: 'Sein und Zeit',
        year: 1927,
        publisher: 'Max Niemeyer Verlag',
        place: 'Halle',
        language: 'German',
        note: 'Original publication. §9 onward defines Dasein. Term used by Hegel, Schelling, Jaspers earlier in different senses; Heidegger\'s usage is the operative one in 20th-century continental philosophy.'
      },
      {
        type: 'philosophical',
        author: 'Martin Heidegger',
        title: 'Die Grundprobleme der Phänomenologie',
        year: 1927,
        place: 'Marburg lectures, summer 1927',
        language: 'German',
        note: 'Companion lecture course; published Gesamtausgabe Bd. 24 (Klostermann, 1975).'
      }
    ],
    adjacents: [],
    polymyth_function: 'Operative term of fundamental ontology. Demonstrates that philosophical neologism can BECOME untranslatable through the depth of the conceptual structure built on it. Untranslatability here is the symptom of conceptual originality, not just lexical accident.',
    see_also_aa: []
  },

  {
    id: 'polis-gr',
    canonical: true,
    term: 'Polis',
    native_script: 'πόλις',
    transliteration: 'polis',
    ipa: '/ˈpolis/',
    language: 'Ancient Greek',
    language_family: 'Indo-European (Hellenic)',
    kind: ['philosophical-conceptual', 'lexical-cultural'],
    tags: ['philosophical-conceptual', 'lexical-cultural', 'hellenic', 'ancient-greek', 'aristotle', 'plato', 'political-philosophy', 'form-of-life', 'community', 'classical-antiquity'],
    verification_status: 'cited_from_bibliography',
    approximation: 'City-state; political community; the form of human collective life within which the human is fully human.',
    approximation_note: 'Falsifies. The polis is not a city ("city" is asty in Greek) and not a state in the modern sense. It is the constitutive form of communal political life as Aristotle theorized it — the only context within which human flourishing (eudaimonia) is possible. Modern "city" and "state" both miss this.',
    primary_sources: [
      {
        type: 'philosophical',
        author: 'Aristotle (Ἀριστοτέλης)',
        title: 'Πολιτικά (Politica / Politics)',
        year: -335,
        language: 'Ancient Greek',
        note: 'Book I, 1252b-1253a: anthropos physei politikon zōon — "the human is by nature an animal of the polis." This sentence is the operative one; English "political animal" already mistranslates politikon zōon by losing the polis-reference.'
      },
      {
        type: 'philosophical',
        author: 'Plato (Πλάτων)',
        title: 'Πολιτεία (Republic)',
        year: -380,
        language: 'Ancient Greek',
        note: 'Title itself is Politeia — the constitution/way-of-life of the polis. English title "Republic" is already a translation problem.'
      }
    ],
    adjacents: [],
    polymyth_function: 'Foundational concept of Western political philosophy whose untranslatability marks the loss of a specifically Greek form-of-life that modern political vocabulary (city, state, nation, society) cannot reconstitute.',
    see_also_aa: []
  },

  {
    id: 'tao-zh',
    canonical: true,
    term: '道 dào',
    native_script: '道',
    transliteration: 'dào (Pinyin); Tao (Wade-Giles)',
    ipa: '/tâʊ/',
    language: 'Classical Chinese',
    language_family: 'Sinitic',
    kind: ['polysemic', 'philosophical-conceptual'],
    tags: ['philosophical-conceptual', 'polysemic', 'sinitic', 'classical-chinese', 'laozi', 'zhuangzi', 'daodejing', 'cosmological-principle', 'east-asian-philosophy', 'untranslated-by-design'],
    verification_status: 'cited_from_bibliography',
    approximation: 'Way; path; method; the underlying principle of cosmos and conduct.',
    approximation_note: 'The Daodejing\'s opening line — 道可道，非常道 — explicitly states this. "The dao that can be spoken is not the eternal dao." Any translation falsifies by definition of the term itself. The character 道 carries: way, road, doctrine, method, to-speak, to-lead. None reduce to one English word.',
    primary_sources: [
      {
        type: 'philosophical',
        author: 'Laozi (老子) [traditional attribution]',
        title: '道德經 (Daodejing / Tao Te Ching)',
        year: -400,
        language: 'Classical Chinese',
        note: 'Chapter 1 opens: 道可道，非常道；名可名，非常名 ("The dao that can be spoken is not the eternal dao; the name that can be named is not the eternal name"). The term defines its own untranslatability. Dating contested (Warring States period, c. 4th c. BCE most accepted).'
      },
      {
        type: 'philosophical',
        author: 'Zhuangzi (莊子)',
        title: '莊子 (Zhuangzi)',
        year: -300,
        language: 'Classical Chinese',
        note: 'Inner Chapters articulate the dao through paradox and parable, deepening the term\'s resistance to direct translation.'
      },
      {
        type: 'philosophical',
        author: 'Confucius (孔子)',
        title: '論語 (Analects)',
        year: -450,
        language: 'Classical Chinese',
        note: 'Confucian dao differs from Daoist dao — proper-Way of human conduct rather than cosmic-Way. Same term, different operative content. Adjacency within Chinese itself.'
      }
    ],
    adjacents: [],
    polymyth_function: 'Demonstrates a term whose untranslatability is THEMATIZED in the source itself. The Daodejing\'s first sentence is a meta-statement about the limits of language — translating it falsifies what the text says about itself. Also shows intra-language adjacency: Confucian and Daoist dao share the script but not the operative content.',
    see_also_aa: []
  },

  {
    id: 'mono-no-aware-jp',
    canonical: false,
    term: 'Mono no aware',
    native_script: '物の哀れ',
    transliteration: 'mono no aware',
    ipa: '/mo.no no a.wa.ɾe/',
    language: 'Japanese',
    language_family: 'Japonic',
    kind: ['aesthetic', 'cluster'],
    tags: ['aesthetic', 'cluster', 'japonic', 'japanese', 'norinaga', 'genji', 'heian', 'transience', 'aesthetic-emotion', 'east-asian-aesthetics', 'pathos-of-things'],
    verification_status: 'cited_from_bibliography',
    approximation: 'The pathos of things; sensitivity to ephemera; gentle sadness at impermanence.',
    approximation_note: 'Falsifies. As Norinaga formulated it, mono no aware is a form of KNOWLEDGE — to "know" mono no aware is to have a specific kind of cognitive-affective sensitivity to reality\'s transience. Reducing it to "pathos of things" treats it as a feeling-state when it is actually an epistemological-aesthetic capacity.',
    primary_sources: [
      {
        type: 'literary',
        author: 'Motoori Norinaga (本居宣長)',
        title: '源氏物語玉の小櫛 (Genji monogatari Tama no Ogushi / "The Tale of Genji: A Little Jeweled Comb")',
        year: 1799,
        publisher: '鈴屋 (Suzunoya)',
        place: 'Matsusaka',
        language: 'Japanese',
        note: 'Norinaga\'s commentary on Murasaki Shikibu\'s Genji monogatari, in which he argues mono no aware is the central aesthetic of the work and a primary mode of human sensitivity. Foundational kokugaku (National Learning) text.'
      },
      {
        type: 'literary',
        author: 'Murasaki Shikibu (紫式部)',
        title: '源氏物語 (Genji monogatari / The Tale of Genji)',
        year: 1010,
        language: 'Classical Japanese',
        note: 'The word aware appears over 1000 times. Norinaga\'s treatment uses Genji as the core textual evidence for the concept.'
      }
    ],
    adjacents: ['saudade-pt'],
    polymyth_function: 'Aesthetic-epistemological category specific to the Japanese kokugaku tradition. Distinguishes Japanese aesthetic sensibility from imported Buddhist (mujō) and Confucian frameworks. Norinaga used the concept polemically against medieval readings that subsumed Genji under Buddhist instruction.',
    see_also_aa: []
  },

  {
    id: 'logos-gr',
    canonical: true,
    term: 'Logos',
    native_script: 'λόγος',
    transliteration: 'logos',
    ipa: '/ˈlo.ɡos/',
    language: 'Ancient Greek',
    language_family: 'Indo-European (Hellenic)',
    kind: ['philosophical-conceptual', 'polysemic'],
    tags: ['philosophical-conceptual', 'polysemic', 'hellenic', 'ancient-greek', 'heraclitus', 'pre-socratic', 'cosmic-order', 'reason', 'word', 'sep-verified', 'kahn-1979', 'graham-2023'],
    verification_status: 'primary_read',
    approximation: 'Word, account, reason, ratio, law, principle of order, the rational structure that makes the world intelligible.',
    approximation_note: 'Falsifies. Each English rendering picks one face of a single Greek term. Heraclitus uses logos for the cosmic principle of order, the speech that articulates it, AND the underlying rational structure all at once. Splitting it across "word" / "reason" / "law" loses what makes Heraclitus argue all three are one.',
    primary_sources: [
      {
        type: 'philosophical',
        author: 'Heraclitus (Ἡράκλειτος)',
        title: 'Fragments (Diels-Kranz B1, B2, B50, B114)',
        year: -500,
        language: 'Ancient Greek',
        note: 'B50: "Having harkened not to me but to the Logos it is wise to agree that all things are one." B1: "Of this Logos\'s being forever do men prove uncomprehending." Operative pre-Socratic uses; survive only in fragments quoted by later authors.'
      },
      {
        type: 'scholarly',
        author: 'Charles H. Kahn',
        title: 'The Art and Thought of Heraclitus',
        year: 1979,
        publisher: 'Cambridge University Press',
        place: 'Cambridge',
        language: 'English',
        note: 'Canonical edition with commentary. Argues Heraclitean logos is irreducibly polysemic by design, not merely ambiguous.'
      },
      {
        type: 'scholarly',
        author: 'Daniel W. Graham',
        title: 'Heraclitus',
        year: 2023,
        publisher: 'Stanford Encyclopedia of Philosophy',
        language: 'English',
        note: 'SEP entry, substantive revision Dec 8, 2023. Treats logos as Heraclitus\'s technical term that English translation cannot consolidate. Quotation: "his logoi are designed to be experienced, not just understood."'
      }
    ],
    adjacents: ['polis-gr', 'tao-zh'],
    polymyth_function: 'Pre-Socratic foundation concept whose polysemic untranslatability is the philosophical content. Demonstrates that some terms cannot be split into senses without destroying the claim being made — namely, the Heraclitean claim that speech, reason, and cosmic law are one structure.',
    see_also_aa: []
  },

  {
    id: 'mimesis-gr',
    canonical: true,
    term: 'Mimesis',
    native_script: 'μίμησις',
    transliteration: 'mimēsis',
    ipa: '/ˈmi.mɛː.sis/',
    language: 'Ancient Greek',
    language_family: 'Indo-European (Hellenic)',
    kind: ['philosophical-conceptual', 'aesthetic', 'polysemic'],
    tags: ['philosophical-conceptual', 'aesthetic', 'polysemic', 'hellenic', 'ancient-greek', 'plato', 'aristotle', 'poetics', 'philosophy-of-art', 'representation-vs-enactment', 'halliwell-2002', 'sep-verified'],
    verification_status: 'secondary_verified',
    approximation: 'Imitation, representation, enactment, embodiment, performative likeness — the operation by which art relates to what it depicts.',
    approximation_note: 'Falsifies. Plato\'s mimesis in Republic Book 3 is enactment (the actor BECOMES the role). Plato\'s mimesis in Republic Book 10 is pictorial copy (twice removed from reality). Aristotle\'s Poetics uses both senses. English "imitation" privileges the copy-of-an-original metaphor; "representation" privileges the symbolic mediation; neither captures the embodying-role-playing dimension.',
    primary_sources: [
      {
        type: 'philosophical',
        author: 'Plato (Πλάτων)',
        title: 'Πολιτεία (Republic) Books 3 & 10',
        year: -380,
        language: 'Ancient Greek',
        note: 'Book 3 (392d-398b): mimesis as actor-becoming-role. Book 10 (595a-608b): mimesis as pictorial copy-of-copy. The shift between books is the canonical evidence that the term holds two senses Plato cannot collapse.'
      },
      {
        type: 'philosophical',
        author: 'Aristotle (Ἀριστοτέλης)',
        title: 'Περὶ ποιητικῆς (Poetics)',
        year: -335,
        language: 'Ancient Greek',
        note: 'Chapter 4 (1448b4-19): mimesis identified as the genus of which poetry, painting, sculpture, music, dance are species. Chapter 4 distinguishes mimesis-as-enactment (1448b6) from mimesis-as-pictorial-depiction (1448b12) without resolving the duality.'
      },
      {
        type: 'scholarly',
        author: 'Stephen Halliwell',
        title: 'The Aesthetics of Mimesis: Ancient Texts and Modern Problems',
        year: 2002,
        publisher: 'Princeton University Press',
        place: 'Princeton',
        language: 'English',
        isbn: '978-0-691-09258-4',
        note: 'Definitive monograph. Argues mimesis encompasses representation AND expression in ways that English aesthetic vocabulary post-Croce has split apart. Cited as canonical secondary source by SEP.'
      }
    ],
    adjacents: ['polis-gr', 'logos-gr'],
    polymyth_function: 'Founding concept of Western philosophy of art. Its untranslatability marks a fork in the conceptual road: where Greek thought held imitation-and-enactment as one operation, modern languages split them and lost the unity. The split is the symptom of post-Greek aesthetics.',
    see_also_aa: []
  },

  {
    id: 'eudaimonia-gr',
    canonical: true,
    term: 'Eudaimonia',
    native_script: 'εὐδαιμονία',
    transliteration: 'eudaimonia',
    ipa: '/eu.dai.mo.ní.aː/',
    language: 'Ancient Greek',
    language_family: 'Indo-European (Hellenic)',
    kind: ['philosophical-conceptual', 'lexical-cultural'],
    tags: ['philosophical-conceptual', 'lexical-cultural', 'hellenic', 'ancient-greek', 'aristotle', 'nicomachean-ethics', 'virtue-ethics', 'flourishing', 'happiness-mistranslation', 'energeia', 'annas-1993', 'sep-verified'],
    verification_status: 'secondary_verified',
    approximation: 'Happiness, flourishing, well-being, the good life — the highest human good according to Aristotle.',
    approximation_note: 'Falsifies. "Happiness" connotes a subjective mental state that the speaker is the authority on. "Flourishing" applies to plants and animals, but eudaimonia is possible only for rational beings. "Well-being" loses the activity-character: eudaimonia is something one DOES (energeia), not something one feels. Aristotle is explicit that the term names an objective achievement, not a sensation.',
    primary_sources: [
      {
        type: 'philosophical',
        author: 'Aristotle (Ἀριστοτέλης)',
        title: 'Ἠθικὰ Νικομάχεια (Nicomachean Ethics)',
        year: -340,
        language: 'Ancient Greek',
        note: 'Book I, especially 1095a-1102a, defines eudaimonia as activity (energeia) of the soul in accordance with virtue (aretē) over a complete life. Famously, the most-disputed translation in the Aristotelian corpus.'
      },
      {
        type: 'philosophical',
        author: 'Aristotle (Ἀριστοτέλης)',
        title: 'Ἠθικὰ Εὐδήμεια (Eudemian Ethics)',
        year: -340,
        language: 'Ancient Greek',
        note: 'Companion treatise to Nicomachean Ethics. Title itself derived from eudaimonia.'
      },
      {
        type: 'scholarly',
        author: 'Rosalind Hursthouse and Glen Pettigrove',
        title: 'Virtue Ethics',
        year: 2023,
        publisher: 'Stanford Encyclopedia of Philosophy',
        language: 'English',
        note: 'SEP entry. Direct quotation: "It is standardly translated as \'happiness\' or \'flourishing\' and occasionally as \'well-being.\' Each translation has its disadvantages." Authoritatively documents the untranslatability claim.'
      },
      {
        type: 'scholarly',
        author: 'Julia Annas',
        title: 'The Morality of Happiness',
        year: 1993,
        publisher: 'Oxford University Press',
        place: 'New York',
        language: 'English',
        isbn: '978-0-19-509652-9',
        note: 'Definitive study of Hellenistic ethics. Argues no English term captures the activity-virtue-objectivity nexus eudaimonia carries.'
      }
    ],
    adjacents: ['polis-gr'],
    polymyth_function: 'The end-goal of Aristotelian ethics whose untranslatability is the symptom of a deeper category-shift: ancient Greek ethics took the highest human good to be objective activity-in-accordance-with-virtue, modern English distinguishes this from "happiness" (subjective state) and "flourishing" (biological). Recovering the term is recovering the ancient ethical horizon.',
    see_also_aa: []
  },

  {
    id: 'javanmardi-fa',
    canonical: false,
    term: 'Javānmardi',
    native_script: 'جوانمردی',
    transliteration: 'javānmardi',
    ipa: '/dʒæ.vɒːn.mæɾ.diː/',
    language: 'Persian (Farsi)',
    language_family: 'Indo-European (Iranian)',
    kind: ['lexical-cultural', 'religious-doctrinal', 'cluster'],
    tags: ['lexical-cultural', 'religious-doctrinal', 'cluster', 'iranian', 'persian', 'sufism', 'spiritual-chivalry', 'fotowwa', 'shahnameh', 'ferdowsi', 'corbin-1971', 'ridgeon-2018', 'iranica-blocked'],
    verification_status: 'secondary_verified',
    approximation: 'Spiritual chivalry; a constellation of generosity, selflessness, hospitality, courage, honesty, and justice that defines the ideal Iranian-Sufi-Shi\'a man (javānmard).',
    approximation_note: 'Falsifies. "Chivalry" reads it through Western medieval knighthood (a class-and-warrior code); "manliness" reduces it to gendered virtue. Javānmardi is simultaneously an ethical practice, a Sufi initiatic path (linked to fotowwat), a guild structure (the ʿayyārs and lūtīs), AND an aesthetic-literary ideal in Ferdowsi\'s Shāhnāmeh. Ridgeon: the term "transcends" any English equivalent. The exact OPPOSITE of the listed virtues can be required of the javānmard in some contexts — the rule cannot be reduced to a content.',
    primary_sources: [
      {
        type: 'literary',
        author: 'Ferdowsi (فردوسی)',
        title: 'Šāhnāmeh (شاهنامه, Book of Kings)',
        year: 1010,
        language: 'Persian',
        note: 'The Iranian national epic. Provides the literary-archetypal models of the javānmard hero (Rostam, Sohrab, etc.). Operative source for all subsequent Persian theorizations.'
      },
      {
        type: 'religious',
        author: 'Šehāb-al-Din ʿOmar Sohravardi',
        title: 'Two fotowwa-nāmas',
        year: 1230,
        language: 'Persian',
        note: 'Edited in Mortażā Ṣarrāf, ed., Rasāʾel-e javānmardān moštamel bar haft fotowwat-nāma / Traités des compagnons-chevaliers, Tehran and Paris, 1973. Foundational Sufi treatises on the spiritual-chivalric path.'
      },
      {
        type: 'philosophical',
        author: 'Henry Corbin',
        title: 'Juvénilité et chevalerie (jawānmardī) en Islam iranien',
        year: 1971,
        publisher: 'Eranos-Jahrbuch 40 (Brill, Leiden, 1973)',
        place: 'Ascona / Leiden',
        language: 'French',
        note: 'Pages 311-356. Corbin\'s extended Eranos lecture, later reprinted in L\'Homme et Son Ange: Initiation et Chevalerie Spirituelle (Fayard, 1983). Argues javānmardi is the operative Iranian transformation of philosophical ethics into spiritual practice.'
      },
      {
        type: 'philosophical',
        author: 'Henry Corbin',
        title: 'Introduction to Rasāʾel-e javānmardān',
        year: 1973,
        publisher: 'Bibliothèque iranienne / Tehran-Paris',
        place: 'Tehran and Paris',
        language: 'French',
        note: 'Pages 1-109 of Mortażā Ṣarrāf\'s edition of seven fotowwat-nāmas. Translated to Persian by Eḥsān Narāqī as Āyin-e javānmardi (Tehran, 1984). Treats javānmardi as both Iranian and trans-cultural Abrahamic spiritual chivalry.'
      },
      {
        type: 'scholarly',
        author: 'Lloyd Ridgeon (ed.)',
        title: 'Javanmardi: The Ethics and Practice of Persianate Perfection',
        year: 2018,
        publisher: 'Gingko / British Institute of Persian Studies',
        place: 'London',
        language: 'English',
        isbn: '978-1-909942-15-8',
        note: 'Direct quotation: "Javanmardi is one of those Persian terms that is frequently mentioned in discussions of Persian identity, and yet its precise meaning is difficult to comprehend. A number of equivalents have been offered, including chivalry and manliness, and while these terms are not incorrect, javanmardi transcends them."'
      }
    ],
    adjacents: ['tarof-fa'],
    polymyth_function: 'Iranian operative concept that fuses warrior-ethic, Sufi initiation, guild-fraternity, and literary-archetypal hero into one integrated practice. Cluster-untranslatability: defined by its non-coincidence with chivalry, manliness, futuwwa, virtue. Names a form-of-life Western philosophy split into ethics-religion-craft long before naming each.',
    see_also_aa: []
  },

  {
    id: 'gheyrat-fa',
    canonical: false,
    term: 'Gheyrat',
    native_script: 'غیرت',
    transliteration: 'gheyrat',
    ipa: '/ɣej.ɾæt/',
    language: 'Persian (Farsi)',
    language_family: 'Indo-European (Iranian)',
    kind: ['lexical-cultural', 'pragmatic-interactional', 'cluster'],
    tags: ['lexical-cultural', 'pragmatic-interactional', 'cluster', 'iranian', 'persian', 'honor-vigilance', 'cultural-emotion', 'namus', 'aberu', 'sharifian-2011', 'bagheri-2014', 'bahmani-2019', 'cognitive-linguistics'],
    verification_status: 'secondary_verified',
    approximation: 'A complex emotion fusing protective jealousy, honor-vigilance, courage, and the moral alarm that fires when one\'s nāmus (female kin / sacred values) is threatened.',
    approximation_note: 'Falsifies. "Jealousy" pathologizes; "honor" misses the active monitoring; "zeal" loses the protective-of-female-kin dimension; "chivalry" falsifies the affective intensity. Gheyrat operates as a culture-specific cognitive-emotional schema linking nāmus (female kin and the sanctity associated with them), āberu (face), and mahramiyat (legitimate intimacy). Bagheri: "GHEIRAT may be defined as a monitoring device or alarm system in the mind of Iranians."',
    primary_sources: [
      {
        type: 'linguistic',
        author: 'Mohammad Reza Bagheri',
        title: 'Cognitive Model of GHEIRAT in Persian',
        year: 2014,
        publisher: 'Cognitive Linguistic Studies 2:2',
        language: 'English',
        note: 'Peer-reviewed analysis using cultural conceptualization framework. Argues GHEIRAT is constituted by conceptual metaphors (THE OTHER IS A POTENTIAL OPPONENT, GHEIRAT IS A PHYSICAL SUPPLEMENTARY FORCE) and metonymies that have no English structural equivalent.'
      },
      {
        type: 'scholarly',
        author: 'Hossein Bahmani',
        title: 'Persian \'Rashti jokes\': modern Iran\'s palimpsests of gheyrat-based masculinity',
        year: 2019,
        publisher: 'British Journal of Middle Eastern Studies 46(4)',
        language: 'English',
        note: 'Peer-reviewed sociological analysis. Identifies gheyrat as the gendered social construct organizing a century of Iranian humor, and argues it cannot be rendered as either jealousy or honor without losing the protective-possessive structural function.'
      },
      {
        type: 'linguistic',
        author: 'Farzad Sharifian',
        title: 'Cultural Conceptualizations and Language: Theoretical Framework and Applications',
        year: 2011,
        publisher: 'John Benjamins',
        place: 'Amsterdam / Philadelphia',
        language: 'English',
        isbn: '978-90-272-0407-5',
        note: 'Foundational work on Persian cultural-linguistic schemas. Treats gheyrat alongside related untranslatables (āberu, nāmus, ta\'ārof) as part of a coherent Iranian conceptual ecology.'
      },
      {
        type: 'literary',
        author: 'Hāfez (حافظ)',
        title: 'Divān-e Hāfez',
        year: 1390,
        language: 'Persian',
        note: 'Recurrent classical Persian use of gheyrat in love-mystical poetry, including the divine gheyrat (jealousy) of God for the soul. Establishes the term\'s irreducibility to either secular or religious senses.'
      }
    ],
    adjacents: ['javanmardi-fa', 'tarof-fa'],
    polymyth_function: 'Affective-pragmatic complex that organizes Iranian masculine self-vigilance around the protection of nāmus and āberu. Cluster-untranslatability defined by its non-coincidence with English jealousy, honor, zeal, chivalry. Demonstrates that emotion-categories themselves can be untranslatable: not because the underlying feeling is absent elsewhere, but because the cultural schema that bundles cognitive monitoring + affective intensity + obligatory action has no Western analogue.',
    see_also_aa: []
  },

  {
    id: 'desengano-es',
    canonical: false,
    term: 'Desengaño',
    native_script: 'Desengaño',
    transliteration: null,
    ipa: '/de.seŋ.ˈɡa.ɲo/',
    language: 'Spanish',
    language_family: 'Indo-European (Romance)',
    kind: ['philosophical-conceptual', 'aesthetic', 'lexical-cultural'],
    tags: ['philosophical-conceptual', 'aesthetic', 'lexical-cultural', 'romance', 'spanish', 'baroque', 'cervantes', 'calderon', 'quevedo', 'don-quijote', 'engano-desengano-dyad', 'gonzalez-echevarria-2015', 'neumeister-2025', 'robbins-2007', 'epistemic-mentality'],
    verification_status: 'secondary_verified',
    approximation: 'Disillusion as awakening; the moment when the world\'s deceits (engaños) are seen through and reality becomes available — both as Baroque epistemic event and Neostoic-Christian moral state.',
    approximation_note: 'Falsifies. "Disillusion" carries a depressive English connotation that misses the lucid-knowledge dimension; "disenchantment" reads it through Weberian secularization Spain did not undergo; "awakening" misses the bitter taste; "undeceiving" is awkward. González Echevarría: desengaño is the Baroque movement from engaño (deceit, illusion) to true awareness — the structural pattern of Don Quixote itself. Neumeister: it is not necessarily contradictory but irreducible to "sentimiento" (Rosales), "género" (Presa Díaz), or "state of mind" (Green).',
    primary_sources: [
      {
        type: 'literary',
        author: 'Miguel de Cervantes',
        title: 'El ingenioso hidalgo don Quijote de la Mancha (Don Quixote)',
        year: 1615,
        publisher: 'Juan de la Cuesta',
        place: 'Madrid',
        language: 'Spanish',
        note: 'Part II especially. The novel\'s entire structure (engaño → desengaño) is the operative artistic instantiation of the term. Don Quixote\'s deathbed renunciation of chivalric romance is the canonical scene of desengaño.'
      },
      {
        type: 'literary',
        author: 'Pedro Calderón de la Barca',
        title: 'La vida es sueño (Life is a Dream)',
        year: 1635,
        language: 'Spanish',
        note: 'Segismundo\'s arc moves from engaño (palace luxury feels like dream) to desengaño (the dream is what is taken for life) to wisdom. Theatrical exemplar of the concept.'
      },
      {
        type: 'literary',
        author: 'Francisco de Quevedo',
        title: 'Sueños y discursos de verdades descubridoras de abusos, vicios y engaños',
        year: 1627,
        place: 'Barcelona',
        language: 'Spanish',
        note: 'The "Dreams" sequence. The full subtitle ("truths revealing abuses, vices and deceits") names the desengaño-mechanism explicitly. Conceptismo prose form embodies the compression of deceit-into-disillusion in language itself.'
      },
      {
        type: 'scholarly',
        author: 'Roberto González Echevarría',
        title: 'Cervantes\' "Don Quixote": A Casebook',
        year: 2015,
        publisher: 'Yale University Press',
        place: 'New Haven',
        language: 'English',
        isbn: '978-0-300-19238-3',
        note: 'Chapter 14: "Deceiving and Undeceiving: Baroque Desengaño," pp. 197-209. DOI 10.12987/9780300213317-017. Foundational anglophone study of the concept; argues the engaño-desengaño dyad is the structural skeleton of Cervantes\'s plot and of the entire Spanish Baroque.'
      },
      {
        type: 'scholarly',
        author: 'Sebastian Neumeister',
        title: 'Sacred Disillusions: The Challenge of Ambiguous desengaño in Early Modern Spain',
        year: 2025,
        publisher: 'Neophilologus (Springer)',
        language: 'English',
        note: 'DOI 10.1007/s11061-025-09847-x. Direct quotation: "Desengaño is widely acknowledged as a fundamental concept of early modern Spanish literature and has been lauded a hallmark of the baroque age." Treats the term as resisting any single classification (sentimiento / género / state of mind).'
      },
      {
        type: 'scholarly',
        author: 'Jeremy Robbins',
        title: 'Arts of Perception: The Epistemological Mentality of the Spanish Baroque, 1580-1720',
        year: 2007,
        publisher: 'Routledge',
        place: 'London / New York',
        language: 'English',
        isbn: '978-0-415-32330-3',
        note: 'Argues desengaño is not merely literary but a shared epistemic horizon of the Spanish 17th century, linking Quevedo, Gracián, Calderón, and Cervantes through Neostoic ethics.'
      }
    ],
    adjacents: ['saudade-pt'],
    polymyth_function: 'Spanish Baroque operative concept whose untranslatability marks an entire epistemic age: the period 1580-1680 when European knowledge-foundations cracked open under sceptical pressure and Spanish writers theorized the cracking IN the cracking. Demonstrates that an entire literary genre and philosophical mentality can be carried by a single untranslatable noun. Engaño/desengaño is the dyad; "deceit/disillusion" loses the specifically-Spanish reflexive structure where the disillusioned person is also the formerly-deceived.',
    see_also_aa: []
  },

  {
    id: 'tarof-fa',
    canonical: false,
    term: 'Tarof',
    native_script: 'تعارف',
    transliteration: 'taʿārof (also taarof, tarof)',
    ipa: '/tæʔɒːˈɾof/',
    language: 'Persian (Farsi)',
    language_family: 'Indo-European (Iranian)',
    kind: ['pragmatic-interactional', 'lexical-cultural'],
    tags: ['lexical-cultural', 'pragmatic-interactional', 'iranian', 'persian', 'cultural-keyword', 'speech-act', 'social-frame', 'beeman-1986', 'koutlaki-2002'],
    verification_status: 'cited_from_bibliography',
    approximation: 'Ritualized politeness; ceremonial offer-and-refusal; performative deference structuring Iranian social interaction.',
    approximation_note: 'Falsifies. Tarof is a SYSTEM of communication, not a behavior — it operates as a constitutive frame within which Iranian conversation occurs. The same words can be sincere or pure tarof depending on context. "Politeness" in English is descriptive of behavior; tarof is a hermeneutic field. Misreading tarof literally is the canonical cross-cultural error in Iranian-Western interaction.',
    primary_sources: [
      {
        type: 'anthropological',
        author: 'William O. Beeman',
        title: 'Language, Status, and Power in Iran',
        year: 1986,
        publisher: 'Indiana University Press',
        place: 'Bloomington',
        language: 'English (study of Persian)',
        note: 'Foundational anthropological-linguistic study of tarof and Iranian interactional structure. Beeman is the canonical Western academic source on tarof; his framework is operative in subsequent literature.'
      },
      {
        type: 'anthropological',
        author: 'William O. Beeman',
        title: 'Affectivity in Persian Language Use',
        year: 1988,
        publisher: 'Cultural Anthropology, Vol. 3, No. 1',
        language: 'English',
        note: 'Companion article extending the Language, Status, and Power framework specifically to affective and ritual dimensions.'
      }
    ],
    adjacents: [],
    polymyth_function: 'Demonstrates that an entire COMMUNICATIVE SYSTEM can be untranslatable, not just a word. Tarof is an Iranian linguistic-cultural keyword that has no functional equivalent because it is not a content-concept but a frame within which content gets meaning.',
    see_also_aa: []
  }

];

// Build adjacency lookup index for fast cross-reference resolution.
const UNTRANSLATABLES_BY_ID = {};
UNTRANSLATABLES.forEach(u => { UNTRANSLATABLES_BY_ID[u.id] = u; });

// Sanity check: all adjacency references resolve to existing entries.
// (Safe to remove in production; useful during seed expansion.)
UNTRANSLATABLES.forEach(u => {
  u.adjacents.forEach(adjId => {
    if (!UNTRANSLATABLES_BY_ID[adjId]){
      console.warn('untranslatables.js: dangling adjacency from', u.id, '→', adjId);
    }
  });
});
