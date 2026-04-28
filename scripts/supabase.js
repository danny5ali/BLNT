// supabase.js — database client and all read/write functions
// this replaces localStorage for all persistent data

const SUPABASE_URL = 'https://pplpihxmkucmmmkciypf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbHBpaHhta3VjbW1ta2NpeXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjg3MDksImV4cCI6MjA5MjkwNDcwOX0.Kuyazq6nc-APPS2aOpHw4Bhls1R9-Ut7FSClgxa8Adw';

const DB = {
  // ── base fetch helper ──────────────────────────────────────────
  async req(path, opts = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...opts.headers
      },
      ...opts
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('supabase error:', err);
      return null;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  // ── plays ──────────────────────────────────────────────────────

  // register a new trainer (email capture on trainer card submit)
  async recordPlay(name, email, starter) {
    return this.req('plays', {
      method: 'POST',
      body: JSON.stringify({ name, email, starter })
    });
  },

  // check if an email has already played (for resume state lookup)
  async getPlayByEmail(email) {
    return this.req(`plays?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`);
  },

  // get total play count
  async getPlayCount() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plays?select=id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0'
      }
    });
    const count = res.headers.get('content-range');
    // content-range: 0-0/TOTAL
    return count ? parseInt(count.split('/')[1]) : 0;
  },

  // get plays from today
  async getPlaysToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/plays?select=id&created_at=gte.${today.toISOString()}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'count=exact',
          'Range-Unit': 'items',
          'Range': '0-0'
        }
      }
    );
    const count = res.headers.get('content-range');
    return count ? parseInt(count.split('/')[1]) : 0;
  },

  // ── fallen_log ─────────────────────────────────────────────────

  async recordFall(name, email, gym) {
    return this.req('fallen_log', {
      method: 'POST',
      body: JSON.stringify({ name, email, gym })
    });
  },

  // get fall counts per gym (for funnel)
  async getFallCounts() {
    const data = await this.req('fallen_log?select=gym');
    if (!data) return {};
    const counts = {};
    data.forEach(r => {
      counts[r.gym] = (counts[r.gym] || 0) + 1;
    });
    return counts;
  },

  // ── prizes_awarded ─────────────────────────────────────────────

  // check if a limited prize is still available (not yet claimed)
  async isPrizeAvailable(prizeId) {
    const data = await this.req(
      `prizes_awarded?prize_id=eq.${prizeId}&limited=eq.true&select=id&limit=1`
    );
    return !data || data.length === 0;
  },

  // check if this email already received a specific prize
  async emailHasPrize(email, prizeId) {
    const data = await this.req(
      `prizes_awarded?email=eq.${encodeURIComponent(email)}&prize_id=eq.${prizeId}&select=id&limit=1`
    );
    return data && data.length > 0;
  },

  // award a prize for clearing a gym
  // returns the awarded row, or null if not available
  async awardPrize(prize, winnerName, email) {
    // double-check availability for limited prizes
    if (prize.limited) {
      const available = await this.isPrizeAvailable(prize.id);
      if (!available) return null;
    }
    // check if this email already got this prize
    const already = await this.emailHasPrize(email, prize.id);
    if (already) return null;

    const row = {
      prize_id: prize.id,
      gym: prize.gym,
      prize_name: prize.name,
      winner_name: winnerName,
      email: email,
      limited: prize.limited,
      sent: false
    };
    const result = await this.req('prizes_awarded', {
      method: 'POST',
      body: JSON.stringify(row)
    });
    return result ? result[0] : null;
  },

  // get all awarded prizes (for dashboard)
  async getAllPrizesAwarded() {
    return this.req('prizes_awarded?order=created_at.desc');
  },

  // get claimed limited prizes (for prize board)
  async getClaimedLimitedPrizes() {
    return this.req('prizes_awarded?limited=eq.true&select=prize_id,winner_name,email,sent');
  },

  // mark a prize as sent (dashboard action)
  async markPrizeSent(id) {
    return this.req(`prizes_awarded?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ sent: true })
    });
  },

  // get count of limited prizes remaining
  async getLimitedPrizesRemaining(totalLimited) {
    const data = await this.req('prizes_awarded?limited=eq.true&select=prize_id');
    const claimed = data ? data.length : 0;
    return totalLimited - claimed;
  },

  // get all awarded prizes for a specific email (for dashboard filter)
  async getPrizesForEmail(email) {
    return this.req(`prizes_awarded?email=eq.${encodeURIComponent(email)}`);
  },

  // get starter pick distribution
  async getStarterPicks() {
    const data = await this.req('plays?select=starter');
    if (!data) return { vesper: 0, omen: 0, hunger: 0 };
    const counts = { vesper: 0, omen: 0, hunger: 0 };
    data.forEach(r => {
      if (r.starter && counts[r.starter] !== undefined) counts[r.starter]++;
    });
    return counts;
  }
};

window.DB = DB;
