// musicPlayer.js
import { open as openModal } from '../core/modal.js';

export function openFullMusicList(owner='hub') {
  const np = window.MyFiMusic?.getNowPlaying?.() || {};
  const playlist = window.MyFiMusic?.getPlaylist?.() || [];

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div class="modal-head">
      <div class="modal-head-title">Music</div>
      <div class="modal-head-sub">Select a track, or control playback</div>
    </div>

    <div class="modal-body" id="music-body" style="display:grid;row-gap:12px;">
      <div id="nowplaying" style="padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.03);">
        <div style="font-size:12px;opacity:.75;margin-bottom:4px;">Now Playing</div>
        <div style="font-weight:600" id="np-title">${np.title ?? 'Unknown Track'}</div>
        <div style="opacity:.8" id="np-artist">${np.artist ?? ''}</div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="modal-btn" id="btn-prev">Prev</button>
        <button class="modal-btn modal-btn-primary" id="btn-toggle">${np.isPlaying ? 'Pause' : 'Play'}</button>
        <button class="modal-btn" id="btn-next">Next</button>
        <button class="modal-btn" id="btn-mute">${np.isMuted ? 'Unmute' : 'Mute'}</button>
      </div>

      <div style="font-size:12px;opacity:.8;margin-top:4px;">Tracks</div>
      <div id="track-list" style="display:grid;row-gap:8px;"></div>
    </div>

    <div class="modal-footer">
      <button class="modal-btn" id="close">Close</button>
    </div>
  `;

  const ref = openModal({ owner, scope: 'screen', content: tpl.content });

  const cardEl   = document.querySelector('#modal-root .modal-card:last-child');
  const bodyEl   = cardEl.querySelector('#music-body');
  const listEl   = cardEl.querySelector('#track-list');

  function paintList() {
    const np2 = window.MyFiMusic?.getNowPlaying?.() || {};
    listEl.replaceChildren(...(playlist.map((t, i) => {
      const row = document.createElement('button');
      row.className = 'modal-btn';
      row.style.justifyContent = 'space-between';
      row.style.display = 'flex';
      row.style.width = '100%';
      row.style.textAlign = 'left';
      row.style.gap = '10px';
      row.dataset.index = String(i);
      row.innerHTML = `
        <span>
          <span style="font-weight:600;">${t.title}</span>
          <span style="opacity:.8;"> — ${t.artist}</span>
        </span>
        <span style="opacity:.7;">${i === np2.index && np2.isPlaying ? '▶' : (i === np2.index ? '⏸' : '')}</span>
      `;
      row.addEventListener('click', () => {
        window.MyFiMusic?.playAt?.(i);
        paintNowPlaying();
        paintList();
      });
      return row;
    })));
  }

  function paintNowPlaying() {
    const np3 = window.MyFiMusic?.getNowPlaying?.() || {};
    cardEl.querySelector('#np-title').textContent  = np3.title || 'Unknown Track';
    cardEl.querySelector('#np-artist').textContent = np3.artist || '';
    cardEl.querySelector('#btn-toggle').textContent = np3.isPlaying ? 'Pause' : 'Play';
    cardEl.querySelector('#btn-mute').textContent   = np3.isMuted ? 'Unmute' : 'Mute';
  }

  // Wire controls
  cardEl.querySelector('#btn-prev').addEventListener('click', () => { window.MyFiMusic?.prev?.();  paintNowPlaying(); paintList(); });
  cardEl.querySelector('#btn-next').addEventListener('click', () => { window.MyFiMusic?.next?.();  paintNowPlaying(); paintList(); });
  cardEl.querySelector('#btn-toggle').addEventListener('click', () => { window.MyFiMusic?.togglePlayPause?.(); paintNowPlaying(); paintList(); });
  cardEl.querySelector('#btn-mute').addEventListener('click', () => { window.MyFiMusic?.toggleMuted?.();     paintNowPlaying(); });
  cardEl.querySelector('#close').addEventListener('click', () => ref.close());

  // Live updates while modal is open
  const onChange = () => { paintNowPlaying(); paintList(); };
  window.addEventListener('music:changed', onChange);
  ref.onClose(() => window.removeEventListener('music:changed', onChange));

  // Initial paint
  paintList();
}
