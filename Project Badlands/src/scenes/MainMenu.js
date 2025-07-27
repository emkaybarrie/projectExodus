import { config } from "../config.js";

export default class MainMenu extends Phaser.Scene {
    constructor() {
      super({ key: 'MainMenu' });

      this.overlay
      this.menuText
    }
  
    preload() {
      // Preload assets

    }

    create() {
      // Play Main Menu Music
      this.sound.play('music_mainMenu')

      // Add and darken the background
      this.bg = this.add.image(0, 0, 'titleScreen2c').setOrigin(0).setScale(1).setDisplaySize(config.width, config.height);

      const titleText = this.add.image(this.scale.width * 0.5, this.scale.height * 0.35,'titleScreenText4').setOrigin(0.5).setScale(0.75)

      // Menu items (these can be dynamically added or retrieved)
      const menuItems = ['Start Game', 'Quick Play', 'Test Sandbox'];
      this.menuText = [];

      // Create menu text objects
      for (let i = 0; i < menuItems.length; i++) {
          let item = this.add.text(titleText.x, titleText.y + this.scale.height * 0.1 + (i * 50), menuItems[i], {
              fontFamily: 'Arial',  // You can replace this with your font
              fontSize: '32px',
              fontStyle: 'bold',
              color: '#ffffff',
              align: 'center'
          }).setOrigin(0.5);
          
          item.setInteractive();
          

          // Add mouse hover effect (highlighting the text when the mouse hovers)
          item.on('pointerover', () => {
              item.setStyle({ color: '#ffcc00' });  // Highlight color

              this.tweens.add({
                targets: item,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 200,
                ease: 'Cubic.easeInOut'
              });

          });

          item.on('pointerout', () => {
              if (!item.isSelected) {
                  item.setStyle({ color: '#ffffff' });  // Reset color when mouse leaves

                  this.tweens.add({
                    targets: item,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Cubic.easeInOut'
                  });
              }
          });

          // Handle mouse click event to select menu option
          item.on('pointerdown', () => {
              console.log(`${item.text} selected!`);
              // Add the logic for what happens when the item is selected
              this.executeMenuAction(i);
          });

          this.menuText.push(item);
      }

      // Keyboard navigation: Use the up and down arrow keys to navigate
      let selectedIndex = 2;
      this.menuText[selectedIndex].setStyle({ color: '#ffcc00' });  // Highlight the first item initially

      this.input.keyboard.on('keydown-UP', () => {
          // Move the selection up
          this.menuText[selectedIndex].setStyle({ color: '#ffffff' });
          selectedIndex = (selectedIndex - 1 + menuItems.length) % menuItems.length;
          this.menuText[selectedIndex].setStyle({ color: '#ffcc00' });
      });

      this.input.keyboard.on('keydown-DOWN', () => {
          // Move the selection down
          this.menuText[selectedIndex].setStyle({ color: '#ffffff' });
          selectedIndex = (selectedIndex + 1) % menuItems.length;
          this.menuText[selectedIndex].setStyle({ color: '#ffcc00' });
      });

      // Handle enter/space to select an option
      this.input.keyboard.on('keydown-SPACE', () => {
          console.log(`${menuItems[selectedIndex]} selected!`);
          // Add the logic for the selected item (e.g., start game, show options, etc.)
          this.executeMenuAction(selectedIndex);
      });
  
  
      
    }

