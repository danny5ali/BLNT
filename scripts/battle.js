// battle.js — the battle system

class Battle {
  constructor(playerCreature, gym, log, onUpdate, onEnd) {
    this.gym = gym;
    this.log = log;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;

    // clone stats so the originals aren't mutated across battles
    this.player = {
      ...playerCreature,
      stats: { ...playerCreature.stats },
      currentHp: playerCreature.stats.hp,
      maxHp: playerCreature.stats.hp,
      slipping: false,
      charged: false
    };

    // build opponent(s) — gyms 3 and 6 have two creatures
    this.opponents = [this.makeOpponent(gym.creature)];
    if (gym.creature2) {
      this.opponents.push(this.makeOpponent(gym.creature2));
    }
    this.currentOpp = 0;

    this.busy = false;
    this.ended = false;
  }

  makeOpponent(creatureData) {
    // mirror match copies player's starter
    if (creatureData.mirror) {
      return {
        name: this.player.name,
        sprite: this.player.sprite,
        stats: { ...creatureData.stats },
        currentHp: creatureData.stats.hp,
        maxHp: creatureData.stats.hp,
        slipping: false,
        charged: false
      };
    }
    return {
      ...creatureData,
      stats: { ...creatureData.stats },
      currentHp: creatureData.stats.hp,
      maxHp: creatureData.stats.hp,
      slipping: false,
      charged: false
    };
  }

  get opponent() {
    return this.opponents[this.currentOpp];
  }

  start() {
    this.log(`<span class="arrow">▸</span>${this.gym.leader} sent out ${this.opponent.name.toLowerCase()}.`);
    if (this.gym.quote) {
      setTimeout(() => this.log(`<span class="dim">${this.gym.quote.toLowerCase()}</span>`), 600);
    }
    setTimeout(() => {
      this.log(`<span class="dim">what will you do?</span>`);
      this.onUpdate();
    }, 1200);
  }

  // called when player picks a move
  playerMove(moveId) {
    if (this.busy || this.ended) return;
    this.busy = true;

    const move = window.GAME_DATA.MOVES[moveId];

    if (move.isFlee) {
      this.log(`<span class="arrow">▸</span>you folded.`);
      setTimeout(() => this.endBattle(false, true), 800);
      return;
    }

    // determine turn order
    const playerFirst = this.player.stats.spd >= this.opponent.stats.spd;
    if (playerFirst) {
      this.executePlayerMove(move, () => {
        if (this.opponent.currentHp <= 0) {
          this.handleOppFaint();
        } else {
          setTimeout(() => this.executeOpponentMove(), 700);
        }
      });
    } else {
      this.executeOpponentMove(() => {
        if (this.player.currentHp <= 0) {
          this.handlePlayerFaint();
        } else {
          setTimeout(() => this.executePlayerMove(move), 700);
        }
      });
    }
  }

