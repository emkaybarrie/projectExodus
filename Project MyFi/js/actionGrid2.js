// --- MOCKED PLAYER DATA ---
const playerDataManager = {
  init: async () => ({
    actions: {
      gridSize: { rows: 4, cols: 6 },
      equipped: [
        { id: 'socialising_1', position: { row: 0, col: 0 }, capAmount: 25 },
        { id: 'travel_1', position: { row: 1, col: 2 }, capAmount: 40 }
      ]
    }
  }),
  updateByKey: (key, val) => console.log('Mock update:', key, val),
  save: () => console.log('Mock save called'),
  on: () => {}
};

// --- ACTION DEFINITIONS ---
const actionsDefinitions = {
  socialising_1: {
    id: 'socialising_1',
    name: 'Chat with Friends',
    group: 'Socialising & Entertainment',
    category: 'Wants',
    shape: [[1, 1], [1, 0]],
    capMax: 100
  },
  travel_1: {
    id: 'travel_1',
    name: 'Take a Walk',
    group: 'Travel',
    category: 'Needs',
    shape: [[1, 1, 1]],
    capMax: 50
  }
};

const categoryColors = {
  Growth: '#4CAF50',
  Wants: '#FF9800',
  Needs: '#2196F3'
};

const gridContainer = document.getElementById('action-grid');
const equippedActions = {};
let gridRows = 4, gridCols = 6;

async function initActionGrid() {
  const playerData = await playerDataManager.init();
  const playerActions = playerData.actions || {};

  if (playerActions.gridSize) {
    gridRows = playerActions.gridSize.rows;
    gridCols = playerActions.gridSize.cols;
  }

  if (Array.isArray(playerActions.equipped)) {
    playerActions.equipped.forEach(a => {
      if (actionsDefinitions[a.id]) {
        equippedActions[a.id] = {
          actionDef: actionsDefinitions[a.id],
          position: a.position,
          capAmount: a.capAmount || 0
        };
      }
    });
  }

  renderGrid();
}

function renderGrid() {
  gridContainer.style.gridTemplateRows = `repeat(${gridRows}, 50px)`;
  gridContainer.style.gridTemplateColumns = `repeat(${gridCols}, 50px)`;
  gridContainer.innerHTML = '';

  for (let i = 0; i < gridRows * gridCols; i++) {
    const slot = document.createElement('div');
    slot.classList.add('grid-slot');
    slot.dataset.index = i;

    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drag-over-valid');
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over-valid');
    });
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over-valid');
      const draggedActionId = e.dataTransfer.getData('text/plain');
      const dropIndex = parseInt(slot.dataset.index);
      handleDrop(draggedActionId, dropIndex);
    });

    gridContainer.appendChild(slot);
  }

  Object.values(equippedActions).forEach(({ actionDef, position, capAmount }) => {
    const el = document.createElement('div');
    el.classList.add('action-item');
    el.style.backgroundColor = categoryColors[actionDef.category] || '#ccc';

    const h = actionDef.shape.length;
    const w = actionDef.shape[0].length;

    el.style.gridRowStart = position.row + 1;
    el.style.gridRowEnd = position.row + 1 + h;
    el.style.gridColumnStart = position.col + 1;
    el.style.gridColumnEnd = position.col + 1 + w;

    const bar = document.createElement('div');
    bar.classList.add('action-progress-bar');
    const pct = Math.min(100, (capAmount / actionDef.capMax) * 100);
    bar.style.width = `${pct}%`;

    el.appendChild(bar);

    el.title = `${actionDef.name}\n${pct.toFixed(0)}% charged`;
    el.draggable = true;
    el.dataset.actionId = actionDef.id;

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', actionDef.id);
      e.dataTransfer.effectAllowed = "move";
    });

    gridContainer.appendChild(el);
  });
}

function canPlaceActionAt(def, row, col, ignoreId = null) {
  const h = def.shape.length, w = def.shape[0].length;
  if (row + h > gridRows || col + w > gridCols) return false;

  for (const [id, data] of Object.entries(equippedActions)) {
    if (id === ignoreId) continue;
    const { position: pos, actionDef: d } = data;
    const dh = d.shape.length, dw = d.shape[0].length;

    const overlap = row < pos.row + dh &&
                    row + h > pos.row &&
                    col < pos.col + dw &&
                    col + w > pos.col;
    if (overlap) return false;
  }

  return true;
}

function handleDrop(actionId, dropIndex) {
  const row = Math.floor(dropIndex / gridCols);
  const col = dropIndex % gridCols;
  const data = equippedActions[actionId];
  if (!data) return;

  if (canPlaceActionAt(data.actionDef, row, col, actionId)) {
    data.position = { row, col };
    renderGrid();
  } else {
    alert("Invalid placement: overlaps or out of bounds.");
    renderGrid();
  }
}

initActionGrid();