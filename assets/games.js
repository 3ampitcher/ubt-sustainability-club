/* ===========================================================
   UBT Sustainability Club — the six mini-games
   Vanilla JS, no dependencies, no network, no storage.

   Every game is a plain object with a start(api) function. The host
   below owns the lifecycle: it creates a fresh runtime for each play,
   and tears that runtime down (frames, timers, listeners, DOM) before
   anything else can start. That is what makes replay and switching
   between games safe without a page refresh.
   =========================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Runtime — owns every frame, timer and listener a game makes
     --------------------------------------------------------- */
  function createRuntime() {
    var dead = false;
    var frameId = 0;
    var timeouts = new Set();
    var intervals = new Set();
    var listeners = [];
    var cleanups = [];

    return {
      get dead() { return dead; },

      /* One continuous loop, delta-timed. Only one per game is needed. */
      frame: function (fn) {
        var last = 0;
        var step = function (now) {
          if (dead) return;
          if (!last) last = now;
          var dt = (now - last) / 1000;
          last = now;
          if (dt > 0.05) dt = 0.05;          // tab-switch / slow frame guard
          fn(dt);
          if (!dead) frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);
      },

      timeout: function (fn, ms) {
        var id = setTimeout(function () {
          timeouts.delete(id);
          if (!dead) fn();
        }, ms);
        timeouts.add(id);
        return id;
      },

      interval: function (fn, ms) {
        var id = setInterval(function () { if (!dead) fn(); }, ms);
        intervals.add(id);
        return id;
      },

      on: function (target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        listeners.push([target, type, fn, opts]);
      },

      cleanup: function (fn) { cleanups.push(fn); },

      destroy: function () {
        if (dead) return;
        dead = true;
        if (frameId) cancelAnimationFrame(frameId);
        timeouts.forEach(clearTimeout); timeouts.clear();
        intervals.forEach(clearInterval); intervals.clear();
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        listeners.length = 0;
        cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
        cleanups.length = 0;
      }
    };
  }

  /* ---------------------------------------------------------
     Small helpers
     --------------------------------------------------------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  function drawEmoji(ctx, ch, x, y, size, alpha) {
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.font = Math.round(size) + 'px ' + EMOJI_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
    ctx.restore();
  }

  /* Canvas that always matches its host box, at device resolution. */
  function setupCanvas(rt, host) {
    var canvas = el('canvas', 'game-canvas');
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var view = { w: 1, h: 1, s: 1 };

    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      view.w = Math.max(1, Math.round(r.width));
      view.h = Math.max(1, Math.round(r.height));
      view.s = clamp(Math.min(view.w, view.h) / 380, 0.62, 1.7);
      canvas.width = Math.round(view.w * dpr);
      canvas.height = Math.round(view.h * dpr);
      canvas.style.width = view.w + 'px';
      canvas.style.height = view.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    rt.on(window, 'resize', resize);
    rt.on(window, 'orientationchange', resize);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(resize);
      ro.observe(host);
      rt.cleanup(function () { ro.disconnect(); });
    }
    return { canvas: canvas, ctx: ctx, view: view };
  }

  /* Pointer position in canvas coordinates. */
  function localPoint(canvas, ev) {
    var r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  /* HUD builders ------------------------------------------------ */
  function hudChip(hud, label) {
    var chip = el('span', 'hud-chip', label);
    hud.appendChild(chip);
    return {
      set: function (text) { chip.innerHTML = text; }
    };
  }
  /* plain:true keeps the bar green — used where a full bar is the goal
     (race progress) rather than a countdown running out. */
  function hudBar(hud, plain) {
    var bar = el('div', 'hud-bar');
    var fill = el('i');
    bar.appendChild(fill);
    hud.appendChild(bar);
    return {
      set: function (pct) {
        pct = clamp(pct, 0, 1);
        fill.style.width = (pct * 100).toFixed(1) + '%';
        bar.className = 'hud-bar' + (plain ? '' : pct < 0.2 ? ' danger' : pct < 0.45 ? ' warn' : '');
      }
    };
  }

  /* ===========================================================
     GAME 1 — Save the Turtle
     =========================================================== */
  var gameTurtle = {
    id: 'turtle',
    name: 'Save the Turtle',
    emoji: '🐢',
    tagline: 'Clear the plastic', tint: '#35B39B',
    instruction: 'Tap the trash before it reaches the turtle.',
    startLabel: 'Start',
    start: function (api) {
      var rt = api.rt;
      var c = setupCanvas(rt, api.field);
      var ctx = c.ctx, view = c.view;

      var TIME = 10;            // hard time limit
      var CROSS = 8;            // seconds of clean swimming to reach safety
      var MAX_HITS = 3;
      var TRASH = ['🥤', '🛍️', '🧴', '🥫', '🧃', '🍬'];

      var t = 0, progress = 0, hits = 0, cleared = 0, stall = 0;
      var trash = [], pops = [], bubbles = [];
      var nextSpawn = 0.45;

      for (var i = 0; i < 16; i++) {
        bubbles.push({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(1.5, 4), sp: rnd(0.03, 0.09) });
      }

      var barTime = hudBar(api.hud);
      var chipClear = hudChip(api.hud, '');
      var chipLife = hudChip(api.hud, '');
      function hud() {
        barTime.set(1 - t / TIME);
        chipClear.set('🗑️ Cleared ' + cleared);
        chipLife.set('❤️'.repeat(Math.max(0, MAX_HITS - hits)) || '💔');
      }
      hud();

      function turtlePos() {
        var x = 54 * view.s + progress * (view.w - 108 * view.s);
        var y = view.h * 0.6 + Math.sin(t * 2.2) * view.h * 0.06;
        return { x: x, y: y };
      }

      function spawn() {
        var tp = turtlePos();
        var side = irnd(0, 3);
        var x, y;
        var m = 40 * view.s;
        if (side === 0) { x = view.w + m; y = rnd(m, view.h - m); }
        else if (side === 1) { x = rnd(0, view.w); y = -m; }
        else if (side === 2) { x = rnd(0, view.w); y = view.h + m; }
        else { x = view.w * 0.75; y = -m; }
        trash.push({
          x: x, y: y,
          ch: TRASH[irnd(0, TRASH.length - 1)],
          sp: rnd(52, 76) * view.s,
          spin: rnd(-2, 2),
          rot: rnd(0, 6.28),
          r: 25 * view.s
        });
      }

      rt.on(c.canvas, 'pointerdown', function (ev) {
        ev.preventDefault();
        var p = localPoint(c.canvas, ev);
        for (var i = trash.length - 1; i >= 0; i--) {
          var o = trash[i];
          var dx = o.x - p.x, dy = o.y - p.y;
          var hitR = o.r + 14 * view.s;             // generous for fingers
          if (dx * dx + dy * dy <= hitR * hitR) {
            trash.splice(i, 1);
            cleared++;
            pops.push({ x: o.x, y: o.y, life: 0.45, r: o.r });
            hud();
            return;
          }
        }
      });

      rt.frame(function (dt) {
        t += dt;

        /* --- update --- */
        if (stall > 0) stall = Math.max(0, stall - dt);
        else progress = Math.min(1, progress + dt / CROSS);

        nextSpawn -= dt;
        if (nextSpawn <= 0 && t < TIME - 1.2) { spawn(); nextSpawn = rnd(0.72, 1.02); }

        var tp = turtlePos();
        for (var i = trash.length - 1; i >= 0; i--) {
          var o = trash[i];
          var dx = tp.x - o.x, dy = tp.y - o.y;
          var d = Math.hypot(dx, dy) || 1;
          o.x += (dx / d) * o.sp * dt;
          o.y += (dy / d) * o.sp * dt;
          o.rot += o.spin * dt;
          if (d < 30 * view.s) {
            trash.splice(i, 1);
            hits++; stall += 0.8;
            hud();
            if (hits >= MAX_HITS) { api.end(false, 'Too much plastic reached her.'); return; }
          }
        }
        for (var j = pops.length - 1; j >= 0; j--) {
          pops[j].life -= dt;
          if (pops[j].life <= 0) pops.splice(j, 1);
        }
        for (var b = 0; b < bubbles.length; b++) {
          bubbles[b].y -= bubbles[b].sp * dt;
          if (bubbles[b].y < -0.05) { bubbles[b].y = 1.05; bubbles[b].x = Math.random(); }
        }

        hud();
        if (progress >= 1) { api.end(true, 'She made it to safe water.'); return; }
        if (t >= TIME) { api.end(false, 'She ran out of time.'); return; }

        /* --- draw --- */
        var g = ctx.createLinearGradient(0, 0, 0, view.h);
        g.addColorStop(0, '#7FCFE4');
        g.addColorStop(1, '#1E6C92');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, view.w, view.h);

        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (var bb = 0; bb < bubbles.length; bb++) {
          ctx.beginPath();
          ctx.arc(bubbles[bb].x * view.w, bubbles[bb].y * view.h, bubbles[bb].r * view.s, 0, 6.29);
          ctx.fill();
        }

        /* safe zone on the right */
        var zoneW = 52 * view.s;
        ctx.fillStyle = 'rgba(86,184,74,.30)';
        ctx.fillRect(view.w - zoneW, 0, zoneW, view.h);
        drawEmoji(ctx, '🪸', view.w - zoneW / 2, view.h * 0.78, 30 * view.s, 0.95);
        drawEmoji(ctx, '🌿', view.w - zoneW / 2, view.h * 0.34, 26 * view.s, 0.9);

        for (var k = 0; k < trash.length; k++) {
          var o2 = trash[k];
          ctx.save();
          ctx.translate(o2.x, o2.y);
          ctx.rotate(o2.rot);
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          ctx.arc(0, 0, o2.r * 1.05, 0, 6.29);
          ctx.fill();
          drawEmoji(ctx, o2.ch, 0, 0, o2.r * 1.55);
          ctx.restore();
        }

        for (var p2 = 0; p2 < pops.length; p2++) {
          var pp = pops[p2];
          var k2 = 1 - pp.life / 0.45;
          ctx.save();
          ctx.globalAlpha = 1 - k2;
          ctx.strokeStyle = '#56B84A';
          ctx.lineWidth = 3 * view.s;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, pp.r * (1 + k2 * 1.4), 0, 6.29);
          ctx.stroke();
          ctx.restore();
        }

        var wobble = stall > 0 ? Math.sin(t * 30) * 4 * view.s : 0;
        drawEmoji(ctx, '🐢', tp.x + wobble, tp.y, 46 * view.s);
      });
    }
  };

  /* ===========================================================
     GAME 2 — Eco Race
     =========================================================== */
  var gameRace = {
    id: 'race',
    name: 'Eco Race',
    emoji: '🏁',
    tagline: 'Beat the rival', tint: '#6F86D6',
    instruction: 'Collect energy. Avoid waste. Finish first.',
    startLabel: 'Start the race',
    start: function (api) {
      var rt = api.rt;
      var c = setupCanvas(rt, api.field);
      var ctx = c.ctx, view = c.view;

      var TRACK = 2000;         // track length in world units
      var PPU = 0.52;           // pixels per unit on screen
      var BASE = 146;           // player base speed
      var OPP = 149;            // rival speed
      var GUARD = 26;           // absolute safety timeout (s)

      var t = 0, pd = 0, od = 0, bonus = 0, slow = 0, boosts = 0, bumps = 0;
      var roadW, roadX, playerX, targetX;
      var keyL = false, keyR = false;
      var items = [];

      function layout() {
        roadW = Math.min(view.w * 0.86, 430 * view.s);
        roadX = (view.w - roadW) / 2;
        if (playerX == null) { playerX = view.w / 2; targetX = playerX; }
        playerX = clamp(playerX, roadX + 26 * view.s, roadX + roadW - 26 * view.s);
        targetX = clamp(targetX, roadX + 26 * view.s, roadX + roadW - 26 * view.s);
      }
      layout();

      /* Track layout: fixed at start, so the race is a real course. */
      (function build() {
        var lanes = [0.18, 0.5, 0.82];
        var d = 300;
        var boostCount = 0;
        while (d < TRACK - 150) {
          var isBoost = boostCount < 8 && (Math.random() < 0.55 || boostCount < (d / TRACK) * 7);
          var lane = lanes[irnd(0, 2)];
          items.push({ d: d, lane: lane, kind: isBoost ? 'boost' : 'waste', got: false });
          if (isBoost) boostCount++;
          /* Occasionally a second item in another lane, never blocking all three. */
          if (Math.random() < 0.35) {
            var other = lanes.filter(function (l) { return l !== lane; });
            items.push({
              d: d, lane: other[irnd(0, other.length - 1)],
              kind: Math.random() < 0.5 ? 'boost' : 'waste', got: false
            });
          }
          d += rnd(105, 150);
        }
      })();

      var barYou = hudBar(api.hud, true);   // fills up as you near the finish
      var chipYou = hudChip(api.hud, '');
      function hud() {
        barYou.set(pd / TRACK);
        chipYou.set('⚡ ' + boosts + ' &nbsp;·&nbsp; ' + (pd >= od ? 'Leading' : 'Behind'));
      }
      hud();

      function movePointer(ev) {
        var p = localPoint(c.canvas, ev);
        targetX = clamp(p.x, roadX + 26 * view.s, roadX + roadW - 26 * view.s);
      }
      rt.on(c.canvas, 'pointerdown', function (ev) { ev.preventDefault(); c.canvas.setPointerCapture && c.canvas.setPointerCapture(ev.pointerId); movePointer(ev); });
      rt.on(c.canvas, 'pointermove', function (ev) { if (ev.buttons || ev.pointerType === 'touch') movePointer(ev); });
      rt.on(window, 'keydown', function (ev) {
        if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') { keyL = true; ev.preventDefault(); }
        if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') { keyR = true; ev.preventDefault(); }
      });
      rt.on(window, 'keyup', function (ev) {
        if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') keyL = false;
        if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') keyR = false;
      });

      rt.frame(function (dt) {
        t += dt;
        layout();

        if (keyL) targetX -= 420 * dt * view.s;
        if (keyR) targetX += 420 * dt * view.s;
        targetX = clamp(targetX, roadX + 26 * view.s, roadX + roadW - 26 * view.s);
        playerX += (targetX - playerX) * Math.min(1, dt * 14);

        if (bonus > 0) bonus = Math.max(0, bonus - 22 * dt);
        if (slow > 0) slow = Math.max(0, slow - dt);
        var speed = BASE + bonus - (slow > 0 ? 42 : 0);
        pd += speed * dt;
        od += (OPP + Math.sin(t * 1.3) * 5) * dt;

        var py = view.h * 0.74;
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (it.got) continue;
          var ix = roadX + it.lane * roadW;
          if (Math.abs(it.d - pd) < 28 && Math.abs(ix - playerX) < 30 * view.s) {
            it.got = true;
            if (it.kind === 'boost') { boosts++; bonus = Math.min(120, bonus + 58); }
            else { bumps++; bonus = 0; slow = 1.1; }
          }
        }

        hud();
        if (pd >= TRACK) { api.end(true, 'You crossed the line first. ⚡ ' + boosts + ' collected.'); return; }
        if (od >= TRACK) { api.end(false, 'The rival took it. Grab more energy boosts.'); return; }
        if (t >= GUARD) { api.end(false, 'Out of time.'); return; }

        /* --- draw --- */
        ctx.fillStyle = '#26543A';
        ctx.fillRect(0, 0, view.w, view.h);
        ctx.fillStyle = '#232C55';
        ctx.fillRect(roadX, 0, roadW, view.h);

        /* lane dashes scrolling with distance */
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 3 * view.s;
        ctx.setLineDash([18 * view.s, 22 * view.s]);
        ctx.lineDashOffset = (pd * PPU) % (40 * view.s);
        for (var l = 1; l <= 2; l++) {
          var lx = roadX + (roadW / 3) * l;
          ctx.beginPath(); ctx.moveTo(lx, -20); ctx.lineTo(lx, view.h + 20); ctx.stroke();
        }
        ctx.setLineDash([]);

        /* verge trees for a sense of speed */
        ctx.save();
        var treeGap = 150;
        var firstTree = Math.floor((pd - 200) / treeGap) * treeGap;
        for (var tt = firstTree; tt < pd + 900; tt += treeGap) {
          var ty = py - (tt - pd) * PPU;
          if (ty < -40 || ty > view.h + 40) continue;
          drawEmoji(ctx, '🌳', roadX - 22 * view.s, ty, 26 * view.s, 0.9);
          drawEmoji(ctx, '🌳', roadX + roadW + 22 * view.s, ty, 26 * view.s, 0.9);
        }
        ctx.restore();

        /* finish line */
        var fy = py - (TRACK - pd) * PPU;
        if (fy > -60 && fy < view.h + 60) {
          var sq = roadW / 10;
          for (var r2 = 0; r2 < 2; r2++) {
            for (var cq = 0; cq < 10; cq++) {
              ctx.fillStyle = ((r2 + cq) % 2) ? '#FFFFFF' : '#141C42';
              ctx.fillRect(roadX + cq * sq, fy + r2 * sq * 0.6, sq, sq * 0.6);
            }
          }
        }

        /* items */
        for (var m = 0; m < items.length; m++) {
          var o = items[m];
          if (o.got) continue;
          var oy = py - (o.d - pd) * PPU;
          if (oy < -40 || oy > view.h + 40) continue;
          var ox = roadX + o.lane * roadW;
          if (o.kind === 'boost') {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,.22)';
            ctx.arc(ox, oy, 20 * view.s, 0, 6.29); ctx.fill();
            drawEmoji(ctx, '⚡', ox, oy, 28 * view.s);
          } else {
            drawEmoji(ctx, '🛢️', ox, oy, 28 * view.s);
          }
        }

        /* rival */
        var oy2 = py - (od - pd) * PPU;
        if (oy2 > -60 && oy2 < view.h + 60) {
          drawEmoji(ctx, '🚗', roadX + roadW * 0.22, oy2, 36 * view.s);
          drawEmoji(ctx, '💨', roadX + roadW * 0.22, oy2 + 26 * view.s, 20 * view.s, 0.75);
        }

        /* player */
        if (slow > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.55;
        drawEmoji(ctx, '🚲', playerX, py, 38 * view.s);
        ctx.globalAlpha = 1;
        if (bonus > 12) drawEmoji(ctx, '✨', playerX, py + 26 * view.s, 20 * view.s, 0.9);
      });
    }
  };

  /* ===========================================================
     GAME 3 — Bin It
     =========================================================== */
  var gameBin = {
    id: 'bin',
    name: 'Bin It',
    emoji: '♻️',
    tagline: 'Sort five items', tint: '#56B84A',
    instruction: 'Put 5 items in the right bin.',
    startLabel: 'Start',
    start: function (api) {
      var rt = api.rt;
      var BINS = [
        { key: 'recycle', label: 'Recycling', ico: '♻️' },
        { key: 'general', label: 'General Waste', ico: '🗑️' },
        { key: 'food', label: 'Food Waste', ico: '🍎' }
      ];
      var POOL = [
        { e: '🧴', n: 'Plastic bottle', b: 'recycle' },
        { e: '🍌', n: 'Banana peel', b: 'food' },
        { e: '🥫', n: 'Soda can', b: 'recycle' },
        { e: '🧻', n: 'Used tissue', b: 'general' },
        { e: '📦', n: 'Cardboard box', b: 'recycle' },
        { e: '📰', n: 'Newspaper', b: 'recycle' },
        { e: '🍏', n: 'Apple core', b: 'food' },
        { e: '🥚', n: 'Egg shells', b: 'food' },
        { e: '🍟', n: 'Chip bag', b: 'general' },
        { e: '🫙', n: 'Glass jar', b: 'recycle' },
        { e: '🥤', n: 'Plastic straw', b: 'general' },
        { e: '🍞', n: 'Stale bread', b: 'food' }
      ];

      var ROUNDS = 5;
      var PER_ITEM = 4.2;
      var items = shuffle(POOL).slice(0, ROUNDS);
      var idx = 0, score = 0, left = PER_ITEM, answered = false;

      var wrap = el('div', 'dom-game');
      var itemBox = el('div', 'bin-item');
      var emo = el('div', 'bin-emoji');
      var nm = el('div', 'bin-name');
      itemBox.appendChild(emo); itemBox.appendChild(nm);
      var flash = el('div', 'bin-flash', '&nbsp;');
      var row = el('div', 'bin-row');

      var buttons = BINS.map(function (b) {
        var btn = el('button', 'bin-btn');
        btn.type = 'button';
        btn.appendChild(el('i', null, b.ico));
        btn.appendChild(el('b', null, b.label));
        rt.on(btn, 'click', function () { answer(b.key, btn); });
        row.appendChild(btn);
        return btn;
      });

      wrap.appendChild(itemBox);
      wrap.appendChild(flash);
      wrap.appendChild(row);
      api.field.appendChild(wrap);

      var barTime = hudBar(api.hud);
      var chipN = hudChip(api.hud, '');
      var chipS = hudChip(api.hud, '');
      function hud() {
        barTime.set(left / PER_ITEM);
        chipN.set('Item ' + Math.min(idx + 1, ROUNDS) + ' / ' + ROUNDS);
        chipS.set('✅ ' + score);
      }

      function render() {
        var it = items[idx];
        emo.textContent = it.e;
        nm.textContent = it.n;
        flash.textContent = ' ';
        flash.className = 'bin-flash';
        buttons.forEach(function (b) { b.className = 'bin-btn'; b.disabled = false; });
        answered = false;
        left = PER_ITEM;
        hud();
      }

      function answer(key, btn) {
        if (answered) return;
        answered = true;
        var it = items[idx];
        var ok = key === it.b;
        if (ok) { score++; flash.textContent = 'Correct'; flash.className = 'bin-flash ok'; }
        else { flash.textContent = it.n + ' → ' + BINS.filter(function (b) { return b.key === it.b; })[0].label; flash.className = 'bin-flash no'; }
        buttons.forEach(function (b, i) {
          b.disabled = true;
          if (BINS[i].key === it.b) b.className = 'bin-btn correct';
          else if (b === btn && !ok) b.className = 'bin-btn wrong';
        });
        hud();
        rt.timeout(next, ok ? 480 : 900);
      }

      function next() {
        idx++;
        if (idx >= ROUNDS) {
          api.end(score >= 4, 'You sorted ' + score + ' of ' + ROUNDS + ' correctly.');
          return;
        }
        render();
      }

      render();
      rt.frame(function (dt) {
        if (answered) return;
        left -= dt;
        if (left <= 0) { left = 0; hud(); answer('__timeout__', null); return; }
        hud();
      });
    }
  };

  /* ===========================================================
     GAME 4 — Don't Cook the Planet
     =========================================================== */
  var gameCook = {
    id: 'cook',
    name: "Don't Cook the Planet",
    emoji: '🌍',
    tagline: 'Tap to cool', tint: '#F0A93C',
    instruction: 'Tap as fast as you can.',
    startLabel: 'Start',
    start: function (api) {
      var rt = api.rt;
      var TIME = 5.0;
      var START_T = 41.5, TARGET = 36.0, MAXT = 46;
      var WARM = 0.85;      // degrees gained per second
      var COOL = 0.45;      // degrees lost per tap

      var t = 0, temp = START_T, taps = 0;

      var wrap = el('div', 'dom-game cook-wrap');
      var earth = el('div', 'cook-earth', '🌍');
      var tempEl = el('div', 'cook-temp');
      var scale = el('div', 'cook-scale');
      var fill = el('i'); var mark = el('b');
      scale.appendChild(fill); scale.appendChild(mark);
      var btn = el('button', 'cook-btn', 'TAP TO COOL');
      btn.type = 'button';

      wrap.appendChild(earth);
      wrap.appendChild(tempEl);
      wrap.appendChild(scale);
      wrap.appendChild(btn);
      api.field.appendChild(wrap);

      /* target marker position on the 34–46 scale */
      var LO = 34;
      mark.style.left = (((TARGET - LO) / (MAXT - LO)) * 100) + '%';

      var barTime = hudBar(api.hud);
      var chipTaps = hudChip(api.hud, '');
      function hud() {
        barTime.set(1 - t / TIME);
        chipTaps.set('👆 ' + taps + ' taps');
        tempEl.textContent = temp.toFixed(1) + '°  →  target ' + TARGET.toFixed(1) + '°';
        var k = clamp((temp - LO) / (MAXT - LO), 0, 1);
        fill.style.width = (k * 100) + '%';
        earth.style.filter = 'saturate(' + (1 + k * 1.6).toFixed(2) + ') hue-rotate(' + (-k * 25).toFixed(0) + 'deg)';
        earth.style.transform = 'scale(' + (1 + k * 0.10).toFixed(3) + ')';
      }
      hud();

      function tap() {
        taps++;
        temp = Math.max(20, temp - COOL);
        btn.classList.add('hit');
        rt.timeout(function () { btn.classList.remove('hit'); }, 70);
        hud();
        if (temp <= TARGET) api.end(true, 'Cooled it with ' + taps + ' taps. Nice hands.');
      }

      rt.on(btn, 'pointerdown', function (ev) { ev.preventDefault(); tap(); });
      rt.on(btn, 'keydown', function (ev) {
        if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); tap(); }
      });
      rt.on(btn, 'click', function (ev) { ev.preventDefault(); });  // pointerdown already counted

      btn.focus({ preventScroll: true });

      rt.frame(function (dt) {
        t += dt;
        temp = Math.min(MAXT, temp + WARM * dt);
        hud();
        if (temp <= TARGET) { api.end(true, 'Cooled it with ' + taps + ' taps. Nice hands.'); return; }
        if (t >= TIME) { api.end(false, 'Stopped at ' + temp.toFixed(1) + '°. Target was ' + TARGET.toFixed(1) + '°.'); return; }
      });
    }
  };

  /* ===========================================================
     GAME 5 — Drop Catch
     =========================================================== */
  var gameDrop = {
    id: 'drop',
    name: 'Drop Catch',
    emoji: '💧',
    tagline: 'Catch the water', tint: '#4FA8D8',
    instruction: 'Catch water. Avoid trash.',
    startLabel: 'Start',
    start: function (api) {
      var rt = api.rt;
      var c = setupCanvas(rt, api.field);
      var ctx = c.ctx, view = c.view;

      var TIME = 14, NEED = 7, MAX_TRASH = 3;
      var TRASH = ['🗑️', '🛍️', '🥫', '🧴'];

      var t = 0, caught = 0, junk = 0, missed = 0;
      var drops = [], splashes = [];
      var nextSpawn = 0.25;
      var bx = view.w / 2, targetX = bx;
      var keyL = false, keyR = false;

      var barTime = hudBar(api.hud);
      var chipCaught = hudChip(api.hud, '');
      var chipJunk = hudChip(api.hud, '');
      function hud() {
        barTime.set(1 - t / TIME);
        chipCaught.set('💧 ' + caught + ' / ' + NEED);
        chipJunk.set('🚫 ' + junk + ' / ' + MAX_TRASH);
      }
      hud();

      function bucketW() { return 84 * view.s; }
      function bucketY() { return view.h - 46 * view.s; }

      function move(ev) {
        var p = localPoint(c.canvas, ev);
        targetX = clamp(p.x, bucketW() / 2, view.w - bucketW() / 2);
      }
      rt.on(c.canvas, 'pointerdown', function (ev) { ev.preventDefault(); c.canvas.setPointerCapture && c.canvas.setPointerCapture(ev.pointerId); move(ev); });
      rt.on(c.canvas, 'pointermove', function (ev) { if (ev.buttons || ev.pointerType === 'touch') move(ev); });
      rt.on(window, 'keydown', function (ev) {
        if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') { keyL = true; ev.preventDefault(); }
        if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') { keyR = true; ev.preventDefault(); }
      });
      rt.on(window, 'keyup', function (ev) {
        if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') keyL = false;
        if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') keyR = false;
      });

      rt.frame(function (dt) {
        t += dt;

        if (keyL) targetX -= 460 * dt * view.s;
        if (keyR) targetX += 460 * dt * view.s;
        targetX = clamp(targetX, bucketW() / 2, view.w - bucketW() / 2);
        bx += (targetX - bx) * Math.min(1, dt * 16);
        bx = clamp(bx, bucketW() / 2, view.w - bucketW() / 2);

        nextSpawn -= dt;
        if (nextSpawn <= 0 && t < TIME - 0.8) {
          var isTrash = Math.random() < 0.27;
          drops.push({
            x: rnd(28 * view.s, view.w - 28 * view.s),
            y: -28 * view.s,
            v: rnd(180, 250) * view.s,
            trash: isTrash,
            ch: isTrash ? TRASH[irnd(0, TRASH.length - 1)] : '💧',
            wob: rnd(0, 6.28)
          });
          nextSpawn = rnd(0.30, 0.46);
        }

        var by = bucketY(), bw = bucketW();
        for (var i = drops.length - 1; i >= 0; i--) {
          var d = drops[i];
          d.y += d.v * dt;
          if (d.trash) d.x += Math.sin(t * 2 + d.wob) * 18 * dt * view.s;

          if (d.y >= by - 14 * view.s && d.y <= by + 22 * view.s && Math.abs(d.x - bx) < bw / 2) {
            drops.splice(i, 1);
            if (d.trash) {
              junk++;
              splashes.push({ x: d.x, y: by, life: 0.4, bad: true });
              hud();
              if (junk >= MAX_TRASH) { api.end(false, 'Too much trash in the bucket.'); return; }
            } else {
              caught++;
              splashes.push({ x: d.x, y: by, life: 0.4, bad: false });
              hud();
              if (caught >= NEED) { api.end(true, 'Bucket full — ' + caught + ' drops saved.'); return; }
            }
            continue;
          }
          if (d.y > view.h + 40 * view.s) { drops.splice(i, 1); if (!d.trash) missed++; }
        }
        for (var s = splashes.length - 1; s >= 0; s--) {
          splashes[s].life -= dt;
          if (splashes[s].life <= 0) splashes.splice(s, 1);
        }

        hud();
        if (t >= TIME) { api.end(false, 'Time up with ' + caught + ' of ' + NEED + ' drops.'); return; }

        /* --- draw --- */
        var g = ctx.createLinearGradient(0, 0, 0, view.h);
        g.addColorStop(0, '#BBD9F2');
        g.addColorStop(1, '#6D9CC4');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, view.w, view.h);

        ctx.fillStyle = 'rgba(11,17,48,.16)';
        ctx.fillRect(0, by + 16 * view.s, view.w, view.h);

        for (var k = 0; k < drops.length; k++) {
          drawEmoji(ctx, drops[k].ch, drops[k].x, drops[k].y, (drops[k].trash ? 30 : 28) * view.s);
        }

        for (var sp = 0; sp < splashes.length; sp++) {
          var s2 = splashes[sp];
          var kk = 1 - s2.life / 0.4;
          ctx.save();
          ctx.globalAlpha = 1 - kk;
          ctx.strokeStyle = s2.bad ? '#E5484D' : '#3FA0D8';
          ctx.lineWidth = 3 * view.s;
          ctx.beginPath();
          ctx.arc(s2.x, s2.y, 14 * view.s + kk * 26 * view.s, 0, 6.29);
          ctx.stroke();
          ctx.restore();
        }

        /* bucket */
        ctx.save();
        ctx.fillStyle = '#101838';
        ctx.beginPath();
        var half = bw / 2;
        ctx.moveTo(bx - half, by - 8 * view.s);
        ctx.lineTo(bx + half, by - 8 * view.s);
        ctx.lineTo(bx + half * 0.72, by + 26 * view.s);
        ctx.lineTo(bx - half * 0.72, by + 26 * view.s);
        ctx.closePath();
        ctx.fill();
        var fillPct = clamp(caught / NEED, 0, 1);
        ctx.fillStyle = '#56B84A';
        ctx.fillRect(bx - half * 0.82, by + 22 * view.s - 28 * view.s * fillPct, half * 1.64, 28 * view.s * fillPct);
        ctx.restore();
      });
    }
  };

  /* ===========================================================
     GAME 6 — Power UBT
     =========================================================== */
  var gamePower = {
    id: 'power',
    name: 'Power UBT',
    emoji: '⚡',
    tagline: 'Three upgrades', tint: '#E0C24A',
    instruction: 'Make 3 choices. Reach the target.',
    startLabel: 'Start',
    start: function (api) {
      var rt = api.rt;
      var START = 22, TARGET = 70, PICKS = 3;

      var OPTIONS = [
        { ico: '☀️', name: 'Solar Panels', dots: 3, lo: 20, hi: 24 },
        { ico: '🚌', name: 'Campus Shuttle', dots: 3, lo: 18, hi: 22 },
        { ico: '❄️', name: 'Smart AC', dots: 2, lo: 14, hi: 17 },
        { ico: '🚿', name: 'Water Saving', dots: 2, lo: 13, hi: 16 },
        { ico: '💡', name: 'LED Lighting', dots: 2, lo: 12, hi: 15 },
        { ico: '♻️', name: 'Waste Sorting', dots: 1, lo: 8, hi: 11 }
      ];

      var score = START, picks = 0, busy = false;

      var wrap = el('div', 'dom-game');
      var head = el('div', 'power-head');
      var meter = el('div', 'power-meter');
      var mFill = el('i'); var mMark = el('b');
      meter.appendChild(mFill); meter.appendChild(mMark);
      var nums = el('div', 'power-nums');
      var numLeft = el('span', null, 'Campus score <strong>' + START + '</strong>');
      var numRight = el('span', null, 'Target <strong>' + TARGET + '</strong>');
      nums.appendChild(numLeft); nums.appendChild(numRight);
      head.appendChild(meter); head.appendChild(nums);

      var grid = el('div', 'power-grid');
      var btns = shuffle(OPTIONS).map(function (o) {
        var b = el('button', 'power-btn');
        b.type = 'button';
        b.appendChild(el('i', null, o.ico));
        b.appendChild(el('b', null, o.name));
        var dots = el('span', 'power-dots');
        for (var i = 0; i < 3; i++) dots.appendChild(el('s', i < o.dots ? '' : 'off'));
        b.appendChild(dots);
        rt.on(b, 'click', function () { choose(o, b); });
        grid.appendChild(b);
        return b;
      });

      wrap.appendChild(head);
      wrap.appendChild(grid);
      api.field.appendChild(wrap);

      var chipPicks = hudChip(api.hud, '');
      function hud() {
        chipPicks.set('Choice ' + Math.min(picks + 1, PICKS) + ' / ' + PICKS);
        numLeft.innerHTML = 'Campus score <strong>' + Math.round(score) + '</strong>';
        mFill.style.width = clamp(score / 100, 0, 1) * 100 + '%';
      }
      mMark.style.left = TARGET + '%';
      hud();

      function choose(o, b) {
        if (busy || picks >= PICKS) return;
        busy = true;
        score += Math.round(rnd(o.lo, o.hi));
        picks++;
        b.className = 'power-btn picked';
        btns.forEach(function (x) { x.disabled = true; });
        hud();

        rt.timeout(function () {
          if (picks >= PICKS) {
            api.end(score >= TARGET, 'Campus score ' + Math.round(score) + ' of ' + TARGET + '.');
            return;
          }
          btns.forEach(function (x) { if (!x.classList.contains('picked')) x.disabled = false; });
          busy = false;
        }, 700);
      }
    }
  };

  /* ===========================================================
     Host — cards, overlay, lifecycle
     =========================================================== */
  var GAMES = [gameTurtle, gameRace, gameBin, gameCook, gameDrop, gamePower];

  var grid = document.getElementById('gamesGrid');
  var overlay = document.getElementById('overlay');
  var panel = document.getElementById('overlayPanel');
  var closeBtn = document.getElementById('overlayClose');
  var titleEl = document.getElementById('gameTitle');
  var kickerEl = document.getElementById('gameKicker');
  var hudEl = document.getElementById('hud');
  var fieldEl = document.getElementById('field');
  var curtain = document.getElementById('curtain');
  var curtainInner = document.getElementById('curtainInner');

  if (!grid || !overlay) return;

  var current = null;      // the game definition being shown
  var runtime = null;      // runtime of the play in progress
  var session = 0;         // guards stale end() calls
  var lastFocus = null;

  /* --- cards --- */
  GAMES.forEach(function (g) {
    var card = el('button', 'game-card');
    card.type = 'button';
    card.style.setProperty('--tint', g.tint);
    card.appendChild(el('span', 'game-emblem', g.emoji));
    var text = el('span', 'game-text');
    text.appendChild(el('span', 'game-name', g.name));
    text.appendChild(el('span', 'game-tag', g.tagline));
    card.appendChild(text);
    card.addEventListener('click', function () { openGame(g, card); });
    grid.appendChild(card);
  });

  function teardown() {
    session++;
    if (runtime) { runtime.destroy(); runtime = null; }
    fieldEl.innerHTML = '';
    hudEl.innerHTML = '';
  }

  function openGame(g, fromEl) {
    lastFocus = fromEl || document.activeElement;
    teardown();
    current = g;
    titleEl.textContent = g.name;
    kickerEl.textContent = 'Mini-game';
    overlay.hidden = false;
    document.body.classList.add('locked');
    showIntro();
    closeBtn.focus({ preventScroll: true });
  }

  function closeGame() {
    teardown();
    current = null;
    overlay.hidden = true;
    document.body.classList.remove('locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function showCurtain(cls, html) {
    curtainInner.className = 'curtain-inner ' + (cls || '');
    curtainInner.innerHTML = html;
    curtain.hidden = false;
  }

  function showIntro() {
    var g = current;
    showCurtain('', [
      '<div class="curtain-emoji">' + g.emoji + '</div>',
      '<h3>' + g.name + '</h3>',
      '<p>' + g.instruction + '</p>',
      '<div class="btn-row">',
      '<button class="btn btn-go" data-act="start">' + (g.startLabel || 'Start') + '</button>',
      '<button class="btn btn-quiet" data-act="back">Back to Games</button>',
      '</div>'
    ].join(''));
  }

  function showResult(won, detail) {
    showCurtain(won ? 'result-win' : 'result-lose', [
      '<div class="curtain-emoji">' + (won ? '🎉' : '😅') + '</div>',
      '<h3>' + (won ? 'You win!' : 'Not this time') + '</h3>',
      '<p>' + (detail || '') + '</p>',
      '<div class="btn-row">',
      '<button class="btn btn-go" data-act="again">Play Again</button>',
      '<button class="btn btn-quiet" data-act="back">Back to Games</button>',
      '</div>'
    ].join(''));
  }

  function play() {
    if (!current) return;
    teardown();
    var g = current;
    var mySession = session;
    curtain.hidden = true;
    curtainInner.className = 'curtain-inner';
    curtainInner.innerHTML = '';        // never leave a stale result behind
    runtime = createRuntime();

    var api = {
      rt: runtime,
      field: fieldEl,
      hud: hudEl,
      end: function (won, detail) {
        if (mySession !== session) return;      // a stale game trying to finish
        if (runtime) { runtime.destroy(); runtime = null; }
        fieldEl.innerHTML = '';
        hudEl.innerHTML = '';
        showResult(!!won, detail);
      }
    };

    /* Give the browser one frame so the field has its final size. */
    requestAnimationFrame(function () {
      if (mySession !== session || !runtime) return;
      try {
        g.start(api);
      } catch (err) {
        if (window.console) console.error(err);
        api.end(false, 'Something went wrong — try again.');
      }
    });
  }

  /* Curtain buttons are re-created each time, so delegate. */
  curtain.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'start' || act === 'again') play();
    else if (act === 'back') closeGame();
  });

  closeBtn.addEventListener('click', closeGame);
  overlay.addEventListener('pointerdown', function (ev) {
    if (ev.target === overlay) closeGame();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !overlay.hidden) closeGame();
  });

  /* If the tab is hidden mid-game, stop and offer a clean restart. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && runtime && !overlay.hidden) {
      teardown();
      showIntro();
    }
  });

  /* Expose for the smoke tests. */
  window.UBTGames = { list: GAMES, open: openGame, close: closeGame, play: play };
})();