  executePlayerMove(move, cb) {
    if (move.isDodge) {
      this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} slipped into the shadows.`);
      this.player.slipping = true;
      this.busy = false;
      this.onUpdate();
      if (cb) setTimeout(cb, 600);
      return;
    }
    if (move.isCharge) {
      this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} locked in.`);
      this.player.charged = true;
      this.busy = false;
      this.onUpdate();
      if (cb) setTimeout(cb, 600);
      return;
    }
    // strike
    this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} used strike.`);
    setTimeout(() => {
      const result = this.calcDamage(this.player, this.opponent, move);
      if (result.hit) {
        this.opponent.currentHp = Math.max(0, this.opponent.currentHp - result.dmg);
        this.shake('opp');
        if (result.crit) {
          this.log(`<span class="arrow">▸</span>critical hit. ${result.dmg} dmg.`);
        } else {
          this.log(`<span class="arrow">▸</span>it landed. ${result.dmg} dmg.`);
        }
      } else {
        this.log(`<span class="arrow">▸</span>it didn't land.`);
      }
      this.player.charged = false;
      this.onUpdate();
      this.busy = false;
      if (cb) setTimeout(cb, 700);
    }, 500);
  }

  executeOpponentMove(cb) {
    const move = this.pickAiMove();

    if (move === 'dodge') {
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} slipped.`);
      this.opponent.slipping = true;
      this.onUpdate();
      this.busy = false;
      if (cb) setTimeout(cb, 600);
      return;
    }

    if (move === 'charge') {
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} locked in.`);
      this.opponent.charged = true;
      this.onUpdate();
      this.busy = false;
      if (cb) setTimeout(cb, 600);
      return;
    }

    if (move === 'heal') {
      const heal = Math.floor(this.opponent.maxHp * 0.25);
      this.opponent.currentHp = Math.min(this.opponent.maxHp, this.opponent.currentHp + heal);
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} regrouped. +${heal} hp.`);
      this.onUpdate();
      this.busy = false;
      if (cb) setTimeout(cb, 600);
      return;
    }

    // strike
    this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} struck.`);
    setTimeout(() => {
      const result = this.calcDamage(this.opponent, this.player, window.GAME_DATA.MOVES.strike);
      if (result.hit) {
        let dmg = result.dmg;
        if (this.player.slipping) {
          dmg = Math.floor(dmg / 2);
          this.player.slipping = false;
        }
        this.player.currentHp = Math.max(0, this.player.currentHp - dmg);
        this.shake('player');
        if (result.crit) {
          this.log(`<span class="arrow">▸</span>critical. ${this.player.name.toLowerCase()} took ${dmg}.`);
        } else {
          this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} took ${dmg}.`);
        }
      } else {
        this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} dodged.`);
        this.player.slipping = false;
      }
      this.opponent.charged = false;
      this.onUpdate();
      this.busy = false;
      if (cb) setTimeout(cb, 700);
    }, 500);
  }

  pickAiMove() {
    const pattern = this.gym.aiPattern;
    const r = Math.random();
    switch (pattern) {
      case 'simple':
        return 'strike';
      case 'evasive':
        if (r < 0.2) return 'dodge';
        return 'strike';
      case 'multi':
        if (r < 0.15) return 'dodge';
        return 'strike';
      case 'aggressive':
        if (r < 0.2) return 'charge';
        return 'strike';
      case 'mirror':
        // mimics player's last pattern, just randomized aggressive
        if (r < 0.2) return 'dodge';
        if (r < 0.35) return 'charge';
        return 'strike';
      case 'boss':
        if (r < 0.15 && this.opponent.currentHp < this.opponent.maxHp * 0.5) return 'heal';
        if (r < 0.25) return 'charge';
        if (r < 0.35) return 'dodge';
        return 'strike';
      default:
        return 'strike';
    }
  }

  calcDamage(attacker, defender, move) {
    const minD = move.minDmg || 15;
    const maxD = move.maxDmg || 25;
    const hitChance = move.hitChance || 0.8;

    // charged attacks always hit + bonus dmg
    let willHit = Math.random() < hitChance;
    let multiplier = 1;
    if (attacker.charged) {
      willHit = true;
      multiplier = 1.5;
    }

    if (!willHit) return { hit: false, dmg: 0, crit: false };

    let baseDmg = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
    // factor in atk relative to baseline 18
    baseDmg = Math.floor(baseDmg * (attacker.stats.atk / 18));
    baseDmg = Math.floor(baseDmg * multiplier);

    const critChance = (move.critChance || 0.1) + (attacker.stats.luck * 0.01);
    const crit = Math.random() < critChance;
    if (crit) baseDmg = Math.floor(baseDmg * 2);

    return { hit: true, dmg: baseDmg, crit };
  }

  shake(target) {
    const sel = target === 'player' ? '.combatant.you .sprite-box' : '.combatant.opp .sprite-box';
    const el = document.querySelector(sel);
    if (el) {
      el.classList.add('hit');
      setTimeout(() => el.classList.remove('hit'), 400);
    }
  }

  handleOppFaint() {
    this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} fainted.`);
    if (this.currentOpp + 1 < this.opponents.length) {
      // multi-creature fight: send out next
      this.currentOpp++;
      setTimeout(() => {
        this.log(`<span class="arrow">▸</span>${this.gym.leader} sent out ${this.opponent.name.toLowerCase()}.`);
        this.onUpdate();
        this.busy = false;
      }, 1000);
    } else {
      // gym cleared
      setTimeout(() => this.endBattle(true, false), 900);
    }
  }

  handlePlayerFaint() {
    this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} fainted.`);
    setTimeout(() => this.endBattle(false, false), 900);
  }

  endBattle(won, fled) {
    if (this.ended) return;
    this.ended = true;
    this.busy = true;
    if (this.onEnd) this.onEnd({ won, fled });
  }
}

window.Battle = Battle;
