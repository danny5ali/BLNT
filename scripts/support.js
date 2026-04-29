// support.js — state management, audio, sharing utilities

// ============= STATE =============
const State = {
  KEY: 'blnt_state',

  default: () => ({
    name: '',
    email: '',
    starter: null,
    runs: 0,
    badges: 0,
    // resume mechanic: if we fell at gym 4+, this holds our checkpoint info
    // null = no checkpoint, fresh run on next play
    checkpoint: null, // { badges: 3, starter: 'omen' }
    // prize tracking — globally limited prizes that have been claimed
    // limited prizes: only one winner each (first to clear that gym)
    // unlimited prizes (gym 1): tracked per-email so we know who got the link
    prizesClaimed: [], // limited prizes only [{ id, gym, email, name, time }]
    prizesAwarded: [], // ALL prizes ever awarded (limited + unlimited) [{ id, gym, email, name, time, sent }]
    fallenLog: [], // [{ name, gym, time }]
    audioMuted: true,
    runId: 1
  }),

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.default();
      const data = JSON.parse(raw);
      return { ...this.default(), ...data };
    } catch (e) {
      return this.default();
    }
  },

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      console.error('save failed', e);
    }
  },

  // get the prize unlocked by clearing a specific gym
  prizeForGym(gymNum) {
    return window.GAME_DATA.PRIZES.find(p => p.gym === gymNum);
  },

  // is a limited prize still available?
  isPrizeAvailable(state, prize) {
    if (!prize.limited) return true;
    return !state.prizesClaimed.some(p => p.id === prize.id);
  },

  // has this specific email already won this specific prize? (prevents double-claim of unlimited prizes)
  emailHasWonPrize(state, email, prizeId) {
    return state.prizesAwarded.some(
      p => p.id === prizeId && p.email.toLowerCase() === email.toLowerCase()
    );
  },

  // award a prize for clearing a gym. returns the prize awarded, or null if none.
  awardPrizeForGym(state, gymNum, email, name) {
    const prize = this.prizeForGym(gymNum);
    if (!prize) return null;

    // already won this exact prize? skip
    if (this.emailHasWonPrize(state, email, prize.id)) return null;

    // limited prize already claimed? skip
    if (prize.limited && !this.isPrizeAvailable(state, prize)) return null;

    const award = {
      id: prize.id,
      gym: prize.gym,
      name: prize.name,
      email: email,
      winnerName: name,
      time: Date.now(),
      sent: false
    };

    state.prizesAwarded.push(award);

    // for limited prizes, also record in claimed (locks it forever)
    if (prize.limited) {
      state.prizesClaimed.push(award);
    }

    return prize;
  },

  // count of limited prizes remaining
  prizesRemaining(state) {
    const limited = window.GAME_DATA.PRIZES.filter(p => p.limited);
    return limited.length - state.prizesClaimed.length;
  },

  // does this gym have its prize still available?
  gymHasAvailablePrize(state, gymNum) {
    const prize = this.prizeForGym(gymNum);
    if (!prize) return false;
    return this.isPrizeAvailable(state, prize);
  },

  // resume mechanic: did we fall past the checkpoint?
  hasCheckpoint(state) {
    return state.checkpoint && state.checkpoint.badges >= window.GAME_DATA.CHECKPOINT_GYM - 1;
  },

  reset() {
    localStorage.removeItem(this.KEY);
  }
};

