// js/musicManager.js
// BG music controller with fade, splash deferral, visibility handling, + PLAYLIST + UI helpers.


(function () {
  // === PLAYLIST ==============================================================
  // Extend/replace this list as you like. First entry auto-plays after first user gesture.
  const PLAYLIST = [
    { src: "../public/assets/music/main-full.mp3",   title: "Ember Pulse",  artist: "MyFi OST" },
  ];

  const DEFAULT_VOL = 0.7;
  const MIN_VOL = 0.0;
  const MAX_VOL = 1.0;

  const FADE_MS_SHORT = 180;
  const FADE_MS_LONG  = 450;

  let audio = null;
  let isReady = false;
  let isMuted = false;
  let intendedVol = DEFAULT_VOL;
  let currentScene = "default";

  let idx = 0; // current playlist index

  try { isMuted = localStorage.getItem("myfi.musicMuted") === "1"; } catch (_) {}

  // ---- Splash helpers (dynamic) --------------------------------------------
  function isSplashActive() {
    if (window.__MYFI_DEFER_MUSIC === true) return true;
    return !!window.__MYFI_DEFER_MUSIC && !window.__MYFI_SPLASH_DONE;
  }
  function markSplashDone() {
    window.__MYFI_DEFER_MUSIC = false;
    window.__MYFI_SPLASH_DONE = true;
  }

  // ---- Audio plumbing -------------------------------------------------------
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = isMuted ? 0 : intendedVol;
    audio.addEventListener("error", () => {
      console.warn("[MyFiMusic] Audio error; check source:", audio?.src);
    });
    audio.addEventListener("ended", () => {
      // Shouldn't fire with loop=true, but keep as guard.
      next();
    });
    isReady = true;
    // load current index source
    setSource(idx);
    return audio;
  }

  function setSource(i) {
    idx = (i + PLAYLIST.length) % PLAYLIST.length;
    const item = PLAYLIST[idx];
    ensureAudio();
    if (!item) return;
    if (audio.src !== new URL(item.src, location.href).href) {
      audio.src = item.src;
    }
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function fadeTo(targetVol, ms = FADE_MS_SHORT) {
    ensureAudio();
    const start = audio.volume;
    const end = clamp(targetVol, MIN_VOL, MAX_VOL);
    if (ms <= 0) { audio.volume = end; return; }
    const startTime = performance.now();

    function step(t) {
      const p = clamp((t - startTime) / ms, 0, 1);
      audio.volume = start + (end - start) * p;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  async function _playCurrent() {
    ensureAudio();
    try {
      if (!isMuted) audio.volume = intendedVol;
      await audio.play();
    } catch (err) {
      try {
        audio.load();
        if (!isMuted) audio.volume = intendedVol;
        await audio.play();
      } catch (_) {
        // still blocked until a user gesture
      }
    }
    dispatchChanged();
  }

  function pause() {
    if (!audio) return;
    audio.pause();
    dispatchChanged();
  }

  // ---- Visibility handling --------------------------------------------------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      fadeTo(0, FADE_MS_SHORT);
      setTimeout(() => pause(), FADE_MS_SHORT + 20);
    } else {
      if (!isMuted && !isSplashActive()) {
        _playCurrent().then(() => fadeTo(intendedVol, FADE_MS_SHORT));
      }
    }
  });

  // ---- Scenes / volumes -----------------------------------------------------
  const SCENE_VOLUMES = {
    default: DEFAULT_VOL,
    vitals:  0.55,
    game:    0.7,
    shop:    0.45,
    modal:   0.35,
    quiet:   0.25,
  };

  function setScene(sceneName, fadeMs = FADE_MS_LONG) {
    currentScene = sceneName || "default";
    const target = SCENE_VOLUMES[currentScene] ?? DEFAULT_VOL;
    intendedVol = clamp(target, MIN_VOL, MAX_VOL);
    if (!isMuted && audio && !document.hidden && !audio.paused && !isSplashActive()) {
      fadeTo(intendedVol, fadeMs);
    }
  }

  // ---- Splash integration ---------------------------------------------------
  window.addEventListener("splash:show", () => {
    window.__MYFI_DEFER_MUSIC = true;
    window.__MYFI_SPLASH_DONE = false;
  });

  // ---- Public control (mute / toggle / playlist) ----------------------------
  function setMuted(m) {
    isMuted = !!m;
    try { localStorage.setItem("myfi.musicMuted", isMuted ? "1" : "0"); } catch (_) {}
    if (!audio) ensureAudio();

    if (isMuted) {
      // cancel pending splash handler
      if (setMuted._pendingSplashHandler) {
        window.removeEventListener("splash:done", setMuted._pendingSplashHandler);
        setMuted._pendingSplashHandler = null;
      }
      fadeTo(0, FADE_MS_SHORT);
      setTimeout(() => pause(), FADE_MS_SHORT + 10);
    } else {
      if (isSplashActive()) {
        if (!setMuted._pendingSplashHandler) {
          setMuted._pendingSplashHandler = () => {
            setMuted._pendingSplashHandler = null;
            markSplashDone();
            if (!document.hidden) _playCurrent().then(() => fadeTo(intendedVol, FADE_MS_SHORT));
          };
          window.addEventListener("splash:done", setMuted._pendingSplashHandler, { once: true });
        }
      } else {
        if (!document.hidden) {
          _playCurrent().then(() => fadeTo(intendedVol, FADE_MS_SHORT));
        }
      }
    }
    updateToggleButton();
    dispatchChanged();
  }

  function toggleMuted() { setMuted(!isMuted); }

  function play(index = idx) {
    setSource(index);
    if (!isMuted && !document.hidden && !isSplashActive()) {
      _playCurrent();
    }
    dispatchChanged();
  }

  function next() {
    setSource(idx + 1);
    if (!isMuted && !document.hidden && !isSplashActive()) {
      _playCurrent();
    }
    dispatchChanged();
  }

  function prev() {
    setSource(idx - 1);
    if (!isMuted && !document.hidden && !isSplashActive()) {
      _playCurrent();
    }
    dispatchChanged();
  }

  function togglePlayPause() {
    ensureAudio();
    if (audio.paused) _playCurrent();
    else {
      fadeTo(0, FADE_MS_SHORT);
      setTimeout(() => pause(), FADE_MS_SHORT + 10);
    }
  }

  // ---- UI helpers & events --------------------------------------------------
  function updateToggleButton() {
    const btn = document.querySelector('[data-action="toggle-music"]');
    if (!btn) return;
    btn.setAttribute("aria-pressed", isMuted ? "false" : "true");
    btn.setAttribute("aria-label", isMuted ? "Unmute music" : "Mute music");
    btn.classList.toggle("is-muted", isMuted);
    const txt = btn.querySelector(".music-btn__label");
    if (txt) txt.textContent = isMuted ? "Music Off" : "Music On";
  }

  function getNowPlaying() {
    const item = PLAYLIST[idx] || {};
    return {
      index: idx,
      title: item.title || "Unknown Track",
      artist: item.artist || "",
      isPlaying: !!(audio && !audio.paused),
      isMuted,
      total: PLAYLIST.length
    };
  }

  function dispatchChanged() {
    const detail = getNowPlaying();
    window.dispatchEvent(new CustomEvent('music:changed', { detail }));
  }

  // Attempt to start on first load if allowed
  window.addEventListener("DOMContentLoaded", () => {
    updateToggleButton();
    ensureAudio();
    if (isSplashActive()) {
      window.addEventListener("splash:done", () => {
        markSplashDone();
        if (!isMuted && !document.hidden) _playCurrent();
      }, { once: true });
    } else {
      if (!isMuted && !document.hidden) _playCurrent();
    }
  });

  // ---- Export both engine + tiny UI API (so header code can call these) -----
  window.MyFiMusic = {
    // engine
    play, next, prev, pause, togglePlayPause,
    setMuted, toggleMuted, setScene,
    isMuted: () => isMuted, isReady: () => isReady,
    // data
    getNowPlaying,
    // for external list UIs
    getPlaylist: () => PLAYLIST.slice(),
    playAt: (i) => play(i|0)
  };

})();