    // Function to run actions based on the selected menu item
    executeMenuAction(index) {
      switch (index) {
          case 0:  // Start Game
              console.log('Starting game...');
              // Add logic for starting the game here (e.g., transition to gameplay scene)
              this.showOverlay(index)
              break;
          case 1:  // Quick play
              console.log('Starting quick play session...');
              // Add logic for showing options menu here (e.g., transition to options scene)
              // Freeplay
              this.playerData = {
                id: 0,
                alias: 'Guest',
                stage: 1,
                score: 0,
                spiritLevel: 1,
                power: 20,
                powerToNextLevel: 20,
                spiritPoints: 5,
                vitality: 1,
                focus: 1,
                adaptability: 1
              }


              this.scene.start('LoadingScreen', {
                targetScene: 'Badlands',
                category: 'badlands',
                assets: [
                    //{ type: 'image', key: 'terrain', path: 'assets/terrain.png' },
                    //{ type: 'spritesheet', key: 'enemy', path: 'assets/enemy_spritesheet.png', frameConfig: { frameWidth: 64, frameHeight: 64 } }
                ],
                region: 1,
                playerData: this.playerData
              });
              break;
          case 2:
            this.scene.start('LoadingScreen', {
              targetScene: 'Sandbox',
              category: 'badlands',
              assets: [
                  //{ type: 'image', key: 'terrain', path: 'assets/terrain.png' },
                  //{ type: 'spritesheet', key: 'enemy', path: 'assets/enemy_spritesheet.png', frameConfig: { frameWidth: 64, frameHeight: 64 } }
              ],
              region: 1,
              playerData: this.playerData
            });
            break;
          case 5:  // Exit
              console.log('Exiting game...');
              // Add logic for quitting the game or going back to main menu
              this.game.destroy(true);  // Destroy the game to exit
              // To exit the game and navigate somewhere else:
              //window.location.href = 'https://your-homepage.com';  // Or close the window if in a specific environment
              break;
          default:
              console.log('Unknown menu option');
              break;
      }
    }
  
    // Function to show the overlay
    showOverlay(index) {
      // Disable interactivity for the menu items
      this.hideMainMenu()
      
      // Create a semi-transparent black rectangle as overlay
      this.overlay = this.add.graphics();
      this.overlay.fillStyle(0x000000, 0.5);  // RGB color black with 50% opacity
      this.overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);  // Cover the whole screen
  
