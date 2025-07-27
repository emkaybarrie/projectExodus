const playerDataManager = {
  get: async (key) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Action definitions with shapes, caps, and colors
const actionsDefinitions = {
  read_book: { id: 'read_book', name: 'Read a Book', category: 'growth', shape: [[2, 1]], color: 'purple', capMax: 100 },
  exercise: { id: 'exercise', name: 'Exercise', category: 'growth', shape: [[1, 1]], color: 'green', capMax: 100 },
  watch_movie: { id: 'watch_movie', name: 'Watch Movie', category: 'wants', shape: [[1]], color: 'pink', capMax: 100 },
  shop: { id: 'shop', name: 'Go Shopping', category: 'wants', shape: [[1, 1]], color: 'red', capMax: 100 },
  cook_meal: { id: 'cook_meal', name: 'Cook Meal', category: 'needs', shape: [[1]], color: 'blue', capMax: 100 },
  pay_bills: { id: 'pay_bills', name: 'Pay Bills', category: 'needs', shape: [[1, 1]], color: 'orange', capMax: 100 }
};

const categoryColors = {
  growth: 'purple',
  wants: 'pink',
  needs: 'blue',
};

const gridContainer = document.getElementById('action-grid');
const GRID_ROWS = 4;
const GRID_COLS = 6;
let equippedActions = {}; // id => { actionDef, position }

// === Grid Rendering ===
function renderGrid() {
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateRows = `repeat(${GRID_ROWS}, 50px)`;
  gridContainer.style.gridTemplateColumns = `repeat(${GRID_COLS}, 50px)`;
  gridContainer.style.gap = '4px';
  gridContainer.innerHTML = '';

  for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
    const slot = document.createElement('div');
    slot.classList.add('grid-slot');
    slot.dataset.index = i;
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over-valid'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over-valid'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over-valid');
      const draggedActionId = e.dataTransfer.getData('text/plain');
      const dropIndex = parseInt(slot.dataset.index);
      handleDrop(draggedActionId, dropIndex);
    });
    gridContainer.appendChild(slot);
  }

  Object.values(equippedActions).forEach(({ actionDef, position }) => {
    const el = document.createElement('div');
    el.classList.add('action-item');
    el.style.backgroundColor = actionDef.color || categoryColors[actionDef.category] || '#888';
    el.textContent = actionDef.name;
    el.title = actionDef.name;
    el.draggable = true;
    el.dataset.actionId = actionDef.id;

    const h = actionDef.shape.length;
    const w = actionDef.shape[0].length;

    el.style.gridRowStart = position.row + 1;
    el.style.gridRowEnd = position.row + 1 + h;
    el.style.gridColumnStart = position.col + 1;
    el.style.gridColumnEnd = position.col + 1 + w;

     // ✅ Add unequip on click
  el.addEventListener('click', () => {
    if (confirm(`Unequip "${actionDef.name}"?`)) {
      delete equippedActions[actionDef.id];
      saveEquippedActionsToPlayerData();
      renderGrid();
    }
  });

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', actionDef.id);
      e.dataTransfer.effectAllowed = "move";
    });

    gridContainer.appendChild(el);
  });
}

function canPlaceActionAt(def, row, col, ignoreId = null) {
  const h = def.shape.length;
  const w = def.shape[0].length;
  if (row + h > GRID_ROWS || col + w > GRID_COLS) return false;

  for (const [id, data] of Object.entries(equippedActions)) {
    if (id === ignoreId) continue;
    const { position: pos, actionDef: d } = data;
    const dh = d.shape.length;
    const dw = d.shape[0].length;
    const overlap = row < pos.row + dh && row + h > pos.row && col < pos.col + dw && col + w > pos.col;
    if (overlap) return false;
  }
  return true;
}

function handleDrop(actionId, dropIndex) {
  const row = Math.floor(dropIndex / GRID_COLS);
  const col = dropIndex % GRID_COLS;

  const def = actionsDefinitions[actionId];
  if (!def) return alert('Invalid action.');

  if (!equippedActions[actionId]) {
    if (!canPlaceActionAt(def, row, col)) return alert('No space or overlaps.');
    equippedActions[actionId] = { actionDef: def, position: { row, col } };
  } else {
    const existing = equippedActions[actionId];
    if (canPlaceActionAt(def, row, col, actionId)) {
      existing.position = { row, col };
    } else {
      return alert('Invalid move.');
    }
  }

  saveEquippedActions();
  renderGrid();
}

// === Modal ===
function openActionMenu(category) {
  const modal = document.getElementById('action-menu');
  const title = document.getElementById('action-menu-title');
  const list = document.getElementById('action-list');
  title.textContent = `Choose ${category}`;
  list.innerHTML = '';

  const actions = Object.values(actionsDefinitions).filter(a => a.category === category);
  actions.forEach(action => {
    const item = document.createElement('div');
    item.classList.add('action-item');
    item.textContent = action.name;
    item.style.backgroundColor = action.color;
    item.draggable = true;

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', action.id);
      e.dataTransfer.effectAllowed = "copy";
    });

    item.addEventListener('click', () => {
      equipToFirstAvailable(action);
      closeActionMenu();
    });

    list.appendChild(item);
  });

  modal.classList.remove('hidden');
}

function closeActionMenu() {
  document.getElementById('action-menu').classList.add('hidden');
}

function equipToFirstAvailable(action) {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (canPlaceActionAt(action, r, c)) {
        equippedActions[action.id] = { actionDef: action, position: { row: r, col: c } };
        saveEquippedActions();
        renderGrid();
        return;
      }
    }
  }
  alert('No space available.');
}

// === Persistence ===
function saveEquippedActions() {
  const arr = Object.values(equippedActions).map(({ actionDef, position }) => ({
    id: actionDef.id,
    position
  }));
  playerDataManager.set('equippedActions', arr);
}

async function loadEquippedActions() {
  const saved = await playerDataManager.get('equippedActions');
  if (!saved) return;
  equippedActions = {};
  for (const e of saved) {
    const def = actionsDefinitions[e.id];
    if (def) {
      equippedActions[e.id] = { actionDef: def, position: e.position };
    }
  }
  renderGrid();
}

// === Button Events ===
document.querySelectorAll('.open-action-menu').forEach(btn => {
  btn.addEventListener('click', () => {
    openActionMenu(btn.dataset.category);
  });
});
document.getElementById('close-action-menu').addEventListener('click', closeActionMenu);

// === Init ===
loadEquippedActions();
