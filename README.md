# 🏈 Pick League

A simple site where kids pick winners each week and everyone can see the standings. Built as plain HTML/CSS/JS so it runs on GitHub Pages for free — no server to maintain.

Because GitHub Pages only serves files (it can't run a database), this uses **Firebase** (Google's free tier) to store players, matchups, and picks so everyone's browser sees the same data. Setup takes about 10–15 minutes, one time, and you'll never need to touch code again after that — just use the Admin page.

## What the site does

- **Make Picks** (`index.html`) — a kid types their name once, then picks a winner for each game each week.
- **Standings** (`standings.html`) — automatic leaderboard, plus a week-by-week results log.
- **Admin** (`admin.html`) — where *you* create each week's matchups and enter the real winners after games finish. Sign-in protected.

## Step 1 — Create a free Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with any Google account.
2. Click **Add project**, give it a name (e.g. "family-pick-league"), and finish the wizard (you can decline Google Analytics).
3. Once created, click the **`</>`** (web) icon on the project overview page to register a web app. Give it any nickname. You don't need Firebase Hosting.
4. Firebase will show you a `firebaseConfig` object with values like `apiKey`, `authDomain`, etc. Keep this tab open — you'll paste these into `config.js`.

## Step 2 — Turn on Firestore (the database)

1. In the left sidebar, click **Build → Firestore Database → Create database**.
2. Choose **Start in production mode**, pick any location close to you, and click Enable.
3. Click the **Rules** tab and replace the contents with this, then click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       match /players/{playerId} {
         allow read: if true;
         allow create: if request.auth != null
           && request.resource.data.pinHash is string;
         allow update: if request.auth.token.email in ['YOUR_ADMIN_EMAIL_HERE'];
         allow delete: if request.auth.token.email in ['YOUR_ADMIN_EMAIL_HERE'];
       }

       match /weeks/{weekId} {
         allow read: if true;
         allow write: if request.auth.token.email in ['YOUR_ADMIN_EMAIL_HERE'];
       }

       match /picks/{pickId} {
         allow read: if true;
         allow write: if request.auth != null
           && request.resource.data.playerId is string
           && request.resource.data.pinHash ==
                get(/databases/$(database)/documents/players/$(request.resource.data.playerId)).data.pinHash
           && !get(/databases/$(database)/documents/weeks/$(request.resource.data.weekId)).data.locked;
       }
     }
   }
   ```

   Replace `YOUR_ADMIN_EMAIL_HERE` with the email you'll use to sign in as admin (Step 3).

   How this protects picks: every kid sets a 6-digit PIN when they join. The site never stores or sends the PIN itself — only a scrambled (hashed) version. When someone saves picks, the rule above double-checks that the hash they sent matches the hash on file for that name before allowing the write, and it blocks all writes to a locked week. Setting a brand-new player's PIN, or an admin resetting a forgotten one, is allowed by the `create`/admin-`update` rules; a name's PIN can't otherwise be changed by someone who doesn't already know it.

## Step 3 — Turn on sign-in

1. In the sidebar, click **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous** (this lets kids use the site without creating accounts — it just quietly signs their browser in behind the scenes).
3. Also enable **Email/Password** — this is how *you* log into the Admin page.
4. Go to the **Users** tab and click **Add user**. Enter the same email/password you plan to use as admin, and make sure that email matches what you put in the Firestore rules above.

## Step 4 — Configure the site

Open `config.js` in this folder and fill in:

- The `FIREBASE_CONFIG` values from Step 1.
- `LEAGUE_NAME` — whatever you want shown on the scoreboard header.
- `ADMIN_EMAILS` — an array with the admin email from Step 3 (must match the Firestore rules exactly).

## Step 5 — Put it on GitHub Pages

1. Create a new **public** GitHub repository (private repos need a paid plan for Pages).
2. Upload all the files in this folder (`index.html`, `standings.html`, `admin.html`, `styles.css`, `common.js`, `config.js`) to the repo.
3. In the repo, go to **Settings → Pages**, set "Source" to your main branch (root), and save.
4. GitHub gives you a URL like `https://yourusername.github.io/your-repo-name/` within a minute or two. That's the link to share with the kids.

## Using it week to week

1. Go to `admin.html` on your site, sign in.
2. Click **Create a new week**, add each matchup (away team / home team), leave "winner" blank, and save. Leave "Locked" unchecked so kids can pick.
3. Share the site link. The first time, each kid types their name and sets their own 6-digit PIN — after that, they just pick their name and enter their PIN to make picks (the site remembers "unlocked" on their own device, so they usually won't be asked again there).
4. Once games are underway or the deadline passes, check **Locked** on that week and save — this freezes everyone's picks.
5. After games finish, go back into that week, set each matchup's winner (Away won / Home won), and save. Standings update automatically.
6. If a kid forgets their PIN, go to Admin → Roster and click **Reset PIN** next to their name — they'll be prompted to set a new one next time they pick.

## A couple of honest limitations

- This is built for a small, trusted group (family, friends, a classroom) — not the open internet. The PIN stops casual "I'll pick as my sister" mischief, and the security rules stop random strangers from editing weeks or winners, but a technically sophisticated kid poking at browser dev tools could still find ways around the PIN check. Good enough for a fun league; not bank-grade.
- Because there's no server, the PIN can't be fully hidden the way a real login system would hide a password — it's hashed (scrambled) rather than stored in plain text, but a determined, technical user could still work around it. For a family/friends league this trade-off is normally fine.
- Firebase's free "Spark" tier comfortably covers a league this size (reads/writes are counted, but you'd need a very large, very active league to hit any limits).
- If you ever want real accounts with true server-side verification, that's a bigger change (Firebase Auth per-kid + Cloud Functions) — happy to help with that later if you want it.
