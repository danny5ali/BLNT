// game.js — main game controller, screen routing, state machine

const Game = {
  state: null,
  currentBattle: null,
  currentScreen: 'title',

  init() {
    this.state = State.load();
    Audio.init();
    this.bindEvents();
    this.showScreen('title');
    this.updateMetaScreens();
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + name);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = name;
      window.scrollTo(0, 0);
      // play music for screen
      const audioMap = {
        coldopen: 'coldopen',
        title: 'ambient',
        trainer: 'trainer',
        starter: 'starter',
        map: 'map',
        loss: 'ambient',
        champion: 'ambient'
      };
      if (audioMap[name]) Audio.play(audioMap[name]);
    }
  },

  bindEvents() {
    // mute button
    const mute = document.getElementById('mute-btn');
    if (mute) mute.addEventListener('click', () => Audio.toggleMute());

    // title screen → cold open (the "press start" experience)
    document.getElementById('title-start').addEventListener('click', () => {
      this.startColdOpen();
    });

    // cold open: only strike is enabled, the player loses on purpose
    document.getElementById('coldopen-strike').addEventListener('click', () => {
      this.runColdOpenLoss();
    });

    // after cold open title card, fade to trainer
    document.getElementById('title-card-continue').addEventListener('click', () => {
      this.showScreen('trainer');
    });

    // trainer card submission
    document.getElementById('trainer-submit').addEventListener('click', () => {
      this.submitTrainer();
    });
    document.getElementById('consent-toggle').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('unchecked');
    });

    // starter selection
    document.querySelectorAll('#screen-starter .creature').forEach(el => {
      el.addEventListener('click', () => this.selectStarter(el.dataset.starter));
    });
    document.getElementById('starter-submit').addEventListener('click', () => {
      this.confirmStarter();
    });

    // world map → enter current gym
    document.getElementById('map-enter').addEventListener('click', () => {
      this.enterCurrentGym();
    });

    // loss screen
    document.getElementById('loss-share').addEventListener('click', () => this.shareLoss());
    document.getElementById('loss-again').addEventListener('click', () => this.playAgain());
    document.getElementById('loss-exit').addEventListener('click', () => this.exitToTitle());

    // champion screen
    document.getElementById('champ-share').addEventListener('click', () => this.shareWin());
    document.getElementById('champ-exit').addEventListener('click', () => this.exitToTitle());
  },

  // ============= COLD OPEN =============
  startColdOpen() {
    this.showScreen('coldopen');
    // narration sequence
    const lines = [
      'you don\'t remember how you got here.',
      'the walls are closer than they were a minute ago.',
      'a wild thing appeared.'
    ];
    const narrationEl = document.getElementById('coldopen-narration');
    const wildEl = document.getElementById('coldopen-wild');
    const battleEl = document.getElementById('coldopen-battle');
    narrationEl.style.display = 'block';
    wildEl.style.display = 'none';
    battleEl.style.display = 'none';

    let i = 0;
    const showNext = () => {
      if (i < lines.length - 1) {
        narrationEl.innerHTML = lines.slice(0, i + 1).join('<br><br>');
        i++;
        setTimeout(showNext, 1800);
      } else {
        narrationEl.innerHTML = lines.slice(0, 2).join('<br><br>');
        setTimeout(() => {
          narrationEl.style.display = 'none';
          wildEl.style.display = 'flex';
          setTimeout(() => {
            battleEl.style.display = 'flex';
          }, 1200);
        }, 1500);
      }
    };
    showNext();
  },

  runColdOpenLoss() {
    // player is going to lose. animate hp draining.
    const battleEl = document.getElementById('coldopen-battle');
    battleEl.innerHTML = `
      <div class="hp-row">
        <span>you</span>
        <span class="red">hp critical</span>
      </div>
      <div class="hp-bar" style="--hp: 12%"></div>
      <p style="font-family: 'Press Start 2P', monospace; font-size: 10px; color: #ebe2d2; letter-spacing: 1px; line-height: 1.7; margin-top: 16px;">
        <span style="color: #b32a1f;">▸</span> you used strike.<br>
        <span style="color: #b32a1f;">▸</span> it didn't land.<br>
        <span style="color: #b32a1f;">▸</span> you ran out of luck.
      </p>
    `;
    setTimeout(() => {
      this.showScreen('titlecard');
      setTimeout(() => {
        document.getElementById('title-card-continue').style.opacity = 1;
      }, 2500);
    }, 2800);
  },

  // ============= TRAINER REGISTRATION =============
  submitTrainer() {
    const name = document.getElementById('trainer-name').value.trim();
    const email = document.getElementById('trainer-email').value.trim();
    const consent = !document.getElementById('consent-toggle').classList.contains('unchecked');

    if (!name) {
      document.getElementById('trainer-name').classList.add('error');
      Toast.show('we need to know what to call you');
      return;
    }
    if (!email || !email.includes('@')) {
      document.getElementById('trainer-email').classList.add('error');
      Toast.show('we need a real email');
      return;
    }
    if (!consent) {
      Toast.show('check the box first');
      return;
    }

    // check if email already won
    if (State.emailHasWon(this.state, email)) {
      Toast.show(`your luck has already turned, ${name.toLowerCase()}.`);
      return;
    }

    // check if all prizes claimed
    if (State.prizesRemaining(this.state) === 0) {
      Toast.show('all prizes claimed. play for the experience.');
    }

    this.state.name = name;
    this.state.email = email;
    State.save(this.state);

    this.showScreen('starter');
  },

  // ============= STARTER SELECTION =============
  selectStarter(id) {
    document.querySelectorAll('#screen-starter .creature').forEach(c => c.classList.remove('selected'));
    document.querySelector(`#screen-starter .creature[data-starter="${id}"]`).classList.add('selected');
    document.getElementById('starter-pick').textContent = id;
    document.getElementById('starter-submit').textContent = `▸ begin with ${id}`;
    this.tempStarter = id;
  },

  confirmStarter() {
    if (!this.tempStarter) {
      Toast.show('choose one');
      return;
    }
    this.state.starter = this.tempStarter;
    this.state.runs += 1;
    this.state.badges = 0;
    this.state.runId = (this.state.runId || 1);
    State.save(this.state);
    this.showScreen('map');
    this.updateMap();
  },

  // ============= WORLD MAP =============
  updateMap() {
    const gymList = document.getElementById('map-gyms');
    gymList.innerHTML = '';
    window.GAME_DATA.GYMS.forEach((gym, i) => {
      const cleared = i < this.state.badges;
      const current = i === this.state.badges;
      const locked = i > this.state.badges;
      const cls = cleared ? 'cleared' : current ? 'current' : 'locked';
      const numStr = String(gym.num).padStart(2, '0');

      const div = document.createElement('div');
      div.className = `gym ${cls}`;
      div.innerHTML = `
        <div class="node">${numStr}</div>
        <div class="gym-info">
          <div class="gym-num">gym ${gym.num}${current ? ' · now' : ''}${i === 5 ? ' · final' : ''}</div>
          <div class="gym-name">${gym.name}</div>
          <div class="gym-leader">${cleared ? 'defeated · ' : current ? '' : 'locked · '}${gym.leader === 'danny ali' && locked ? '???' : gym.leader}</div>
        </div>
        <div class="gym-track">track<span class="num">${String(gym.trackNum).padStart(2, '0')}</span></div>
      `;
      gymList.appendChild(div);
    });

    // badges progress strip
    const badgesEl = document.getElementById('map-badges');
    badgesEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('span');
      b.className = 'b';
      if (i < this.state.badges) b.classList.add('lit');
      else if (i === this.state.badges) b.classList.add('curr');
      badgesEl.appendChild(b);
    }

    // headline = current gym's name + track
    const cur = window.GAME_DATA.GYMS[this.state.badges];
    if (cur) {
      document.getElementById('map-title').textContent = cur.name;
      document.getElementById('map-track').textContent = `▸ track ${String(cur.trackNum).padStart(2, '0')} · "${cur.track}"`;
      document.getElementById('map-message').textContent = this.state.badges === 0
        ? 'six gyms stand between you and danny.'
        : this.state.badges === 5
        ? 'one fight left. danny is waiting.'
        : `${cur.leader} is already moving.`;
      document.getElementById('map-enter').textContent = `▸ enter gym ${cur.num}`;
    }
  },

  enterCurrentGym() {
    const gym = window.GAME_DATA.GYMS[this.state.badges];
    if (!gym) return;
    this.startBattle(gym);
  },

  // ============= BATTLE =============
  startBattle(gym) {
    const starter = window.GAME_DATA.STARTERS.find(s => s.id === this.state.starter);
    // restore some HP between gyms (60% restore)
    const playerCreature = {
      ...starter,
      stats: { ...starter.stats }
    };
    // if not first gym, scale player level up and apply partial heal
    if (this.state.badges > 0) {
      const lvlBonus = this.state.badges * 4;
      playerCreature.stats.hp += lvlBonus;
      playerCreature.stats.atk += this.state.badges;
    }

    this.showScreen('battle');
    document.getElementById('battle-gym-num').textContent = `gym ${gym.num} / 6`;
    document.getElementById('battle-gym-name').textContent = gym.name;
    document.getElementById('battle-log').innerHTML = '';

    // log the intro
    if (gym.intro) {
      const lines = gym.intro.split('\n');
      lines.forEach((line, i) => {
        setTimeout(() => {
          this.appendLog(`<span class="dim">${line}</span>`);
        }, i * 600);
      });
    }

    this.currentBattle = new window.Battle(
      playerCreature,
      gym,
      (msg) => this.appendLog(msg),
      () => this.renderBattle(),
      ({ won, fled }) => this.endBattle(won, fled)
    );

    setTimeout(() => {
      this.currentBattle.start();
      this.renderBattle();
    }, gym.intro ? gym.intro.split('\n').length * 600 + 200 : 200);

    // bind move buttons
    document.querySelectorAll('#battle-moves .move').forEach(b => {
      b.onclick = () => {
        const move = b.dataset.move;
        this.currentBattle.playerMove(move);
      };
    });
  },

  appendLog(msg) {
    const log = document.getElementById('battle-log');
    const p = document.createElement('p');
    p.innerHTML = msg;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    // keep last 5 lines
    while (log.children.length > 5) log.removeChild(log.firstChild);
  },

  renderBattle() {
    const b = this.currentBattle;
    if (!b) return;

    // opponent
    document.getElementById('opp-name').textContent = b.opponent.name.toLowerCase();
    document.getElementById('opp-lvl').textContent = `l${10 + this.state.badges * 2}`;
    document.getElementById('opp-role').textContent = `${b.gym.leader} sends`;
    const oppSprite = document.querySelector('.combatant.opp .sprite-box img');
    if (oppSprite) oppSprite.src = b.opponent.sprite || 'assets/butterfly.png';
    this.updateHp('opp', b.opponent);

    // player
    document.getElementById('you-name').textContent = b.player.name.toLowerCase();
    document.getElementById('you-lvl').textContent = `l${8 + this.state.badges * 2}`;
    const youSprite = document.querySelector('.combatant.you .sprite-box img');
    if (youSprite) youSprite.src = b.player.sprite || 'assets/butterfly.png';
    this.updateHp('you', b.player);

    // disable moves while busy
    document.querySelectorAll('#battle-moves .move').forEach(b2 => {
      b2.disabled = b.busy;
    });
  },

  updateHp(target, creature) {
    const fillEl = document.getElementById(`${target}-hp-fill`);
    const textEl = document.getElementById(`${target}-hp-text`);
    if (fillEl) {
      const pct = (creature.currentHp / creature.maxHp) * 100;
      fillEl.style.width = pct + '%';
      fillEl.classList.remove('medium', 'low');
      if (pct < 25) fillEl.classList.add('low');
      else if (pct < 50) fillEl.classList.add('medium');
    }
    if (textEl) {
      textEl.textContent = `${creature.currentHp} / ${creature.maxHp}`;
    }
  },

  endBattle(won, fled) {
    if (won) {
      this.state.badges += 1;
      State.save(this.state);

      if (this.state.badges >= 6) {
        // CHAMPION
        this.handleChampion();
      } else {
        // gym cleared, return to map
        Toast.show(`gym cleared. badge earned.`);
        setTimeout(() => {
          this.showScreen('map');
          this.updateMap();
        }, 1600);
      }
    } else {
      // lost or fled
      this.handleLoss();
    }
  },

  // ============= LOSS =============
  handleLoss() {
    const fellAtGym = this.state.badges + 1;
    // log the fallen for the dashboard
    this.state.fallenLog.push({
      name: this.state.name,
      gym: fellAtGym,
      time: Date.now()
    });
    // reset badges (run is over)
    const badgesAchieved = this.state.badges;
    this.state.badges = 0;
    State.save(this.state);

    // show loss
    document.getElementById('loss-creature').textContent = (this.state.starter || '').toLowerCase();
    document.getElementById('loss-gym-num').textContent = `gym ${fellAtGym}`;
    document.getElementById('loss-card-num').textContent = `#${String(this.state.runs).padStart(6, '0')}`;
    document.getElementById('loss-cleared').textContent = `${badgesAchieved} / 6 cleared`;

    // rotate lore line
    const lore = window.GAME_DATA.LOSS_LORE[Math.floor(Math.random() * window.GAME_DATA.LOSS_LORE.length)];
    document.getElementById('loss-lore').textContent = lore;
    this.lastLore = lore;

    // render badges row
    const row = document.getElementById('loss-badges');
    row.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const span = document.createElement('span');
      span.className = 'b-card';
      if (i < badgesAchieved) span.classList.add('lit');
      else if (i === badgesAchieved) span.classList.add('fell');
      else span.classList.add('dim');
      row.appendChild(span);
    }

    this.lastFellAt = fellAtGym;
    this.lastBadges = badgesAchieved;

    this.showScreen('loss');
  },

  shareLoss() {
    Share.share('loss', {
      name: this.state.name,
      gym: this.lastFellAt,
      badges: this.lastBadges,
      lore: this.lastLore,
      runId: String(this.state.runs).padStart(3, '0')
    });
  },

  playAgain() {
    if (State.prizesRemaining(this.state) === 0) {
      Toast.show('all prizes claimed. you can still play.');
    }
    this.showScreen('starter');
  },

  exitToTitle() {
    this.showScreen('title');
    this.updateMetaScreens();
  },

  // ============= CHAMPION =============
  handleChampion() {
    const nextPrize = State.nextPrize(this.state);
    if (!nextPrize) {
      // no prize left, but they still cleared aliworld
      this.showChampion(null);
      return;
    }

    // claim the prize
    const prizeWon = { ...nextPrize, claimedBy: this.state.email, claimedAt: Date.now() };
    this.state.prizesClaimed.push(prizeWon);
    this.state.winners.push({
      name: this.state.name,
      email: this.state.email,
      prize: nextPrize.name,
      prizeId: nextPrize.id,
      time: Date.now()
    });
    State.save(this.state);

    this.showChampion(nextPrize);
  },

  showChampion(prize) {
    document.getElementById('champ-runs').textContent = String(this.state.runs).padStart(2, '0');
    document.getElementById('champ-starter').textContent = (this.state.starter || '').toLowerCase();

    if (prize) {
      document.getElementById('champ-prize-name').textContent = prize.name;
      const remaining = State.prizesRemaining(this.state);
      document.getElementById('champ-prize-meta').innerHTML = `one of five prizes<span class="red">${remaining === 0 ? 'last one claimed' : `${remaining} left`}</span>`;
      document.getElementById('champ-email-conf').innerHTML = `we'll reach <strong>${this.state.email}</strong> within 24 hours.`;
    } else {
      document.getElementById('champ-prize-name').textContent = 'aliworld respect';
      document.getElementById('champ-prize-meta').innerHTML = `all prizes claimed<span class="red">but you cleared it anyway</span>`;
      document.getElementById('champ-email-conf').innerHTML = `<em>thank you for playing.</em>`;
    }

    this.showScreen('champion');
  },

  shareWin() {
    const lastPrize = this.state.prizesClaimed[this.state.prizesClaimed.length - 1];
    Share.share('champion', {
      name: this.state.name,
      prize: lastPrize ? lastPrize.name : 'champion',
      runId: String(this.state.runs).padStart(3, '0')
    });
  },

  // ============= META UPDATES (title screen, etc) =============
  updateMetaScreens() {
    const remaining = State.prizesRemaining(this.state);
    const nextPrize = State.nextPrize(this.state);
    const prizeText = remaining === 0
      ? 'all prizes claimed'
      : `${remaining} prizes · 6 gyms · one chance per trainer`;
    const titleFoot = document.getElementById('title-foot');
    if (titleFoot) titleFoot.textContent = prizeText;

    const trainerNext = document.getElementById('trainer-next');
    if (trainerNext && nextPrize) {
      trainerNext.innerHTML = `next prize · <span class="red">${nextPrize.name}</span>`;
    }
  }
};

// boot
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});

window.Game = Game;
