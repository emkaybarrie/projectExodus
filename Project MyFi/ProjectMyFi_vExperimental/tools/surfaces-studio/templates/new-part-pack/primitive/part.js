// part.js (PRIMITIVE stub)
// NOTE: This is a *locked* file in the normal workflow.
// Studio can generate it as a starting point, but AI should NOT edit it by default.
export function <Kind>Part(host, { id, kind, props = {}, ctx = {} }){
  const root = document.createElement('div');
  root.className = `Part-<Kind>`;
  root.textContent = `<Kind> (stub)`;
  host.appendChild(root);
  return { unmount(){ root.remove(); } };
}
