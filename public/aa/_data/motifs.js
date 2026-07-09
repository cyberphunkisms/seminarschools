// motifs.js
//
// Polymyth Motifs Layer
//
// Each motif is a thematic family — a recurring narrative element, creature
// form, scenario, or image — that appears across multiple traditions, genres,
// and source-types. Motifs are CONCRETE PATTERNS, distinct from:
//   - mass-archetypes (universal human types: Hero, Trickster, Sage)
//   - identity-convergence (same tagId across taxonomies)
//   - adjacency (untranslatables-specific)
//   - membership (concrete instance of a mass-archetype)
//
// Where mass-archetypes ask "what role does this character play?" motifs ask
// "what concrete element is recurring across stories?" Anthropomorphic Cat
// is a motif. Trickster is a mass-archetype. Cheshire Cat is an instance of
// BOTH — that's allowed and informative.
//
// Grounding: this layer is structurally analogous to Stith Thompson's
// Motif-Index of Folk-Literature (1932-1936), which assigns numeric codes to
// recurring narrative elements across folklore traditions. The aa* archive
// already includes thompson-motif as a tradition. The motifs.js file extends
// the principle BEYOND folklore to encompass gaming, literature, film,
// religious tradition, and mythology — anywhere a recurring concrete element
// appears across multiple source-types.
//
// The structural problem motifs solve: a tag like "Catfolk" (Pathfinder 2e)
// has no identity-convergence partners because the literal label is unique
// to PF. Yet it OBVIOUSLY clusters thematically with Khajiit, Tabaxi,
// Cheshire Cat, Puss in Boots, the Baron from Studio Ghibli's The Cat
// Returns, Bastet. The motif layer makes this clustering explicit and
// citable.
//
// Schema (per motif):
//   id              — slug, unique
//   label           — display name
//   category        — broad type-of-motif: 'creature-form', 'narrative-pattern',
//                     'scenic', 'object', 'role-function', 'event'
//   description     — what the motif IS, in 2-4 sentences
//   members         — array of concrete instances. Schema:
//                     {label, source, author, year, type, location?, aaref?}
//                     type ∈ {game, literature, film, mythology, folk,
//                             religious, comics, tv, manga, ttrpg, mmorpg}
//                     aaref is optional cross-ref into existing aa*: {taxonomyId, tagLabel}
//   polymyth_function — what this motif tells us about human imagination /
//                       why this cluster matters for the framework
//   overlaps        — IDs of other motifs that share members (Cheshire Cat
//                     appears in talking-cat AND cat-trickster, etc.)
//
// Citation rule (CITES+LOGOI): every member must have a verifiable primary
// source. Year, author, and publisher/studio when known. Uncertain entries
// flagged or omitted rather than fabricated.
//
// Seed: four cat-related motifs covering the user's diagnostic example
// (Catfolk floating alone). Schema is general — non-cat motifs (sword-from-
// stone, dying-and-rising-god, mentor's-death, witch-in-the-woods, faustian-
// bargain) plug in identically.

