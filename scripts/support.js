// support.js — state management, audio, sharing utilities

// ============= STATE =============
// in v1 this lives in localStorage. phase 3 swaps to supabase.
const State = {
  KEY: 'blnt_state',

  default: () => ({
    name: '',
    email: '',
    starter: null,
    runs: 0,
    currentRun: null,
    badges: 0,
    prizesClaimed: [],
    winners: [], // [{ name, email, prize, time }]
    fallenLog: [], // [{ name, gym, time }]
    audioMuted: true,
    runId: 1
  }),

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.default();
      const data = JSON.parse(raw);
      // merge with default so new fields exist
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

  // who has won which prize? returns next available prize
  nextPrize(state) {
    const claimed = state.prizesClaimed.map(p => p.id);
    return window.GAME_DATA.PRIZES.find(p => !claimed.includes(p.id));
  },

  prizesRemaining(state) {
    return window.GAME_DATA.PRIZES.length - state.prizesClaimed.length;
  },

  // has this email already won a prize?
  emailHasWon(state, email) {
    return state.winners.some(w => w.email.toLowerCase() === email.toLowerCase());
  },

  reset() {
    localStorage.removeItem(this.KEY);
  }
};

// ============= AUDIO =============
const Audio = {
  current: null,
  muted: true,

  init() {
    this.muted = State.load().audioMuted;
    this.updateButton();
  },

  play(key) {
    // stop current
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
    if (this.muted) return;
    const src = window.GAME_DATA.AUDIO_MAP[key];
    if (!src) return;
    try {
      const el = new window.HTMLAudioElement ? document.createElement('audio') : null;
      if (!el) return;
      el.src = src;
      el.loop = true;
      el.volume = 0.5;
      el.play().catch(() => { /* autoplay blocked, ignore */ });
      this.current = el;
    } catch (e) { /* file missing, fail silently */ }
  },

  toggleMute() {
    this.muted = !this.muted;
    const state = State.load();
    state.audioMuted = this.muted;
    State.save(state);
    if (this.muted && this.current) {
      this.current.pause();
    } else if (!this.muted && this.current) {
      this.current.play().catch(() => {});
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
      ctx.fillText('almost.', 540, 700);
      ctx.fillText('not yet.', 540, 850);
    } else {
      ctx.fillText('cleared', 540, 700);
      ctx.fillText('aliworld.', 540, 850);
    }

    // sub
    ctx.fillStyle = '#b32a1f';
    ctx.font = 'bold 32px monospace';
    if (type === 'loss') {
      ctx.fillText(`FELL AT GYM ${data.gym} / 6`, 540, 950);
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
