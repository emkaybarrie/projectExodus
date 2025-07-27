export const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [],
    physics: {
        default: 'arcade',
        arcade: {
            debug: true,
            fps:120,
            gravity: {y: 2000 } // Adjust based on your game
        }
    },
    input: {
        keyboard: true,
        gamepad: true,
    },
};