const MOTIFS = [

  {
    id: 'anthropomorphic-cat',
    label: 'Anthropomorphic Cat',
    category: 'creature-form',
    description: 'Humanoid cat-people: bipedal, speaking, social, often appearing as a fantasy or science-fiction race or species. Distinguished from talking-cats (which retain feline form) and from sacred-cats (which are venerated as cats per se). The motif crystallizes ambivalent human relationships with cats — autonomous, predatory, graceful, alien — mapped onto humanoid form.',
    members: [
      {
        label: 'Catfolk',
        source: 'Pathfinder 2e Core Rulebook / Advanced Player\'s Guide',
        author: 'Paizo Publishing',
        year: 2019,
        type: 'ttrpg',
        aaref: { taxonomyId: 'pf2e', tagLabel: 'Catfolk' }
      },
      {
        label: 'Tabaxi',
        source: 'Dungeons & Dragons (Volo\'s Guide to Monsters / 5e)',
        author: 'Wizards of the Coast',
        year: 2016,
        type: 'ttrpg',
        note: 'Earlier appearances in AD&D Forgotten Realms; current cat-folk presentation locked in 5e era.'
      },
      {
        label: 'Khajiit',
        source: 'The Elder Scrolls series',
        author: 'Bethesda Softworks',
        year: 1994,
        type: 'mmorpg',
        note: 'Series since Arena (1994); developed culturally across Daggerfall, Morrowind, Oblivion, Skyrim, Online.'
      },
      {
        label: 'Mithra',
        source: 'Final Fantasy XI',
        author: 'Square (later Square Enix)',
        year: 2002,
        type: 'mmorpg'
      },
      {
        label: 'Miqo\'te',
        source: 'Final Fantasy XIV',
        author: 'Square Enix',
        year: 2010,
        type: 'mmorpg',
        note: 'Original 2010 release and A Realm Reborn 2013 relaunch.'
      },
      {
        label: 'The Baron (Humbert von Gikkingen)',
        source: 'Whisper of the Heart (1995); The Cat Returns (2002)',
        author: 'Studio Ghibli; manga by Aoi Hiiragi (Baron: The Cat Returns / バロン 猫の男爵)',
        year: 2002,
        type: 'film',
        note: 'Films directed by Yoshifumi Kondō (1995) and Hiroyuki Morita (2002). Manga published by Tokuma Shoten 2002.'
      },
      {
        label: 'Puss in Boots',
        source: 'Histoires ou contes du temps passé, "Le Maître chat ou le Chat botté"',
        author: 'Charles Perrault',
        year: 1697,
        type: 'literature',
        note: 'Walks bipedally, wears boots, speaks — proto-anthropomorphic-cat archetype in European folktale.'
      }
    ],
    polymyth_function: 'The cat-as-person motif demonstrates how a single ambivalent human-animal relationship (autonomous, predatory, beautiful, indifferent) generates structurally similar fantasy-races across radically different traditions — French folk literature, Egyptian-influenced fantasy, Japanese animation, American TTRPG, MMOs from multiple continents. Same imaginative impulse, independent reinventions.',
    overlaps: ['talking-cat', 'cat-trickster']
  },

  {
    id: 'talking-cat',
    label: 'Talking Cat',
    category: 'creature-form',
    description: 'Cats that speak human language while retaining feline form (NOT bipedal-humanoid). Often companions, witnesses, oracles, or chaos-agents. Distinguished from anthropomorphic-cat (which is human-formed) by retention of cat body.',
    members: [
      {
        label: 'Cheshire Cat',
        source: 'Alice\'s Adventures in Wonderland',
        author: 'Lewis Carroll',
        year: 1865,
        type: 'literature',
        publisher: 'Macmillan',
        note: 'Speaks, philosophizes, vanishes — canonical talking-cat in English literature.'
      },
      {
        label: 'The Cat in the Hat',
        source: 'The Cat in the Hat',
        author: 'Dr. Seuss (Theodor Seuss Geisel)',
        year: 1957,
        type: 'literature',
        publisher: 'Random House',
        note: 'Bipedal in illustration but functionally a cat-form chaos agent — borderline anthropomorphic-cat. Included here primarily for the speech-act and trickster registers.'
      },
      {
        label: 'Jiji',
        source: 'Kiki\'s Delivery Service (魔女の宅急便)',
        author: 'Studio Ghibli; based on novel by Eiko Kadono (1985)',
        year: 1989,
        type: 'film',
        note: 'Speaks to Kiki throughout the film as her familiar; speech-ability tied to her witch-power.'
      },
      {
        label: 'Behemoth (Бегемот)',
        source: 'The Master and Margarita (Мастер и Маргарита)',
        author: 'Mikhail Bulgakov',
        year: 1967,
        type: 'literature',
        note: 'Written 1928-1940, published posthumously 1967. Demonic talking cat in Woland\'s retinue — sometimes bipedal, sometimes feline.'
      },
      {
        label: 'Salem Saberhagen',
        source: 'Sabrina the Teenage Witch (TV series 1996-2003)',
        author: 'ABC; based on Archie Comics character (1962-)',
        year: 1996,
        type: 'tv',
        note: 'Talking-cat form is a punishment-transformation; was originally human warlock.'
      }
    ],
    polymyth_function: 'The talking cat figure plays a recurring structural role: witness, oracle, philosophical interlocutor, or chaos-companion. The retention of cat form is essential — it lets the figure speak from outside human social structure while remaining recognizable as a creature humans live alongside.',
    overlaps: ['cat-trickster']
  },

  {
    id: 'cat-trickster',
    label: 'Cat as Trickster',
    category: 'role-function',
    description: 'Cats specifically functioning as trickster figures — boundary-crossers, rule-benders, agents of productive chaos, manipulators of social structure. Cuts across talking-cat and anthropomorphic-cat motifs.',
    members: [
      {
        label: 'Cheshire Cat',
        source: 'Alice\'s Adventures in Wonderland',
        author: 'Lewis Carroll',
        year: 1865,
        type: 'literature',
        publisher: 'Macmillan',
        note: 'Boundary-crossing par excellence — exists between visibility and invisibility, sense and nonsense.'
      },
      {
        label: 'Puss in Boots',
        source: 'Histoires ou contes du temps passé',
        author: 'Charles Perrault',
        year: 1697,
        type: 'literature',
        note: 'Manipulates social class, deceives the king and the ogre, wins his master a princess and a kingdom through pure cunning.'
      },
      {
        label: 'The Cat in the Hat',
        source: 'The Cat in the Hat',
        author: 'Dr. Seuss',
        year: 1957,
        type: 'literature',
        publisher: 'Random House',
        note: 'Pure rule-breaking chaos agent who arrives, disrupts, and restores order before authority returns.'
      },
      {
        label: 'Behemoth',
        source: 'The Master and Margarita',
        author: 'Mikhail Bulgakov',
        year: 1967,
        type: 'literature',
        note: 'Wreaks havoc through Soviet Moscow as Woland\'s retinue-trickster.'
      }
    ],
    polymyth_function: 'Cats are over-represented in the trickster role across cultures — likely because their actual behavior (independent, hard to command, predatory yet domesticated, simultaneously inside and outside human social structure) maps so cleanly onto trickster structural positions.',
    overlaps: ['talking-cat', 'anthropomorphic-cat']
  },

  {
    id: 'sacred-cat',
    label: 'Sacred Cat / Cat-Deity',
    category: 'role-function',
    description: 'Cats as objects of religious veneration, deities in feline form, or supernatural-folk-magic agents tied to cat form. Distinguished from witch-familiar (where the cat is a magical companion not a god) and from anthropomorphic-cat (which is humanoid).',
    members: [
      {
        label: 'Bastet (Bast)',
        source: 'Egyptian religion, cult center at Bubastis (Tell Basta)',
        year: -2400,
        type: 'mythology',
        location: 'Egypt',
        note: 'Cat-headed goddess from Old Kingdom onward, prominent cult through Dynasty 22 (945-715 BCE) and into Greco-Roman period. Domestic and protective associations.'
      },
      {
        label: 'Sekhmet',
        source: 'Egyptian religion',
        year: -2400,
        type: 'mythology',
        location: 'Egypt',
        note: 'Lion-headed goddess; included as sacred-cat motif in extended sense (felidae).'
      },
      {
        label: 'Maneki-neko (招き猫)',
        source: 'Japanese folk tradition',
        year: 1850,
        type: 'folk',
        location: 'Japan',
        note: 'Beckoning-cat figure, Edo-period origin; multiple competing origin-legends (Gōtoku-ji temple, Imado-jinja shrine). Talisman of fortune and protection.'
      },
      {
        label: 'Cat-sìth (Cat Sidhe)',
        source: 'Scottish Highland folklore; Celtic folk tradition',
        type: 'folk',
        location: 'Scotland / Ireland',
        note: 'Black cat with white chest-spot from Celtic folklore; supernatural feline that can steal souls of the recently dead before judgment. Documented in Campbell\'s Popular Tales of the West Highlands (1860).'
      }
    ],
    polymyth_function: 'The sacred cat motif marks a register of human awe at felinity — independent, watchful, predatory, beautiful — that crosses the threshold from awe-of-creature to religious/supernatural status. The motif is geographically widespread (Egypt, Japan, Celtic regions, China, Norse-Freyja\'s-cats) suggesting structural rather than diffusionist origin.',
    overlaps: []
  },

  {
    id: 'sword-from-stone',
    label: 'Sword from the Stone',
    category: 'object',
    description: 'A sword embedded in stone, anvil, or other immovable matter that can be drawn out only by the rightful hero, king, or chosen one. Distinct from "sword reforged" (Andúril, Glamdring) and "sword found by chance" — the stone-sword test specifically authenticates lineage or destiny through a feat impossible for the unworthy.',
    members: [
      {
        label: 'Excalibur (drawn from stone)',
        source: 'Le Morte d\'Arthur, Book I',
        author: 'Sir Thomas Malory',
        year: 1485,
        type: 'literature',
        publisher: 'Caxton press',
        note: 'In Malory the sword-in-the-stone is the test that proves Arthur\'s royal birth; the later Excalibur from the Lady of the Lake is a separate sword. Caxton\'s 1485 print is the operative reference text.'
      },
      {
        label: 'Caliburn / Caliburnus',
        source: 'Historia Regum Britanniae',
        author: 'Geoffrey of Monmouth',
        year: 1136,
        type: 'literature',
        location: 'Latin (Britain)',
        note: 'Geoffrey\'s Latin pseudo-history is the textual ancestor of the Arthurian sword-tradition; Caliburn becomes Excalibur in later French and English elaborations.'
      },
      {
        label: 'The Sword in the Stone',
        source: 'The Sword in the Stone (novel)',
        author: 'T. H. White',
        year: 1938,
        type: 'literature',
        publisher: 'Collins',
        note: 'Standalone novel later incorporated into The Once and Future King (1958). Modern canonical reframing of the Arthurian motif.'
      },
      {
        label: 'Sigmund\'s sword in Branstock',
        source: 'Völsunga saga, ch. 3',
        type: 'literature',
        location: 'Old Norse / Icelandic',
        year: 1270,
        note: 'Approx. 13th century compilation of older oral material. Odin appears as a one-eyed stranger and drives a sword into the Branstock tree at the wedding feast; Sigmund alone can pull it free. Pre-Arthurian instance of the same structural test.'
      }
    ],
    polymyth_function: 'The sword-from-stone motif is the archetypal authenticity-test for sovereignty. It externalizes the question "who is the rightful one?" into an objective physical test that cannot be faked, gamed, or contested. The motif crystallizes the political-theological problem of legitimate authority in pre-modern societies — recurring independently in Arthurian and Norse traditions because the structural problem is general.',
    overlaps: []
  },

  {
    id: 'dying-and-rising-god',
    label: 'Dying-and-Rising God',
    category: 'narrative-pattern',
    description: 'A divine figure who dies and is restored to life — frequently tied to seasonal-agricultural cycles, mystery-cult initiation, or eschatological renewal. The pattern was generalized as a comparative-religious type by Frazer (1890), and the universality of the type is contested in modern scholarship (Smith 1987 onward). Even where the type is loose, individual instances are well-documented.',
    members: [
      {
        label: 'Osiris',
        source: 'Pyramid Texts (Old Kingdom funerary corpus)',
        year: -2400,
        type: 'mythology',
        location: 'Egypt',
        note: 'Earliest written sources from Dynasty 5-6 royal pyramids. Plutarch\'s De Iside et Osiride (c. 100 CE) is the earliest sustained narrative synthesis available in Greek.'
      },
      {
        label: 'Adonis',
        source: 'Greek mythology; Theocritus, Idyll XV',
        author: 'Theocritus',
        year: -270,
        type: 'mythology',
        location: 'Greece (via Phoenician/Levantine substrate)',
        note: 'The cult was practiced via the Adonia festival in Athens and other Greek cities; Theocritus\'s Idyll XV depicts the Adonia at the Ptolemaic court in Alexandria.'
      },
      {
        label: 'Christ (death and resurrection)',
        source: 'Pauline epistles (1 Corinthians 15:3-8) and the four canonical gospels',
        year: 55,
        type: 'religious',
        note: '1 Corinthians 15 is the earliest extant written reference to the resurrection (c. 53-55 CE). Gospel narratives follow c. 70-100 CE.'
      },
      {
        label: 'Baldr',
        source: 'Prose Edda, Gylfaginning ch. 49',
        author: 'Snorri Sturluson',
        year: 1220,
        type: 'mythology',
        location: 'Iceland (Old Norse)',
        note: 'Snorri\'s 13th c. compilation. Baldr is killed by mistletoe through Loki\'s scheme and is to return after Ragnarök — making the motif eschatological rather than seasonal here.'
      },
      {
        label: 'Tammuz / Dumuzi',
        source: 'Sumerian and Akkadian literary corpus; "Inanna\'s Descent to the Underworld"',
        year: -2000,
        type: 'mythology',
        location: 'Sumer / Mesopotamia',
        note: 'Earliest cuneiform sources from early second millennium BCE; the Tammuz cult is referenced in Ezekiel 8:14 (6th c. BCE). Dumuzi\'s annual descent and return to the underworld is mourned in the Tammuz lamentations.'
      }
    ],
    polymyth_function: 'The motif marks a fundamental human imaginative response to seasonality and mortality. Frazer over-generalized it into a master-pattern; modern scholarship (especially J.Z. Smith, "Dying and Rising Gods" 1987) shows that the type is more loose and the instances less unified than Frazer claimed. The framework should preserve both the recurrence (real) and the contestation (real). Cite Frazer as the framing, cite Smith as the corrective.',
    overlaps: []
  },

  {
    id: 'mentors-death',
    label: 'Mentor\'s Death',
    category: 'narrative-pattern',
    description: 'The wise older guide of the protagonist dies, sacrifices themselves, or is otherwise removed — typically at a pivotal narrative moment that forces the protagonist into autonomous action. Structurally distinct from "mentor\'s departure" (which is reversible) and from "wise old man" appearance generally (Jungian Senex). The mentor\'s irreversible removal is the structural function.',
    members: [
      {
        label: 'Obi-Wan Kenobi',
        source: 'Star Wars (Episode IV: A New Hope)',
        author: 'George Lucas',
        year: 1977,
        type: 'film',
        publisher: 'Lucasfilm / 20th Century Fox',
        note: 'Killed by Vader on the Death Star in Act II — the mentor\'s death that releases Luke into autonomous heroic action.'
      },
      {
        label: 'Gandalf the Grey (falling at Khazad-dûm)',
        source: 'The Lord of the Rings: The Fellowship of the Ring, Book II ch. 5 ("The Bridge of Khazad-dûm")',
        author: 'J. R. R. Tolkien',
        year: 1954,
        type: 'literature',
        publisher: 'Allen & Unwin',
        note: 'Gandalf returns later as Gandalf the White — making this a partial-return rather than permanent removal. Tolkien complicates the motif rather than instantiating it cleanly.'
      },
      {
        label: 'Yoda',
        source: 'Return of the Jedi (Episode VI)',
        author: 'George Lucas; dir. Richard Marquand',
        year: 1983,
        type: 'film',
        publisher: 'Lucasfilm',
        note: 'Yoda dies of old age on Dagobah after delivering final instructions to Luke. Mentor\'s death by natural cause rather than violence — different register than Obi-Wan.'
      },
      {
        label: 'Albus Dumbledore',
        source: 'Harry Potter and the Half-Blood Prince, ch. 27 ("The Lightning-Struck Tower")',
        author: 'J. K. Rowling',
        year: 2005,
        type: 'literature',
        publisher: 'Bloomsbury / Scholastic',
        note: 'Killed by Snape under prior arrangement with Dumbledore — the death is staged but real. Rowling stretches the motif by making it a planned sacrifice for tactical reasons.'
      }
    ],
    polymyth_function: 'The mentor\'s death is the structural device that forces the protagonist out of dependent learning into autonomous action. Campbell (Hero with a Thousand Faces, 1949) treats the wise-helper as a stage of the hero\'s journey but does not generalize the death-of-mentor as its own structural unit. The motif is robust enough across modern fantasy and SF to deserve isolation as a distinct pattern.',
    overlaps: []
  },

  {
    id: 'witch-in-the-woods',
    label: 'Witch in the Woods',
    category: 'scenic',
    description: 'A solitary, often dangerous female figure with magical powers, encountered by protagonists in a wooded or wild liminal zone outside settled society. Distinguished from court-witches (in palace settings) and from the Crone-as-Wise-Woman type (which can be benevolent and knowledge-giving) — the woods-witch carries the threat-register specifically.',
    members: [
      {
        label: 'The witch in Hansel and Gretel',
        source: 'Kinder- und Hausmärchen, KHM 15',
        author: 'Jacob and Wilhelm Grimm',
        year: 1812,
        type: 'literature',
        publisher: 'Realschulbuchhandlung, Berlin',
        note: 'First edition 1812. Lures children with the gingerbread house and intends to eat them — canonical instance of the woods-witch threat-register.'
      },
      {
        label: 'Baba Yaga',
        source: 'Narodnye russkie skazki (Russian Folk-Tales)',
        author: 'collected by Alexander Afanasyev',
        year: 1855,
        type: 'folk',
        location: 'Russia',
        note: 'Multi-volume collection (1855-1867) of Russian folk-tales. Baba Yaga inhabits a hut on chicken legs deep in the forest — sometimes hostile, sometimes ambiguous helper. The motif is older than Afanasyev; this is the canonical scholarly compilation.'
      },
      {
        label: 'Circe',
        source: 'Odyssey, Book X',
        author: 'Homer (compositional tradition)',
        year: -700,
        type: 'literature',
        location: 'Greece',
        note: 'On the island of Aeaea (a wooded liminal zone), Circe transforms Odysseus\'s men into swine. Earliest fully-developed witch-in-the-woods instance in Western literature.'
      },
      {
        label: 'The Evil Queen / Witch (Snow White)',
        source: 'Snow White and the Seven Dwarfs (Disney animated film)',
        author: 'Walt Disney; dir. David Hand et al.',
        year: 1937,
        type: 'film',
        publisher: 'Walt Disney Productions',
        note: 'Disney consolidated the Grimm tale\'s queen and witch into a single transforming figure who pursues Snow White into the woods. Modern visual canon for the type.'
      },
      {
        label: 'The Blair Witch',
        source: 'The Blair Witch Project',
        author: 'Daniel Myrick and Eduardo Sánchez (writer-directors)',
        year: 1999,
        type: 'film',
        publisher: 'Artisan Entertainment',
        note: 'Late 20th c. reanimation of the motif in found-footage horror form. The witch is never seen — only the woods\' hostility is — pushing the motif toward pure spatial-threat.'
      }
    ],
    polymyth_function: 'The witch-in-the-woods motif maps the boundary between settled society (village, hearth) and the forest as zone-of-uncertainty where social rules thin out. The figure crystallizes anxieties about female autonomy outside patriarchal structures, knowledge unsanctioned by official channels, and the dissolution of social protection. Cross-cultural recurrence (Russian, German, Greek, modern American horror) tracks the structural rather than diffusionist origin of the type.',
    overlaps: []
  },

  {
    id: 'faustian-bargain',
    label: 'Faustian Bargain',
    category: 'narrative-pattern',
    description: 'A protagonist exchanges something fundamental — soul, salvation, integrity, future self — to a supernatural agent (Devil, demon, dark patron) in return for power, knowledge, success, or worldly reward. The bargain is freely chosen, contractually formalized, and structurally tragic: the cost is hidden until too late, OR is fully understood and accepted with eyes-open hubris.',
    members: [
      {
        label: 'Theophilus of Adana',
        source: 'Greek hagiographical legend recorded by Eutychianus',
        author: 'Eutychianus of Adana',
        year: 600,
        type: 'religious',
        location: 'Cilicia (Byzantine Empire)',
        note: 'Earliest extant pact-with-devil narrative in Christian tradition. Theophilus historical c. 538; Eutychianus claims eyewitness status. Translated to Latin in the 9th c. by Paul the Deacon of Naples; dramatized by Rutebeuf in Le Miracle de Théophile (13th c.). Direct ancestor of the Faust legend.'
      },
      {
        label: 'Faust',
        source: 'Faust I (Eine Tragödie, Erster Teil)',
        author: 'Johann Wolfgang von Goethe',
        year: 1808,
        type: 'literature',
        location: 'German',
        publisher: 'Cotta',
        note: 'Faust I 1808; Faust II 1832 (posthumous). Goethe\'s lifework — over 60 years from first sketches to final edition. The canonical Faust text, building on the 16th c. chapbook Historia von D. Johann Fausten (Spies, 1587) and Marlowe\'s Doctor Faustus (c. 1592).'
      },
      {
        label: 'Doctor Faustus',
        source: 'The Tragical History of the Life and Death of Doctor Faustus',
        author: 'Christopher Marlowe',
        year: 1592,
        type: 'literature',
        location: 'English',
        note: 'Approx. composition 1588-1593. First printed 1604 (A-text) and 1616 (B-text). Marlowe\'s play introduces the Faust legend to English literature and establishes much of the dramatic shape Goethe later transforms.'
      },
      {
        label: 'The Devil and Daniel Webster',
        source: 'The Devil and Daniel Webster (short story)',
        author: 'Stephen Vincent Benét',
        year: 1936,
        type: 'literature',
        publisher: 'The Saturday Evening Post (24 October 1936)',
        note: 'American Faustian motif transposed to 19th c. New Hampshire. Webster argues Jabez Stone\'s case before a jury of damned American historical figures and wins — distinctively American resolution where rhetoric defeats the contract.'
      },
      {
        label: 'Krabat',
        source: 'Krabat (novel)',
        author: 'Otfried Preußler',
        year: 1971,
        type: 'literature',
        location: 'German',
        publisher: 'Arena Verlag',
        note: 'Based on Wendish/Sorbian folk legend. Young apprentice in a haunted mill makes the bargain unknowingly; escape through love. Modern German children\'s/YA reactivation of the type.'
      }
    ],
    polymyth_function: 'The Faustian bargain dramatizes the structural ambivalence of human ambition: the wish to exceed natural limits AND the moral catastrophe such exceeding entails. The motif is durable across radical cultural and theological contexts — Byzantine Christian, Lutheran-influenced Renaissance England, German Idealism, American legal-democratic, modern children\'s YA — because the underlying anxiety (about ambition\'s costs) is general. Theophilus is the structural ancestor; Goethe is the canonical synthesis.',
    overlaps: []
  }

];

// Build lookup index
const MOTIFS_BY_ID = {};
MOTIFS.forEach(m => { MOTIFS_BY_ID[m.id] = m; });

// Build reverse index: aaref → motif IDs (for "what motifs does this aa* tag belong to?")
const MOTIFS_BY_AAREF = {};
MOTIFS.forEach(m => {
  m.members.forEach(member => {
    if (member.aaref){
      const key = member.aaref.taxonomyId + ':' + member.aaref.tagLabel;
      if (!MOTIFS_BY_AAREF[key]) MOTIFS_BY_AAREF[key] = [];
      MOTIFS_BY_AAREF[key].push(m.id);
    }
  });
});

// Sanity: overlap references resolve
MOTIFS.forEach(m => {
  (m.overlaps || []).forEach(oid => {
    if (!MOTIFS_BY_ID[oid]){
      console.warn('motifs.js: dangling overlap from', m.id, '→', oid);
    }
  });
});
