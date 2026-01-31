// audio.js — Audio Manager
// Sound effects and procedural music using Web Audio API

/**
 * Create the audio manager
 */
export function createAudioManager() {
  let context = null;
  let masterVolume = 0.7;
  let musicVolume = 0.4;
  let sfxVolume = 0.8;
  let currentMusic = null;
  let musicGain = null;
  let sfxGain = null;
  let musicInterval = null;
  let currentRegion = 'frontier';

  // Sound cache
  const sounds = new Map();

  /**
   * Initialize audio context (must be called from user interaction)
   */
  function init() {
    if (context) return;

    context = new (window.AudioContext || window.webkitAudioContext)();

    // Create gain nodes
    musicGain = context.createGain();
    musicGain.gain.value = masterVolume * musicVolume;
    musicGain.connect(context.destination);

    sfxGain = context.createGain();
    sfxGain.gain.value = masterVolume * sfxVolume;
    sfxGain.connect(context.destination);

    console.log('[Audio] Initialized');
  }

  /**
   * Resume audio context (required after user interaction)
   */
  function resume() {
    if (context && context.state === 'suspended') {
      context.resume();
    }
  }

  /**
   * Load a sound file
   */
  async function loadSound(id, url) {
    if (!context) init();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      sounds.set(id, audioBuffer);
      console.log(`[Audio] Loaded: ${id}`);
    } catch (err) {
      console.warn(`[Audio] Failed to load ${id}:`, err);
    }
  }

  /**
   * Play a sound effect
   */
  function playSfx(id, options = {}) {
    if (!context) return;
    resume();

    const buffer = sounds.get(id);
    if (!buffer) {
      // Generate procedural sound as fallback
      playProceduralSfx(id, options);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const gainNode = context.createGain();
    gainNode.gain.value = options.volume || 1;
    gainNode.connect(sfxGain);

    source.connect(gainNode);
    source.playbackRate.value = options.pitch || 1;
    source.start(0);
  }

  /**
   * Play procedural sound effect (fallback when no audio files)
   */
  function playProceduralSfx(id, options = {}) {
    if (!context) return;

    const now = context.currentTime;

    // Sound profiles with more variety
    const profiles = {
      // Movement
      jump: { sounds: [
        { type: 'sine', freq: 300, slide: 400, attack: 0.01, decay: 0.15, vol: 0.25 },
        { type: 'square', freq: 600, slide: 200, attack: 0.01, decay: 0.08, vol: 0.1 },
      ]},
      doubleJump: { sounds: [
        { type: 'sine', freq: 400, slide: 600, attack: 0.01, decay: 0.12, vol: 0.3 },
        { type: 'triangle', freq: 800, slide: 400, attack: 0.01, decay: 0.1, vol: 0.15 },
      ]},
      land: { sounds: [
        { type: 'sine', freq: 100, slide: -50, attack: 0.01, decay: 0.1, vol: 0.2 },
      ]},
      sprint: { sounds: [
        { type: 'sawtooth', freq: 80, slide: 20, attack: 0.01, decay: 0.05, vol: 0.1 },
      ]},

      // Combat
      attack: { sounds: [
        { type: 'sawtooth', freq: 200, slide: -100, attack: 0.01, decay: 0.08, vol: 0.25 },
        { type: 'square', freq: 400, slide: 200, attack: 0.01, decay: 0.05, vol: 0.1 },
      ]},
      hit: { sounds: [
        { type: 'sawtooth', freq: 150, slide: -80, attack: 0.005, decay: 0.15, vol: 0.3 },
        { type: 'square', freq: 80, slide: -40, attack: 0.01, decay: 0.2, vol: 0.2 },
      ]},
      enemyHit: { sounds: [
        { type: 'square', freq: 300, slide: -150, attack: 0.01, decay: 0.1, vol: 0.25 },
      ]},
      enemyDeath: { sounds: [
        { type: 'sawtooth', freq: 200, slide: -180, attack: 0.01, decay: 0.3, vol: 0.3 },
        { type: 'square', freq: 100, slide: -80, attack: 0.05, decay: 0.4, vol: 0.15 },
      ]},

      // Player states
      damage: { sounds: [
        { type: 'sawtooth', freq: 200, slide: -100, attack: 0.01, decay: 0.2, vol: 0.35 },
        { type: 'square', freq: 100, slide: -50, attack: 0.02, decay: 0.25, vol: 0.2 },
      ]},
      death: { sounds: [
        { type: 'sawtooth', freq: 300, slide: -280, attack: 0.01, decay: 0.6, vol: 0.4 },
        { type: 'sine', freq: 150, slide: -130, attack: 0.1, decay: 0.8, vol: 0.2 },
      ]},
      heal: { sounds: [
        { type: 'sine', freq: 400, slide: 200, attack: 0.05, decay: 0.3, vol: 0.2 },
        { type: 'triangle', freq: 600, slide: 300, attack: 0.1, decay: 0.4, vol: 0.15 },
      ]},
      shieldBlock: { sounds: [
        { type: 'square', freq: 500, slide: 0, attack: 0.01, decay: 0.15, vol: 0.3 },
        { type: 'sine', freq: 800, slide: -200, attack: 0.01, decay: 0.2, vol: 0.2 },
      ]},

      // Pickups
      pickup: { sounds: [
        { type: 'sine', freq: 600, slide: 300, attack: 0.01, decay: 0.15, vol: 0.25 },
        { type: 'triangle', freq: 900, slide: 200, attack: 0.02, decay: 0.1, vol: 0.15 },
      ]},
      essence: { sounds: [
        { type: 'sine', freq: 800, slide: 400, attack: 0.01, decay: 0.1, vol: 0.2 },
      ]},
      powerup: { sounds: [
        { type: 'sine', freq: 400, slide: 600, attack: 0.01, decay: 0.3, vol: 0.3 },
        { type: 'triangle', freq: 600, slide: 800, attack: 0.05, decay: 0.4, vol: 0.2 },
        { type: 'sine', freq: 800, slide: 1000, attack: 0.1, decay: 0.5, vol: 0.15 },
      ]},

      // UI
      select: { sounds: [
        { type: 'sine', freq: 500, slide: 100, attack: 0.01, decay: 0.08, vol: 0.2 },
      ]},
      confirm: { sounds: [
        { type: 'sine', freq: 600, slide: 200, attack: 0.01, decay: 0.1, vol: 0.25 },
        { type: 'sine', freq: 800, slide: 100, attack: 0.05, decay: 0.15, vol: 0.15 },
      ]},
      pause: { sounds: [
        { type: 'square', freq: 300, slide: -100, attack: 0.01, decay: 0.2, vol: 0.2 },
      ]},
      milestone: { sounds: [
        { type: 'sine', freq: 500, slide: 300, attack: 0.01, decay: 0.2, vol: 0.3 },
        { type: 'triangle', freq: 700, slide: 400, attack: 0.1, decay: 0.3, vol: 0.2 },
        { type: 'sine', freq: 900, slide: 500, attack: 0.2, decay: 0.4, vol: 0.15 },
      ]},
    };

    const profile = profiles[id] || profiles.select;

    // Play all layers of the sound
    for (const layer of profile.sounds) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = layer.type;
      oscillator.frequency.setValueAtTime(layer.freq, now);
      oscillator.frequency.linearRampToValueAtTime(
        layer.freq + layer.slide,
        now + layer.decay
      );

      const vol = layer.vol * (options.volume || 1);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + layer.attack);
      gainNode.gain.linearRampToValueAtTime(0, now + layer.decay);

      oscillator.connect(gainNode);
      gainNode.connect(sfxGain);

      oscillator.start(now);
      oscillator.stop(now + layer.decay + 0.01);
    }
  }

  /**
   * Play music track
   */
  function playMusic(regionId = 'frontier', options = {}) {
    if (!context) init();
    resume();

    // Stop current music
    stopMusic();

    currentRegion = regionId;

    const buffer = sounds.get(`music_${regionId}`);
    if (!buffer) {
      // Play procedural music as fallback
      startProceduralMusic(regionId);
      return;
    }

    currentMusic = context.createBufferSource();
    currentMusic.buffer = buffer;
    currentMusic.loop = options.loop !== false;
    currentMusic.connect(musicGain);
    currentMusic.start(0);
  }

  /**
   * Start procedural background music
   */
  function startProceduralMusic(regionId) {
    if (musicInterval) {
      clearInterval(musicInterval);
    }

    // Region-specific music parameters
    const regionStyles = {
      frontier: {
        bpm: 110,
        key: [261.63, 293.66, 329.63, 392.00, 440.00], // C major pentatonic
        bassNotes: [130.81, 146.83, 164.81],
        mood: 'adventurous',
      },
      badlands: {
        bpm: 130,
        key: [261.63, 293.66, 311.13, 392.00, 415.30], // C minor
        bassNotes: [130.81, 155.56, 174.61],
        mood: 'intense',
      },
      void: {
        bpm: 90,
        key: [261.63, 277.18, 329.63, 369.99, 415.30], // Mysterious
        bassNotes: [130.81, 138.59, 164.81],
        mood: 'ethereal',
      },
    };

    const style = regionStyles[regionId] || regionStyles.frontier;
    const beatDuration = 60 / style.bpm;
    let beat = 0;

    const playBeat = () => {
      if (!context || context.state === 'closed') {
        clearInterval(musicInterval);
        return;
      }

      const now = context.currentTime;

      // Kick drum on 1 and 3
      if (beat % 4 === 0 || beat % 4 === 2) {
        playDrum('kick', now, style.mood === 'intense' ? 0.35 : 0.25);
      }

      // Snare/clap on 2 and 4
      if (beat % 4 === 1 || beat % 4 === 3) {
        playDrum(style.mood === 'ethereal' ? 'hihat' : 'snare', now, 0.2);
      }

      // Hi-hat on every beat
      playDrum('hihat', now, 0.08);

      // Bass line every 2 beats
      if (beat % 2 === 0) {
        const bassNote = style.bassNotes[Math.floor(Math.random() * style.bassNotes.length)];
        playNote(bassNote, 'sine', now, beatDuration * 1.5, 0.2);
      }

      // Melody every 4 beats
      if (beat % 4 === 0) {
        const note = style.key[Math.floor(Math.random() * style.key.length)];
        playNote(note * 2, 'triangle', now, beatDuration * 2, 0.12);
      }

      // Arpeggio notes
      if (style.mood === 'ethereal' && beat % 2 === 1) {
        const note = style.key[Math.floor(Math.random() * style.key.length)];
        playNote(note * 4, 'sine', now, beatDuration, 0.06);
      }

      beat = (beat + 1) % 16;
    };

    musicInterval = setInterval(playBeat, beatDuration * 1000);
    console.log(`[Audio] Playing procedural music for ${regionId}`);
  }

  /**
   * Play a drum sound
   */
  function playDrum(type, time, volume) {
    const osc = context.createOscillator();
    const gain = context.createGain();

    if (type === 'kick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      osc.start(time);
      osc.stop(time + 0.15);
    } else if (type === 'snare') {
      // Noise burst for snare
      const bufferSize = context.sampleRate * 0.1;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = context.createGain();
      noiseGain.gain.setValueAtTime(volume, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      noise.connect(noiseGain);
      noiseGain.connect(musicGain);
      noise.start(time);
      noise.stop(time + 0.1);
      return;
    } else if (type === 'hihat') {
      // High-frequency noise burst
      const bufferSize = context.sampleRate * 0.05;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;

      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;

      const noiseGain = context.createGain();
      noiseGain.gain.setValueAtTime(volume, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(musicGain);
      noise.start(time);
      noise.stop(time + 0.05);
      return;
    }

    osc.connect(gain);
    gain.connect(musicGain);
  }

  /**
   * Play a melodic note
   */
  function playNote(freq, type, time, duration, volume) {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.linearRampToValueAtTime(volume * 0.7, time + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Stop music
   */
  function stopMusic() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
    if (currentMusic) {
      try {
        currentMusic.stop();
      } catch (e) {
        // Already stopped
      }
      currentMusic = null;
    }
  }

  /**
   * Set master volume
   */
  function setMasterVolume(volume) {
    masterVolume = Math.max(0, Math.min(1, volume));
    updateVolumes();
  }

  /**
   * Set music volume
   */
  function setMusicVolume(volume) {
    musicVolume = Math.max(0, Math.min(1, volume));
    updateVolumes();
  }

  /**
   * Set SFX volume
   */
  function setSfxVolume(volume) {
    sfxVolume = Math.max(0, Math.min(1, volume));
    updateVolumes();
  }

  /**
   * Update gain node volumes
   */
  function updateVolumes() {
    if (musicGain) {
      musicGain.gain.value = masterVolume * musicVolume;
    }
    if (sfxGain) {
      sfxGain.gain.value = masterVolume * sfxVolume;
    }
  }

  /**
   * Cleanup
   */
  function destroy() {
    stopMusic();
    if (context) {
      context.close();
      context = null;
    }
    sounds.clear();
  }

  return {
    init,
    resume,
    loadSound,
    playSfx,
    playMusic,
    stopMusic,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    destroy,
  };
}

export default { createAudioManager };
