# BETTER LUCK NEXT TIME — aliworld
## deploy, test, and reset guide

---

## step 1 — run supabase SQL

go to: https://supabase.com/dashboard/project/pplpihxmkucmmmkciypf/sql/new

paste the contents of `supabase-schema.sql` and click run.
tables created: plays, fallen_log, prizes_awarded.

---

## step 2 — add audio files

drop 11 mp3s into `/assets/audio/` with these exact filenames:

```
01-what-dreams-are-made-of.mp3
02-where-we-been.mp3
03-whats-yo-name.mp3
04-find-my-way.mp3
05-what-i-need.mp3
06-we-believe.mp3
07-hold-me-back.mp3
08-motion.mp3
09-cant-lose.mp3
10-doin-the-most.mp3
11-made-it-off-rap.mp3
```

---

## step 3 — push to github

open terminal (mac: cmd+space → terminal):

```bash
# clone your repo if you haven't already
git clone https://github.com/danny5ali/ali.git
cd ali

# copy all game files into the repo
# (drag everything from the dannyali-aliworld folder into the repo folder)

# commit and push
git add .
git commit -m "launch aliworld game"
git push origin main
```

---

## step 4 — enable github pages

1. go to https://github.com/danny5ali/ali/settings/pages
2. under "Source" select: Deploy from a branch
3. branch: main / folder: / (root)
4. click save
5. wait ~60 seconds
6. github will show your site URL (usually danny5ali.github.io/ali)

---

## step 5 — point play.dannyali.com at github

in your domain registrar (wherever dannyali.com DNS is managed):

add a CNAME record:
- name: `play`
- value: `danny5ali.github.io`
- TTL: 3600

DNS takes 5-60 minutes to propagate. check with: https://dnschecker.org

the CNAME file in this repo tells github to respond to play.dannyali.com.

---

## step 6 — change dashboard password

before launch, open `dashboard.html` and change line:

```js
const DASHBOARD_PASSWORD = 'aliworld2024';
```

to something stronger that only you and your team know.

---

## how to test before launch

1. open play.dannyali.com in a private/incognito window
2. play the game with a test email (e.g. yourname+test@gmail.com)
3. check supabase to confirm data was captured:
   - https://supabase.com/dashboard/project/pplpihxmkucmmmkciypf/editor
   - check the plays and prizes_awarded tables
4. open dashboard.html locally (or at play.dannyali.com/dashboard.html)
   - enter password: aliworld2024 (change this before launch)
   - verify your test email shows up in winners

---

## how to reset testers before launch

**reset a specific tester's data** (surgical):
go to supabase → SQL editor → run:

```sql
delete from plays where email = 'test@example.com';
delete from fallen_log where email = 'test@example.com';
delete from prizes_awarded where email = 'test@example.com';
```

**reset all data for clean launch** (nuclear):
go to supabase → SQL editor → run:

```sql
truncate plays;
truncate fallen_log;
truncate prizes_awarded;
```

also clear your own browser localStorage:
- open devtools (f12 or cmd+option+i)
- Application tab → Local Storage → right click blnt_state → delete

---

## dashboard

open: play.dannyali.com/dashboard.html
password: aliworld2024 (change before launch)

the dashboard auto-refreshes every 30 seconds.
use "▸ export csv" to download all emails at any time.
use "▸ send" on any winner to mark their prize as sent.
use "▸ swap" to change any prize (e.g. when album drops publicly).

---

## what's in this build

```
dannyali-aliworld/
├── index.html              the game
├── dashboard.html          admin back office
├── CNAME                   play.dannyali.com routing
├── supabase-schema.sql     run this once in supabase
├── styles/
│   ├── base.css
│   └── game.css
├── scripts/
│   ├── data.js             all game content (prizes, gyms, lore)
│   ├── supabase.js         database client
│   ├── support.js          state, audio, share
│   ├── battle.js           battle system + AI
│   └── game.js             main controller
└── assets/
    ├── butterfly.png
    ├── sprites/            16 character sprites
    └── audio/              drop 11 mp3s here
```
