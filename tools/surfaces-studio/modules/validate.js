// tools/surfaces-studio/modules/validate.js
import { $ } from './dom.js';
import { toast } from './toast.js';

const CONTRACT_BEGIN = '<!-- CONTRACT:BEGIN -->';
const CONTRACT_END   = '<!-- CONTRACT:END -->';

export function initValidate(state) {
  const btnRun = $('#btnValidate');
  const btnCopy = $('#btnCopyReport');
  const report = $('#reportBox');

  if (!btnRun || !btnCopy || !report) return;

  btnRun.addEventListener('click', () => {
    const lines = [];

    // 1) Mapping correctness
    lines.push('## Mapping correctness');
    const allSlots = flattenSlots(state.rootSlots);
    const map = state.partsMap || {};
    const lib = state.partsLibrary || {};

    let badMap = 0;
    for (const s of allSlots) {
      const m = map[s.id];
      if (!m) continue;

      if (!m.partId || !lib[m.partId]) {
        badMap++;
        lines.push(`- ❌ ${s.id} maps to missing partId: "${m.partId || ''}"`);
      } else {
        lines.push(`- ✅ ${s.id} → ${m.partId} (slicePath="${m.slicePath || ''}")`);
      }
    }
    if (!Object.keys(map).length) lines.push('- (no mappings yet)');

    // 2) Contract markers
    lines.push('\n## Contract markers');
    let missingContract = 0;

    for (const [partId, part] of Object.entries(lib)) {
      const baseHtml = part?.baseline?.html || '';
      if (!hasContract(baseHtml)) {
        missingContract++;
        lines.push(`- ❌ ${partId} baseline missing CONTRACT markers`);
      } else {
        lines.push(`- ✅ ${partId} baseline has contract`);
      }

      if (part?.uplift) {
        const upHtml = part?.uplift?.html || '';
        if (!hasContract(upHtml)) {
          missingContract++;
          lines.push(`- ❌ ${partId} uplift missing CONTRACT markers`);
        } else {
          lines.push(`- ✅ ${partId} uplift has contract`);
        }
      }
    }
    if (!Object.keys(lib).length) lines.push('- (no parts in library yet)');

    // 3) Summary
    lines.push('\n## Summary');
    lines.push(`- bad mappings: ${badMap}`);
    lines.push(`- missing contract: ${missingContract}`);

    report.textContent = lines.join('\n');
    toast('Validate complete');
  });

  btnCopy.addEventListener('click', async () => {
    await copyText(report.textContent || '');
    toast('Copied report');
  });
}

function hasContract(html) {
  return String(html).includes(CONTRACT_BEGIN) && String(html).includes(CONTRACT_END);
}

function flattenSlots(root) {
  const out = [];
  (function walk(list) {
    for (const s of (list || [])) {
      out.push(s);
      if (s.children?.length) walk(s.children);
    }
  })(root);
  return out;
}

async function copyText(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}