      // Optionally, you can add some text on the overlay
      this.overlayText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.15, 'Select Mode', {
          fontFamily: 'Arial',
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center'
      }).setOrigin(0.5);
      
      // You can add more UI components here as needed (e.g., buttons, sliders for options)

      // Add a "Close" button to remove the overlay
      this.closeButton = this.add.text(this.scale.width * 0.5, this.scale.height * 0.85, 'Back', {
          fontFamily: 'Arial',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center'
      }).setOrigin(0.5).setInteractive().setDepth(9);

      // Create the background box for the close button
      this.buttonBox = this.add.graphics().setInteractive();
      this.buttonBox.fillStyle(0x171423, 0.65);  // Purple background with 20% opacity
      this.buttonBox.lineStyle(4, 0x800080, 0.8); // Purple border (solid)
      this.buttonBox.strokeRect(this.closeButton.x - this.closeButton.width / 2 - 10, this.closeButton.y - this.closeButton.height / 2 - 10, this.closeButton.width + 20, this.closeButton.height + 20); // Adjust for padding around button
      this.buttonBox.fillRect(this.closeButton.x - this.closeButton.width / 2 - 10, this.closeButton.y - this.closeButton.height / 2 - 10, this.closeButton.width + 20, this.closeButton.height + 20); // Background fill


      // Add mouse hover effect (highlighting the text when the mouse hovers)
      this.closeButton.on('pointerover', () => {
       // this.closeButton.setStyle({ color: '#ffcc00' });  // Highlight color

        this.tweens.add({
          targets: this.closeButton,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 200,
          ease: 'Cubic.easeInOut'
        });

        this.tweens.add({
          targets: [this.buttonBox,this.closeButton],
          alpha: 1,
          duration: 300,
          ease: 'Power1',
        });

      });

      this.closeButton.on('pointerout', () => {
          if (!this.closeButton.isSelected) {
            this.closeButton.setStyle({ color: '#ffffff' });  // Reset color when mouse leaves

              this.tweens.add({
                targets: this.closeButton,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Cubic.easeInOut'
              });

              this.tweens.add({
                targets: [this.buttonBox,this.closeButton],
                alpha: 0.65,
                duration: 300,
                ease: 'Power1',
              });
          }
      });

      this.closeButton.on('pointerdown', () => {
          this.removeOverlay();  // Close the overlay and re-enable interactivity
      });

      // Run Specific Overlay Code
      switch (index) {
        case 0:  // Start Game
            console.log('Initialise Mode Select Menu...');
            // Add logic for starting the game here (e.g., transition to gameplay scene)
            this.openModeSelectMenu()
            break;
        case 1:  // Options
            console.log('Opening options...');
            // Add logic for showing options menu here (e.g., transition to options scene)
            break;
        case 5:  // Exit
            console.log('Exiting game...');
            // Add logic for quitting the game or going back to main menu
            this.game.destroy(true);  // Destroy the game to exit
            // To exit the game and navigate somewhere else:
            //window.location.href = 'https://your-homepage.com';  // Or close the window if in a specific environment
            break;
        default:
            console.log('Unknown menu option');
            break;
    }
    }

    // Function to remove the overlay (use this when closing the options or going back)
    removeOverlay() {
      if (this.overlay) {
        // Clear Open Menus
        this.closeModeSelectMenu()

        // Clear Overlay
        this.overlay.clear();  // Clear the graphics
        this.overlayText.destroy()
        this.closeButton.destroy()
        this.buttonBox.destroy()
      }

      // Re-enable interactivity for the main menu items
      this.showMainMenu();
    }

    // Function to disable interactivity for the main menu items
    hideMainMenu() {
      this.menuText.forEach(item => {
          item.setVisible(false);  // Disable interactivity for each menu item
      });
    }

    // Function to enable interactivity for the main menu items
    showMainMenu() {
      this.menuText.forEach(item => {
          item.setVisible(true);  // Re-enable interactivity for each menu item
      });
    }

    openModeSelectMenu() {
      // Define menu options
      this.options = [
          { imageKey: 'prologue', title: 'Prologue', description: 'Welcome to the Badlands' },
          { imageKey: 'story' + Phaser.Math.Between(0,14), title: 'Story', description: 'Empower your avatar, and defend their home from the forces ravaging the land' },
          { imageKey: 'explore_1', title: 'Explore', description: 'Experience the Badlands through the eyes of an avatar' },
      ];

      this.storyImageKey = this.options[1].imageKey

      console.log(this.storyImageKey)
  
      this.selectedOptionIndex = 0;
  
      // Create menu items
      this.menuItems = this.options.map((option, index) => {
          const x = (this.scale.width * 0.25) + (index * (this.scale.width * 0.25));
          const y = this.scale.height * 0.5;
          const initialAlpha = 0.65;  // Initial opacity
  
          // Image
          const img = this.add.image(0, -73, option.imageKey);
          img.displayWidth = 300;
          img.displayHeight = 285;

          const totalHeight = img.displayHeight + 150; // Includes space for text
          const totalWidth = img.displayWidth + 4; // Slight padding
  
          // Title text
          const title = this.add.text(0, img.displayHeight / 2 - 40, option.title, {
              fontSize: '24px',
              fill: '#fff',
              fontFamily: 'Arial',
              //fontStyle: 'bold',
              wordWrap: { width: totalWidth * 0.9 }
          }).setOrigin(0.5);
  
          // Description text
          const description = this.add.text(0, img.displayHeight / 2 + 15, option.description, {
              fontSize: '16px',
              fill: '#ccc',
              fontFamily: 'Arial',
              wordWrap: { width: totalWidth * 0.9 }
          }).setOrigin(0.5);
  
          // Border (rectangle graphics)
          // Define colors
          const borderColor = 0x6A0DAD;  // Dark Purple color
          const boxFillColour = 0x171423
          const border = this.add.graphics();
          border.lineStyle(4, 0xffffff, 1);
          border.strokeRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight);
          

          // Step 1: Create the light grey fill using Graphics
          const fillGraphics = this.add.graphics();
          fillGraphics.fillStyle(boxFillColour, 1); // Light grey color (Hex: 0xD3D3D3)
          fillGraphics.fillRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight); // Adjust size to fit the container
  
          // Create a container to group the image, text, and border
          const container = this.add.container(x, y, [border, fillGraphics, img, title, description]);
          container.setSize(totalWidth, totalHeight);
          container.setAlpha(initialAlpha);  // Set initial opacity for border
  
          // Use container's size for interactivity
          container.setInteractive();
  
          // Interactive scaling on hover
          container.on('pointerover', () => this.highlightOption(container, 1.2,1));
          container.on('pointerout', () => this.unHighlightOption(container, 1, 0.65));
          container.on('pointerdown', () => this.selectOption(container,index));

  
          return container;
      });
  }

  highlightOption(container,scaleFactor, alphaTarget){
    this.tweens.add({
      targets: container,
      scaleX: scaleFactor,
      scaleY: scaleFactor,
      duration: 300,
      ease: 'Power1',
    });

    this.tweens.add({
      targets: container,
      alpha: alphaTarget,
      duration: 300,
      ease: 'Power1',
    });

    // Tween for glimmer effect (pulsing alpha)
    this.glimmerTween = this.tweens.add({
      targets: container.getAt(0),
      alpha: { from: 0.5, to: 1 },
      duration: 800,
      yoyo: true,  // Makes it go back to its initial alpha
      repeat: -1,  // Infinite loop of the glimmer effect
      ease: 'Sine.easeInOut',  // Smooth ease-in/out
    });
  }
  
  // Tween the scale of the container
  unHighlightOption(container, scaleFactor, alphaTarget) {
      this.tweens.add({
          targets: container,
          scaleX: scaleFactor,
          scaleY: scaleFactor,
          duration: 300,
          ease: 'Power1',
      });

      this.tweens.add({
        targets: container,
        alpha: alphaTarget,
        duration: 300,
        ease: 'Power1',
    });

    this.glimmerTween.stop()

  }

  // Handle option selection
  selectOption(container,index) {
    console.log(`Option ${index} selected!`);

    this.glimmerTween.stop()

    // Flash effect on selection
    this.tweens.add({
      targets: container.getAt(0),
      alpha: 0.5,  // Dim the border briefly to indicate selection
      duration: 100,
      yoyo: true,  // Revert back to original state
      repeat: 2,  // Repeat once
      ease: 'Bounce.easeOut',
    });

    // Squish effect
    this.tweens.add({
      targets: container,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(500, () => {
              // Proceed to the next scene based on the selected option
              if (index + 1 == 2){
                this.scene.start(`Login`, {imageKey: this.storyImageKey});
              } else {
                // Quick Play
                this.playerData = {
                  id: 0,
                  alias: 'Guest',
                  stage: 1,
                  score: 0,
                  spiritLevel: 1,
                  power: 20,
                  powerToNextLevel: 20,
                  spiritPoints: 5,
                  vitality: 1,
                  focus: 1,
                  adaptability: 1
                }
    
                console.log(this.playerData)
                this.scene.start(`Base`, { dataPacket: this.playerData});
              }
        });
              
      },
    });
  }


    // Function to destroy all created items
    closeModeSelectMenu() {
      // Destroy the menu images
      if (this.menuImages) {
          this.menuImages.forEach(img => img.destroy());
      }

      // Destroy the title and description text
      if (this.titleText) {
          this.titleText.destroy();
      }

      if (this.descriptionText) {
          this.descriptionText.destroy();
      }

      // Destroy the prompt text
      if (this.promptText) {
          this.promptText.destroy();
      }
    }


    isGamepadButtonPressed() {
      const gamepads = this.input.gamepad.gamepads;
      return gamepads.some((pad) => pad && pad.buttons[0].pressed); // Check A button
    }
  }
