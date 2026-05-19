# Algorithm a Day

A daily algorithm-reader. One lesson per day, Python code, an SVG visualization, a weekly quiz every seventh day. Progress syncs across devices via Firebase.

Designed to live on GitHub Pages — pure static HTML/CSS/JS, no build step.

---

## What you get

- **60 lessons** across two packs:
  - **Pack 1 — Foundations & Patterns** (days 1–30): two pointers, sliding window, hash maps, prefix sums, stacks, queues, recursion, merge/quick sort, heaps, linked lists, trees, BFS, DFS, binary search, backtracking, greedy, memoization, DP tabulation, knapsack, LCS, edit distance, union-find, Dijkstra, topological sort, tries, monotonic stack, bit manipulation, Floyd's cycle, Kadane's.
  - **Pack 2 — Advanced Algorithms** (days 31–60): Boyer-Moore voting, KMP, Rabin-Karp, Manacher's, Z-algorithm, segment trees, Fenwick trees, Floyd-Warshall, Bellman-Ford, A*, Tarjan's SCC, Kruskal's, Prim's, max flow, bipartite matching, convex hull, reservoir sampling, quickselect, suffix arrays, Aho-Corasick, find cycle start, LRU cache, Bloom filter, skip list, Catalan numbers, matrix exponentiation, Mo's algorithm, heavy-light decomposition, LCA via binary lifting, Sieve of Eratosthenes.
- **Daily unlock**: one button per calendar day.
- **Weekly quizzes**: every 7th day reviews the past week.
- **Streak counter** and stats.
- **Cross-device sync** via Firebase.
- **Export / import** progress as JSON.
- **Easy to extend**: drop in `curriculum-pack-3.json`, list it in `packs.json`, done — no code changes.

---

## Firebase setup (one-time, ~10 minutes)

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com). Sign in with a Google account.
2. Click **Add project**.
3. Name it `algo-daily`. Continue.
4. When asked about Google Analytics, **disable it**. Continue.
5. Wait ~30 seconds. Click **Continue** when ready.

### 2. Add a web app

1. On your project's overview page, click the **`</>`** icon (web app).
2. Nickname: anything (e.g. `algo-daily-web`).
3. **Do NOT check "Firebase Hosting."** You're using GitHub Pages.
4. Click **Register app**.
5. Copy the `firebaseConfig` object Firebase shows — you'll paste it into `app.js`.

   It looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "algo-daily-xxxxx.firebaseapp.com",
     projectId: "algo-daily-xxxxx",
     storageBucket: "algo-daily-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123def456"
   };
   ```

6. Click **Continue to console**.

### 3. Enable Email/Password authentication

1. Left sidebar → **Build → Authentication**.
2. Click **Get started**.
3. Click **Email/Password** in the providers list.
4. Toggle **Enable** ON. Leave "Email link" off.
5. **Save**.

### 4. Create the Firestore database

1. Left sidebar → **Build → Firestore Database**.
2. Click **Create database**.
3. Pick a location closest to you (cannot be changed later).
4. Choose **Start in production mode**. Click **Create**.
5. Wait ~30 seconds.

### 5. Set up Firestore security rules

1. In Firestore, click the **Rules** tab.
2. Replace everything with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /progress/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

3. Click **Publish**.

### 6. Paste your config into `app.js`

1. Open `app.js` in a text editor.
2. At the top, find the placeholder `firebaseConfig` object.
3. Replace it with the one from step 2.5.
4. Save.

---

## Running locally

Browsers block `fetch()` from `file://` URLs, so you need a local server:

```bash
cd algo-daily
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Deploy to GitHub Pages

1. Create a public GitHub repo, push these files to `main`.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch**, pick `main` and `/ (root)`. Save.
3. Site goes live at `https://<username>.github.io/<repo-name>/` within ~1 minute.

### Authorize your GitHub Pages domain in Firebase

After deploying:

1. Firebase console → **Authentication → Settings → Authorized domains**.
2. **Add domain** → enter `<username>.github.io` (no `https://`, no path).

Otherwise auth works locally but fails on the deployed site.

---

## How the curriculum packs work

The app loads `packs.json` first to find out which curriculum files exist. Each pack is a separate JSON file.

**File structure:**
```
packs.json                     ← index, lists all packs
curriculum-pack-1.json         ← 30 foundational algorithms (days 1–30)
curriculum-pack-2.json         ← 30 advanced algorithms (days 31–60)
```

**`packs.json`** looks like:
```json
{
  "packs": [
    { "id": "pack-1", "name": "Foundations & Patterns", "file": "curriculum-pack-1.json" },
    { "id": "pack-2", "name": "Advanced Algorithms",    "file": "curriculum-pack-2.json" }
  ]
}
```

When you finish pack 1, pack 2 starts automatically — no flag-flipping, no signin. The masthead subtitle shows which pack you're currently in.

---

## Adding more algorithms (pack 3, pack 4, etc.)

Three steps, ~5 minutes:

### 1. Create the new pack file

Make `curriculum-pack-3.json` (or whatever number) with the same shape as the existing packs. Each algorithm needs a **unique numeric ID** — start at 61 since packs 1–2 used 1–60.

Example minimal entry:

```json
[
  {
    "id": 61,
    "name": "Your New Algorithm",
    "difficulty": "medium",
    "category": "patterns",
    "tagline": "One-line teaser.",
    "explanation": "How it works.",
    "intuition": "Plain-English metaphor.",
    "code": "def example():\n    pass",
    "complexity": {"time": "O(n)", "space": "O(1)"},
    "use_case": "Where it appears in practice.",
    "viz": "generic_concept",
    "quiz": [
      {"q": "Sample question?", "options": ["A", "B", "C", "D"], "answer": 0}
    ]
  }
]
```

The `"viz": "generic_concept"` field gives you a placeholder visualization. To get a fancier one, define a function in `visualizations.js` and reference its key.

### 2. Register it in `packs.json`

Add an entry to the `packs` array:

```json
{
  "id": "pack-3",
  "name": "Whatever Theme You Like",
  "description": "Optional description.",
  "file": "curriculum-pack-3.json"
}
```

### 3. Push to GitHub

Commit and push. GitHub Pages redeploys in a minute. Refresh the app — when you finish pack 2, pack 3 starts. Your existing progress is preserved.

---

## Skipping cloud sync

If you don't want Firebase, leave the placeholder `firebaseConfig` in `app.js`. The app detects unfilled config and runs in local-only mode (browser storage). Use **Export progress** to back it up.

---

## Files

```
index.html                – page shell
styles.css                – editorial/technical theme
app.js                    – state, daily unlock, quizzes, sync (Firebase config goes here)
visualizations.js         – SVG animations for each algorithm
packs.json                – list of curriculum packs in load order
curriculum-pack-1.json    – days 1–30 (foundations)
curriculum-pack-2.json    – days 31–60 (advanced)
README.md                 – this file
```

---

## Firebase free tier limits

For this app: 50,000 reads/day, 20,000 writes/day, 1 GiB storage. One person using it daily uses maybe 5–10 reads and 1–2 writes per day. You will not hit any limit.
