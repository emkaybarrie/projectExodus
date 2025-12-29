import { on, clamp } from '../../_shared/dom.js';

async function loadHTML() {
  const res = await fetch(new URL('./baseline.html', import.meta.url));
  return res.text();
}

function makeBadge(text) {
  const b = document.createElement('span');
  b.className = 'ui-chip';
  b.textContent = text;
  b.style.marginLeft = '6px';
  return b;
}

function makeProgressBar(p) {
  const wrap = document.createElement('div');

  const current = Number(p?.current ?? 0);
  const max = Number(p?.max ?? 1);
  const pct = max > 0 ? clamp((current / max) * 100, 0, 100) : 0;

  const bar = document.createElement('div');
  bar.style.height = '12px';
  bar.style.borderRadius = '999px';
  bar.style.border = '1px solid var(--ui-line)';
  bar.style.background = `linear-gradient(90deg, var(--ui-accent) ${pct}%, var(--ui-surface) ${pct}%)`;

  const label = document.createElement('div');
  label.textContent = p?.label || `${current} / ${max}`;
  label.style.fontSize = '12px';
  label.style.color = 'var(--ui-muted)';
  label.style.marginTop = '6px';

  wrap.appendChild(bar);
  wrap.appendChild(label);
  return wrap;
}

export default {
  id: 'QuestItem',
  variants: ['default'],

  mount({ el, props, slice, emit }) {
    let cleanup = [];

    function clear() {
      cleanup.forEach(fn => { try { fn(); } catch {} });
      cleanup = [];
    }

    function render() {
      clear();

      const title = el.querySelector('[data-role="title"]');
      const subtitle = el.querySelector('[data-role="subtitle"]');
      const badges = el.querySelector('[data-role="badges"]');
      const progress = el.querySelector('[data-role="progress"]');
      const actions = el.querySelector('[data-role="actions"]');
      const card = el.querySelector('[data-role="card"]');

      if (card) {
        card.style.border = '1px solid var(--ui-line)';
        card.style.background = 'var(--ui-surface)';
        card.style.borderRadius = '16px';
        card.style.padding = '14px';
      }

      if (title) {
        title.textContent = slice?.title || slice?.id || 'Quest';
        title.style.fontWeight = '800';
        title.style.letterSpacing = '0.3px';
      }
      if (subtitle) {
        subtitle.textContent = slice?.subtitle || '';
        subtitle.style.color = 'var(--ui-muted)';
        subtitle.style.fontSize = '12px';
        subtitle.style.marginTop = '4px';
      }

      badges?.replaceChildren();
      if (slice?.isActive) badges?.appendChild(makeBadge('Active'));
      if (slice?.isComplete) badges?.appendChild(makeBadge('Complete'));
      if (slice?.isPlayerAuthored) badges?.appendChild(makeBadge('Goal'));
      // Rewards badges (xp/essence)
      for (const r of (slice?.rewards || [])) {
        const label = r.kind === 'xp' ? `XP +${r.amount}` : `${r.kind} +${r.amount}`;
        badges?.appendChild(makeBadge(label));
      }

      progress?.replaceChildren();
      progress?.appendChild(makeProgressBar(slice?.progress));

      actions?.replaceChildren();
      actions && (actions.style.marginTop = '12px');

      // Primary click: open details (future)
      cleanup.push(on(card || el, 'click', (ev) => {
        // Prevent clicking the button from triggering primary too
        if (ev.target?.closest?.('button')) return;
        emit('primary', { id: slice?.id });
      }));

      // Claim button (manual claim only)
      const claimable = !!slice?.isClaimable;
      const autoClaim = !!slice?.autoClaim;

      if (claimable) {
        if (autoClaim) {
          // Auto-claim is FEATURE-OWNED; UI can optionally emit once as a fallback.
          // We avoid spamming by emitting only on first render when autoClaim is true.
          emit('claim', { id: slice?.id });
          const note = document.createElement('div');
          note.textContent = 'Auto-claiming…';
          note.style.fontSize = '12px';
          note.style.color = 'var(--ui-muted)';
          actions.appendChild(note);
        } else {
          const btn = document.createElement('button');
          btn.className = 'ui-btn';
          btn.textContent = slice?.cta?.label || 'Claim';
          btn.style.width = '100%';
          cleanup.push(on(btn, 'click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            emit('claim', { id: slice?.id });
          }));
          actions.appendChild(btn);
        }
      } else {
        const hint = document.createElement('div');
        hint.textContent = slice?.isComplete ? 'Claimed' : 'In progress';
        hint.style.fontSize = '12px';
        hint.style.color = 'var(--ui-muted)';
        actions.appendChild(hint);
      }
    }

    loadHTML().then(html => {
      el.innerHTML = html;
      render();
    });

    return {
      update({ slice: nextSlice }) {
        slice = nextSlice;
        render();
      },
      unmount() {
        clear();
      }
    };
  }
};
