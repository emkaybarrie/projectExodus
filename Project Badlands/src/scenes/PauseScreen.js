import { config } from "../config.js";
export default class PauseScreen extends Phaser.Scene {
    constructor() {
      super({ key: 'PauseScreen' });
    }
  
    create() {
         // Pause game when "P" is pressed
         this.input.keyboard.on('keydown-P', () => {
            this.scene.stop(); // Pause this scene
            this.scene.resume('Badlands'); // Launch the pause menu scene
        });

        // Bring the pause menu to the top
         this.scene.bringToTop();
      // Dimmed background
      this.add.rectangle(0, 0, config.width, config.height, 0x000000, 0.35).setOrigin(0);
  
      // Menu text
      this.add.text(this.scale.width * 0.5, this.scale.height * 0.35, 'Game Paused', { fontSize: '48px', color: '#ffffff' })
        .setOrigin(0.5);
  
      const resumeText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.4, 'Resume', { fontSize: '24px', color: '#ffffff' })
        .setOrigin(0.5)
        .setInteractive();
  
      const quitText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.45, 'Quit', { fontSize: '24px', color: '#ffffff' })
        .setOrigin(0.5)
        .setInteractive();
  
      // Resume game
      resumeText.on('pointerdown', () => {
        this.scene.stop(); // Close the pause menu
        this.scene.resume('Badlands'); // Resume the game scene
      });
  
      // Quit to main menu (or reload the game)
      quitText.on('pointerdown', () => {
        // Restart the entire game
        // Simulate a page refresh by reloading the page
        window.location.reload();
      });
    }
  }
  