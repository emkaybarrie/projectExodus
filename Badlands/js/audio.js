/**
 * BADLANDS: Audio System
 *
 * Generates procedural music using Web Audio API.
 * No external audio files required - everything is synthesized.
 *
 * Design Decision: Procedural audio ensures the prototype runs anywhere
 * without asset dependencies, and allows precise beat timing control.
 */

const AudioSystem = (() => {
  let audioCtx = null;
  let masterGain = null;
  let isInitialized = false;
  let isPlaying = false;

  // Music state
  let bpm = 120; // Beats per minute
  let beatInterval = 500; // ms between beats (derived from BPM)
  let nextBeatTime = 0;
  let currentBeat = 0;

  // Schedulers
  let schedulerInterval = null;
  const scheduleAheadTime = 0.1; // seconds to schedule ahead
  const lookahead = 25; // ms between scheduler calls

  // Sound buffers
  const sounds = {};

  // Beat callbacks
  const beatListeners = [];

  /**
   * Initialize the audio context (must be called from user gesture)
   */
  function init() {
    if (isInitialized) return Promise.resolve();

    return new Promise((resolve) => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.value = 0.5;

      // Create sound presets
      createSounds();

      isInitialized = true;
      console.log('[Audio] Initialized');
      resolve();
    });
  }

  /**
   * Create synthesized sound presets
   */
  function createSounds() {
    // We'll create sounds on-demand using synthesis
    // This keeps things lightweight
  }

  /**
   * Set BPM and recalculate beat interval
   */
  function setBPM(newBPM) {
    bpm = Math.max(60, Math.min(200, newBPM));
    beatInterval = (60 / bpm) * 1000;
    console.log(`[Audio] BPM set to ${bpm} (interval: ${beatInterval.toFixed(0)}ms)`);
  }

  /**
   * Get current BPM
   */
  function getBPM() {
    return bpm;
  }

  /**
   * Get beat interval in milliseconds
   */
  function getBeatInterval() {
    return beatInterval;
  }

  /**
   * Start the music/beat scheduler
   */
  function startMusic() {
    if (!isInitialized || isPlaying) return;

    // Resume audio context if suspended
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isPlaying = true;
    currentBeat = 0;
    nextBeatTime = audioCtx.currentTime;

    // Start scheduler
    schedulerInterval = setInterval(scheduler, lookahead);
    console.log('[Audio] Music started');
  }

  /**
   * Stop the music
   */
  function stopMusic() {
    if (!isPlaying) return;

    isPlaying = false;
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    currentBeat = 0;
    console.log('[Audio] Music stopped');
  }

  /**
   * Scheduler - runs ahead of time to schedule beats
   */
  function scheduler() {
    if (!isPlaying) return;

    while (nextBeatTime < audioCtx.currentTime + scheduleAheadTime) {
      scheduleBeat(nextBeatTime, currentBeat);
      nextBeatTime += beatInterval / 1000;
      currentBeat++;
    }
  }

  /**
   * Schedule a beat at a specific time
   */
  function scheduleBeat(time, beatNum) {
    // Determine beat type (4/4 time signature)
    const beatInMeasure = beatNum % 4;
    const isDownbeat = beatInMeasure === 0;
    const isOffbeat = beatInMeasure === 2;

    // Play kick on downbeats
    if (isDownbeat) {
      playKick(time, 0.6);
    }

    // Play hihat on all beats
    playHihat(time, isDownbeat ? 0.3 : 0.15);

    // Play snare on offbeats
    if (isOffbeat) {
      playSnare(time, 0.4);
    }

    // Bass note on downbeat
    if (isDownbeat) {
      playBass(time, 0.3);
    }

    // Notify beat listeners (with slight delay to match audio)
    const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
    setTimeout(() => {
      notifyBeatListeners(beatNum, isDownbeat);
    }, delayMs);
  }

  /**
   * Synthesize a kick drum sound
   */
  function playKick(time, volume = 0.5) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  /**
   * Synthesize a snare drum sound
   */
  function playSnare(time, volume = 0.4) {
    // Noise burst
    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    // Highpass filter for snare snap
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noise.start(time);
    noise.stop(time + 0.15);

    // Body tone
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.05);
    oscGain.gain.setValueAtTime(volume * 0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  /**
   * Synthesize a hihat sound
   */
  function playHihat(time, volume = 0.2) {
    const bufferSize = audioCtx.sampleRate * 0.05;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  /**
   * Synthesize a bass note
   */
  function playBass(time, volume = 0.3) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Western-style bass progression (pentatonic)
    const notes = [55, 65.41, 73.42, 82.41]; // A1, C2, D2, E2
    const measure = Math.floor(currentBeat / 4) % notes.length;
    const freq = notes[measure];

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    // Low pass for warmth
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 1;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(time);
    osc.stop(time + 0.4);
  }

  /**
   * Play a one-shot sound effect
   */
  function playSFX(type, volume = 0.5) {
    if (!isInitialized || !audioCtx) return;

    const time = audioCtx.currentTime;

    switch (type) {
      case 'jump':
        playJumpSFX(time, volume);
        break;
      case 'attack':
        playAttackSFX(time, volume);
        break;
      case 'hit':
        playHitSFX(time, volume);
        break;
      case 'death':
        playDeathSFX(time, volume);
        break;
      case 'beatHit':
        playBeatHitSFX(time, volume);
        break;
      case 'combo':
        playComboSFX(time, volume);
        break;
    }
  }

  function playJumpSFX(time, volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.1);
    gain.gain.setValueAtTime(volume * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  function playAttackSFX(time, volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
    gain.gain.setValueAtTime(volume * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  function playHitSFX(time, volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
    gain.gain.setValueAtTime(volume * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  function playDeathSFX(time, volume) {
    for (let i = 0; i < 5; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = time + i * 0.1;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200 - i * 30, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      gain.gain.setValueAtTime(volume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  }

  function playBeatHitSFX(time, volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, time);
    gain.gain.setValueAtTime(volume * 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  function playComboSFX(time, volume) {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = time + i * 0.05;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(volume * 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  /**
   * Register a callback for beat events
   */
  function onBeat(callback) {
    beatListeners.push(callback);
  }

  /**
   * Remove a beat listener
   */
  function offBeat(callback) {
    const idx = beatListeners.indexOf(callback);
    if (idx > -1) beatListeners.splice(idx, 1);
  }

  /**
   * Notify all beat listeners
   */
  function notifyBeatListeners(beatNum, isDownbeat) {
    beatListeners.forEach(cb => cb(beatNum, isDownbeat));
  }

  /**
   * Get current audio time
   */
  function getCurrentTime() {
    return audioCtx ? audioCtx.currentTime : 0;
  }

  /**
   * Set master volume
   */
  function setVolume(vol) {
    if (masterGain) {
      masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  /**
   * Check if audio is currently playing
   */
  function isAudioPlaying() {
    return isPlaying;
  }

  // Public API
  return {
    init,
    setBPM,
    getBPM,
    getBeatInterval,
    startMusic,
    stopMusic,
    playSFX,
    onBeat,
    offBeat,
    getCurrentTime,
    setVolume,
    isPlaying: isAudioPlaying
  };
})();
