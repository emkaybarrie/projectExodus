import { config } from "../config.js";

import preload from '../preload.js';
import InputManager from '../classes/InputManager.js';
import EnvironmentManager from '../classes/EnvironmentManager.js';
import TerrainManager from '../classes/TerrainManager.js';
import { getStageConfigData } from '../libraries/Stages.js';

const fontSizeScaling = config.width / 1920



export default class Sandbox extends Phaser.Scene {
    constructor() {
        super('Sandbox');

        this.baseSpeed = 0
        this.sandbox = true

    }

    init() {

    }

    preload(){
        // Load assets if needed
        preload(this);
        this.load.spritesheet('terrainTileset2', 'assets/images/ground_tileset.png', { frameWidth: 16, frameHeight: 16 });
         
    }

    create() {

        

        // Currently stubbed - Add function to get stageConfig when based on desired stage
        this.stageConfig = getStageConfigData({regionId: 1, zoneId: this.stage})
        
        // Managers
            // Input Manager
            this.inputManager = new InputManager(this)
            this.inputManager.setupControls()
            this.input.addPointer(10);  // Allow up to 10 pointers
            // Scenery Manager
            this.environmentManager = new EnvironmentManager(this)
            // Terrain Manager
            this.terrainManager = new TerrainManager(this) 
            

        

        // Generate Start Terrain and Set Terrain Colliders
        const terrainDesign = this.terrainManager.generateTerrainDesignV2()
        const testTerrain = [
            { tileType: 'flat', length: this.scale.width * 1},                 
            // { tileType: 'slope', length: config.height * 0.05, yDirection: 'up'},  
            // { tileType: 'flat', length: config.width * 0.05},                 
            // { tileType: 'slope', length: config.height * 0.05, yDirection: 'up' }, 
            // { tileType: 'flat', length: config.width * 0.15},                
            // { tileType: 'wall', length: config.height * 0.05, yDirection: 'up' },  
            // { tileType: 'flat', length: config.width * 0.1},                 
            // { tileType: 'wall', length: config.height * 0.05, yDirection: 'up' }, 
            // { tileType: 'flat', length: config.width * 0.1},
            // { tileType: 'slope', length: config.height * 0.1, yDirection: 'up' },
            // { tileType: 'flat', length: config.width * 0.2}, 
            // // Switch to Mode 1
            // { tileType: 'flat', length: config.width * 0.35},    
            // { tileType: 'wall', length: config.height * 0.1, yDirection: 'down' },
            // { tileType: 'flat', length: config.width * 0.1},
            // { tileType: 'slope', length: config.height * 0.1, yDirection: 'down' },
            // { tileType: 'flat', length: config.width * 0.4},    
            // { tileType: 'wall', length: config.height * 0.05, yDirection: 'down' },                  
        ]
        
        this.terrainManager.generateTerrainV2(0,'ground', terrainDesign)

        

        this.input.keyboard.on('keydown', (event) => {
            switch (event.code) {
                case 'ArrowLeft':
                    this.baseSpeed = -5;
                    console.log('Base speed set to -2 (moving left)');
                    break;
                case 'ArrowRight':
                    this.baseSpeed = 5;
                    console.log('Base speed set to 2 (moving right)');
                    break;
                case 'Space':
                    this.baseSpeed = 5;
                    //console.log('Base speed set to 0 (stopping)');
                    break;
            }
        });
        

        this.input.keyboard.on('keyup', (event) => {
            if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
                this.baseSpeed = 0;
                console.log('Stopped moving');
            }
        });
    
        

  
        
    }


     update() {


    }







}
