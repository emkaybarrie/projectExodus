import { config } from "../config.js";

import preload from '../preload.js';
import InputManager from '../classes/InputManager.js';
import EnvironmentManager from '../classes/EnvironmentManager.js';
import TerrainManager from '../classes/TerrainManager.js';
import ObstacleManager from '../classes/ObstacleManager.js';
import LootManager from '../classes/LootManager.js';
import EnemyManager from '../classes/EnemyManager.js';
import AvatarManager from '../classes/AvatarManager.js';
import CameraManager from '../classes/CameraManager.js';
import UIManager from '../classes/UIManager.js';
import { getStageConfigData } from '../libraries/Stages.js';

const fontSizeScaling = config.width / 1920

const musicList = {
    1:'142',
    2:'Blame Brett',
    3:'Francesca',
    4:'From Eden',
    5:'Kings Season',
    6:'Spartacus',
    7:'Stay Crunchy',
    8:'Xylem Up',
}

export default class Badlands extends Phaser.Scene {
    constructor() {
        super('Badlands');
        this.scriptId = 'AKfycbw1zakrf0zclJNWzBSXjIKTfudd6Q9-YHNq6EvP7JGQ4OrtPIs0SwrgJCsAyoB4Y5eu'
        this.sheetUrl = `https://script.google.com/macros/s/${this.scriptId}/exec`;

        // Region & Stage Details
        this.region = null
        this.stage = 1
        this.stageProgress = 0
        this.stageLength = 100
        this.stageStart = false
        this.stageProgressionActive = false

        this.stageConfig = null
        this.baseSpeed = 0

        // Scoring
        this.score = null
        this.highScoreStage = null
        this.highScore = null

        this.avatar = null;

        this.currentTrack = null
        this.stageRestarting = false



    }

    init(data) {
        console.log(data)
        this.region = data.region;
        this.playerData = data.playerData
    }

