// No-build helpers: load CSS/HTML assets safely in native ESM.

export async function ensureCssLink(href, id) {
  // id ensures we only add it once.
  if (id && document.getElementById(id)) return;

  // If already present by href, also skip
  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find(l => l.getAttribute("href") === href);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  if (id) link.id = id;
  document.head.appendChild(link);

  // Optional: wait for load so first render isn't FOUC-y
  await new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true }); // don't hard fail
  });
}

export async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${url}`);
  return res.text();
}

export function mapHooks(root){
  const out = {};
  root.querySelectorAll("[data-hook]").forEach(n => out[n.getAttribute("data-hook")] = n);
  return out;
}
