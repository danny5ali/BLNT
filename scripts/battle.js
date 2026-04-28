// battle.js — battle system, rewritten for clarity and to fix hang bugs

class Battle {
  constructor(playerCreature, gym, log, onUpdate, onEnd) {
    this.gym = gym;
    this.log = log;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;

    this.player = this.makeCombatant(playerCreature);
    this.opponents = [this.makeOpponent(gym.creature)];
    if (gym.creature2) {
      this.opponents.push(this.makeOpponent(gym.creature2));
    }
    this.currentOpp = 0;
    this.busy = true; // start busy until intro finishes
    this.ended = false;
  }

  makeCombatant(c) {
    return {
      name: c.name,
      sprite: c.sprite,
      stats: { ...c.stats },
      currentHp: c.stats.hp,
      maxHp: c.stats.hp,
      slipping: false,
      charged: false
    };
  }

  makeOpponent(creatureData) {
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
    return this.makeCombatant(creatureData);
  }

  get opponent() {
    return this.opponents[this.currentOpp];
  }

  start() {
    this.busy = true;
    this.log(`<span class="arrow">▸</span>${this.gym.leader} sent out ${this.opponent.name.toLowerCase()}.`);
    if (this.gym.quote) {
      setTimeout(() => this.log(`<span class="dim">${this.gym.quote.toLowerCase()}</span>`), 600);
      setTimeout(() => {
        this.log(`<span class="dim">what will you do?</span>`);
        this.busy = false;
        this.onUpdate();
      }, 1300);
    } else {
      setTimeout(() => {
        this.log(`<span class="dim">what will you do?</span>`);
        this.busy = false;
        this.onUpdate();
      }, 900);
    }
  }

  playerMove(moveId) {
    if (this.busy || this.ended) return;
    this.busy = true;
    this.onUpdate();

    const move = window.GAME_DATA.MOVES[moveId];

    if (move.isFlee) {
      this.log(`<span class="arrow">▸</span>you folded.`);
      this.scheduleEnd(false, true, 800);
      return;
    }

    const playerFirst = this.player.stats.spd >= this.opponent.stats.spd;

    if (playerFirst) {
      this.doPlayerTurn(move, () => {
        if (this.checkBattleEnd()) return;
        this.doOpponentTurn(() => {
          if (this.checkBattleEnd()) return;
          this.endTurn();
        });
      });
    } else {
      this.doOpponentTurn(() => {
        if (this.checkBattleEnd()) return;
        this.doPlayerTurn(move, () => {
          if (this.checkBattleEnd()) return;
          this.endTurn();
        });
      });
    }
  }

  doPlayerTurn(move, done) {
    if (move.isDodge) {
      this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} slipped into the shadows.`);
      this.player.slipping = true;
      this.onUpdate();
      setTimeout(done, 700);
      return;
    }
    if (move.isCharge) {
      this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} locked in.`);
      this.player.charged = true;
      this.onUpdate();
      setTimeout(done, 700);
      return;
    }
    this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} used strike.`);
    setTimeout(() => {
      const result = this.calcDamage(this.player, this.opponent, move);
      if (result.hit) {
        let dmg = result.dmg;
        if (this.opponent.slipping) {
          dmg = Math.floor(dmg / 2);
          this.opponent.slipping = false;
        }
        this.opponent.currentHp = Math.max(0, this.opponent.currentHp - dmg);
        this.shake('opp');
        if (result.crit) {
          this.log(`<span class="arrow">▸</span>critical. ${dmg} dmg.`);
        } else {
          this.log(`<span class="arrow">▸</span>it landed. ${dmg} dmg.`);
        }
      } else {
        this.log(`<span class="arrow">▸</span>it didn't land.`);
      }
      this.player.charged = false;
      this.onUpdate();
      setTimeout(done, 700);
    }, 500);
  }

  doOpponentTurn(done) {
    const move = this.pickAiMove();

    if (move === 'dodge') {
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} slipped.`);
      this.opponent.slipping = true;
      this.onUpdate();
      setTimeout(done, 700);
      return;
    }
    if (move === 'charge') {
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} locked in.`);
      this.opponent.charged = true;
      this.onUpdate();
      setTimeout(done, 700);
      return;
    }
    if (move === 'heal') {
      const heal = Math.floor(this.opponent.maxHp * 0.25);
      this.opponent.currentHp = Math.min(this.opponent.maxHp, this.opponent.currentHp + heal);
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} regrouped. +${heal} hp.`);
      this.onUpdate();
      setTimeout(done, 700);
      return;
    }
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
      setTimeout(done, 700);
    }, 500);
  }

  checkBattleEnd() {
    if (this.ended) return true;

    if (this.opponent.currentHp <= 0) {
      this.log(`<span class="arrow">▸</span>${this.opponent.name.toLowerCase()} fainted.`);
      if (this.currentOpp + 1 < this.opponents.length) {
        this.currentOpp++;
        setTimeout(() => {
          this.log(`<span class="arrow">▸</span>${this.gym.leader} sent out ${this.opponent.name.toLowerCase()}.`);
          this.busy = false;
          this.onUpdate();
        }, 1100);
        return true;
      }
      this.scheduleEnd(true, false, 1000);
      return true;
    }

    if (this.player.currentHp <= 0) {
      this.log(`<span class="arrow">▸</span>${this.player.name.toLowerCase()} fainted.`);
      this.scheduleEnd(false, false, 1000);
      return true;
    }

    return false;
  }

  endTurn() {
    this.busy = false;
    this.onUpdate();
  }

  scheduleEnd(won, fled, delay) {
    if (this.ended) return;
    this.ended = true;
    this.busy = true;
    this.onUpdate();
    setTimeout(() => {
      if (this.onEnd) this.onEnd({ won, fled });
    }, delay);
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

    let willHit = Math.random() < hitChance;
    let multiplier = 1;
    if (attacker.charged) {
      willHit = true;
      multiplier = 1.5;
    }

    if (!willHit) return { hit: false, dmg: 0, crit: false };

    let baseDmg = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
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
}

window.Battle = Battle;
