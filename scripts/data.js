// data.js — single source of truth for game content

const STARTERS = [
  {
    id: 'vesper',
    name: 'VESPER',
    type: 'memory / dusk',
    description: 'for those who survive',
    track: 'where we been',
    trackNum: 2,
    sprite: 'assets/sprites/creature-vesper.png',
    stats: { hp: 110, atk: 14, spd: 6, luck: 4 }
  },
  {
    id: 'omen',
    name: 'OMEN',
    type: 'sign / luck',
    description: 'for those who walk before the storm',
    track: 'find my way',
    trackNum: 4,
    sprite: 'assets/sprites/creature-omen.png',
    stats: { hp: 95, atk: 18, spd: 9, luck: 7 }
  },
  {
    id: 'hunger',
    name: 'HUNGER',
    type: 'heart / risk',
    description: "for those who can't wait",
    track: 'what i need',
    trackNum: 5,
    sprite: 'assets/sprites/creature-hunger.png',
    stats: { hp: 80, atk: 24, spd: 8, luck: 6 }
  }
];

const GYMS = [
  {
    num: 1,
    name: 'hold me back',
    track: 'hold me back',
    trackNum: 7,
    leader: 'the gatekeeper',
    leaderSprite: 'assets/sprites/leader-1-gatekeeper.png',
    intro: 'the gatekeeper steps forward.',
    quote: '"you don\'t get past me."',
    creature: {
      name: 'STONEMAW',
      sprite: 'assets/sprites/creature-vesper.png', // placeholder until commissioned
      stats: { hp: 70, atk: 12, spd: 5, luck: 3 }
    },
    aiPattern: 'simple',
    badge: 'badge of restraint'
  },
  {
    num: 2,
    name: 'motion',
    track: 'motion',
    trackNum: 8,
    leader: 'the runner',
    leaderSprite: 'assets/sprites/leader-2-runner.png',
    intro: 'the runner is already gone before you blink.',
    quote: '"keep up."',
    creature: {
      name: 'SPRINTER',
      sprite: 'assets/sprites/creature-omen.png',
      stats: { hp: 75, atk: 14, spd: 12, luck: 5 }
    },
    aiPattern: 'evasive',
    badge: 'badge of pace'
  },
  {
    num: 3,
    name: 'we believe',
    track: 'we believe',
    trackNum: 6,
    leader: 'the congregation',
    leaderSprite: 'assets/sprites/leader-3-congregation.png',
    intro: 'the congregation answers as one.',
    quote: '"we keep each other up."',
    creature: {
      name: 'CHORUS',
      sprite: 'assets/sprites/creature-hunger.png',
      stats: { hp: 90, atk: 13, spd: 7, luck: 4 }
    },
    creature2: {
      name: 'CHORUS-II',
      sprite: 'assets/sprites/creature-hunger.png',
      stats: { hp: 85, atk: 15, spd: 7, luck: 5 }
    },
    aiPattern: 'multi',
    badge: 'badge of faith'
  },
  {
    num: 4,
    name: "doin' the most",
    track: "doin' the most",
    trackNum: 10,
    leader: 'the showoff',
    leaderSprite: 'assets/sprites/leader-4-showoff.png',
    intro: 'the showoff is grinning.',
    quote: '"watch this."',
    creature: {
      name: 'FLAREUP',
      sprite: 'assets/sprites/creature-omen.png',
      stats: { hp: 95, atk: 20, spd: 10, luck: 8 }
    },
    aiPattern: 'aggressive',
    badge: 'badge of flash'
  },
  {
    num: 5,
    name: "can't lose",
    track: "can't lose",
    trackNum: 9,
    leader: 'the rival',
    leaderSprite: 'assets/sprites/leader-5-rival.png',
    intro: "your reflection sends out your own creature.\nthe rival doesn't speak.",
    quote: '',
    creature: {
      // mirror match — set at runtime to copy player's starter
      mirror: true,
      stats: { hp: 110, atk: 22, spd: 11, luck: 9 }
    },
    aiPattern: 'mirror',
    badge: 'badge of doubt'
  },
  {
    num: 6,
    name: 'made it off rap',
    track: 'made it off rap',
    trackNum: 11,
    leader: 'danny ali',
    leaderSprite: 'assets/sprites/leader-6-danny.png',
    intro: 'danny ali is already waiting.',
    quote: '"i made it off rap. you got off lucky to be here."',
    creature: {
      name: 'BUTTERFLY',
      sprite: 'assets/butterfly.png',
      stats: { hp: 100, atk: 22, spd: 11, luck: 10 }
    },
    creature2: {
      name: 'NIGHTWORK',
      sprite: 'assets/sprites/creature-omen.png',
      stats: { hp: 120, atk: 25, spd: 9, luck: 12 }
    },
    aiPattern: 'boss',
    badge: 'champion of aliworld'
  }
];

