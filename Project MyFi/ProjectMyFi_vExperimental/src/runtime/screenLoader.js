import { joinUrl } from "./util.js";

export function createScreenLoader() {
  return {
    async loadSurface(screenDir) {
      const surfaceUrl = joinUrl(screenDir, "./surface.json");
      const res = await fetch(surfaceUrl);
      if (!res.ok) throw new Error(`Surface load failed: ${surfaceUrl}`);
      const surface = await res.json();
      return { surface, surfaceUrl };
    },

    async loadLayout(screenDir, surface) {
      if (!surface.layout?.html || !surface.layout?.css) {
        throw new Error(`Surface missing layout.html/css paths`);
      }

      const htmlUrl = joinUrl(screenDir, surface.layout.html);
      const cssUrl  = joinUrl(screenDir, surface.layout.css);

      const [htmlRes, cssRes] = await Promise.all([fetch(htmlUrl), fetch(cssUrl)]);
      if (!htmlRes.ok) throw new Error(`Layout HTML missing: ${htmlUrl}`);
      if (!cssRes.ok) throw new Error(`Layout CSS missing: ${cssUrl}`);

      return {
        html: await htmlRes.text(),
        css:  await cssRes.text(),
        htmlUrl,
        cssUrl
      };
    }
  };
}
