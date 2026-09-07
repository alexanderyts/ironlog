# Ironlog

A mobile-first workout tracker with an intelligent workout builder, progressive-overload autofill, a rest timer, and coaching analysis. No frameworks, no dependencies — plain HTML/CSS/JS.

**One codebase, two builds:**

| Build | Where it runs | Cloud backup | Offline |
|---|---|---|---|
| `dist/app.html` | As a Claude Artifact (claude.ai) | Claude's built-in database | After first load |
| `docs/` | Your own site (GitHub Pages) as an installable PWA | **Dropbox** (optional) | Yes — service worker |

## Develop

```bash
npm test          # unit tests for the engine (builder, ordering, analysis, sync, units, search)
npm run build     # writes dist/app.html and docs/ (site + service worker + manifest + icons)
npm run dev       # serves docs/ at http://localhost:4321
```

### Layout

```
src/
  data/exercises.js      exercise library + region/pattern/tier metadata
  engine/progression.js  sets, volume, last performance, overload suggestion, unit conversion, streak
  engine/builder.js      smart workout builder, ordering, safety cap, complementary suggestions
  engine/analysis.js     effectiveness analysis, coaching tips, PRs, weekly volume
  engine/search.js       fuzzy "describe an exercise" search
  engine/sync.js         merge/tombstone logic shared by every cloud backend, backup format
  app/store.js           local-first state + cloud adapters (Claude DB · Dropbox · none)
  app/dropbox.js         Dropbox OAuth (PKCE) + file API
  app/ui.js              views, interactions, rest timer, boot
  styles.css · template.html
build.js                 assembles both targets
test/                    node:test suites (run with `npm test`)
```

Engine modules are pure: they take the sessions array in and never touch the DOM or app state. That is what makes them testable — and what keeps the "smart" behaviour from regressing.

## Host it on GitHub Pages (free)

1. Push this folder to a GitHub repository.
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder: `/docs`** → Save.
3. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.
4. Open it on your phone → Share → **Add to Home Screen**. It installs with its own icon, runs full-screen, and works offline.

Every time you change something: `npm run build`, commit, push. Pages redeploys automatically; the app shows an **"Update ready"** toast on the next open.

## Turn on Dropbox cloud backup (one-time, ~5 minutes)

The site build can keep your history in a single file inside your Dropbox and sync every device. No server involved.

1. Go to <https://www.dropbox.com/developers/apps> → **Create app**.
2. Choose **Scoped access** → **App folder** → name it (e.g. `Ironlog`) → Create.
3. On the app page, **Permissions** tab: tick `files.metadata.read`, `files.content.write`, `files.content.read` → Submit.
4. **Settings** tab → **OAuth 2 → Redirect URIs**: add your site URL exactly, e.g. `https://<your-username>.github.io/<repo-name>/` (and `http://localhost:4321/` if you want to test locally) → Add.
5. Copy the **App key** into `config.json`:
   ```json
   { "DROPBOX_APP_KEY": "your-app-key-here" }
   ```
6. `npm run build`, commit, push. Open the app → **Settings → Connect Dropbox**.

The app key is safe to publish (it's a public client id; the PKCE flow needs no secret). Data goes to `Apps/Ironlog/ironlog.json` in your Dropbox — you can open it, back it up, or delete it any time.

## Publish the Claude Artifact

`dist/app.html` is the single-file artifact build. Publish it with the Artifact tool (declare `db` + `downloads` capabilities); republish the same path to keep the URL.

## Versioning

Bump `version` in `package.json` and add an entry to `CHANGELOG.md`. The version shows in Settings and keys the service-worker cache, so users get the update.
