// js/musicManager.js
// Lightweight BG music controller with fade + scene volumes.
// Requires an audio file at: ./assets/audio/main.mp3 (change path below if needed)

(function () {
  const MUSIC_SRC = "./assets/audio/main.mp3"; // <-- update if your path differs
  const DEFAULT_VOL = 0.6;   // normal playing volume
  const MIN_VOL = 0.0;
  const MAX_VOL = 1.0;

  // Soft fades
  const FADE_MS_SHORT = 180;   // for quick toggles / visibility changes
  const FADE_MS_LONG  = 450;   // for scene changes (optional bonus)

  let audio = null;
  let isReady = false;
  let isMuted = false;
  let intendedVol = DEFAULT_VOL; // where we want volume when unmuted
  let currentScene = "default";

  // Persisted mute
  try { isMuted = localStorage.getItem("myfi.musicMuted") === "1"; } catch (_) {}

  // ---- Splash helpers (read flags dynamically; never snapshot) ----
  function isSplashActive() {
    // If __MYFI_DEFER_MUSIC is true, treat splash as active regardless of SPLASH_DONE
    if (window.__MYFI_DEFER_MUSIC === true) return true;
    // Otherwise only active if explicitly not done (both undefined => inactive)
    return !!window.__MYFI_DEFER_MUSIC && !window.__MYFI_SPLASH_DONE;
  }
  function markSplashDone() {
    window.__MYFI_DEFER_MUSIC = false;
    window.__MYFI_SPLASH_DONE = true;
  }

  // Create audio element
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = isMuted ? 0 : intendedVol;
    audio.addEventListener("error", () => {
      console.warn("[MyFiMusic] Audio error; check path:", MUSIC_SRC);
    });
    isReady = true;
    return audio;
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

  // Mobile-safe start: play(), with load()+play() fallback to re-prime pipeline.
  async function start() {
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
        // still blocked until another user gesture
      }
    }
  }

  function pause() {
    if (!audio) return;
    audio.pause();
  }

  function updateToggleButton() {
    const btn = document.querySelector('[data-action="toggle-music"]');
    if (!btn) return;
    btn.setAttribute("aria-pressed", isMuted ? "false" : "true");
    btn.setAttribute("aria-label", isMuted ? "Unmute music" : "Mute music");
    btn.classList.toggle("is-muted", isMuted);
    const txt = btn.querySelector(".music-btn__label");
    if (txt) txt.textContent = isMuted ? "Music Off" : "Music On";
  }

  // ----- setMuted: respects splash state dynamically + cleans pending handler -----
  function setMuted(m) {
    isMuted = !!m;
    try { localStorage.setItem("myfi.musicMuted", isMuted ? "1" : "0"); } catch (_) {}

    if (!audio) ensureAudio();

    if (isMuted) {
      // Cancel any pending splash-start handler
      if (setMuted._pendingSplashHandler) {
        window.removeEventListener("splash:done", setMuted._pendingSplashHandler);
        setMuted._pendingSplashHandler = null;
      }
      // Fade out, then pause.
      fadeTo(0, FADE_MS_SHORT);
      setTimeout(() => pause(), FADE_MS_SHORT + 10);
    } else {
      // Unmuting: if splash is active right now, wait for it to finish once.
      if (isSplashActive()) {
        if (!setMuted._pendingSplashHandler) {
          setMuted._pendingSplashHandler = () => {
            setMuted._pendingSplashHandler = null;
            markSplashDone(); // defensive
            if (!document.hidden) start().then(() => fadeTo(intendedVol, FADE_MS_SHORT));
          };
          window.addEventListener("splash:done", setMuted._pendingSplashHandler, { once: true });
        }
      } else {
        // Normal path: resume now (only if tab is visible).
        if (!document.hidden) {
          start().then(() => fadeTo(intendedVol, FADE_MS_SHORT));
        }
      }
    }

    updateToggleButton();
  }

  function toggleMuted() { setMuted(!isMuted); }

  // Page visibility: pause when hidden, resume when visible (if not muted and splash inactive)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      fadeTo(0, FADE_MS_SHORT);
      setTimeout(() => pause(), FADE_MS_SHORT + 20);
    } else {
      if (!isMuted && !isSplashActive()) {
        start().then(() => fadeTo(intendedVol, FADE_MS_SHORT));
      }
    }
  });

  // Optional: scene-based volumes (bonus)
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

  // Support an optional "splash:show" event if your splash fires one
  window.addEventListener("splash:show", () => {
    window.__MYFI_DEFER_MUSIC = true;
    window.__MYFI_SPLASH_DONE = false;
  });

  // Wire up header button if it's present after DOM loads
  window.addEventListener("DOMContentLoaded", () => {
    updateToggleButton();
    ensureAudio();

    if (isSplashActive()) {
      // Wait for splash to finish before starting
      window.addEventListener("splash:done", () => {
        markSplashDone();
        if (!isMuted && !document.hidden) start();
      }, { once: true });
    } else {
      // Normal behavior: try to start (may be deferred by autoplay policy)
      if (!isMuted && !document.hidden) start();
    }
  });

  // Expose public API
  window.MyFiMusic = {
    start,
    pause,
    setMuted,
    toggleMuted,
    setScene,
    isMuted: () => isMuted,
    isReady: () => isReady,
  };
})();
