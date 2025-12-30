import { on, clamp } from '../../_shared/dom.js';
import { partRegistry } from '../../registry.js';
import { mountChildPart } from '../../_shared/mountChildPart.js';

const PART_ID = 'QuestItem';

async function loadHTML() {
  const url = new URL('./baseline.html', import.meta.url);
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`[${PART_ID}] baseline.html failed to load (${res.status}):`, url.href);
    return `<div class="ui-btn">Missing baseline.html for ${PART_ID}</div>`;
  }

  const html = await res.text();

  // CONTRACT validation MUST come after this line
  if (!html.includes('CONTRACT:BEGIN') || !html.includes('CONTRACT:END')) {
    console.warn(`[${PART_ID}] baseline.html missing CONTRACT markers`);
  }

  return html;
}

export default {
  id: 'QuestItem',
  variants: ['default'],

  mount({ el, props, slice, emit }) {
    let cleanup = [];
    let childMounts = [];

    function clear() {
      // Unmount composed child parts first
      childMounts.forEach(m => { try { m.unmount(); } catch {} });
      childMounts = [];

      // Then remove event handlers
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

      // Clear containers
      badges?.replaceChildren();
      progress?.replaceChildren();
      actions?.replaceChildren();

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

      function addBadge(text) {
        if (!badges) return;
        const host = document.createElement('span');
        host.style.marginLeft = '6px';
        badges.appendChild(host);

        childMounts.push(
          mountChildPart({
            registry: partRegistry,
            partId: 'Badge',
            el: host,
            props: { text }
          })
        );
      }

      if (slice?.isActive) addBadge('Active');
      if (slice?.isComplete) addBadge('Complete');
      if (slice?.isPlayerAuthored) addBadge('Goal');

      // Rewards badges (xp/essence)
      for (const r of (slice?.rewards || [])) {
        const label = r.kind === 'xp' ? `XP +${r.amount}` : `${r.kind} +${r.amount}`;
        addBadge(label);
      }

      if (progress) {
        const host = document.createElement('div');
        progress.appendChild(host);

        childMounts.push(
          mountChildPart({
            registry: partRegistry,
            partId: 'ProgressBar',
            el: host,
            slice: slice?.progress
          })
        );
      }

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
          const host = document.createElement('div');
          host.style.width = '100%';
          actions.appendChild(host);

          childMounts.push(
            mountChildPart({
              registry: partRegistry,
              partId: 'Button',
              el: host,
              props: { label: slice?.cta?.label || 'Claim' },
              emit: (name) => {
                if (name === 'press') emit('claim', { id: slice?.id });
              }
            })
          );

          // Stop card "primary" click from firing when pressing the button
          const btnEl = host.querySelector('button');
          if (btnEl) {
            cleanup.push(on(btnEl, 'click', (ev) => {
              ev.stopPropagation();
            }));
          }
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
