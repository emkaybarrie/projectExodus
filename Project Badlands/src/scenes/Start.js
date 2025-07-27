import preload from "../preload.js";
import { config } from "../config.js";

export default class Start extends Phaser.Scene {
    constructor() {
        super('Start');
        
    }

    preload() {
        // Load assets if needed
        preload(this);  // Call the preload function with the current scene
    }

    create() {

        this.cameras.main.fadeIn(1500, 0, 0, 0);

        // Debug
        // Variables to hold textures and the current index
        let titleImageKeys = ['titleScreen1', 'titleScreen2a', 'titleScreen2b', 'titleScreen2c'];
        let currentImageIndex = Phaser.Math.Between(3,3);
        let titleTextKeys = ['titleScreenText1', 'titleScreenText2', 'titleScreenText3', 'titleScreenText4', 'titleScreenText5', 'titleScreenText6'];
        let currentTextIndex = Phaser.Math.Between(3,3);

        this.input.keyboard.on('keydown-Z', () => {
            // Increment the index and wrap around if necessary
            currentImageIndex = (currentImageIndex + 1) % titleImageKeys.length;
            // Set the sprite's texture to the new one
            titleScreen.setTexture(titleImageKeys[currentImageIndex]);
            // Scale the image to fit the screen
            scaleImageToFitCanvas(titleScreen);
        });

        this.input.keyboard.on('keydown-X', () => {
            // Increment the index and wrap around if necessary
            currentTextIndex = (currentTextIndex + 1) % titleTextKeys.length;
            // Set the sprite's texture to the new one
            titleText.setTexture(titleTextKeys[currentTextIndex]);
        });

        const titleScreen = this.add.image(0,0, titleImageKeys[currentImageIndex]).setOrigin(0).setInteractive()

        // Scale the image to fit the screen
        scaleImageToFitCanvas(titleScreen);
        
        // Adjust scaling on window resize
        window.addEventListener('resize', () => {
            config.width = window.innerWidth;
            config.height = window.innerHeight;
            game.resize(config.width, config.height);
            scaleImageToFitCanvas(titleScreen);
        });

        // Add Start screen text
     

        const titleText = this.add.image(this.scale.width * 0.5, this.scale.height * 0.35,titleTextKeys[currentTextIndex]).setOrigin(0.5).setInteractive()
        
        const instructionText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, 'Press Space to start', {
            fontSize: '26px',
            fill: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.showUpdateLog()

        // Create a fade-in and fade-out effect using a tween
        this.tweens.add({
            targets: instructionText,
            alpha: 0,      // Start fully transparent
            duration: 0,   // Instant transparency
            yoyo: true,    // Makes the animation play back and forth
            repeat: -1,    // Repeat indefinitely
            ease: 'Linear', // Linear easing for a smooth fade
            duration: 2000 // Duration of each fade in and out (1 second)
        });
        
        this.add.text(this.scale.width * 0.975, this.scale.height * 0.975, 'Current Supported: Keyboard, Gamepad', {
            fontSize: '16px',
            fill: '#fff',
            fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        // Update instruction text dynamically based on input
        
        // Track input mode (default to keyboard)
        let inputMode = 'keyboard';
        let isMouseMoving = false;

        // Detect mouse movement
        this.input.on('pointermove', () => {
            if (!isMouseMoving) {
                isMouseMoving = true;
                instructionText.setText('Click to start');
            }

        });

        // Detect when the mouse stops moving (after a short delay)
        this.input.on('pointerout', () => {
            // Mouse has left the canvas, reset text
            isMouseMoving = false;
            // Reset the text after a short delay if the mouse is not moving
            this.time.delayedCall(500, () => {
                if (!this.input.activePointer.isPointerOut  && inputMode == 'keyboard') {
                    instructionText.setText('Press Space to start');
                }
            });
        });
        
        this.input.keyboard.on('keydown', () => {
            inputMode = 'keyboard';
            instructionText.setText('Press Space to start');
        });

        this.input.gamepad.on('connected', () => {
            inputMode = 'gamepad';
            instructionText.setText('Press A to start');
        });
        
        // Handle "start" based on input mode
        this.input.keyboard.on('keydown-SPACE', () => {
            if (inputMode === 'keyboard') {
            this.startMenuScene();
            }
        });

        titleScreen.on('pointerdown', () => this.startMenuScene());
        
        this.input.gamepad.on('down', (pad, button) => {
            if (inputMode === 'gamepad' && button.index === 0) { // Button 0 is typically A on most gamepads
            this.startMenuScene();
            }
        });
        
        // Method to start the MenuScene and enter fullscreen
        this.startMenuScene = () => {
                this.scene.start('MainMenu');
                this.scale.startFullscreen();
        };
    }

    showUpdateLog() {
        // Create a background for the text box (optional)
        this.updateLogBox = this.add.rectangle(config.width * 0.01, config.height * 0.01, config.width * 0.23, config.height * 0.1 , 0x000000, 0.5)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0xffffff); // Adds a white border
        
        // Create the text object
        this.updateLog = this.add.text(this.updateLogBox.x + config.width * 0.005,this.updateLogBox.y + config.height * 0.005, '', {
            fontSize: '14px',
            fill: '#ffffff',
            wordWrap: { width: config.width * 0.25 },
            lineSpacing: 8 // Adds spacing between lines
        });

        // Set placeholder log text
        this.updateLog.setText(
            "Latest Major Updates (03/01):\n" +
            " - New environments added\n" +
            " - Terrain generation updated\n" +
            " - Added starting area and skill selection shrine"
        );
    }



    
}

function scaleImageToFitCanvas(image) {
    // Set image size to match the game size
    image.setDisplaySize(config.width, config.height);
}
