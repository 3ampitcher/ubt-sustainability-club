/* ==========================================================================
   UBT Sustainability Club — page behaviour
   The official logo is used exactly as supplied from assets/logo.jpg. If the
   file is missing, show a plain wordmark rather than a broken image.
   ========================================================================== */
(function () {
  'use strict';
  var logo = document.getElementById('crestImg');
  var fallback = document.getElementById('crestFallback');
  if (!logo || !fallback) return;

  function swap() {
    logo.hidden = true;
    logo.style.display = 'none';
    fallback.hidden = false;
  }
  logo.addEventListener('error', swap);
  if (logo.complete && logo.naturalWidth === 0) swap();
})();
