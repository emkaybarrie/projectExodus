// ---FILE: src/app/router.js
export function createRouter({ onRoute }){
  let current = null;

  function start(surfaceId){
    goto(surfaceId);
  }

  async function goto(surfaceId){
    current = surfaceId;
    // pushState later; v1 keeps it simple + deterministic
    await onRoute(surfaceId);
  }

  return {
    start,
    goto,
    get current(){ return current; }
  };
}