    preload(){
        // Load assets if needed
        preload(this);
        this.load.image('avatarIcon', `assets/avatars/${this.region}/icons/Badlands/default.png`)
        this.load.image('healthIcon', 'assets/images/healthIcon.png')
        this.load.image('manaIcon', 'assets/images/manaIcon.png')
        this.load.image('staminaIcon', 'assets/images/staminaIcon.png')

        // Stub Monsters
        const currentRegion = 'region1'; // Replace with your dynamic logic
        const currentStage = 'stage1';  // Replace with your dynamic logic
        this.monsterList = {
            region1: {
                stage1: {
                    common: [
                        {
                            name: 'nightborne_archer',
                            spriteSheetPath: 'assets/enemies/region1/nightborne_archer.png',
                            dimensions: { frameWidth: 64, frameHeight: 64 },
                            animations: [
                                { type: 'idle', start: 40, end: 43, frameRate: 6, repeat: -1 },
                                { type: 'run', start: 0, end: 7, frameRate: 12, repeat: -1 },
                                { type: 'attack', start: 24, end: 30, frameRate: 8, repeat: 0 },
                                { type: 'takeHit', start: 8, end: 9, frameRate: 6, repeat: 0 },
                                { type: 'death', start: 8, end: 15, frameRate: 8, repeat: 0 }
                            ],
                            flipReversed: true,
                            scale: 1.5,
                            physicsBox: { width: 32, height: 32, offsetX: 16, offsetY: 16 }, // Optional
                            tint: 0xFFFFFF,//0x00FF00,
                            type: 'default',
                            baseHealthModifier: 0.85,
                            attackType: 'ranged',
                            attackRange: this.scale.width * 0.5,        
                            attackPower: 15,
                            maxAttackCombo: 1,
                            attackRecoveryTime: 2500
                        },
                        {
                            name: 'nightborne_warrior',
                            spriteSheetPath: 'assets/enemies/region1/nightborne_warrior.png',
                            dimensions: { frameWidth: 140, frameHeight: 93 },
                            animations: [
                                { type: 'idle', start: 0, end: 7, frameRate: 6, repeat: -1 },
                                { type: 'run', start: 8, end: 15, frameRate: 12, repeat: -1 },
                                { type: 'attack', start: 16, end: 25, frameRate: 8, repeat: 0 },
                                { type: 'takeHit', start: 26, end: 28, frameRate: 6, repeat: 0 },
                                { type: 'death', start: 29, end: 38, frameRate: 10, repeat: 0 }
                            ],
                            flipReversed: false,
                            scale: 1.25,
                            physicsBox: { width: 20, height: 50, offsetX: 100, offsetY: 35 }, // Optional
                            tint: 0xFFFFFF,//0x00FF00,
                            type: 'default',
                            baseHealthModifier: 1,
                            attackType: 'melee',
                            attackRange: this.scale.width * 0.1,        
                            attackPower: 25,
                            maxAttackCombo: 3,
                            attackRecoveryTime: 2000

                        },
                        // Other common monsters...
                    ],
                    uncommon: [
                        {
                            name: 'nightborne_hound',
                            spriteSheetPath: 'assets/enemies/region1/nightborne_hound.png',
                            dimensions: { frameWidth: 64, frameHeight: 64 },
                            animations: [
                                { type: 'idle', start: 0, end: 5, frameRate: 6, repeat: -1 },
                                { type: 'run', start: 7, end: 11, frameRate: 12, repeat: -1 },
                                { type: 'attack', start: 7, end: 11, frameRate: 8, repeat: 0 },
                                { type: 'takeHit', start: 14, end: 17, frameRate: 6, repeat: 0 },
                                { type: 'death', start: 21, end: 27, frameRate: 8, repeat: 0 }
                            ],
                            flipReversed: false,
                            scale: 1.25,
                            physicsBox: { width: 64, height: 32, offsetX: 0, offsetY: 32 }, // Optional
                            tint: 0xFFFFFF,//0x00FF00,
                            type: 'chaser',
                            baseHealthModifier: 0.9,
                            attackType: 'melee',
                            attackRange: this.scale.width * 0,   
                            attackPower: 20,
                            maxAttackCombo: 1,
                            attackRecoveryTime: 1000
                        },
                        // Other uncommon monsters...
                    ],
                    rare: [
                        {
                            name: 'nightborne_elite',
                            spriteSheetPath: 'assets/enemies/region1/nightborne_elite.png',
                            dimensions: { frameWidth: 80, frameHeight: 80 },
                            animations: [
                                { type: 'idle', start: 0, end: 8, frameRate: 6, repeat: -1 },
                                { type: 'run', start: 23, end: 28, frameRate: 12, repeat: -1 },
                                { type: 'attack', start: 46, end: 57, frameRate: 8, repeat: 0 },
                                { type: 'takeHit', start: 69, end: 73, frameRate: 10, repeat: 0 },
                                { type: 'death', start: 92, end: 114, frameRate: 12, repeat: 0 }
                            ],
                            flipReversed: true,
                            scale: 3,
                            physicsBox: { width: 20, height: 32, offsetX: 25, offsetY: 32 }, // Optional        
                            tint: 0xFFFFFF,//0x00FF00,
                            type: 'chaser',
                            baseHealthModifier: 1.5,
                            attackType: 'melee',
                            attackRange: this.scale.width * 0.1, 
                            attackPower: 40,
                            maxAttackCombo: 3,
                            attackRecoveryTime: 3000
                        },
                        // Other rare monsters...
                    ],
                    // Other rarities...
                },
                // Other stages...
            },
            // Other regions...
        };
        
        // Preload only the relevant monster spritesheets
        this.loadMonsterSpritesheets(this.monsterList, currentRegion, currentStage);

        //Stub  animation
        this.anims.create({
            key: 'animation_MajorReward',  // The key that will be used to refer to this animation
            frames: this.anims.generateFrameNumbers('animation_MajorReward', { start: 0, end: 29 }),  // Frame range (adjust according to your spritesheet)
            frameRate: 24,  // Animation speed (frames per second)
            repeat: -1,  // Repeat the animation indefinitely
            //yoyo: true
        });

        this.anims.create({
            key: 'hitAnim_bow',  // The key that will be used to refer to this animation
            frames: this.anims.generateFrameNumbers('hitAnim_bow', { start: 0, end: 15 }),  // Frame range (adjust according to your spritesheet)
            frameRate: 28,  // Animation speed (frames per second)
            repeat: 0  // Repeat the animation indefinitely
        });

        this.anims.create({
            key: 'hitAnim_powerShot',  // The key that will be used to refer to this animation
            frames: this.anims.generateFrameNumbers('hitAnim_powerShot', { start: 0, end: 15 }),  // Frame range (adjust according to your spritesheet)
            frameRate: 22,  // Animation speed (frames per second)
            repeat: 0  // Repeat the animation indefinitely
        });

        this.anims.create({
            key: 'hitAnim_huntingHawk',  // The key that will be used to refer to this animation
            frames: this.anims.generateFrameNumbers('hitAnim_huntingHawk', { start: 0, end: 15 }),  // Frame range (adjust according to your spritesheet)
            frameRate: 28,  // Animation speed (frames per second)
            repeat: 0  // Repeat the animation indefinitely
        });
  
         
    }

