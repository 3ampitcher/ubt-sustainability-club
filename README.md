# UBT Sustainability Club

The club's landing hub — one mobile-first page that gets a student into the
WhatsApp group, the membership application, the club's social accounts and six
short sustainability games.

Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no
cookies, no tracking, and no field anywhere that asks a student for anything
about themselves.

```
├── index.html          the page, with the six illustrations inlined as an SVG sprite
├── assets/
│   ├── styles.css      design system + all styling
│   ├── games.js        the six games and their lifecycle host
│   ├── hub.js          logo fallback
│   ├── art.svg.html    source of the card illustrations (edit here, then paste into index.html)
│   ├── fonts/          Archivo + IBM Plex Mono, self-hosted
│   └── logo.jpg        ← THE OFFICIAL CLUB LOGO GOES HERE
└── README.md
```

## 1. Add the logo

Put the official club logo in `assets/` named exactly `logo.jpg`. It is shown as
supplied and is never redrawn, recoloured or re-lettered by the site. It appears
top-right and as the browser tab icon.

From a browser: repo → `assets` → **Add file → Upload files** → drag it in →
**Commit changes**. Until it is there, a plain text wordmark shows in its place
so the page never displays a broken image.

## 2. Publish

**Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**
Live a minute later at `https://<user>.github.io/<repo>/`.

Locally: `python3 -m http.server 8000`, then `http://127.0.0.1:8000/`. The fonts
are committed, so the page needs no network of its own — it runs from a
`file://` path or a USB stick.

## Layout

The page is one phone-width column (430px), centred and given a card edge on
wider screens, so a booth laptop shows the same screen a student holds rather
than a stretched-out website. Content order:

1. Logo → 2. Title → 3. Supporting line → 4. Join WhatsApp Group →
5. Apply to Join → 6. Deadline → 7. Socials → 8. Pick a Game → 9. Six games

## The six games

| Game | Type | Runs for | Win |
| --- | --- | --- | --- |
| Save the Turtle | Reflex | ~15s | Turtle reaches safe water |
| Eco Race | Race | ~19s | Cross the line before the rival |
| Bin It | Speed | ~30s | 4 or 5 of 5 sorted right |
| Don't Cook the Planet | Awareness | 8s | Cool Earth to 36° |
| Drop Catch | Skill | ~20s | Catch 8 water drops |
| Power UBT | Strategy | ~15s | Campus score reaches 70 |

Every game runs on a timer or a fixed number of rounds, so none can run forever.
All work with mouse, touch and arrow keys, and end on a **Play Again / Back to
Games** screen.

**Why replay is safe.** Each play gets its own *runtime* that owns every
animation frame, timer and event listener the game creates. Starting, replaying,
closing or switching games destroys that runtime first, so nothing from a
previous play survives. Students can play back to back all day without the page
being reloaded.

**Tuning.** Each game is one self-contained object in `assets/games.js` with its
constants at the top of `start()` — for example, in Drop Catch:

```js
var TIME = 20, NEED = 8, MAX_TRASH = 3;
```

Raise `TIME` to give students longer; raise `NEED` to make it harder. To reorder
the tiles, edit the `GAMES` array near the bottom of the file.

## Editing

| Change | Where |
| --- | --- |
| Any of the five links | `index.html`, search for the URL |
| Application deadline | `index.html`, the `.deadline` line |
| Title / tagline | `index.html`, `.title` and `.lede` |
| Colours, spacing, type | the token block at the top of `assets/styles.css` |
| A card illustration | `assets/art.svg.html`, then paste the sprite into `index.html` |

Tested in current Chrome and Safari engines at phone, tablet and laptop sizes.