// 5 prizes, claimed in order (cheap to expensive)
const PRIZES = [
  { id: 'sticker', name: 'sticker pack', deliverable: 'physical' },
  { id: 'album', name: 'early album link', deliverable: 'digital', link: 'https://symphony.to/dannyali/better-luck-next-time' },
  { id: 'merch', name: 'free merch pack', deliverable: 'physical', link: 'https://square.link/u/3mgewklo' },
  { id: 'patreon', name: 'free patreon membership', deliverable: 'manual', link: 'https://patreon.com/c/six5ive' },
  { id: 'show', name: 'lifetime show entry', deliverable: 'manual' }
];

// rotated on loss screens for replayability
const LOSS_LORE = [
  'better luck doesn\'t come twice.',
  'the broker keeps the count.',
  'you almost made it. that\'s the worst kind of close.',
  'hold me back was right.',
  'the showoff was right too.',
  'this is what dreams are made of.',
  'not yet means not now.',
  'some doors only open from the other side.',
  'the album knows.',
  'd.a. saw you coming.',
  'the moths know who you were.',
  'you found your way. just not the right way.',
  'aliworld remembers.'
];

// in-cold-open, the wild creature you fight (and lose to)
const COLD_OPEN_CREATURE = {
  name: 'unknown',
  sprite: 'assets/sprites/creature-omen.png',
  stats: { hp: 100, atk: 28, spd: 99, luck: 99 }
};

// player moves
const MOVES = {
  strike: {
    name: 'strike',
    desc: '15-25 dmg',
    minDmg: 15,
    maxDmg: 25,
    hitChance: 0.8,
    critChance: 0.1
  },
  slip: {
    name: 'slip',
    desc: 'halve next hit',
    isDodge: true
  },
  lockin: {
    name: 'lock in',
    desc: '1.5x next strike',
    isCharge: true
  },
  fold: {
    name: 'fold',
    desc: 'forfeit run',
    isFlee: true,
    danger: true
  }
};

// audio map — files dropped in /assets/audio/ later
const AUDIO_MAP = {
  coldopen: 'assets/audio/01-what-dreams-are-made-of.mp3',
  trainer: 'assets/audio/03-whats-yo-name.mp3',
  starter: 'assets/audio/05-what-i-need.mp3',
  map: 'assets/audio/04-find-my-way.mp3',
  gym1: 'assets/audio/07-hold-me-back.mp3',
  gym2: 'assets/audio/08-motion.mp3',
  gym3: 'assets/audio/06-we-believe.mp3',
  gym4: 'assets/audio/10-doin-the-most.mp3',
  gym5: 'assets/audio/09-cant-lose.mp3',
  gym6: 'assets/audio/11-made-it-off-rap.mp3',
  ambient: 'assets/audio/02-where-we-been.mp3'
};

window.GAME_DATA = { STARTERS, GYMS, PRIZES, LOSS_LORE, COLD_OPEN_CREATURE, MOVES, AUDIO_MAP };
