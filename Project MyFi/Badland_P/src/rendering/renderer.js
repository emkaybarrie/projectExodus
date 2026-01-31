// renderer.js — Canvas Renderer
// Main rendering coordinator

/**
 * Create the main renderer
 */
export function createRenderer(canvas, ctx) {
  let width = canvas.width;
  let height = canvas.height;

  /**
   * Clear the canvas
   */
  function clear() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Update dimensions
   */
  function resize(w, h) {
    width = w;
    height = h;
  }

  /**
   * Draw a rectangle
   */
  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  /**
   * Draw a circle
   */
  function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw text
   */
  function drawText(text, x, y, { font = '16px sans-serif', color = '#fff', align = 'left' } = {}) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  /**
   * Get context for direct drawing
   */
  function getContext() {
    return ctx;
  }

  return {
    clear,
    resize,
    drawRect,
    drawCircle,
    drawText,
    getContext,
    get width() { return width; },
    get height() { return height; },
  };
}

export default { createRenderer };