    create() {
        this.sound.stopAll()
        // // Scale factors relative to screen size
        const baseScreenIncrementX = this.scale.width * 0.01;
        const baseScreenIncrementY = this.scale.height * 0.01;

        // Initialisation
        // System Idenficiation
        this.isTouch = this.input.activePointer.touch;
        this.isMobile = /Mobi|Android/i.test(navigator.userAgent);
        // Pause Screen
        this.activatePauseScreenButton()
        // Disable Right Click Menu
        this.input.mouse.disableContextMenu();

        // Score System
        this.highScore = this.playerData.score
        this.highScoreStage = this.playerData.stage

        // Initialize the score display
        this.scoreText = this.add.text(baseScreenIncrementX * 95, baseScreenIncrementY * 2.5, `Score: ${this.score}`, {
            fontSize: '42px',
            fill: '#fff'
        }).setDepth(9).setScrollFactor(0).setOrigin(1,0)

        // High Score And High Score Stage
        this.recordText_Score = this.add.text(baseScreenIncrementX * 95, this.scoreText.y + baseScreenIncrementY * 15, `High Score: ${Math.round(this.highScore)}`, {
            fontSize: '24px',
            fill: '#fff'
        }).setDepth(9).setScrollFactor(0).setOrigin(1,0)

        this.recordText_Stage = this.add.text(baseScreenIncrementX * 95, this.recordText_Score.y + baseScreenIncrementY * 5 , `Furthest Stage: ${this.highScoreStage}`, {
            fontSize: '24px',
            fill: '#fff'
        }).setDepth(9).setScrollFactor(0).setOrigin(1,0)

        // Music System
        // Play the background music after delay
        setTimeout(() => {
            this.playTrackFromMusicList()
        }, 1000);

        // Currently stubbed - Add function to get stageConfig when based on desired stage
        this.stageConfig = getStageConfigData({regionId: 1, zoneId: this.stage})

        // Element Groups

        this.projectileGroup = this.physics.add.group(); // Phaser group to manage projectiles
        this.friendlyProjectileGroup = this.physics.add.group(); // Phaser group to manage projectiles
        
        // Managers
            // Input Manager
            this.inputManager = new InputManager(this)
            this.inputManager.setupControls()
            this.input.addPointer(10);  // Allow up to 10 pointers
            // Scenery Manager
            this.environmentManager = new EnvironmentManager(this)
            // Terrain Manager
            this.terrainManager = new TerrainManager(this) 
            // Avatar Manager
            this.avatarManager = new AvatarManager(this, this.inputManager, 1, config.width * 0.1, config.height * 0.5);
            // Obstacle Manager
            this.obstacleManager = new ObstacleManager(this)
            // Loot Manager
            this.lootManager = new LootManager(this)
            // Enemy Manager
            this.enemyManager = new EnemyManager(this)
            
        // Camera Manager
        this.cameraManager = new CameraManager(this)
        // UI Manager
        this.uiManager = new UIManager(this)

        // Set Colliders
        this.terrainManager.addColliders()
        this.obstacleManager.addColliders()
        this.lootManager.addColliders()
        this.enemyManager.addColliders()

        // Generate Start Terrain and Set Terrain Colliders
        this.terrainManager.generateStartTerrain()
        

        // Stubs / Debug
        //this.initialiseControlsText()
        this.showMessageBox()
        //this.activateBlessingsScreenButton()

        
        

  
        
    }

