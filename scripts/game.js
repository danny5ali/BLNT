// game.js — main controller, screen routing, state machine

const Game = {
  state: null,
  currentBattle: null,
  currentScreen: 'title',
  tempStarter: null,
  pendingGym: null,

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
    const mute = document.getElementById('mute-btn');
    if (mute) mute.addEventListener('click', () => Audio.toggleMute());

    document.getElementById('title-start').addEventListener('click', () => this.startColdOpen());
    document.getElementById('coldopen-strike').addEventListener('click', () => this.runColdOpenLoss());
    document.getElementById('title-card-continue').addEventListener('click', () => this.showScreen('trainer'));

    document.getElementById('trainer-submit').addEventListener('click', () => this.submitTrainer());
    document.getElementById('consent-toggle').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('unchecked');
    });

    document.querySelectorAll('#screen-starter .creature').forEach(el => {
      el.addEventListener('click', () => this.selectStarter(el.dataset.starter));
    });
    document.getElementById('starter-submit').addEventListener('click', () => this.confirmStarter());

    document.getElementById('map-enter').addEventListener('click', () => this.showLeaderReveal());
    document.getElementById('reveal-continue').addEventListener('click', () => this.startBattleNow());

    document.getElementById('loss-share').addEventListener('click', () => this.shareLoss());
    document.getElementById('loss-again').addEventListener('click', () => this.playAgain());
    document.getElementById('loss-resume').addEventListener('click', () => this.resumeRun());
    document.getElementById('loss-exit').addEventListener('click', () => this.exitToTitle());
    document.getElementById('loss-album').addEventListener('click', () => {
      window.open(window.GAME_DATA.ALBUM.link, '_blank');
    });

    document.getElementById('champ-share').addEventListener('click', () => this.shareWin());
    document.getElementById('champ-exit').addEventListener('click', () => this.exitToTitle());
  },

  // ============= COLD OPEN =============
  startColdOpen() {
    // unmute on first user interaction (press start is a tap/click — safe for autoplay)
    // showScreen will trigger the actual play call so we just need to unmute the flag here
    if (AudioPlayer.muted) {
      AudioPlayer.muted = false;
      const state = State.load();
      state.audioMuted = false;
      State.save(state);
      AudioPlayer.updateButton();
    }
    this.showScreen('coldopen');
    const lines = [
      'you don\'t remember how you got here.',
      'the walls are closer than they were a minute ago.',
      'a wild thing appeared.'
    ];
    const narrationEl = document.getElementById('coldopen-narration');
    const wildEl = document.getElementById('coldopen-wild');
    const battleEl = document.getElementById('coldopen-battle');
    narrationEl.style.display = 'block';
    narrationEl.innerHTML = '';
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
          setTimeout(() => { battleEl.style.display = 'flex'; }, 1200);
        }, 1500);
      }
    };
    showNext();
  },

  runColdOpenLoss() {
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

    document.getElementById('trainer-name').classList.remove('error');
    document.getElementById('trainer-email').classList.remove('error');

    if (!name) {
      document.getElementById('trainer-name').classList.add('error');
      Toast.show('we need to know what to call you');
      return;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      document.getElementById('trainer-email').classList.add('error');
      Toast.show('we need a real email');
      return;
    }
    if (!consent) {
      Toast.show('check the box first');
      return;
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
    State.save(this.state);

    // write to supabase — this is the email capture moment
    DB.recordPlay(this.state.name, this.state.email, this.tempStarter).catch(() => {});

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

    const badgesEl = document.getElementById('map-badges');
    badgesEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('span');
      b.className = 'b';
      if (i < this.state.badges) b.classList.add('lit');
      else if (i === this.state.badges) b.classList.add('curr');
      badgesEl.appendChild(b);
    }

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

  // ============= LEADER REVEAL =============
  showLeaderReveal() {
    const gym = window.GAME_DATA.GYMS[this.state.badges];
    if (!gym) return;
    this.pendingGym = gym;

    document.getElementById('reveal-gym-num').textContent = `gym ${gym.num} / 6`;
    document.getElementById('reveal-track').textContent = `track ${String(gym.trackNum).padStart(2, '0')}`;
    document.getElementById('reveal-leader-img').src = gym.leaderSprite;
    document.getElementById('reveal-leader-name').textContent = gym.leader.toLowerCase();
    document.getElementById('reveal-quote').innerHTML = gym.intro
      ? `<em>${gym.intro.replace(/\n/g, '<br>')}</em>`
      : '';
    document.getElementById('reveal-quote-line').textContent = gym.quote || '';

    this.showScreen('reveal');

    // auto-continue after 5s if user doesn't tap
    if (this.revealTimer) clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => {
      if (this.currentScreen === 'reveal') this.startBattleNow();
    }, 6000);
  },

  startBattleNow() {
    if (this.revealTimer) clearTimeout(this.revealTimer);
    if (!this.pendingGym) return;
    this.startBattle(this.pendingGym);
    this.pendingGym = null;
  },

  // ============= BATTLE =============
  startBattle(gym) {
    const starter = window.GAME_DATA.STARTERS.find(s => s.id === this.state.starter);
    const playerCreature = {
      ...starter,
      stats: { ...starter.stats }
    };
    if (this.state.badges > 0) {
      const lvlBonus = this.state.badges * 4;
      playerCreature.stats.hp += lvlBonus;
      playerCreature.stats.atk += this.state.badges;
    }

    this.showScreen('battle');
    document.getElementById('battle-gym-num').textContent = `gym ${gym.num} / 6`;
    document.getElementById('battle-gym-name').textContent = gym.name;
    document.getElementById('battle-log').innerHTML = '';

    this.currentBattle = new window.Battle(
      playerCreature,
      gym,
      (msg) => this.appendLog(msg),
      () => this.renderBattle(),
      ({ won, fled }) => this.endBattle(won, fled)
    );

    this.renderBattle(); // initial render

    setTimeout(() => {
      this.currentBattle.start();
    }, 400);

    document.querySelectorAll('#battle-moves .move').forEach(b => {
      b.onclick = () => {
        const move = b.dataset.move;
        if (this.currentBattle) this.currentBattle.playerMove(move);
      };
    });
  },

  appendLog(msg) {
    const log = document.getElementById('battle-log');
    const p = document.createElement('p');
    p.innerHTML = msg;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 5) log.removeChild(log.firstChild);
  },

  renderBattle() {
    const b = this.currentBattle;
    if (!b) return;

    document.getElementById('opp-name').textContent = b.opponent.name.toLowerCase();
    document.getElementById('opp-lvl').textContent = `l${10 + this.state.badges * 2}`;
    document.getElementById('opp-role').textContent = `${b.gym.leader} sends`;
    const oppSprite = document.querySelector('.combatant.opp .sprite-box img');
    if (oppSprite) oppSprite.src = b.opponent.sprite || 'assets/butterfly.png';
    this.updateHp('opp', b.opponent);

    const oppBox = document.querySelector('.combatant.opp .sprite-box');
    if (oppBox) {
      if (b.opponent.currentHp <= 0) oppBox.classList.add('faint');
      else oppBox.classList.remove('faint');
    }

    document.getElementById('you-name').textContent = b.player.name.toLowerCase();
    document.getElementById('you-lvl').textContent = `l${8 + this.state.badges * 2}`;
    const youSprite = document.querySelector('.combatant.you .sprite-box img');
    if (youSprite) youSprite.src = b.player.sprite || 'assets/butterfly.png';
    this.updateHp('you', b.player);

    const youBox = document.querySelector('.combatant.you .sprite-box');
    if (youBox) {
      if (b.player.currentHp <= 0) youBox.classList.add('faint');
      else youBox.classList.remove('faint');
    }

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
    this.currentBattle = null;

    if (won) {
      this.state.badges += 1;
      const gymJustCleared = this.state.badges;
      State.save(this.state);

      // record locally first (instant) — supabase is fire-and-forget
      const prize = window.GAME_DATA.PRIZES.find(p => p.gym === gymJustCleared);
      let prizeWon = null;

      if (prize) {
        // check locally first: did this email already win this prize?
        const alreadyWon = (this.state.prizesAwarded || []).some(
          a => a.id === prize.id && a.email === this.state.email
        );

        if (!alreadyWon) {
          this.state.prizesAwarded = this.state.prizesAwarded || [];
          this.state.prizesAwarded.push({
            id: prize.id, gym: prize.gym, name: prize.name,
            email: this.state.email, winnerName: this.state.name,
            time: Date.now(), sent: false
          });
          if (prize.limited) {
            this.state.prizesClaimed = this.state.prizesClaimed || [];
            this.state.prizesClaimed.push({ id: prize.id });
          }
          State.save(this.state);
          prizeWon = prize;

          // fire-and-forget to supabase (won't block UI)
          if (window.DB) {
            DB.awardPrize(prize, this.state.name, this.state.email).catch(() => {});
          }
        }
      }

      this.lastPrizeWon = prizeWon;
      this.continueAfterWin(gymJustCleared);
    } else {
      this.handleLoss();
    }
  },

  continueAfterWin(gymCleared) {
    const prize = this.lastPrizeWon;
    if (gymCleared >= 6) {
      this.handleChampion(prize);
    } else {
      if (prize) {
        Toast.show(`▸ won ${prize.name}!`, 3500);
      } else {
        Toast.show(`gym cleared. badge earned.`);
      }
      setTimeout(() => {
        this.showScreen('map');
        this.updateMap();
      }, 2000);
    }
  },

  // ============= LOSS =============
  handleLoss() {
    const fellAtGym = this.state.badges + 1;
    const badgesAchieved = this.state.badges;
    const checkpointGym = window.GAME_DATA.CHECKPOINT_GYM;

    this.state.fallenLog.push({
      name: this.state.name,
      gym: fellAtGym,
      time: Date.now()
    });

    // write fall to supabase for funnel tracking
    DB.recordFall(this.state.name, this.state.email, fellAtGym).catch(() => {});

    // resume mechanic: if fell at gym 4+, save checkpoint
    // checkpoint preserves: badges (gym 3 cleared = badges 3), starter
    const canResume = fellAtGym >= checkpointGym;
    if (canResume) {
      this.state.checkpoint = {
        badges: badgesAchieved,
        starter: this.state.starter,
        savedAt: Date.now()
      };
    } else {
      // gyms 1-3 — full reset
      this.state.checkpoint = null;
    }

    // reset badges in main state (they live in checkpoint if resumable)
    this.state.badges = 0;
    State.save(this.state);

    // populate loss screen
    document.getElementById('loss-creature').textContent = (this.state.starter || '').toLowerCase();
    document.getElementById('loss-gym-num').textContent = `gym ${fellAtGym}`;
    document.getElementById('loss-card-num').textContent = `#${String(this.state.runs).padStart(6, '0')}`;
    document.getElementById('loss-cleared').textContent = `${badgesAchieved} / 6 cleared`;

    const lore = window.GAME_DATA.LOSS_LORE[Math.floor(Math.random() * window.GAME_DATA.LOSS_LORE.length)];
    document.getElementById('loss-lore').textContent = lore;
    this.lastLore = lore;

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

    // toggle button visibility based on resume eligibility
    const resumeBtn = document.getElementById('loss-resume');
    const againBtn = document.getElementById('loss-again');
    if (canResume) {
      resumeBtn.style.display = '';
      againBtn.style.display = 'none';
    } else {
      resumeBtn.style.display = 'none';
      againBtn.style.display = '';
    }

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
    // full restart from starter selection (gyms 1-3 fall, or "play again" choice)
    this.state.checkpoint = null;
    State.save(this.state);
    this.showScreen('starter');
  },

  resumeRun() {
    // restore badges from checkpoint, jump back to map
    if (!State.hasCheckpoint(this.state)) {
      Toast.show('no checkpoint to resume');
      this.showScreen('starter');
      return;
    }
    this.state.badges = this.state.checkpoint.badges;
    this.state.starter = this.state.checkpoint.starter;
    State.save(this.state);
    this.showScreen('map');
    this.updateMap();
    Toast.show(`▸ run resumed at gym ${this.state.badges + 1}`);
  },

  exitToTitle() {
    this.showScreen('title');
    this.updateMetaScreens();
  },

  // ============= CHAMPION =============
  handleChampion(prizeWon) {
    // prizeWon is the gym 6 prize (lifetime show entry), already awarded by endBattle
    // clear checkpoint since we cleared the run
    this.state.checkpoint = null;
    State.save(this.state);
    this.showChampion(prizeWon);
  },

  showChampion(prize) {
    document.getElementById('champ-runs').textContent = String(this.state.runs).padStart(2, '0');
    document.getElementById('champ-starter').textContent = (this.state.starter || '').toLowerCase();

    if (prize) {
      document.getElementById('champ-prize-name').textContent = prize.name;
      const remaining = State.prizesRemaining(this.state);
      document.getElementById('champ-prize-meta').innerHTML = `champion of aliworld<span class="red">${remaining === 0 ? 'last prize claimed' : `${remaining} prizes left in pool`}</span>`;
      document.getElementById('champ-email-conf').innerHTML = `we'll reach <strong>${this.state.email}</strong> within 24 hours.`;
    } else {
      document.getElementById('champ-prize-name').textContent = 'aliworld respect';
      document.getElementById('champ-prize-meta').innerHTML = `the show entry was already claimed<span class="red">but you cleared it anyway</span>`;
      document.getElementById('champ-email-conf').innerHTML = `<em>thank you for playing.</em>`;
    }

    this.showScreen('champion');
  },

  shareWin() {
    const lastPrize = this.lastPrizeWon || (this.state.prizesAwarded[this.state.prizesAwarded.length - 1]);
    Share.share('champion', {
      name: this.state.name,
      prize: lastPrize ? lastPrize.name : 'champion',
      runId: String(this.state.runs).padStart(3, '0')
    });
  },

  updateMetaScreens() {
    const remaining = State.prizesRemaining(this.state);
    const prizeText = remaining === 0
      ? 'all limited prizes claimed · play for fun'
      : `6 gyms · 6 prizes · ${remaining} limited remaining`;
    const titleFoot = document.getElementById('title-foot');
    if (titleFoot) titleFoot.textContent = prizeText;

    // next prize on trainer card = the prize for gym 1 (always available — unlimited)
    const trainerNext = document.getElementById('trainer-next');
    if (trainerNext) {
      const gym1Prize = State.prizeForGym(1);
      trainerNext.innerHTML = `gym 1 reward · <span class="red">${gym1Prize.name}</span>`;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});

window.Game = Game;