// ============= AUDIO =============
// note: we use AudioPlayer (not Audio) because Audio is a built-in browser constructor
const AudioPlayer = {
  current: null,
  currentKey: null,
  muted: true,

  init() {
    this.muted = State.load().audioMuted;
    this.updateButton();
  },

  play(key) {
    // already playing this exact track? don't restart
    if (this.currentKey === key && this.current && !this.current.paused) return;

    // stop current track
    if (this.current) {
      try { this.current.pause(); } catch (e) {}
      this.current = null;
    }
    this.currentKey = key;

    if (this.muted) return;

    const src = window.GAME_DATA.AUDIO_MAP[key];
    if (!src) {
      console.warn('no audio for key:', key);
      return;
    }

    try {
      const el = document.createElement('audio');
      el.src = src;
      el.loop = true;
      el.volume = 0.5;
      el.preload = 'auto';
      this.current = el;
      // play returns a promise — handle rejection (autoplay blocked, etc)
      const p = el.play();
      if (p && p.catch) {
        p.catch(err => {
          console.warn('audio play blocked:', err.message);
        });
      }
    } catch (e) {
      console.warn('audio error:', e);
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    const state = State.load();
    state.audioMuted = this.muted;
    State.save(state);

    if (this.muted) {
      // pause the current track but don't tear down
      if (this.current) {
        try { this.current.pause(); } catch (e) {}
      }
    } else {
      // unmuting — play whatever the current screen needs
      const key = this.currentKey || 'ambient';
      // force restart by clearing currentKey so play() doesn't skip
      this.currentKey = null;
      this.play(key);
    }
    this.updateButton();
  },

  updateButton() {
    const btn = document.getElementById('mute-btn');
    if (btn) {
      btn.textContent = this.muted ? '[ sound off ]' : '[ sound on ]';
    }
  }
};

// also expose under old name for backwards compatibility
const Audio = AudioPlayer;

// ============= SHARE / CARD GENERATION =============
const Share = {
  // generate a 1080x1920 ig-story sized card for sharing
  // type: 'loss' or 'champion'
  // data: { name, gym, starter, prize, badges, lore }
  async generateCard(type, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    // bg
    ctx.fillStyle = '#ebe2d2';
    ctx.fillRect(0, 0, 1080, 1920);

    // grain noise (simulated with random dots)
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 1080;
      const y = Math.random() * 1920;
      ctx.fillStyle = '#1c1815';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    // header
    ctx.fillStyle = '#6b6258';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SIX5IVE · ALIWORLD', 80, 100);
    ctx.textAlign = 'right';
    ctx.fillText('BETTER LUCK NEXT TIME', 1000, 100);
    ctx.textAlign = 'left';

    // line under header
    ctx.fillStyle = '#1c1815';
    ctx.fillRect(80, 130, 920, 1);

    // big title
    ctx.fillStyle = '#1c1815';
    ctx.font = 'italic 130px serif';
    ctx.textAlign = 'center';
    if (type === 'loss') {
      ctx.fillStyle = '#b32a1f';
      ctx.font = 'bold 96px monospace';
      ctx.fillText('BETTER LUCK', 540, 660);
      ctx.fillText('NEXT TIME!', 540, 770);
      ctx.fillStyle = '#6b6258';
      ctx.font = 'italic 36px serif';
      ctx.fillText('an album by danny ali', 540, 830);
    } else {
      ctx.fillText('cleared', 540, 700);
      ctx.fillText('aliworld.', 540, 850);
    }

    // sub
    ctx.fillStyle = '#b32a1f';
    ctx.font = 'bold 32px monospace';
    if (type === 'loss') {
      ctx.fillText(`FELL AT GYM ${data.gym} / 6`, 540, 920);
    } else {
      ctx.fillText('CHAMPION', 540, 950);
    }

    // badges row (6 squares)
    const badgeSize = 50;
    const totalW = 6 * badgeSize + 5 * 12;
    const startX = (1080 - totalW) / 2;
    for (let i = 0; i < 6; i++) {
      const x = startX + i * (badgeSize + 12);
      const y = 1050;
      if (type === 'champion') {
        ctx.fillStyle = '#1c1815';
        ctx.fillRect(x, y, badgeSize, badgeSize);
      } else {
        if (i < data.badges) {
          ctx.fillStyle = '#1c1815';
          ctx.fillRect(x, y, badgeSize, badgeSize);
        } else if (i === data.badges) {
          ctx.fillStyle = '#b32a1f';
          ctx.fillRect(x, y, badgeSize, badgeSize);
        } else {
          ctx.strokeStyle = '#6b6258';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, badgeSize, badgeSize);
        }
      }
    }

    // lore line / prize name
    ctx.font = 'italic 36px serif';
    ctx.fillStyle = '#6b6258';
    if (type === 'loss' && data.lore) {
      this.wrapText(ctx, `"${data.lore}"`, 540, 1250, 800, 50);
    } else if (type === 'champion' && data.prize) {
      ctx.fillStyle = '#1c1815';
      ctx.font = 'italic 56px serif';
      ctx.fillText(`won: ${data.prize}`, 540, 1280);
    }

    // trainer name
    ctx.font = 'italic 40px serif';
    ctx.fillStyle = '#1c1815';
    ctx.fillText(`trainer: ${data.name || 'unknown'}`, 540, 1500);

    // tags
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#b32a1f';
    ctx.fillText('@OFFICIALDANNYALI · @SSIX5IVE', 540, 1750);

    // card no / signature
    ctx.font = '24px monospace';
    ctx.fillStyle = '#6b6258';
    ctx.textAlign = 'left';
    ctx.fillText(`run #${data.runId || '001'}`, 80, 1820);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1c1815';
    ctx.font = 'italic 36px cursive';
    ctx.fillText('— d.a.', 1000, 1820);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  },

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  },

  async share(type, data) {
    const blob = await this.generateCard(type, data);
    if (!blob) return Toast.show('couldn\'t generate card');

    const file = new File([blob], `blnt-${type}-${Date.now()}.png`, { type: 'image/png' });

    // try native share first (mobile)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'BETTER LUCK NEXT TIME',
          text: type === 'champion'
            ? `i cleared aliworld. @officialdannyali @ssix5ive`
            : `i lost at aliworld. @officialdannyali @ssix5ive`
        });
        return;
      } catch (e) { /* user cancelled or error, fall through */ }
    }

    // fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Toast.show('downloaded — tag us @officialdannyali @ssix5ive');
  }
};

// ============= TOAST =============
const Toast = {
  show(msg, ms = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
};

window.State = State;
window.Audio = Audio;
window.Share = Share;
window.Toast = Toast;