    update(time, delta) {
        
        this.manageProgression_ScoringSystem()

        this.scoreText.setText(`Score: ${Math.round(this.score)}`);

    }

    showMessageBox() {
        // Create a background for the text box (optional)
        this.messageBox = this.add.rectangle(config.width * 0.025, config.height * 0.3, config.width * 0.225, config.height * 0.2, 0x000000, 0.5)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0xffffff); // Adds a white border
        
        // Create the text object
        const fontSize = 14 * fontSizeScaling
        this.message = this.add.text(this.messageBox.x + config.width * 0.005, this.messageBox.y + config.height * 0.005, '', {
            fontSize: fontSize,
            fill: '#ffffff',
            wordWrap: { width: config.width * 0.22 },
            lineSpacing: 8 // Adds spacing between lines
        });

        // Set placeholder log text
        this.message.setText(
            "Objective: Survive and collect coins to increase your score.\n\n" +
            "Tip: Use ARROW keys to move.\n" +
            "Tip: Press SPACE or TAP to jump.\n" +
            "Tip: Press Q or DOUBLE TAP to dodge.\n" +
            "Tip: Press E to attack and A / D for skills.\n\n" +
            "Tip: Press P to pause" 

        );

        this.messageBox.setDepth(10)
        this.message.setDepth(10)
    }

    manageProgression_ScoringSystem(){


        if(this.stageStart && this.stageProgressionActive){
            this.stageProgress += this.baseSpeed * 0.01
            this.score += this.baseSpeed * 0.01
        }
        
        this.uiManager.updateProgressBar(this.uiManager.progressBar, this.stageProgress,this.stageLength)
        if(this.stageProgress > this.stageLength ){
            this.stage += 1
            this.stageProgress = 0

            // Stub - stage length and speed
            this.avatarManager.adaptability += 15
            this.avatarManager.refreshStats()
            this.stageLength *= 1.1


            if(this.stage <= 3 ){
                this.stageConfig = getStageConfigData({regionId: 1, zoneId: this.stage})
                this.environmentManager.loadBackgroundTextures(
                    this.stageConfig.regionId, 
                    this.stageConfig.zoneId, 
                    this.stageConfig.sectorId, 
                    this.stageConfig.numberOfLayers, 
                    this.stageConfig.parallaxSpeeds
                )
            }
        }
    }

    async saveScoreToDb(score, stage){
        try {
            const response = await fetch(
              `${this.sheetUrl}?request=updateScore&id=${this.playerData.id}&score=${Math.round(score)}&stage=${stage}`,{
                method: "POST",
              }
            );
      
            const result = await response.json();
      
            console.log(result)
      
            if (result.status === "success") {
              // Player score updated
            } else if (result.status === "error") {
              // Player doesn't exist, prompt for account creation
              console.log(result.message)
            } else {
              console.error(result.message);
            }
          } catch (error) {
            console.error("Error logging in:", error);
          }
    }


    restartStage(){
        if(!this.stageRestarting){
            this.stageRestarting = true
        // Save Score
        // Save the score and stage only if the current score is higher than the saved one
        if (this.score > this.highScore) {
            this.saveScoreToDb(this.score, this.stage);
            console.log('Saving Score to DB')
            this.highScore = this.score
            this.highScoreStage = this.stage

        }

        // Update the texts
        this.recordText_Score.setText(`High Score: ${Math.round(this.highScore)}`);
        this.recordText_Stage.setText(`Furthest Stage: ${this.highScoreStage}`);

        this.score = 0
        this.stageProgress = 0
        this.stage = 1

        this.stageConfig = getStageConfigData({regionId: 1, zoneId: this.stage})
        this.environmentManager.loadBackgroundTextures(
            this.stageConfig.regionId, 
            this.stageConfig.zoneId, 
            this.stageConfig.sectorId, 
            this.stageConfig.numberOfLayers, 
            this.stageConfig.parallaxSpeeds
        )

        // Stub
        this.avatarManager.vitality = 100 + this.playerData.vitality
        this.avatarManager.focus = 100 +this.playerData.focus
        this.avatarManager.adaptability = 100 + this.playerData.adaptability
        this.avatarManager.refreshStats()

        // Update the texts
        this.scoreText.setText(`Score: ${this.score}`);

        // Restart Music
        console.log('Playing New song')
        this.playTrackFromMusicList()

        // Reset Flag
        setTimeout(() => {
            this.stageRestarting = false
        }, 500);
        }

 
    }

    playTrackFromMusicList(track = 0){
        if (this.currentTrack){
            this.currentTrack.stop()
        }

        let selectedTrack
        if (track == 0){
            track = Phaser.Math.Between(1, 8)
        } 

        selectedTrack = 'backgroundMusic' + track; // Select chosen track
        
         
        this.currentTrack = this.sound.add(selectedTrack, {
            loop: false,  // Set to false because we want to manually handle the looping
            volume: 0.5,  // Adjust the volume (optional, between 0 and 1)
        });
    
        // Add a listener for when the music ends
        this.currentTrack.on('complete', () => {
            // Play the next random song when the current one finishes
            this.playTrackFromMusicList();
        });
    
        // Play the music
        this.currentTrack.play();
        this.showTrackName(musicList[track]);

    }
    // Function to display the track name briefly on the screen
    showTrackName(trackName, duration = 3000) {
        // Create a text object to display the track name
        const trackNameText = this.add.text(this.scale.width / 2, this.scale.height / 4, `Now Playing: ${trackName}`, {
            fontSize: '32px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000', // Optional: Add a stroke for better visibility
            strokeThickness: 3,
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(9); // Center the text

        // Fade in the text (optional)
        trackNameText.setAlpha(0);
        this.tweens.add({
            targets: trackNameText,
            alpha: 1, // Fully visible
            duration: 500, // Fade-in duration
            onComplete: () => {
                // Keep the text for the duration, then fade out
                this.time.delayedCall(duration, () => {
                    this.tweens.add({
                        targets: trackNameText,
                        alpha: 0, // Fade out
                        duration: 500,
                        onComplete: () => {
                            trackNameText.destroy(); // Remove the text after it fades out
                        },
                    });
                });
            },
        });
    }

    loadMonsterSpritesheets(monsterList, region, stage) {
        const loadedAssets = new Set(); // Track loaded spritesheets
  
    
        // If region is provided, use it; otherwise, loop over all regions
        const regionsToLoad = region ? [region] : Object.keys(monsterList);
    
        regionsToLoad.forEach(regionKey => {
            const region = monsterList[regionKey];
    
            // If stage is provided, use it; otherwise, loop over all stages for the region
            const stagesToLoad = stage ? [stage] : Object.keys(region);
    
            stagesToLoad.forEach(stageKey => {
                const stageData = region[stageKey];
    
                // Load each monster's spritesheet
                Object.values(stageData).forEach(monsters => {
                    monsters.forEach(monster => {
                        const { name, spriteSheetPath, dimensions } = monster;
    
                        // Only load if not already loaded
                        if (!loadedAssets.has(spriteSheetPath)) {
                            this.load.spritesheet(name, spriteSheetPath, {
                                frameWidth: dimensions.frameWidth,
                                frameHeight: dimensions.frameHeight,
                            });
                            loadedAssets.add(spriteSheetPath);
                        }
                    });
                });
            });
        });
 
    }
    
    // Stub Helpers

    // Set Up Pause and Blessings Screen Buttons
    activatePauseScreenButton(){
        // Pause game when "P" is pressed
        this.input.keyboard.on('keydown-P', () => {
            this.scene.pause(); // Pause this scene
            this.scene.launch('PauseScreen'); // Launch the pause menu scene
            this.scene.bringToTop('PauseScreen');
        });
        
    }

    activateBlessingsScreenButton(){
        // Blessings game when "B" is pressed
        this.input.keyboard.on('keydown-B', () => {
           this.scene.pause(); // Pause this scene
           this.scene.launch('BlessingsScreen',{ mainScene: this, avatar: this.avatarManager }); // Launch the pause menu scene
           this.scene.bringToTop('BlessingsScreen');
       });
    }

}
