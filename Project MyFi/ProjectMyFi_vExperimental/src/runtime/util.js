export function joinUrl(baseDir, relPath) {
  // baseDir like "./src/screens/hub-wardwatch/"
  // relPath like "./layout.html"
  // ensure there's exactly one slash
  if (!baseDir.endsWith("/")) baseDir += "/";
  if (relPath.startsWith("./")) relPath = relPath.slice(2);
  return baseDir + relPath;
}
