// Hash-based router for "BE LIGHT".
// Listens to location.hash and swaps between the Tree homepage and chapters.
// Public contract (unchanged from the previous inline version):
//   #         | #home   -> show #homepage, hide #chapter-container
//   #capitulo-NN        -> hide #homepage, fetch the mapped file into
//                          #chapter-container, re-execute any <script> tags
// Chapters that need their own JS (WebGL scenes) embed an <iframe> internally —
// the router only injects their wrapper HTML.

(function () {
  const chapterMap = {
    '01': 'cap-01-focus.html',
    '02': 'cap-02-path.html',
    '03': 'cap-03-adaptability.html',
    '04': 'cap-04-coherence.html',
    '05': 'cap-05.html',
    '06': 'cap-06.html',
    '07': 'cap-07.html',
    '08': 'cap-08.html',
    '09': 'cap-09.html',
    '10': 'cap-10.html',
    '11': 'cap-11.html',
  };

  // Chapters exempt from the portrait rotate-overlay: sensor-driven
  // experiences where the phone lives in the hand at any angle (11 —
  // IRIDESCENCE reads the gyroscope; forcing landscape would fight the
  // very gesture the chapter asks for). Flagged on <body> so the
  // overlay's CSS in index.html can stand down.
  const orientationFree = { '11': true };

  function renderFallback(container, num) {
    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;'
      + 'font-family:\'Space Grotesk\',sans-serif;background:var(--bg,#fffff);color:var(--fg,#1a1a1a);">'
      + '<div style="text-align:center;">'
      + '<p style="font-size:13px;font-weight:300;letter-spacing:0.3em;color:var(--fg-dim,rgba(0,0,0,0.4));margin-bottom:18px;">CAPÍTULO ' + num + '</p>'
      + '<p style="font-size:11px;font-weight:300;letter-spacing:0.15em;color:var(--fg-faint,rgba(0,0,0,0.25));">PRÓXIMAMENTE</p>'
      + '<a href="#home" style="display:inline-block;margin-top:36px;font-size:10px;font-weight:400;letter-spacing:0.3em;'
      + 'color:var(--fg-dim,rgba(0,0,0,0.4));text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:3px;font-family:\'Space Mono\',monospace;">VOLVER</a>'
      + '</div></div>';
  }

  function loadChapter(container, file, num) {
    fetch(file)
      .then(function (r) {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(function (html) {
        container.innerHTML = html;
        // innerHTML does not execute <script> tags — clone and replace them so
        // each chapter's logic runs. Heavy WebGL chapters wrap their scripts
        // in an <iframe>, which executes naturally via its src attribute.
        container.querySelectorAll('script').forEach(function (old) {
          const s = document.createElement('script');
          for (const a of old.attributes) s.setAttribute(a.name, a.value);
          s.textContent = old.textContent;
          old.replaceWith(s);
        });
      })
      .catch(function () { renderFallback(container, num); });
  }

  function handleRoute() {
    const hash = window.location.hash;
    const homepage = document.getElementById('homepage');
    const container = document.getElementById('chapter-container');
    if (!homepage || !container) return;

    if (!hash || hash === '#' || hash === '#home') {
      homepage.style.display = '';
      container.style.display = 'none';
      container.innerHTML = '';
      document.body.classList.remove('chapter-active', 'orientation-free');
      return;
    }

    if (hash.indexOf('#capitulo-') === 0) {
      homepage.style.display = 'none';
      container.style.display = 'block';
      document.body.classList.add('chapter-active');

      const num = hash.replace('#capitulo-', '');
      document.body.classList.toggle('orientation-free', orientationFree[num] === true);
      const file = chapterMap[num];
      if (file) loadChapter(container, file, num);
      else renderFallback(container, num);
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
})();
