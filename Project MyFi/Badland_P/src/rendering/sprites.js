// sprites.js — Sprite Sheet Manager
// Loading and rendering sprite animations

/**
 * Create the sprite manager
 */
export function createSpriteManager() {
  const sprites = new Map();
  const animations = new Map();

  /**
   * Load a sprite sheet image
   */
  async function loadSprite(id, src, frameWidth, frameHeight) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        sprites.set(id, {
          image: img,
          frameWidth,
          frameHeight,
          framesPerRow: Math.floor(img.width / frameWidth),
        });
        console.log(`[Sprites] Loaded: ${id}`);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Define an animation sequence
   */
  function defineAnimation(spriteId, animId, frames, frameDuration = 100) {
    animations.set(`${spriteId}:${animId}`, {
      spriteId,
      frames, // Array of frame indices
      frameDuration,
      totalDuration: frames.length * frameDuration,
    });
  }

  /**
   * Draw a specific frame from a sprite sheet
   */
  function drawFrame(ctx, spriteId, frameIndex, x, y, options = {}) {
    const sprite = sprites.get(spriteId);
    if (!sprite) return;

    const {
      scale = 1,
      flipX = false,
      flipY = false,
      alpha = 1,
    } = options;

    const { image, frameWidth, frameHeight, framesPerRow } = sprite;
    const sx = (frameIndex % framesPerRow) * frameWidth;
    const sy = Math.floor(frameIndex / framesPerRow) * frameHeight;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (flipX || flipY) {
      ctx.translate(
        flipX ? x + frameWidth * scale : x,
        flipY ? y + frameHeight * scale : y
      );
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(
        image,
        sx, sy, frameWidth, frameHeight,
        0, 0, frameWidth * scale, frameHeight * scale
      );
    } else {
      ctx.drawImage(
        image,
        sx, sy, frameWidth, frameHeight,
        x, y, frameWidth * scale, frameHeight * scale
      );
    }

    ctx.restore();
  }

  /**
   * Draw an animation frame based on time
   */
  function drawAnimation(ctx, spriteId, animId, time, x, y, options = {}) {
    const anim = animations.get(`${spriteId}:${animId}`);
    if (!anim) return;

    const { frames, frameDuration, totalDuration } = anim;
    const loopedTime = time % totalDuration;
    const frameIndex = Math.floor(loopedTime / frameDuration);
    const actualFrame = frames[frameIndex % frames.length];

    drawFrame(ctx, spriteId, actualFrame, x, y, options);
  }

  /**
   * Check if a sprite is loaded
   */
  function hasSprite(id) {
    return sprites.has(id);
  }

  /**
   * Get sprite dimensions
   */
  function getSpriteDimensions(id) {
    const sprite = sprites.get(id);
    if (!sprite) return null;
    return {
      frameWidth: sprite.frameWidth,
      frameHeight: sprite.frameHeight,
    };
  }

  return {
    loadSprite,
    defineAnimation,
    drawFrame,
    drawAnimation,
    hasSprite,
    getSpriteDimensions,
  };
}

export default { createSpriteManager };
