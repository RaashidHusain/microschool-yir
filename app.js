/* ===== Imam Al-Asr MicoSchool 2025-2026· fun photo journey ===== */
(function () {
  "use strict";

  const WEB = (i) => `images/photo-${i}.jpg`;
  const THUMB = (i) => `thumbs/photo-${i}.jpg`;

  const HERO_TAGS = [
    "Where every day is an adventure ✨",
    "734 happy memories and counting 📸",
    "Smiles, snacks, puzzles & friends 🧩",
    "Our class. Our story. Our fun. 🌟",
  ];

  const $ = (s) => document.querySelector(s);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let PHOTOS = [];          // available indices
  let order = [];           // shuffled play order
  let CAPTIONS = {};        // { photoIndex: "youthful caption" } from captions.json

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- NAV: solidify on scroll ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.7);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- HERO rotating tagline ---------- */
  const heroTag = $("#heroTag");
  let tagI = 0;
  if (!reduceMotion) {
    setInterval(() => {
      tagI = (tagI + 1) % HERO_TAGS.length;
      heroTag.style.opacity = 0;
      setTimeout(() => { heroTag.textContent = HERO_TAGS[tagI]; heroTag.style.opacity = 1; }, 350);
    }, 4200);
    heroTag.style.transition = "opacity .35s ease";
  }

  /* ---------- BOOTSTRAP: manifest + AI/OCR captions ---------- */
  Promise.all([
    // Cache-bust: the manifest used to be cached "immutable" for a year, so a
    // changing query param forces browsers/CDN to fetch the current photo list.
    fetch("images/manifest.json?v=" + Date.now()).then((r) => r.json()).catch(() => null),
    fetch("captions.json").then((r) => r.json()).catch(() => ({})),
  ]).then(([m, caps]) => {
    CAPTIONS = caps || {};
    PHOTOS = (m && m.photos) || Array.from({ length: 734 }, (_, i) => i);
    order = shuffle(PHOTOS);
    start();
  });

  // Caption for a photo: the AI/OCR caption if we have one, else nothing.
  const captionFor = (idx) => CAPTIONS[idx] || CAPTIONS[String(idx)] || "";

  function start() {
    buildHero();
    buildStory();
    buildGallery();
    animateCount();
  }

  /* ---------- HERO background slideshow ---------- */
  function buildHero() {
    const wrap = $("#heroSlides");
    // Two crossfading layers; we keep advancing through a shuffled queue of
    // ALL photos so the same picture never comes back until every one has shown.
    const slides = [0, 1].map(() => {
      const d = document.createElement("div");
      d.className = "slide";
      wrap.appendChild(d);
      return d;
    });

    let queue = shuffle(PHOTOS);
    let qi = 0;
    const nextIdx = () => {
      if (qi >= queue.length) { queue = shuffle(PHOTOS); qi = 0; }
      return queue[qi++];
    };
    // Crossfade to a photo only after it has loaded (no blank flash).
    const showOn = (d, idx, cb) => {
      const img = new Image();
      img.src = WEB(idx);
      img.onload = img.onerror = () => {
        d.style.backgroundImage = `url("${WEB(idx)}")`;
        if (cb) cb();
      };
    };

    let h = 0;
    showOn(slides[0], nextIdx());
    slides[0].classList.add("on");
    if (reduceMotion || PHOTOS.length < 2) return;

    setInterval(() => {
      const off = h;
      const inc = (h + 1) % slides.length;
      showOn(slides[inc], nextIdx(), () => {   // next unseen photo, swap once loaded
        slides[inc].classList.add("on");
        slides[off].classList.remove("on");
        h = inc;
      });
    }, 4500);
  }

  /* ---------- STORY auto player ---------- */
  function buildStory() {
    const img = $("#storyImg");
    const cap = $("#storyCaption");
    const count = $("#storyCount");
    const prog = $("#storyProgress");
    const playBtn = $("#storyPlay");
    const wrap = $("#playerWrap");
    const music = $("#storyMusic");
    const muteBtn = $("#storyMute");
    let pos = 0;
    let playing = true;

    /* ---------- Background music (follows the slideshow's play/pause) ---------- */
    if (music) music.volume = 0.35; // gentle, in-the-background level
    function syncMusic() {
      if (!music) return;
      if (playing && !music.muted) {
        // play() can reject if the browser is still blocking autoplay; ignore it.
        const p = music.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        music.pause();
      }
    }
    if (muteBtn && music) {
      muteBtn.addEventListener("click", () => {
        music.muted = !music.muted;
        muteBtn.textContent = music.muted ? "🔇" : "🔊";
        muteBtn.setAttribute("aria-label", music.muted ? "Unmute music" : "Mute music");
        syncMusic();
      });
    }
    // Browsers block audio until the visitor interacts; start it on the first gesture.
    function primeMusic() {
      syncMusic();
      document.removeEventListener("pointerdown", primeMusic);
      document.removeEventListener("keydown", primeMusic);
    }
    document.addEventListener("pointerdown", primeMusic);
    document.addEventListener("keydown", primeMusic);
    let timer = null;
    let tick = null;
    // Base pace = 15 min / photo count, plus a flat +2s per photo for a more
    // relaxed viewing speed (so each image lingers a couple seconds longer).
    const TOTAL_MS = 15 * 60 * 1000; // 900,000 ms
    const EXTRA_PER_PHOTO_MS = 2000; // +2s on every slide
    const isFull = () => document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap;
    const curDur = () => TOTAL_MS / order.length + EXTRA_PER_PHOTO_MS;

    function render() {
      const idx = order[pos];
      img.classList.add("fade");
      const next = new Image();
      next.src = WEB(idx);
      next.onload = () => {
        img.src = next.src;
        img.classList.remove("fade");
      };
      const capText = captionFor(idx);
      cap.textContent = capText;
      cap.style.display = capText ? "block" : "none";
      count.textContent = `${pos + 1} / ${order.length}`;
      // preload upcoming
      const pre = new Image(); pre.src = WEB(order[(pos + 1) % order.length]);
    }
    function go(n) {
      pos = (n + order.length) % order.length;
      render();
      restart();
    }
    function startProgress() {
      if (reduceMotion) return;
      const dur = curDur();
      let t0 = performance.now();
      cancelAnimationFrame(tick);
      const loop = (now) => {
        const pct = Math.min(100, ((now - t0) / dur) * 100);
        prog.style.width = pct + "%";
        if (playing) tick = requestAnimationFrame(loop);
      };
      tick = requestAnimationFrame(loop);
    }
    function restart() {
      clearInterval(timer);
      if (playing) {
        startProgress();
        timer = setInterval(() => go(pos + 1), curDur());
      }
    }
    function setPlaying(p) {
      playing = p;
      playBtn.textContent = p ? "⏸" : "▶";
      if (p) restart();
      else { clearInterval(timer); cancelAnimationFrame(tick); }
      syncMusic();
    }

    $("#storyNext").addEventListener("click", () => go(pos + 1));
    $("#storyPrev").addEventListener("click", () => go(pos - 1));
    playBtn.addEventListener("click", () => setPlaying(!playing));

    // ----- Touch swipe (mobile): flip photos with a flick -----
    const stage = $(".player__stage");
    let tx = 0, ty = 0, swiped = false;
    stage.addEventListener("touchstart", (e) => {
      tx = e.touches[0].clientX; ty = e.touches[0].clientY; swiped = false;
    }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        swiped = true;
        go(dx < 0 ? pos + 1 : pos - 1);
      }
    }, { passive: true });

    // Tapping the photo: advance in fullscreen, else open the big lightbox.
    // (A swipe sets the flag so it doesn't also trigger a tap.)
    img.addEventListener("click", () => {
      if (swiped) { swiped = false; return; }
      if (isFull()) go(pos + 1);
      else openLightbox(Math.max(0, PHOTOS.indexOf(order[pos])));
    });

    // ----- Fullscreen control -----
    function enterFull() {
      (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
    }
    function exitFull() {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
    function toggleFull() { isFull() ? exitFull() : enterFull(); }
    $("#storyFs").addEventListener("click", toggleFull);
    const bigFs = $("#storyFsBig");
    if (bigFs) bigFs.addEventListener("click", enterFull);

    function onFsChange() {
      const full = isFull();
      $("#storyFs").textContent = full ? "✕" : "⛶";
      if (!playing) setPlaying(true);   // auto-play the show when going fullscreen
      else restart();                    // re-time at the new (faster/slower) speed
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);

    // Arrow keys / space drive the slideshow while in fullscreen
    document.addEventListener("keydown", (e) => {
      if (!isFull()) return;
      if (e.key === "ArrowRight") go(pos + 1);
      else if (e.key === "ArrowLeft") go(pos - 1);
      else if (e.key === " ") { e.preventDefault(); setPlaying(!playing); }
    });

    // Pause auto-play when the section is off-screen to save data (never while fullscreen)
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (isFull()) return;
        if (!e.isIntersecting && playing) clearInterval(timer);
        else if (e.isIntersecting && playing) restart();
      });
    }, { threshold: 0.25 });
    io.observe($(".player"));

    render();
    if (reduceMotion) { setPlaying(false); } else { restart(); }
  }

  /* ---------- GALLERY grid + reveal ---------- */
  function buildGallery() {
    const grid = $("#grid");
    const frag = document.createDocumentFragment();
    PHOTOS.forEach((idx, i) => {
      const fig = document.createElement("figure");
      const im = document.createElement("img");
      im.loading = "lazy";
      im.decoding = "async";
      im.src = THUMB(idx);
      im.alt = "A happy class memory";
      fig.appendChild(im);
      fig.addEventListener("click", () => openLightbox(i));
      frag.appendChild(fig);
    });
    grid.appendChild(frag);

    const figs = grid.querySelectorAll("figure");
    if (reduceMotion) { figs.forEach((f) => f.classList.add("in")); return; }
    const io = new IntersectionObserver((es, obs) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); } });
    }, { rootMargin: "120px" });
    figs.forEach((f) => io.observe(f));
  }

  /* ---------- LIGHTBOX (with its own slideshow) ---------- */
  const lb = $("#lightbox");
  const lbImg = $("#lbImg");
  const lbPlay = $("#lbPlay");
  let lbPos = 0;
  let lbTimer = null;

  const lbCaption = $("#lbCaption");
  function showLb() {
    const idx = PHOTOS[lbPos];
    lbImg.src = WEB(idx);
    // Only show real AI/OCR captions in the lightbox (skip random filler).
    const c = CAPTIONS[idx] || CAPTIONS[String(idx)] || "";
    lbCaption.textContent = c;
    lbCaption.style.display = c ? "block" : "none";
    const pre = new Image(); pre.src = WEB(PHOTOS[(lbPos + 1) % PHOTOS.length]);
  }
  function openLightbox(pos) {
    lbPos = pos;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    showLb();
  }
  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    stopLbPlay();
  }
  function lbGo(n) { lbPos = (n + PHOTOS.length) % PHOTOS.length; showLb(); }
  function startLbPlay() {
    lbPlay.textContent = "⏸ Pause";
    lbTimer = setInterval(() => lbGo(lbPos + 1), 3000);
  }
  function stopLbPlay() {
    lbPlay.textContent = "▶ Slideshow";
    clearInterval(lbTimer); lbTimer = null;
  }

  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbNext").addEventListener("click", () => lbGo(lbPos + 1));
  $("#lbPrev").addEventListener("click", () => lbGo(lbPos - 1));
  lbPlay.addEventListener("click", () => (lbTimer ? stopLbPlay() : startLbPlay()));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") lbGo(lbPos + 1);
    if (e.key === "ArrowLeft") lbGo(lbPos - 1);
  });

  /* ---------- COUNT-UP ---------- */
  function animateCount() {
    const el = document.querySelector(".band__num[data-count]");
    if (!el) return;
    const target = +el.dataset.count;
    if (reduceMotion) { el.textContent = target; return; }
    const io = new IntersectionObserver((es, obs) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        let n = 0; const step = Math.ceil(target / 60);
        const t = setInterval(() => {
          n += step;
          if (n >= target) { n = target; clearInterval(t); }
          el.textContent = n;
        }, 24);
      });
    });
    io.observe(el);
  }

  /* ---------- SURPRISE button → confetti + random photo ---------- */
  $("#surpriseBtn").addEventListener("click", () => {
    confettiBurst();
    const p = Math.floor(Math.random() * PHOTOS.length);
    openLightbox(p);
  });

  /* ---------- CONFETTI ---------- */
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  function confettiBurst() {
    if (reduceMotion) return;
    canvas.classList.add("go");
    canvas.width = innerWidth; canvas.height = innerHeight;
    const colors = ["#2b6ef6", "#ff5a8a", "#ffc83d", "#36d399", "#a78bfa"];
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2, y: innerHeight / 3,
      vx: (Math.random() - 0.5) * 16, vy: Math.random() * -16 - 4,
      g: 0.4 + Math.random() * 0.3, s: 6 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)], r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
    }));
    let frames = 0;
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      });
      frames++;
      if (frames < 150) requestAnimationFrame(draw);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.classList.remove("go"); }
    })();
  }
})();
