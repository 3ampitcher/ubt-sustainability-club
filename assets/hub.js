/* ==========================================================================
   UBT Sustainability Club — hub behaviour
   Booth rating + the logo safety net. No dependencies, no cookies, and
   nothing that identifies a person is ever read, stored or sent.
   ========================================================================== */
(function () {
  'use strict';

  /* ========================================================================
     ▼▼▼  THE ONLY PART YOU NEED TO EDIT  ▼▼▼

     Where should booth ratings be collected?

     A GitHub Pages site is static — it can serve this page to a thousand
     phones but it cannot store anything itself. So the ratings have to land
     in a service you own. Pick one mode:

     ── 'off' (default) ──────────────────────────────────────────────────
     Ratings are counted only in the browser they were tapped in. Fine for
     a booth tablet, useless for students on their own phones. Open the page
     with ?tally on the end of the URL to see and download what that one
     device collected.

     ── 'google' ─────────────────────────────────────────────────────────
     One tap, no second screen, results land in a Google Sheet you own.
     This is the one to use if students open the page on their own phones.

       1. Go to forms.google.com and make a new form.
       2. Add ONE question, type "Short answer", titled e.g. "Booth rating".
       3. Top right: Send → the link icon (🔗) → copy the link.
          It looks like  https://forms.gle/xxxx  — open it, then copy the
          full https://docs.google.com/forms/d/e/1FAIpQL..../viewform URL
          from the address bar.
       4. From that URL, the long code between /e/ and /viewform is your
          formId. Paste it below.
       5. To get the entryId: on the live form, right-click the answer box →
          Inspect, and find the input's name — it looks like entry.123456789.
          (Or: form editor → ⋮ → "Get pre-filled link", fill anything,
          Get link, and read entry.NNNNNNN out of the copied URL.)
       6. Set mode to 'google' and fill in both values.

     ── 'link' ───────────────────────────────────────────────────────────
     Opens a form you already have (a Microsoft Form, say) in a new tab with
     the rating passed along. The student has to press Submit there, so
     fewer will finish — but there is nothing new to set up.
     ==================================================================== */

  var FEEDBACK = {
    mode: 'off',            // 'off' | 'google' | 'link'

    formId:  '',            // google: the code between /e/ and /viewform
    entryId: '',            // google: e.g. 'entry.123456789'

    linkUrl: ''             // link: e.g. your Microsoft Form URL
  };

  /* ▲▲▲  END OF THE PART YOU NEED TO EDIT  ▲▲▲ ========================== */

  var SCALE = [
    { key: 'terrible', label: 'Terrible', face: '😞', score: 1 },
    { key: 'poor',     label: 'Poor',     face: '🙁', score: 2 },
    { key: 'okay',     label: 'Okay',     face: '😐', score: 3 },
    { key: 'great',    label: 'Great',    face: '🙂', score: 4 },
    { key: 'amazing',  label: 'Amazing',  face: '🤩', score: 5 }
  ];

  var STORE = 'ubt-booth-ratings';
  var RESET_AFTER = 6000;          // hand the widget back for the next person

  /* ── local record: a backup on this device, and what ?tally reads ────── */
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; }
    catch (e) { return []; }
  }
  function saveLocal(entry) {
    try {
      var all = readLocal();
      all.push(entry);
      localStorage.setItem(STORE, JSON.stringify(all.slice(-2000)));
    } catch (e) { /* private mode, full quota — the send still happened */ }
  }

  /* ── send it somewhere that outlives this browser ────────────────────── */
  function send(choice) {
    if (FEEDBACK.mode === 'google' && FEEDBACK.formId && FEEDBACK.entryId) {
      var body = new FormData();
      body.append(FEEDBACK.entryId, choice.label);
      /* no-cors: the response is opaque, which is fine — Google records the
         row either way, and there is nothing we need to read back. */
      fetch('https://docs.google.com/forms/d/e/' + FEEDBACK.formId + '/formResponse',
            { method: 'POST', mode: 'no-cors', body: body })
        .catch(function () { /* offline: the local copy above still has it */ });
      return;
    }
    if (FEEDBACK.mode === 'link' && FEEDBACK.linkUrl) {
      var sep = FEEDBACK.linkUrl.indexOf('?') === -1 ? '?' : '&';
      window.open(FEEDBACK.linkUrl + sep + 'rating=' + encodeURIComponent(choice.label),
                  '_blank', 'noopener');
    }
  }

  /* ── the widget ──────────────────────────────────────────────────────── */
  var row = document.getElementById('rateRow');
  var thanks = document.getElementById('rateThanks');
  if (!row || !thanks) return;

  var buttons = [];
  var resetTimer = null;

  function build() {
    SCALE.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rate-btn';
      btn.id = 'rate-' + c.key;
      btn.setAttribute('aria-label', c.label);

      var face = document.createElement('span');
      face.className = 'rate-face';
      face.textContent = c.face;
      face.setAttribute('aria-hidden', 'true');

      var label = document.createElement('span');
      label.className = 'rate-label';
      label.textContent = c.label;

      btn.appendChild(face);
      btn.appendChild(label);
      btn.addEventListener('click', function () { choose(c, btn); });
      row.appendChild(btn);
      buttons.push(btn);
    });
  }

  function choose(c, btn) {
    if (btn.disabled) return;

    saveLocal({ rating: c.label, score: c.score, at: new Date().toISOString() });
    send(c);

    buttons.forEach(function (b) { b.disabled = true; b.classList.remove('chosen'); });
    btn.classList.add('chosen');
    thanks.textContent = 'Thank you — noted.';
    thanks.hidden = false;

    clearTimeout(resetTimer);
    resetTimer = setTimeout(reset, RESET_AFTER);
  }

  function reset() {
    buttons.forEach(function (b) { b.disabled = false; b.classList.remove('chosen'); });
    thanks.hidden = true;
    thanks.textContent = '';
  }

  build();

  /* ── ?tally — what this one device has collected, as a CSV ───────────── */
  if (/[?&]tally\b/.test(location.search)) {
    var all = readLocal();
    var box = document.createElement('div');
    box.className = 'rate';
    box.style.marginTop = '12px';

    var counts = SCALE.map(function (c) {
      return c.label + ': ' + all.filter(function (r) { return r.rating === c.label; }).length;
    }).join('  ·  ');

    var p = document.createElement('p');
    p.style.cssText = 'margin:0 0 12px;font-size:13px;color:var(--muted);text-align:center';
    p.textContent = all.length + ' rating' + (all.length === 1 ? '' : 's') +
                    ' on this device — ' + counts;

    var dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'btn btn-quiet';
    dl.style.cssText = 'display:block;margin:0 auto;font-size:14px';
    dl.textContent = 'Download CSV';
    dl.addEventListener('click', function () {
      var csv = 'rating,score,timestamp\n' + all.map(function (r) {
        return r.rating + ',' + r.score + ',' + r.at;
      }).join('\n');
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ubt-booth-ratings.csv';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    box.appendChild(p);
    box.appendChild(dl);
    document.getElementById('rate').parentNode.appendChild(box);
  }

  /* ── logo safety net ─────────────────────────────────────────────────────
     The official logo is used exactly as supplied from assets/logo.png. If
     that file is not there yet, show a plain wordmark rather than a broken
     image, so the page never looks unfinished. */
  var crest = document.getElementById('crestImg');
  var crestFallback = document.getElementById('crestFallback');
  if (crest && crestFallback) {
    var swap = function () {
      crest.hidden = true;
      crest.style.display = 'none';
      crestFallback.hidden = false;
    };
    crest.addEventListener('error', swap);
    if (crest.complete && crest.naturalWidth === 0) swap();
  }
})();
