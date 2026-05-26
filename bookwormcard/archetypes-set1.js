/* polymyth-horoscope-archetypes.js
 * Archetype writeups for each sign across 11 cosmological traditions.
 * Each writeup: 3-5 sentences in polymyth ironmanned-cosmological register.
 * NOT predictive-causal claims. Symbolic-index openings into the mythological corpus that has accumulated around the cyclical position.
 * The user reads these as doorways into character-construction material, not as fortune-telling.
 */

(function(global) {
  'use strict';

  var ARCHETYPES = {

    // ============================================================
    // CHINESE ZODIAC (12 animals)
    // ============================================================
    'chinese-rat': {
      name: 'Rat (鼠)',
      tradition: 'Chinese zodiac',
      writeup: "First in the cycle by virtue of cunning. The rat won the Jade Emperor's race not by speed but by riding the ox's back and jumping off at the finish line. The archetype carries: resourceful intelligence in conditions of scarcity, comfort in margins and undergrounds, capacity to thrive where larger animals cannot. The shadow side is hoarding and the inability to stop calculating long enough to be still. Year-1 of the cycle: the rat is the figure who begins again."
    },
    'chinese-ox': {
      name: 'Ox (牛)',
      tradition: 'Chinese zodiac',
      writeup: "Patient strength, the animal that pulls the plow without complaint. The ox in the Jade Emperor's race carried the rat all the way and lost the lead at the last moment — the archetype carries the experience of being used by faster minds. The corpus around the ox emphasizes endurance, reliability, the slow and accumulating power of work that does not announce itself. Shadow side: stubbornness, refusal to update, the bull-in-the-china-shop when patience finally cracks. The figure who builds the foundation everyone else stands on."
    },
    'chinese-tiger': {
      name: 'Tiger (虎)',
      tradition: 'Chinese zodiac',
      writeup: "King of beasts in East Asian iconography, opposite-pole to the dragon. The tiger archetype is solitary authority — not a pack predator, not a herd animal, the figure whose territory is its own. Carries themes of righteous violence, mountain-spirit, protective ferocity over what the figure has decided is its domain. Shadow side: territoriality without cause, threat-display as substitute for actual presence. Tigers in the corpus are often guardians of thresholds — the figure who decides who passes."
    },
    'chinese-rabbit': {
      name: 'Rabbit (兔)',
      tradition: 'Chinese zodiac',
      writeup: "The moon's animal in East Asian myth — the rabbit on the moon pounds the elixir of immortality. The archetype carries: refinement, peace-seeking, capacity for retreat without abandonment, sensitivity to undercurrents others miss. Aesthetic intelligence rather than confrontational intelligence. Shadow side: avoidance dressed as discernment, escape into beautiful interiors. The figure who sees the violence coming and slips sideways instead of standing the ground."
    },
    'chinese-dragon': {
      name: 'Dragon (龍)',
      tradition: 'Chinese zodiac',
      writeup: "The only mythical creature in the cycle — and the one most freighted with imperial association. East Asian dragons are water-spirits, weather-bringers, not the hoarding wyrms of European tradition. Carries themes of cosmic-scale agency, the figure whose presence reshapes the ground around them, charisma that enters rooms first. Shadow side: theatricality eating substance, the figure who believes their own myth and stops doing the work. Dragons in the corpus are auspicious AND dangerous — what the dragon brings is what the dragon brings, and rarely chooseable."
    },
    'chinese-snake': {
      name: 'Snake (蛇)',
      tradition: 'Chinese zodiac',
      writeup: "Wisdom-animal across virtually every tradition, dragon-without-claws in Chinese specifically. The snake archetype carries: silent acquisition, patience, intelligence that operates beneath visible registers, transformation through sheddings. Sexual and erotic associations across many corpora — the snake-figure is rarely sexless. Shadow side: manipulation, the cold logic that mistakes itself for clarity. Snakes in the corpus are often the keeper of what should not be touched, the guardian of the actual stakes."
    },
    'chinese-horse': {
      name: 'Horse (馬)',
      tradition: 'Chinese zodiac',
      writeup: "Movement, the animal that crossed the steppe and made empires possible. Horse-archetype carries: free-spiritedness, restlessness, capacity for sudden transit between worlds, reluctance to be saddled. Honor and friendship as load-bearing values — the horse-figure is loyal to the people, not to the institution. Shadow side: flightiness, the inability to commit, leaving when it is hard. The figure who appears and disappears according to internal weather no one else can read."
    },
    'chinese-goat': {
      name: 'Goat (羊)',
      tradition: 'Chinese zodiac',
      writeup: "Sometimes translated 'sheep' — the East Asian sheep-goat distinction is loose. The archetype carries: gentleness, artistic sensibility, communal warmth, capacity for delicate work. The figure who keeps the group together by being the one no one fights with. Shadow side: passivity that mistakes itself for kindness, dependence on group-energy to stay animated. Goats in the corpus are often the figure whose absence is felt only after they leave."
    },
    'chinese-monkey': {
      name: 'Monkey (猴)',
      tradition: 'Chinese zodiac',
      writeup: "Sun Wukong, the Monkey King, is the canonical figure — trickster, rebel, eventually buddha. The archetype carries: wit at speed, refusal to take the established hierarchy as final, capacity for transformation through mischief, the figure who breaks the system and is then asked to fix it. Shadow side: mockery as substitute for engagement, cleverness that cannot stop, the mind that out-runs its own ground. Monkeys in the corpus are often the figure who teaches by humiliating teachers."
    },
    'chinese-rooster': {
      name: 'Rooster (雞)',
      tradition: 'Chinese zodiac',
      writeup: "The bird that announces dawn — herald, the figure who is heard before seen. Carries themes of: accuracy in observation, willingness to call out what others see and ignore, formal dignity, the figure who keeps time for everyone else. Shadow side: pomposity, the desire to be noticed becoming the work, criticism as habit rather than craft. Roosters in the corpus are often the figure whose timing is correct even when the message is unwelcome."
    },
    'chinese-dog': {
      name: 'Dog (狗)',
      tradition: 'Chinese zodiac',
      writeup: "Loyalty as the cardinal virtue. The dog-archetype carries: fierce protectiveness of chosen people, moral seriousness, the figure who keeps watch through the night, willingness to fight outsized threats for the people one has chosen. Shadow side: anxiety, suspicion calcifying into paranoia, the figure who cannot stop scanning. Dogs in the corpus are often the figure whose love survives every betrayal — for better and for worse."
    },
    'chinese-pig': {
      name: 'Pig (豬)',
      tradition: 'Chinese zodiac',
      writeup: "Last in the cycle — the pig arrived late to the Jade Emperor's race because it stopped to eat. The archetype is comfort, abundance, generosity-without-calculation, the figure who hosts. Carries themes of hedonism in the productive sense — capacity for pleasure as a real value. Shadow side: laziness, the figure who chooses ease over the harder right, naïveté about how the world works. Pigs in the corpus are often the figure whose kindness is mistaken for stupidity until the moment it isn't."
    },

    // ============================================================
    // TIBETAN ELEMENT-ANIMAL (60-year cycle: 5 elements × 12 animals)
    // V1: writeups for the 5 ELEMENTS only (animal writeups overlap with Chinese).
    // The element modulates the animal — wood-rat is gentler than iron-rat, etc.
    // ============================================================
    'tibetan-wood': {
      name: 'Wood element',
      tradition: 'Tibetan element-animal cycle',
      writeup: "Wood is the growth element — the element of the tree pushing through. Modulates the year-animal toward expansion, openness, adaptive flexibility, the figure who finds where the light is and grows toward it. Wood-years carry themes of beginnings, bending without breaking, the willingness to be reshaped by what one is reaching for. The tree's shadow side is also wood's: rigidity once growth has set, the inability to cut back what has grown wrong."
    },
    'tibetan-fire': {
      name: 'Fire element',
      tradition: 'Tibetan element-animal cycle',
      writeup: "Fire is the transformation element — the element that converts one thing into another by consuming the first. Modulates the year-animal toward intensity, charisma, accelerated learning through burning-up of older selves. Fire-years carry themes of passion, visibility, the figure who cannot be ignored when present. Shadow side: consumption that leaves nothing behind, brilliance that exhausts everyone including the bearer."
    },
    'tibetan-earth': {
      name: 'Earth element',
      tradition: 'Tibetan element-animal cycle',
      writeup: "Earth is the stabilizing element — the ground that holds. Modulates the year-animal toward groundedness, reliability, slow accumulation, the figure who builds the structure others live in. Earth-years carry themes of practicality, generosity through provision, the body as the first instrument. Shadow side: stuckness, the figure who confuses immobility with wisdom, the slow weight that becomes inertia."
    },
    'tibetan-iron': {
      name: 'Iron element',
      tradition: 'Tibetan element-animal cycle',
      writeup: "Iron (sometimes translated 'metal') is the refining element — the element of the blade and the bell. Modulates the year-animal toward precision, sharpness, capacity to cut what needs cutting, the figure whose discrimination is the gift. Iron-years carry themes of rigor, beauty achieved through subtraction, the cold work of getting it right. Shadow side: severity, the figure whose standards cut everyone including the bearer."
    },
    'tibetan-water': {
      name: 'Water element',
      tradition: 'Tibetan element-animal cycle',
      writeup: "Water is the wisdom element — the element that takes the shape of what it fills, that wears down stone over time, that knows where to go without being told. Modulates the year-animal toward emotional intelligence, deep currents under surface calm, capacity to flow around obstacles instead of confronting them. Water-years carry themes of intuition, dream-work, the figure who reads what others say beneath what others say. Shadow side: dissolution, the figure who flows so well they stop having shape at all."
    },

    // Compose tibetan keys: tibetan-wood-rat = wood writeup + chinese-rat writeup combined at display time.
    // Form will fetch both 'tibetan-' + element and 'chinese-' + animal and stack them.

    // ============================================================
    // WESTERN TROPICAL ZODIAC (12 sun signs)
    // ============================================================
    'western-aries': {
      name: 'Aries (the Ram)',
      tradition: 'Western tropical zodiac',
      writeup: "First sign of the zodiac, ruled by Mars — the spring-equinox cardinal-fire sign, the principle of beginning. Aries archetype carries: initiative, the willingness to be first into the room, courage that does not check the room's mood before entering. Carries themes of single-pointed will, the figure who burns bright and short. Shadow side: impatience, conflict for its own sake, the inability to finish what was so dramatically begun. Aries in the corpus is the ram who charges the wall and the ram who leads the flock — same animal, different deployments."
    },
    'western-taurus': {
      name: 'Taurus (the Bull)',
      tradition: 'Western tropical zodiac',
      writeup: "Fixed-earth sign ruled by Venus — the principle of embodied pleasure and durable value. Taurus archetype carries: sensual presence, slow appetites, the figure who knows what they like and stays in it, capacity to make beautiful things that last. Carries themes of rootedness, the body as instrument of knowing, refusal to be hurried. Shadow side: stubbornness, the figure who confuses comfort with virtue, the bull who will not move when the field is on fire."
    },
    'western-gemini': {
      name: 'Gemini (the Twins)',
      tradition: 'Western tropical zodiac',
      writeup: "Mutable-air sign ruled by Mercury — the principle of communication, multiplicity, the figure who is two things at once. Gemini archetype carries: verbal agility, intellectual restlessness, capacity to hold contradictory positions in productive tension, the figure for whom thinking is a form of moving. Carries themes of curiosity as virtue, the messenger between worlds. Shadow side: scatter, the figure whose surface fluency hides absence of depth, the doubling-as-fragmentation that becomes its own problem."
    },
    'western-cancer': {
      name: 'Cancer (the Crab)',
      tradition: 'Western tropical zodiac',
      writeup: "Cardinal-water sign ruled by the Moon — the principle of nurture, memory, the inner home. Cancer archetype carries: emotional intelligence, protective instinct toward chosen people, capacity to hold the family-room together through invisible labor. Carries themes of feeling-as-knowledge, the figure who remembers what others let go. Shadow side: clinginess, the figure whose interior is so rich they forget to leave, mood as method of control."
    },
    'western-leo': {
      name: 'Leo (the Lion)',
      tradition: 'Western tropical zodiac',
      writeup: "Fixed-fire sign ruled by the Sun — the principle of radiant self-expression, the figure at the center of the room because the room organizes around them. Leo archetype carries: generosity that exceeds the bearer's resources, performative confidence, the willingness to be visible in a way that gives others permission to be visible. Carries themes of dignity, play, art-as-life. Shadow side: ego inflation, the figure who needs the audience more than the audience needs them, pride as defense against doubt."
    },
    'western-virgo': {
      name: 'Virgo (the Maiden)',
      tradition: 'Western tropical zodiac',
      writeup: "Mutable-earth sign ruled by Mercury — the principle of analytical service, the figure who notices what is wrong and fixes it. Virgo archetype carries: precision, devotion to craft, the willingness to do the unglamorous work that makes the glamorous work possible. Carries themes of discernment, healing, the figure whose attention is the gift. Shadow side: criticism that becomes its own end, perfectionism as self-attack disguised as standards, the inability to let it be done."
    },
    'western-libra': {
      name: 'Libra (the Scales)',
      tradition: 'Western tropical zodiac',
      writeup: "Cardinal-air sign ruled by Venus — the principle of relation, the figure who composes balance between parties. Libra archetype carries: aesthetic intelligence, diplomatic capacity, refusal to settle for asymmetry, the willingness to hold multiple sides until the genuine equilibrium emerges. Carries themes of partnership, beauty-as-justice, the courtroom-of-the-heart. Shadow side: indecision, the figure whose desire to be liked overrides the position they actually hold, performing-balance as substitute for taking-position."
    },
    'western-scorpio': {
      name: 'Scorpio (the Scorpion)',
      tradition: 'Western tropical zodiac',
      writeup: "Fixed-water sign ruled by Pluto/Mars — the principle of depth-work, transformation through what cannot be ignored. Scorpio archetype carries: emotional intensity, capacity to enter places others avoid, the figure who handles secrets without breaking under them. Carries themes of death-and-rebirth, sexuality-as-knowing, the willingness to feel through completion. Shadow side: vindictiveness, the figure whose intensity becomes possession, the cold long-term grudge that outlasts its own cause."
    },
    'western-sagittarius': {
      name: 'Sagittarius (the Archer)',
      tradition: 'Western tropical zodiac',
      writeup: "Mutable-fire sign ruled by Jupiter — the principle of expansion, the figure who shoots arrows at horizons. Sagittarius archetype carries: optimism, philosophical hunger, restlessness toward bigger frames, the willingness to leave for the unknown. Carries themes of teaching, travel, the centaur who is half-beast and half-civilized aiming at what is beyond both. Shadow side: tactlessness, the figure whose love of the truth becomes a weapon, leaving when the work gets unglamorous."
    },
    'western-capricorn': {
      name: 'Capricorn (the Sea-Goat)',
      tradition: 'Western tropical zodiac',
      writeup: "Cardinal-earth sign ruled by Saturn — the principle of ambitious construction, the figure who builds the ladder and climbs it. Capricorn archetype carries: discipline, long-game patience, capacity for sustained effort toward large goals, the figure who arrives at the summit because they did not stop. Carries themes of authority earned through work, the mountain-as-vocation. Shadow side: coldness, the figure who confuses rank with worth, the cynicism that comes from looking down too long."
    },
    'western-aquarius': {
      name: 'Aquarius (the Water-Bearer)',
      tradition: 'Western tropical zodiac',
      writeup: "Fixed-air sign ruled by Uranus/Saturn — the principle of innovation in service of the collective, the figure who sees the future-shape of the group before the group does. Aquarius archetype carries: intellectual independence, humanitarian orientation, willingness to be eccentric, the figure who pours water from above onto everyone equally. Carries themes of friendship as primary bond, the genius who is also the weirdo. Shadow side: detachment, the figure who loves humanity but dislikes humans, contrarianism as identity."
    },
    'western-pisces': {
      name: 'Pisces (the Fishes)',
      tradition: 'Western tropical zodiac',
      writeup: "Mutable-water sign ruled by Neptune/Jupiter — the principle of dissolution-and-mysticism, the figure who feels the boundaries between selves and worlds become permeable. Pisces archetype carries: empathy without filter, artistic sensitivity, spiritual intelligence, the figure who takes on others' feelings as their own. Carries themes of imagination, sacrifice, the saint-and-the-junkie sharing the same architecture. Shadow side: escapism, the figure who dissolves into whatever they touch, victimhood as comfort. Pisces in the corpus is the last sign because it returns the cycle to ocean."
    }

  };

  global.PolymythHoroscopeArchetypes = ARCHETYPES;

})(typeof window !== 'undefined' ? window : this);
