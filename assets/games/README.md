# Card artwork

Each game shows an illustration drawn in SVG (the sprite at the top of
`index.html`). **To replace any of them with a real photo or render, drop a
file in this folder — no code change needed:**

```
assets/games/turtle.jpg     Save the Turtle
assets/games/race.jpg       Eco Race
assets/games/bin.jpg        Bin It
assets/games/earth.jpg      Don't Cook the Planet
assets/games/drop.jpg       Drop Catch
assets/games/power.jpg      Power UBT
```

The image loads on top of the illustration and wins. If a file is missing or
fails to load, the illustration shows instead, so the page is never broken
while you are part-way through swapping them.

**Sizing.** Landscape, roughly 8:5 (e.g. 800×500 or 1200×750). They are shown
`object-fit: cover`, so keep the subject near the middle — the sides get
cropped on the small tiles and the top and bottom get cropped on the game
screen. Keep each file under ~200 KB so the page stays quick on phone data.
