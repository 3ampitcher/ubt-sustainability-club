# UBT Sustainability Club

The club's landing hub — one page that gets a student into the WhatsApp group,
the membership application, the club's social accounts, six very short games,
and a one-tap booth rating.

Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no
cookies, no tracking, and no field anywhere that asks a student for their name,
number, email or student ID.

```
├── index.html
├── assets/
│   ├── styles.css      design system + all styling
│   ├── games.js        the six games and their lifecycle host
│   ├── hub.js          booth rating + logo fallback  ← the file to configure
│   ├── fonts/          Archivo + IBM Plex Mono, self-hosted
│   └── logo.png        ← THE OFFICIAL CLUB LOGO GOES HERE
└── README.md
```

---

## 1. Add the logo

Put the official club logo in `assets/` named exactly:

```
assets/logo.png
```

It is displayed as supplied and is never redrawn, recoloured or re-lettered by
the site. Until the file is there, the page shows a plain text wordmark instead
of a broken image — nothing else depends on it.

To add it from a browser: open the repo → `assets` → **Add file → Upload files**
→ drag the logo in → **Commit changes**.

## 2. Publish it

**Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**

A minute later the site is live at `https://<user>.github.io/<repo>/`.

Locally: `python3 -m http.server 8000` and open `http://127.0.0.1:8000/`.
It also runs straight from a `file://` path or a USB stick — the fonts are in
the repo, so the page needs no network at all except for the outbound links.

---

## 3. Collecting the booth ratings

**This is the one thing that needs setting up.** GitHub Pages is static — it
serves this page to any number of phones, but it cannot store anything itself.
So the ratings have to land in a service you own.

Open `assets/hub.js`. The first block in the file is the only part to edit:

```js
var FEEDBACK = {
  mode: 'off',      // 'off' | 'google' | 'link'
  formId:  '',
  entryId: '',
  linkUrl: ''
};
```

| mode | What a student does | Where the data goes | Setup |
| --- | --- | --- | --- |
| `off` *(default)* | One tap | Stays in that browser only | none |
| `google` | One tap, nothing else | A Google Sheet you own | ~3 minutes, once |
| `link` | Tap, then Submit on a second screen | A form you already have | paste one URL |

**`off`** counts ratings only in the browser they were tapped in. That is fine
for a booth tablet and useless for students on their own phones. Add `?tally`
to the URL on that device to see the count and download a CSV.

**`google`** is the one to use if students open the page on their own phones.
It posts silently in the background — the student taps a face and is done.

1. [forms.google.com](https://forms.google.com) → new blank form.
2. Add **one** question, type **Short answer**, e.g. "Booth rating".
3. **Send** → the link tab (🔗) → open the link, and copy the full
   `https://docs.google.com/forms/d/e/1FAIpQL.../viewform` URL from the address bar.
4. `formId` is the long code between `/e/` and `/viewform`.
5. `entryId`: in the form editor, **⋮ → Get pre-filled link**, type anything,
   **Get link**, copy it — the URL contains `entry.123456789`. That is the value.
6. Set `mode: 'google'` and paste both in. Commit.

Responses then appear under the form's **Responses** tab and in its linked
Google Sheet. Only the rating word and a timestamp are ever sent — no names, no
device identifiers, nothing that ties a rating to a person.

**`link`** opens a form you already have (a Microsoft Form, say) in a new tab
with `?rating=Great` appended. Nothing new to set up, but fewer students finish,
because it takes a second screen and a Submit button.

Whichever mode is on, every rating is also kept in that browser's local storage
as a backup, and the widget resets itself after six seconds so the next student
at the booth can rate straight away.

---

## The six games

| Game | Type | Length | Win |
| --- | --- | --- | --- |
| Save the Turtle | tapping | ~10s | Turtle reaches safe water |
| Eco Race | racing | ~14s | Cross the line before the rival |
| Bin It | sorting | ~15s | 4 or 5 of 5 sorted right |
| Don't Cook the Planet | button mashing | 5s | Cool Earth to 36° |
| Drop Catch | skill | ~14s | Catch 7 water drops |
| Power UBT | choices | ~10s | Campus score reaches 70 |

Each runs on a timer or a fixed number of rounds, so none can run forever. All
work with mouse, touch and arrow keys, and end on a **Play Again / Back to
Games** screen.

**Why replay is safe.** Each play gets its own *runtime* that owns every
animation frame, timer and event listener the game creates. Starting, replaying,
closing or switching games destroys that runtime first, so nothing from a
previous play survives — no stray loops, no stale scores, no leaked listeners.
Students can play back to back all day without the page being reloaded.

**Tuning a game.** Each is one self-contained object in `assets/games.js` with
its constants at the top of `start()` — for example, in Drop Catch:

```js
var TIME = 14, NEED = 7, MAX_TRASH = 3;
```

Change those numbers to make it easier or harder. To reorder the tiles, edit the
`GAMES` array near the bottom of the file.

---

## Editing the page

| Change | Where |
| --- | --- |
| Any of the five links | `index.html`, search for the URL |
| Application deadline | `index.html`, the `.deadline` line |
| Title / tagline | `index.html`, the `.lede` block |
| Colours, spacing, type | the token block at the top of `assets/styles.css` |
| Rating labels or faces | the `SCALE` array in `assets/hub.js` |

Tested in current Chrome and Safari engines at phone, tablet and laptop sizes.
