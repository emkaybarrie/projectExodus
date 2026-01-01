// src/screens/quests/parts/QuestsHeaderPart.js

export async function QuestsHeaderPart(host){
  const wrap = document.createElement('div');
  wrap.className = 'qb__top myfiCard myfiCardPad';
  wrap.innerHTML = `
    <div class="qb__title myfiTitle">Quests</div>
    <div class="qb__hint myfiHint">Focus up to <b>one</b> quest per type. Focused quests auto-claim on completion.</div>
  `;
  host.appendChild(wrap);

  return {
    unmount(){
      try { host.innerHTML = ''; } catch {}
    }
  };
}
