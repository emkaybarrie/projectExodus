import { config } from "../config.js";
export default class TerrainManager {
    constructor(scene) {

        // Initialize stage elements here
        this.scene = scene; // Reference to the Phaser scene
        this.terrainGroupsPhysics = {
            ground: this.scene.physics.add.staticGroup(),
            low: this.scene.physics.add.staticGroup(),
            medium: this.scene.physics.add.staticGroup(),
            high: this.scene.physics.add.staticGroup()
        };

        this.terrainGroupsTilesprites = this.scene.add.group()
        this.stageConfig = this.scene.stageConfig

        // Chaos Factor Settings - Determine variance for terrain generation
        this.chaosFactorSettings = {
            ground: { chaosLowerBound: 0.95, chaosUpperBound: 1.05},
            low: { chaosLowerBound: 0.95, chaosUpperBound: 1.05 },
            medium: { chaosLowerBound: 0.90, chaosUpperBound: 1.075 },
            high: { chaosLowerBound: 0.85, chaosUpperBound: 1.10 }
        };

        // Elevation Settings
        this.elevationSettings = {
            ground: { baseHeight: this.scene.scale.height * 0.1 },
            low: { baseHeight: this.scene.scale.height * 0.3  },
            medium: { baseHeight: this.scene.scale.height * 0.6 },
            high: { baseHeight: this.scene.scale.height * 0.8 }
        };

        // Distance Settings
        this.distanceSettings = {
            min: { baseWidth: this.scene.scale.width * 0.25 },
            short: { baseWidth: this.scene.scale.width * 0.5 },
            standard: { baseWidth: this.scene.scale.width * 1 },
            far: { baseWidth: this.scene.scale.width * 1.5 },
            max: { baseWidth: this.scene.scale.width * 2}
        };

        // Transition Gap Settings
        this.transitionGapSettings = {
            ground: { baseWidth: this.scene.scale.height * 0.25},
            low: { baseWidth: this.scene.scale.height * 0.35  },
            medium: { baseWidth: this.scene.scale.height * 0.45 },
            high: { baseWidth: this.scene.scale.height * 0.55 }
        };

        // Register the update event for manager
        this.scene.events.on('update', this.updateV2, this);

        // Initialize pools
        this.tilePool = [];  // Pool for tiles
        this.terrainPool = [];  // Pool for terrain physics bodies


    }

        

    addColliders() {
        // Add a collider for each terrain group with the player
        Object.values(this.terrainGroupsPhysics).forEach(terrain => {
            // Avatar
            this.scene.physics.add.collider(
                this.scene.avatarManager.sprite,
                terrain, 
                (sprite, terrainSegment) => this.handleAvatarCollisions(this.scene.avatarManager, terrainSegment),
                null, 
                this
            );
            // Friendly Projectiles
            this.scene.physics.add.collider(this.scene.friendlyProjectileGroup, terrain, (projectile, terrain) => {
                projectile.destroy()
            });
        });

        // Add a collider for each enenmy group with the terrain group
        Object.values(this.terrainGroupsPhysics).forEach(terrainGroup => {
            this.scene.physics.add.collider(
                this.scene.enemyManager.enemyGroup,
                terrainGroup,
                (enemy, terrain) => {
                    //console.log('Collision detected between terrain and enemy');
                }
            );
        });
    
    }

        handleAvatarCollisions(avatar, terrain){

            if(terrain.tileType == 'slope'){
                if(avatar.mode == 1){

                // Reduce speed when moving up
                if (Math.abs(avatar.sprite.body.velocity.x) > 0) {
                    avatar.sprite.setVelocityX(avatar.sprite.body.velocity.x * 0.35);
                }

                // Optional: Increase vertical position slightly to simulate smoother movement
                avatar.sprite.y -= 1; // Small adjustment upwards

                // Add sliding effect
                if (avatar.sprite.body.velocity.x === 0) {
                    avatar.sprite.setVelocityY(100); // Small downward velocity to simulate sliding
                    if(terrain.direction == 'upRight'){
                        avatar.sprite.x -= 2.5
                        avatar.sprite.y += 2
                    } else {
                        avatar.sprite.x += 2.5
                        avatar.sprite.y += 2
                    }
                    
                }
                } else if (avatar.mode == 0) {
                    if(terrain.yDirection == 'up'){
                        avatar.sprite.y -= 1; // Small adjustment upwards
                        if(avatar.traversalSpeedModifier > 50){
                            avatar.traversalSpeedModifier -= 0.35
                        }
                    } else if (terrain.yDirection == 'down'){
                        avatar.sprite.y += 2; // Small adjustment upwards
                        avatar.sprite.setVelocityY(200)
                        if(avatar.traversalSpeedModifier < 300){
                        avatar.traversalSpeedModifier *= 1.05
                        }
                    }
                    
                }
            }

            if (terrain.tileType == 'wall'){
                if(avatar.mode == 0){
                avatar.sprite.x -= this.scene.baseSpeed
                avatar.sprite.setVelocityX(0)

                }
            }

        }
    
    // generateTerrain(x, elevation = 'ground', terrainDesign = null) { 
    //     // Tile indices for flat, sloped, and fill terrain
    //     const tileIndices = {
    //         flat: { ground: 1 },
    //         slope: {
    //             up: { ground: 3 },
    //             down: { ground: 4 },
    //         },
    //         wall: {
    //             up: { ground: 5 },  // Wall facing left (up)
    //             down: { ground: 7 }, // Wall facing right (down)
    //         },
    //         fill: { ground: 6 }, // Tile to fill gaps below slopes
    //         edges: {
    //             left: { ground: 0 },
    //             right: { ground: 2 },
    //         }
    //     };
    
    //     // Elevation Y-position based on input
    //     const elevationOffsets = { 
    //         ground: this.scene.scale.height, 
    //         low: this.scene.scale.height * 0.75, 
    //         high: this.scene.scale.height * 0.5 };
    //     const baseY = elevationOffsets[elevation] || this.scene.scale.height;
    
    //     // Scaling and tile dimensions
    //     const sourceTileWidth = 16;
    //     const sourceTileHeight = 16;
    //     const desiredTileSize = 16;
    //     const scaleFactorX = desiredTileSize / sourceTileWidth;
    //     const scaleFactorY = desiredTileSize / sourceTileHeight;
    
    //     // Define terrain group
    //     const terrainTilesGroup_Local = this.scene.add.group();

    //     // Tiles to Create on batch
    //     let tilesToCreate = [];
    //     // Physics Bodies to  Create on batch
    //     let physicsBodies = []
    //     // Objects to populate Terrain with on batch
    //     let terrainObjects = []

    //     // Track position for stitching terrain
    //     let currentX = x;
    //     let currentY = baseY;
    
    //     let previousSegment = null; // Track the previous segment for handling transitions


    //     // Create terrain design if none provided
    //     if(!terrainDesign){
    //         terrainDesign = this.generateTerrainDesign(this.scene.scale.width * Phaser.Math.Between(1, 2), this.scene.scale.height * 0.6)
    //     }

    //     // Generate terrain map for object creation - to move ot seperate function
    //     terrainDesign.forEach(segment => {
    //         const { tileType, length, yDirection, xDirection, populationConfig } = segment;

    //         //console.log("Next Tile: " + type)
    
    //         if (tileType === 'flat') {
    //             // Check if the previous segment was an upward slope
    //             if (previousSegment && previousSegment.tileType === 'slope' && previousSegment.yDirection === 'up') {
    //                 // If the previous segment was an upward slope, shift the first flat tile down by 1
    //                 currentY += desiredTileSize;
    //             }
    
    //             // Handle transition from an upward wall (left) to flat (add left edge tile)
    //             if (previousSegment && previousSegment.tileType === 'wall' && previousSegment.yDirection === 'up') {
    //                 const edgeTile = this.scene.add.tileSprite(
    //                     currentX - desiredTileSize,
    //                     currentY,
    //                     desiredTileSize,
    //                     desiredTileSize,
    //                     'terrainTileset2',
    //                     tileIndices.edges.left[elevation]
    //                 )
    //                     .setOrigin(0, 1)
    //                     .setScale(scaleFactorX, scaleFactorY);
    //                     terrainTilesGroup_Local.add(edgeTile)

    //                 // Create Physics Body for Segment
                    
    //                 const terrainPhysicsBodySegment = this.terrainGroupsPhysics[elevation].create(currentX, currentY)
    //                 terrainPhysicsBodySegment.setOrigin(1, 1)
    //                 terrainPhysicsBodySegment.displayWidth = desiredTileSize
    //                 terrainPhysicsBodySegment.displayHeight = desiredTileSize
    //                 terrainPhysicsBodySegment.body.setSize(desiredTileSize, desiredTileSize)
    //                 terrainPhysicsBodySegment.setImmovable(true)
    //                 terrainPhysicsBodySegment.body.allowGravity = false
    //                 terrainPhysicsBodySegment.body.checkCollision.down = false
    //                 terrainPhysicsBodySegment.setVisible(false)
    //                 //terrainPhysicsBodySegment.body.updateFromGameObject()

    //                 terrainPhysicsBodySegment.tileType = 'edge'


    //             }

    //             let segmentStart = currentX
    
    //             // Create flat segment
    //             for (let i = 0; i < Math.round(length / desiredTileSize); i++) {
    //                 tilesToCreate.push({
    //                     x: currentX,
    //                     y: currentY,
    //                     xSize: desiredTileSize,
    //                     ySize: desiredTileSize,
    //                     texture: 'terrainTileset2',
    //                     frame: tileIndices.flat[elevation],
    //                     originX: 0,
    //                     originY: 1,
    //                     scaleX: scaleFactorX,
    //                     scaleY: scaleFactorY,
    //                     tileType: 'flat',
    //                 });

    //                 // Fill the gap below the flat tile until we reach baseY
    //                 const fillStartY = currentY + desiredTileSize;
    //                 const fillEndY = baseY;

    //                 const fillYSize = (fillEndY - fillStartY)

    //                 tilesToCreate.push({
    //                     x: currentX,
    //                     y: fillStartY - desiredTileSize,
    //                     xSize: desiredTileSize,
    //                     ySize: fillYSize + desiredTileSize,
    //                     texture: 'terrainTileset2',
    //                     frame: tileIndices.fill[elevation],
    //                     originX: 0,
    //                     originY: 0,
    //                     scaleX: scaleFactorX,
    //                     scaleY: scaleFactorY,
    //                     tileType: 'fill',
    //                 });

    //                 currentX += desiredTileSize;
    //             }

        
    //             // Create Physics Body for Segment
    //             let segmentWidth = Math.round((length / desiredTileSize) * desiredTileSize)

    //             physicsBodies.push({
    //                 x: segmentStart,
    //                 y: currentY - desiredTileSize,
    //                 width: segmentWidth,
    //                 height: desiredTileSize,
    //                 originX: 0,
    //                 originY: 0,
    //                 bodyType: 'flat'
    //             });

    //             // Create Population Data for Segment
    //             if(populationConfig && populationConfig.length > 0){
    //                 // // Get bounds for segment
    //                  let boundsMin = segmentStart + segmentWidth * 0.2
    //                  let boundsMax = segmentStart + segmentWidth * 0.8

    //                 // Number of random items to pick
    //                 const numItemsToPick = Phaser.Math.Between(Phaser.Math.Between(0,1), Math.max(1, populationConfig.length - 2)); // Replace with the desired number of items

    //                 // Shuffle the populationConfig array to randomize order
    //                 const shuffledConfig = Phaser.Utils.Array.Shuffle([...populationConfig]);

    //                 // Take the first numItemsToPick items from the shuffled array
    //                 const selectedItems = shuffledConfig.slice(0, Math.min(numItemsToPick, shuffledConfig.length));

    //                 // For each selected item, add it to terrainObjects
    //                 selectedItems.forEach(configItem => {
    //                     if (configItem != 'loot' && segmentWidth > config.width * 0.1 || configItem == 'loot'){
    //                         let xPlacement = Phaser.Math.FloatBetween(boundsMin, boundsMax);
    //                         let topOfBody = currentY - desiredTileSize;

    //                         // Set X and Y based on segment
    //                         terrainObjects.push({
    //                             x: xPlacement,
    //                             y: topOfBody,
    //                             type: configItem
    //                         });
    //                     }
    //                 });


    //             }
                
    //         } else if (tileType === 'slope') {
    //             // Calculate step size for slope
    //             //const stepX = desiredTileSize;
    //             //const stepY = direction === 'upRight' ? -desiredTileSize : desiredTileSize;
    
    //             // Adjust position for upwards slope to ensure seamless connection
    //             if (yDirection === 'up') {
    //                 currentY -= desiredTileSize;
    //             }

    //             let segmentStart = currentX
    //             let segmentStartY = currentY
    
    //             // Generate sloped tiles
    //             for (let i = 0; i < Math.round(length / desiredTileSize); i++) {
    //                 tilesToCreate.push({
    //                     x: currentX,
    //                     y: currentY,
    //                     xSize: desiredTileSize,
    //                     ySize: desiredTileSize,
    //                     texture: 'terrainTileset2',
    //                     frame: tileIndices.slope[yDirection][elevation],
    //                     originX: 0,
    //                     originY: 1,
    //                     scaleX: scaleFactorX,
    //                     scaleY: scaleFactorY,
    //                     tileType: 'slope',
    //                 });

    //                 // Fill the gap below the flat tile until we reach baseY
    //                 const fillStartY = currentY;
    //                 const fillEndY = baseY;

    //                 const fillYSize = (fillEndY - fillStartY)

    //                 tilesToCreate.push({
    //                     x: currentX,
    //                     y: fillStartY,
    //                     xSize: desiredTileSize,
    //                     ySize: fillYSize,
    //                     texture: 'terrainTileset2',
    //                     frame: tileIndices.fill[elevation],
    //                     originX: 0,
    //                     originY: 0,
    //                     scaleX: scaleFactorX,
    //                     scaleY: scaleFactorY,
    //                     tileType: 'fill',
    //                 });

    //                 // Update position for next slope tile
    //                 currentX += desiredTileSize;
    //                 currentY += yDirection === 'up' ? -desiredTileSize : desiredTileSize;
    //             }

    //             // Create Physics Body for 
                
    //             let stepWidth = 2
    //             let stepHeight = 2
    //             let numSteps = Math.round((Math.round(length / desiredTileSize) * desiredTileSize) / stepWidth )
    //             let originX = 0
    //             let originY = 0

    //             if(yDirection == 'down'){
    //                 stepHeight *= -1
    //                 segmentStartY -= desiredTileSize
    //                 originX = 1
    //             } 
            

    //             for (let i = 0; i < numSteps; i++) {
    //                 physicsBodies.push({
    //                     x: segmentStart + i * stepWidth,
    //                     y: segmentStartY - i * stepHeight,
    //                     width: stepWidth,
    //                     height: stepHeight,
    //                     originX: originX,
    //                     originY: originY,
    //                     bodyType: tileType,
    //                     yDirection: yDirection
    //                 });
    //             }
                
                
    //         } else if (tileType === 'wall') {
    //             // Handle transition to a down wall from flat (add right edge tile)
    //             if (previousSegment && previousSegment.tileType === 'flat' && tileType === 'wall' && yDirection == 'down') {
    //                 const edgeTile = this.scene.add.tileSprite(
    //                     currentX,
    //                     currentY,
    //                     desiredTileSize,
    //                     desiredTileSize,
    //                     'terrainTileset2',
    //                     tileIndices.edges.right[elevation]
    //                 )
    //                     .setOrigin(0, 1)
    //                     .setScale(scaleFactorX, scaleFactorY);
    //                     terrainTilesGroup_Local.add(edgeTile)

    //                 // Create Physics Body for Segment
                    
    //                 const terrainPhysicsBodySegment = this.terrainGroupsPhysics[elevation].create(currentX, currentY, null)
    //                 terrainPhysicsBodySegment.setOrigin(0, 1)
    //                 terrainPhysicsBodySegment.displayWidth = desiredTileSize
    //                 terrainPhysicsBodySegment.displayHeight = desiredTileSize
    //                 terrainPhysicsBodySegment.body.setSize(desiredTileSize, desiredTileSize)
    //                 terrainPhysicsBodySegment.setImmovable(true)
    //                 terrainPhysicsBodySegment.body.allowGravity = false
    //                 terrainPhysicsBodySegment.body.checkCollision.down = false
    //                 terrainPhysicsBodySegment.setVisible(false)

    //                 terrainPhysicsBodySegment.tileType = 'edge'
    //             }
    
    //             // Handle transition to a up wall from flat (add fill tile)
    //             if (previousSegment && previousSegment.tileType === 'flat' && tileType === 'wall' && yDirection == 'up') {
    //                 const fillTile = this.scene.add.tileSprite(
    //                     currentX,
    //                     currentY,
    //                     desiredTileSize,
    //                     desiredTileSize,
    //                     'terrainTileset2',
    //                     tileIndices.fill[elevation]
    //                 )
    //                     .setOrigin(0, 1)
    //                     .setScale(scaleFactorX, scaleFactorY);
    //                     terrainTilesGroup_Local.add(fillTile)
                        

    //             }

    //             // Handle transition to a up wall from slope (add wall tile)
    //             if (previousSegment && previousSegment.tileType === 'slope' && previousSegment.yDirection === 'up' && tileType === 'wall' && yDirection === 'up') {
    //                 const fillWallTile = this.scene.add.tileSprite(
    //                     currentX,
    //                     currentY,
    //                     desiredTileSize,
    //                     desiredTileSize,
    //                     'terrainTileset2',
    //                     tileIndices.wall[yDirection][elevation]
    //                 )
    //                     .setOrigin(0, 1)
    //                     .setScale(scaleFactorX, scaleFactorY)
    //                     .setData('tileType', 'wall'); // Tag as wall tile;
    //                     terrainTilesGroup_Local.add(fillWallTile)
    //             }

    //             // Handle transition to a up wall from slope (add wall tile)
    //             if (previousSegment && previousSegment.tileType === 'slope' && previousSegment.yDirection === 'down' && tileType === 'wall' && yDirection === 'down') {
    //                 // If the previous segment was a downwards slope, shift the first wall tile left by 1
    //                 currentX -= desiredTileSize;
    //                 // If the previous segment was a downwards slope, shift the first flat tile up by 1
    //                 currentY -= desiredTileSize;
    //             }

    //             // Handle wall direction and generate the wall (up or down)
    //             const wallHeight = length;
    
    //             // Track the lowest Y of the wall tiles
    //             let lowestWallY = currentY;
    
    //             // Adjust the wall direction and Y position
    //             if (yDirection === 'up') {
    //                 //currentY = desiredTileSize;  // Move up for the wall
    //             } else if (yDirection === 'down') {
    //                 currentY += desiredTileSize;  // Move down for the wall
    //             }

    //             let segmentStart = currentX
    //             let segmentStartY = currentY
    
    //             // Generate the wall tiles

    //             for (let i = 0; i < Math.round(wallHeight / desiredTileSize); i++) {
    
    //                 tilesToCreate.push({
    //                     x: currentX,
    //                     y: currentY,
    //                     xSize: desiredTileSize,
    //                     ySize: desiredTileSize,
    //                     texture: 'terrainTileset2',
    //                     frame: tileIndices.wall[yDirection][elevation],
    //                     originX: 0,
    //                     originY: 1,
    //                     scaleX: scaleFactorX,
    //                     scaleY: scaleFactorY,
    //                     tileType: 'wall',
    //                 });

    //                 // Fill the gap below the flat tile until we reach baseY
    //                 const fillStartY = currentY;
    //                 const fillEndY = baseY;

    //                 const fillYSize = (fillEndY - fillStartY)

    //                 tilesToCreate.push({
    //                     x: currentX,
    //                     y: fillStartY,
    //                     xSize: desiredTileSize,
    //                     ySize: fillYSize,
    //                     texture: 'terrainTileset2',
    //                     frame: tileIndices.fill[elevation],
    //                     originX: 0,
    //                     originY: 0,
    //                     scaleX: scaleFactorX,
    //                     scaleY: scaleFactorY,
    //                     tileType: 'fill',
    //                 });                    

    //                 // Track the lowest Y of the wall tiles
    //                 lowestWallY = Math.max(lowestWallY, currentY);
    
    //                 // Update Y position for next wall tile (either up or down)
    //                 if (yDirection === 'up') {
    //                     currentY -= desiredTileSize;  // Move up for the wall
    //                 } else if (yDirection === 'down') {
    //                     currentY += desiredTileSize;  // Move down for the wall
    //                 }
                    
    //             }

    //             // Update the X position after generating the wall
    //             currentX += desiredTileSize;
    

    //             // Physics Body

    //             // Create Physics Body for Segment
    //             let segmentHeight = Math.round(length / desiredTileSize) * desiredTileSize
    //             let originX = 0
    //             let originY = 0

    //             if(yDirection == 'up'){
    //                 originY = 1
    //             } 

    //             // Issue - When using this method, collision doesnt work for some reason
    //             // physicsBodies.push({
    //             //     x: segmentStart,
    //             //     y: segmentStartY,
    //             //     width: desiredTileSize,
    //             //     height: segmentHeight,
    //             //     originX: originX,
    //             //     originY: originY,
    //             //     bodyType: tileType
    //             // });

    //             const terrainPhysicsBodySegment = this.terrainGroupsPhysics[elevation].create(segmentStart, segmentStartY)
    //             terrainPhysicsBodySegment.setOrigin(originX, originY)
    //             terrainPhysicsBodySegment.displayHeight = segmentHeight
    //             terrainPhysicsBodySegment.displayWidth = desiredTileSize
    //             terrainPhysicsBodySegment.body.setSize(desiredTileSize, segmentHeight)
    //             terrainPhysicsBodySegment.setImmovable(true)
    //             terrainPhysicsBodySegment.body.allowGravity = false
    //             terrainPhysicsBodySegment.body.checkCollision.down = false
    //             terrainPhysicsBodySegment.setVisible(false)
    //             terrainPhysicsBodySegment.tileType = 'wall'
    
                
    //         }

    //         // Update previous segment
    //         previousSegment = segment;
  
    //     });

    //     // Once iteration is complete, batch-create all the tiles in one go
    //     tilesToCreate.forEach(tileData => {
    //         const tile = this.scene.add.tileSprite(tileData.x, tileData.y, tileData.xSize, tileData.ySize, tileData.texture, tileData.frame)
    //             .setOrigin(tileData.originX, tileData.originY)
    //             .setScale(tileData.scaleX, tileData.scaleY)
    //             .setData('tileType', tileData.tileType);
    //             terrainTilesGroup_Local.add(tile);
    //     });

    //     // Batch-create all physics bodies in one go
    //     physicsBodies.forEach(bodyData => {
    //         const terrainSegment = this.terrainGroupsPhysics[elevation].create(bodyData.x, bodyData.y);
    //         terrainSegment.setOrigin(bodyData.originX, bodyData.originY); // Align bottom-left corner
    //         terrainSegment.displayWidth = bodyData.width;
    //         terrainSegment.displayHeight = bodyData.height;
    //         terrainSegment.body.setSize(bodyData.width, bodyData.height);
    //         terrainSegment.setImmovable(true);
    //         terrainSegment.body.allowGravity = false;
    //         terrainSegment.body.checkCollision.down = false
    //         terrainSegment.setVisible(false);
    //         terrainSegment.tileType = bodyData.bodyType
    //         terrainSegment.yDirection = bodyData.yDirection
    //     });

    //     // Batch-create all terrain objects in one go
    //     terrainObjects.forEach(objectPlacementData => {
    //             this.scene[`${objectPlacementData.type}Manager`].add(
    //                 objectPlacementData.x,
    //                 objectPlacementData.y
    //             )     
    //     });
        
    //     // Add depth and return the physics body
    //     const depthMap = { ground: 5, low: 4, high: 2 };
    //     const depth = depthMap[elevation] || 1;
    //     terrainTilesGroup_Local.setDepth(depth)

    //     // Tag first and last tile in terrainTiles group
    //     const firstChild = terrainTilesGroup_Local.getFirst(true);
    //     firstChild.terrainStart = true
    //     const lastChild = terrainTilesGroup_Local.getLast(true);
    //     lastChild.terrainEnd = true

    //     let terrainGroupWidth = lastChild.x + lastChild.width - firstChild.x

    //     terrainTilesGroup_Local.terrainGroupWidth = terrainGroupWidth
        
    //     this.terrainGroupsTilesprites.add(terrainTilesGroup_Local)
    //     // Return the terrain group
    //     return terrainTilesGroup_Local;
    // }

    // generateTerrainDesign(maxLandWidth, maxLandHeight){



    //     let availableLandWidth = maxLandWidth
    //     const heightBufferZone = this.scene.scale.height * 0.1
    //     const absoluteMaxHeight = this.scene.scale.height - heightBufferZone
    //     const maximumLandHeight = Math.min(maxLandHeight, absoluteMaxHeight)
    //     let availableLandHeight = maximumLandHeight

    //     // Initialise config packet
    //     const terrainConfig = []
    //     const tileSize = 16
    //     const header_footerWidth = 80

    //     // Mappings for terrain generation - based on previous segment
    //     const typeMappings = {
    //         flat: ['slope','wall'],
    //         slope: ['flat'], 
    //         wall: ['flat'], 
    //     };
    //     const yDirections = ['up', 'down'];

    //     // Max and min length constraints for the segments
    //         const minSegmentLength = 64; // minimum length of each segment
    //         const maxSegmentLength = 320; // maximum length of each segment
    //         const maxHeightChange_Wall_Up = 125; // maximum allowed height change for slopes or walls

    //     // Create terrain header
    //     //console.log('Generating config for terrain header...')
    //         // Wall
    //         let tileType = 'wall'
    //         let length = 32
    //         let yDirection = 'up'
    //         let xDirection = 'left'
    //         let populationConfig = null

    //         // Push to config
    //         terrainConfig.push({ tileType, length, yDirection, xDirection});

    //         // Update available land space
    //         availableLandHeight -= length 
    //         availableLandWidth -= tileSize 

    //         // Flat
    //         tileType = 'flat'
    //         length = header_footerWidth - tileSize
    //         xDirection = null
    //         yDirection = null

    //         // Push header to config
    //         terrainConfig.push({ tileType, length, yDirection, xDirection });
            
    //         // Update available land space
    //         availableLandHeight -= tileSize
    //         availableLandWidth -= length

    //     // Generate remaining terrain based on algo and parameters
    //     //console.log('Generating config for terrain body...')

    //         while (availableLandWidth > header_footerWidth){
    //         // Generation Logic
    //         // Confirm last segment
    //         let previousSegment = terrainConfig.length > 0 ? terrainConfig[terrainConfig.length - 1] : null
    //         // Select next segment type
    //         tileType = typeMappings[previousSegment.tileType][Math.floor(Math.random() * typeMappings[previousSegment.tileType].length)];
    //         // Set segment direction parameters
    //         yDirection = null
    //         xDirection = null
    //             // Set Y Direction based on available land height space
    //             if(tileType != 'flat'){
    //                 yDirection = yDirections[Math.floor(Math.random() * yDirections.length)]
    //                 // Override if up/down limit reached
    //                 if(availableLandHeight >= maximumLandHeight - minSegmentLength) yDirection = 'up'
    //                 if(availableLandHeight <= 0) yDirection = 'down'
    //             }
    //             // Set X Direction for wall based on y Direction
    //             if (tileType == 'wall'){
    //                 xDirection = yDirection == 'up'? 'left' : 'right'
    //             }

    //         // Set length based on available land width/height space
    //             // Initialise contraints and set based on type
    //             let minLengthContraint = tileSize
    //             let maxLengthConstraint = tileSize
    //             // Flat
    //             if(tileType == 'flat'){
    //                 minLengthContraint = Math.min(minSegmentLength, availableLandWidth)
    //                 maxLengthConstraint = Math.min(maxSegmentLength, availableLandWidth)
    //             }
    //             // Wall
    //             if(tileType == 'wall'){
    //                 if(yDirection == 'up'){
    //                     minLengthContraint = Math.max(Math.min(minSegmentLength, availableLandHeight), tileSize)
    //                     maxLengthConstraint = Math.max(Math.min(maxSegmentLength, availableLandHeight), tileSize)
    //                     maxLengthConstraint = Math.min(maxLengthConstraint, maxHeightChange_Wall_Up)
    //                 } else if (yDirection == 'down'){
    //                     minLengthContraint = Math.max(Math.min(minSegmentLength, Math.abs(maximumLandHeight - availableLandHeight - minSegmentLength)),tileSize)
    //                     maxLengthConstraint = Math.max(Math.min(maxSegmentLength, Math.abs(maximumLandHeight - availableLandHeight - minSegmentLength)), tileSize)
    //                 }
                    
    //             }
    //             // Slope
    //             if(tileType == 'slope'){
    //                 if(yDirection == 'up'){
    //                     minLengthContraint = Math.max(Math.min(minSegmentLength, availableLandWidth, availableLandHeight), tileSize)
    //                     maxLengthConstraint = Math.max(Math.min(maxSegmentLength, availableLandWidth, availableLandHeight), tileSize)
    //                 } else if (yDirection == 'down'){
    //                     minLengthContraint = Math.max(Math.min(minSegmentLength, Math.abs(maximumLandHeight - availableLandHeight - minSegmentLength)), tileSize)
    //                     maxLengthConstraint = Math.max(Math.min(maxSegmentLength, Math.abs(maximumLandHeight - availableLandHeight - minSegmentLength)), tileSize)
    //                 }
    //             }

    //         length = Phaser.Math.Between(minLengthContraint, maxLengthConstraint)   
            
    //         // Attempt to set length to shorter if low to avoid bug of generating downwards terrain
    //         if (length > Math.abs(maximumLandHeight - availableLandHeight - minSegmentLength * 2.5)  && (tileType == 'wall' || tileType == 'slope') && yDirection == 'down'){
    //             length = tileSize
    //         }

    //         // Set Terrain Objects that can be populated
    //             // Add Population Logic
    //         populationConfig = ['obstacle', 'loot', 'enemy']
            
    //         // Push data to config
    //             //console.log(`Pushing ${tileType} to terrain config`)
    //         terrainConfig.push({ tileType, length, yDirection, xDirection, populationConfig });
            
    //         // Update available land space
    //         if(yDirection == 'up'){
    //             availableLandHeight -= length//tileType != 'flat'? length : tileSize
    //         } else if (yDirection == 'down') {
    //             availableLandHeight += length//tileType != 'flat'? length : tileSize
    //         } else if (previousSegment.tileType == 'wall' && previousSegment.yDirection == 'up' && tileType == 'flat'){
    //             availableLandHeight -= tileSize
    //         }
    //         availableLandWidth -= tileType != 'wall'? length: tileSize
    //         }
        
    //     // Create terrain footer
    //     //console.log('Generating config for terrain footer...')
    //         // Flat
    //         tileType = 'flat'
    //         length = header_footerWidth - tileSize
    //         xDirection = null
    //         yDirection = null

    //         // Push header to config
    //         //console.log(`Pushing ${tileType} to terrain config`)
    //         terrainConfig.push({ tileType, length, yDirection, xDirection });

    //         // Update available land space
    //         availableLandHeight -= tileSize
    //         availableLandWidth -= length

    //         // Wall
    //         tileType = 'wall'
    //         length = 32
    //         yDirection = 'down'
    //         xDirection = 'right'

    //         // Push to config
    //         //console.log(`Pushing ${tileType} to terrain config`)
    //         terrainConfig.push({ tileType, length, yDirection, xDirection});

    //         // Update available land space
    //         availableLandHeight -= length 
    //         availableLandWidth -= tileSize 

    //         console.log('Terrain Config Generated successfully', terrainConfig)
    //         return terrainConfig
            
    // }

    
    
    // Helper method for reusing physics bodies
    
    
    generateStartTerrain(){
        // Start Zone Set Up

        const startTerrainDesign = [
            { tileType: 'flat', length: config.width * 0.25},                 
            { tileType: 'slope', length: config.height * 0.05, yDirection: 'up'},  
            { tileType: 'flat', length: config.width * 0.05},                 
            { tileType: 'slope', length: config.height * 0.05, yDirection: 'up' }, 
            { tileType: 'flat', length: config.width * 0.15},                
            { tileType: 'wall', length: config.height * 0.05, yDirection: 'up' },  
            { tileType: 'flat', length: config.width * 0.1},                 
            { tileType: 'wall', length: config.height * 0.05, yDirection: 'up' }, 
            { tileType: 'flat', length: config.width * 0.1},
            { tileType: 'slope', length: config.height * 0.1, yDirection: 'up' },
            { tileType: 'flat', length: config.width * 0.2}, 
            // Switch to Mode 1
            { tileType: 'flat', length: config.width * 0.35},    
            { tileType: 'wall', length: config.height * 0.1, yDirection: 'down' },
            { tileType: 'flat', length: config.width * 0.1},
            { tileType: 'slope', length: config.height * 0.1, yDirection: 'down' },
            { tileType: 'flat', length: config.width * 0.4},    
            { tileType: 'wall', length: config.height * 0.05, yDirection: 'down' },                  
        ]

        this.generateTerrain(0, 'ground', startTerrainDesign);

        let totalHeight = 0

        startTerrainDesign.forEach(segment => {
            if (segment.yDirection === 'up' && segment.length) {
                totalHeight += segment.length; // Accumulate height for upward segments
            }
        });

        const highestPoint = config.height - totalHeight
        const starterMajorRewardSize = config.width * 0.1

        const starterMajorReward = this.scene.add.image(config.width * 0.9, highestPoint - starterMajorRewardSize + 48, 'majorRewardShrine')
        .setOrigin(0.5, 1)
        .setDisplaySize(starterMajorRewardSize, starterMajorRewardSize)
        .setDepth(5);
        const unactivatedShrineEffect = this.scene.add.sprite(starterMajorReward.x - (starterMajorReward.displayWidth * 0.27), starterMajorReward.y - (starterMajorReward.displayHeight * 0.875))
        unactivatedShrineEffect.setDepth(5).setAlpha(0.5)
        unactivatedShrineEffect.anims.play('animation_MajorReward');  // Start the animation created earlier

        // Add check in the update method
        this.scene.events.on('update', () => {
            if (this.scene.avatarManager.sprite.x >= starterMajorReward.x && !this.scene.stageStart) { 
            this.scene.scene.pause(); // Pause this scene
            this.scene.scene.launch('BlessingsScreen', 
                { 
                mainScene: this.scene, 
                avatar: this.scene.avatarManager, 
                blessingsConfig:{numOptions: 3, type: 'skill', category: 'random', maxRarity: 'uncommon'} }); // Launch the pause menu scene
            this.scene.scene.bringToTop('BlessingsScreen');
                
            } else if (this.scene.stageStart && !this.scene.starterBlessingSelected){
                this.scene.starterBlessingSelected = true
                this.scene.stageProgressionActive = true

                this.scene.cameraManager.mainCamera.flash(500, 48, 25, 52)
                unactivatedShrineEffect.destroy()

                this.scene.avatarManager.mode = 0

                // Register the update event for the scene
                this.scene.events.on('update', () => {
                    if(this.scene.avatarManager.sprite.x >= this.scene.avatarManager.xRepositionUpperBound){
                        this.scene.avatarManager.sprite.x -= 2.5
                    }
                    if(starterMajorReward.x + starterMajorReward.displayWidth / 2 > 0){
                        starterMajorReward.x -= this.scene.baseSpeed
                    } else {
                        starterMajorReward.destroy()
                        this.scene.messageBox.destroy()
                        this.scene.message.destroy()
                    }
                });


                
 
            }
        });
    }

    // update() {
    //     if(this.scene.sandbox){

                    
       
    //     } else {
    //     let repositionSpeed = this.scene.baseSpeed
    //     // Move all terrain physics objects and update
    //     Object.values(this.terrainGroupsPhysics).forEach(terrainGroup => {
    //         terrainGroup.children.iterate((object) => {
    //             if(object){
    //             object.x -= repositionSpeed; // Move each container


    //             if (object.body) {
    //                 object.body.updateFromGameObject();
    //             }

    //             if(object){
    //             if (object.x < -this.scene.scale.width * 0.5) {
    //                 object.destroy() 
    //                 //console.log('Physics object destroyed')
    //             }
    //             }
    //         }
             
    //         });
    //     });

    //     // Move all terrain tilesprite objects
    //     this.terrainGroupsTilesprites.getChildren().forEach(tileGroup => {

    //             tileGroup.getChildren().forEach(tileSprite => {

    //             if(tileSprite){
    //                 // Move each TileSprite to the left
    //                 tileSprite.x -= repositionSpeed;  // Adjust the value (-1) for the speed you want
            
    //                 if(tileSprite){
    //                 // Geenerate new terrain
    //                 if (tileSprite.terrainEnd && tileSprite.x + tileSprite.width < this.scene.scale.width && !tileGroup.generateNewTerrain) {
    //                     tileGroup.generateNewTerrain = true
    //                     this.generateTerrain((this.scene.scale.width + this.scene.scale.width * 0.125) *
    //                             Phaser.Math.FloatBetween(
    //                                 this.chaosFactorSettings.ground.chaosLowerBound,
    //                                 this.chaosFactorSettings.ground.chaosUpperBound
    //                             ),
    //                             'ground'
    //                     );
    //                 }

    //                 // Destroy
    //                 if (tileSprite.x < -tileSprite.width - this.scene.scale.width * 0.1 ) {
    //                     tileSprite.destroy() 
    //                     //console.log('Tilesprite destroyed')
    //                 }

    //                 }
    //             }
    //         });
    //     });

    //     }


    // }

    generateTerrainDesignV2(maxLandWidth = config.width, maxLandHeight = config.height * 0.75){

        const createTerrainHeader = true
        const createTerrainFooter = true

        
        // Local Functions
        function updateGlobalDynamicVariables(){
            updateAvailableSpace()
            updateOrientationToBaselineHeight()
        }
            function updateAvailableSpace(){

                    availableSpace_Ahead = xBound - currentXPosition
                    availableSpace_Up = currentYPosition - yBoundBuffer
                    availableSpace_Down = (yBound - tileSize) - currentYPosition
                    
                    // console.log(
                    //     'Available Space Ahead:  ' + availableSpace_Ahead + "\n",
                    //     'Available Space Up:  ' + availableSpace_Up + "\n",
                    //     'Available Space Down:  ' + availableSpace_Down
                    // )
                
            }

            function updateOrientationToBaselineHeight(){
                    directionToBaselineHeight = currentYPosition > baselineHeight ? 'up' : (currentYPosition < baselineHeight ? 'down' : null);
                    distanceToBaselineHeight = Math.abs(currentYPosition - baselineHeight)

                    // console.log(
                    //     'Direction to Baseline Height:  ' + directionToBaselineHeight + "\n",
                    //     'Distance to Baseline Height:  ' + distanceToBaselineHeight
                    // )
            }

        function selectRandomLandscapeType(previousType = null) {
            const landscapeTypes = Object.keys(landscapeConfig);
        
            // Step 1: Calculate weighted probabilities for each type
            const weightedTypes = landscapeTypes.map(type => {
                const baseWeight = landscapeConfig[type].chanceToOccur; // Base weight from landscapeConfig
                const constraints = landscapeLibrary[type]?.dimensionsData || {}; // Constraints from library
                let weight = baseWeight;
        
                console.log('Previous Type: ' + previousType)
                previousType = previousType == null ? previousType : previousType.toLowerCase()
                // Apply dynamic modifiers
                if (type === previousType) {
                    weight *= 0.5; // Repetition penalty
                }
        
                if (constraints.baseHeight && availableSpace_Up > constraints.baseHeight) {
                    weight *= 0.1; // Reduce weight if space above is insufficient
                }
        
                if (constraints.baseWidth && availableSpace_Ahead > constraints.baseWidth) {
                    weight *= 0.2; // Reduce weight if space ahead is insufficient
                }
        
                return { type, weight };
            });
        
            // Step 2: Normalize weights to calculate probabilities
            const totalWeight = weightedTypes.reduce((sum, entry) => sum + entry.weight, 0);
        
            if (totalWeight === 0) {
                throw new Error("No valid landscape types available based on current constraints!");
            }
        
            // Step 3: Perform random selection
            let random = Math.random() * totalWeight;
        
            for (const entry of weightedTypes) {
                random -= entry.weight;
                if (random <= 0) {
                    return entry.type; // Return the selected landscape type
                }
            }
        }

        function getLandscapeData(landscapeKey = 'plain'){
            return landscapeLibrary[landscapeKey];
        }

        function generateSegmentsForLandscape(landscapeKey = 'plain') {
            // Retrieve the landscape from the library
            landscape = getLandscapeData(landscapeKey);
            landscapeLog.push(landscape)
            previousLandscape = landscape.name
        
            if (!landscape) {
                console.error(`Landscape with key "${landscapeKey}" not found.`);
                return;
            }
        
            const { dimensionsData, anchorPoints } = landscape;
        
            // Ensure dimensionsData exists
            if (!dimensionsData || !anchorPoints) {
                console.error(`Missing required data for landscape "${landscapeKey}".`);
                return;
            }
        
            const { baseWidth, baseHeight } = dimensionsData;

            // Update active landscapeLog entry with segment series start index
            landscapeLog[landscapeLog.length - 1].segementStartIndex = terrainDesign.length
        
            // Loop through numbered anchor points
            Object.keys(anchorPoints).forEach(pointKey => {
                const anchorPoint = anchorPoints[pointKey];
        
                const {
                    xRelativeBound,
                    yRelativeBound,
                    yDirection,
                    segmentMin = {},
                    segmentMax = {}
                } = anchorPoint;
        
                // Calculate targetX and Y values to anchor point for segment series
                const anchorTargetX = baseWidth * xRelativeBound;
                const anchorTargetY = baseHeight * yRelativeBound;

                const segmentSeries_currentX = 0
                const segmentSeries_currentY = 0
                
        
                // Retrieve or fallback to global segment constraints
                const minSegments = {
                    flat: segmentMin.flat, 
                    slope: segmentMin.slope,
                    wall: segmentMin.wall
                };
        
                const maxSegments = {
                    flat: segmentMax.flat, 
                    slope: segmentMax.slope,
                    wall: segmentMax.wall
                };

                // Placeholder for additional data to be passed to segment series generation
        
                // Generate segments towards the anchor point
                // console.log(`Generating segments for anchor point ${pointKey}:`);
                // console.log(`Target X: ${anchorTargetX}, Target Y: ${anchorTargetY}, Direction: ${yDirection}`);
                // console.log(`Min Segments:`, minSegments);
                // console.log(`Max Segments:`, maxSegments);

                // Pass data to segment generation function
                generateSegmentSeries(anchorTargetX, anchorTargetY, yDirection, minSegments, maxSegments, segmentSeries_currentX, segmentSeries_currentY)

            });

            // Update active landscapeLog entry with segment series last index
            landscapeLog[landscapeLog.length - 1].segementEndIndex = terrainDesign.length - 1
        }

            function generateSegmentSeries(anchorTargetX, anchorTargetY, yDirection, minSegments = null, maxSegments = null, segmentSeries_currentX = 0, segmentSeries_currentY = 0){

                function updateDistanceToTargetX(){
                    segmentSeries_distanceToTargetX = anchorTargetX - segmentSeries_currentX
                }

                function updateDistanceToTargetY(){
                    segmentSeries_distanceToTargetY = anchorTargetY - segmentSeries_currentY
                }

                console.log('Generating Segment Series...')

                // Initialise Segment Series generation variables
                let segmentSeries_distanceToTargetX = null
                let segmentSeries_distanceToTargetY = null
                let xTargetInScope = anchorTargetX > 0 ? true : false
                let yTargetInScope = anchorTargetY > 0 ? true : false

                // Set Wall up max length to avoid unclimbable walls
                const maxHeightChange_Wall_Up = 125; // maximum allowed height change for slopes or walls

                // Clear tileType
                tileType = null

                // Mappings for terrain generation - based on previous segment
                const typeMappings = {
                    flat: ['slope','wall'],
                    slope: ['flat', 'slope'], 
                    wall: ['flat', 'slope'], 
                };  

                // Set distances
                updateDistanceToTargetX()
                updateDistanceToTargetY()

                console.log('Generating Segment...')
                while ((!xTargetInScope || segmentSeries_distanceToTargetX > tileSize) && (!yTargetInScope || segmentSeries_distanceToTargetY > tileSize)){
                    // Generation Logic
                    // Select next segment type
                    tileType = typeMappings[previousSegment.tileType][Math.floor(Math.random() * typeMappings[previousSegment.tileType].length)];
                    // Override for flat section
                    if (!yDirection){
                        tileType = 'flat'
                    }

                    // Set length based on available land width/height space
                        // Initialise contraints and set based on type
                        let minLengthContraint = minSegments[tileType]
                        let maxLengthConstraint = maxSegments[tileType]

                        // Adjust min and max contraints based on available space
                        // Flat
                        if(tileType == 'flat'){
                            minLengthContraint = Math.min(minLengthContraint, segmentSeries_distanceToTargetX)
                            maxLengthConstraint = Math.min(maxLengthConstraint, segmentSeries_distanceToTargetX)
                        }
                        // Wall
                        if(tileType == 'wall'){
                            if(yDirection == 'up'){
                                minLengthContraint = Math.max(Math.min(minLengthContraint, segmentSeries_distanceToTargetY), tileSize)
                                maxLengthConstraint = Math.max(Math.min(maxLengthConstraint, segmentSeries_distanceToTargetY, maxHeightChange_Wall_Up), tileSize)
                            } else if (yDirection == 'down'){
                                minLengthContraint = Math.max(Math.min(minLengthContraint, segmentSeries_distanceToTargetY),tileSize)
                                maxLengthConstraint = Math.max(Math.min(maxLengthConstraint, segmentSeries_distanceToTargetY), tileSize)
                            } 
                        }
                        // Slope
                        if(tileType == 'slope'){
                                minLengthContraint = Math.max(Math.min(minLengthContraint, segmentSeries_distanceToTargetY, segmentSeries_distanceToTargetX), tileSize)
                                maxLengthConstraint = Math.max(Math.min(maxLengthConstraint, segmentSeries_distanceToTargetY, segmentSeries_distanceToTargetX), tileSize)
                        }

                    length = Phaser.Math.Between(minLengthContraint, maxLengthConstraint) 
                    // Set additional metadata
                    let linkedLandscape = landscape.name

                    // Package in segment object
                    segment = {
                        tileType: tileType,
                        length: length,
                        yDirection: yDirection,
                        linkedLandscape: linkedLandscape
                    }

                    // Update New X and Y Positions for Next Segment (i.e segment end point)
                    segmentSeries_currentX += segment.tileType == 'flat' ? length : segment.tileType == 'slope' ? length : 0;
                    segmentSeries_currentY += segment.tileType != 'flat' ? length : 0;
                    // Update segment series variables
                    updateDistanceToTargetX()
                    updateDistanceToTargetY()

                    // Override yDirection for flat
                    segment.yDirection = segment.tileType == 'flat' ? null : yDirection
                    // Add to terrainDesign
                    addSegmentToDesign(segment)

                }


                console.log('Segment Series successfully generated for ' + landscape.name)
                
                
                

            }

                function addSegmentToDesign(segmentData){
                    // Add Segment Data to Design
                    terrainDesign.push(segmentData);
                    // Confirm New X and Y Positions for Next Segment (i.e segment end point)
                    currentXPosition += segmentData.tileType == 'flat' ? segmentData.length : segmentData.tileType == 'slope' ? segmentData.length : 0;
                    currentYPosition += segmentData.yDirection ==  'down' ? segmentData.length : segmentData.yDirection == 'up'? -segmentData.length : 0;
                    // Log for Debugging
                    // console.log(
                    //     'Previous Segment: ',previousSegment,"\n",
                    //     'Adding Segment Type: ' + segmentData.tileType + "\n",
                    //     'Current X Position for Next Segment:  ' + currentXPosition + "\n",
                    //     'Current Y Position for Next Segment:  ' + currentYPosition
                    // )
                    // Refresh dynamic variables
                    updateGlobalDynamicVariables()
                    // Update Segment Data with Supplementary Data
                    segmentData.currentX = currentXPosition;
                    segmentData.currentY = currentYPosition;
                    segmentData.availableSpace_Ahead = availableSpace_Ahead 
                    segmentData.availableSpace_Up = availableSpace_Up 
                    segmentData.availableSpace_Down = availableSpace_Down 
                    segmentData.directionToBaselineHeight = directionToBaselineHeight 
                    segmentData.distanceToBaselineHeight = distanceToBaselineHeight 
                    // Update previousSegment variable 
                    previousSegment = terrainDesign.length > 0 ? terrainDesign[terrainDesign.length - 1] : null
                }
        

        // Default Config
        const designConfig = {
            maxWidth: maxLandWidth,
            maxHeight: maxLandHeight,
            baseGradient: 0.1, // Overall upward/downward trend of the terrain
            peakCount: 3, // Number of prominent peaks
            randomness: 0.2, // Adds variation to segment lengths
            terraceCount: 4, // Creates stepped height levels
        };

        const landscapeConfig = {
            plain: { chanceToOccur: 1.0},
            hill: { chanceToOccur: 1.0},
            pit: { chanceToOccur: 0.5},
            mountain: { chanceToOccur: 0.2},
            valley: { chanceToOccur: 0.15},
            plateau: { chanceToOccur: 0.65},
            quarry: { chanceToOccur: 0.4},
        }

        // Initialise Global Constant Variables
        const tileSize = 16
        const xBound = config.width
        const yBound = config.height
        const yBoundBuffer = yBound * 0.05
        const baselineHeight = config.height * 0.75

        const terrainDesign = []
        const landscapeLog = []

        const landscapeLibrary = {
            plain: {
                name: "Plain",
                dimensionsData: {
                    baseWidth: config.width * 0.2,
                    baseHeight: 0,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 1, // 20% of baseWidth
                        yRelativeBound: 0,
                        yDirection: null,
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize,
                        },
                        segmentMax: {
                            flat: tileSize * 5,
                            slope: tileSize,
                            wall: tileSize,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            hill: {
                name: "Hill",
                dimensionsData: {
                    baseWidth: config.width * 0.15,
                    baseHeight: config.height * 0.15,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 0.4, // 20% of baseWidth
                        yRelativeBound: 0.9, // 90% of baseHeight
                        yDirection: "up",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 2,
                            wall: tileSize,
                        },
                        segmentMax: {
                            flat: tileSize * 2,
                            slope: tileSize * 4,
                            wall: tileSize * 2,
                        },
                    },
                    2: {
                        xRelativeBound: 0.2, 
                        yRelativeBound: 0,
                        yDirection: null,
                        segmentMin: {
                            flat: tileSize,
                            slope: 8,
                        },
                        segmentMax: {
                            flat: tileSize * 4,
                            slope: 20,
                        },
                    },
                    3: {
                        xRelativeBound: 0.4, 
                        yRelativeBound: 0.9, 
                        yDirection: "down",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 2,
                            wall: tileSize,
                        },
                        segmentMax: {
                            flat: tileSize * 2,
                            slope: tileSize * 4,
                            wall: tileSize * 2,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            pit: {
                name: "Pit",
                dimensionsData: {
                    baseWidth: config.width * 0.15,
                    baseHeight: config.height * 0.25,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 0.4, // 20% of baseWidth
                        yRelativeBound: 0.9, // 90% of baseHeight
                        yDirection: "down",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 4,
                            wall: tileSize,
                        },
                        segmentMax: {
                            flat: tileSize * 2,
                            slope: config.width * 0.5,
                            wall: tileSize * 2,
                        },
                    },
                    2: {
                        xRelativeBound: 0.2, 
                        yRelativeBound: 0,
                        yDirection: null,
                        segmentMin: {
                            flat: config.width * 0.35 * 0.2,
                            slope: 8,
                        },
                        segmentMax: {
                            flat: config.width * 0.35 * 0.2,
                            slope: 20,
                        },
                    },
                    3: {
                        xRelativeBound: 0.4, 
                        yRelativeBound: 0.9, 
                        yDirection: "up",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 4,
                            wall: tileSize,
                        },
                        segmentMax: {
                            flat: tileSize * 2,
                            slope: config.width * 0.5,
                            wall: tileSize * 2,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            mountain: {
                name: "Mountain",
                dimensionsData: {
                    baseWidth: config.width * 0.3,
                    baseHeight: config.height * 0.85,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 0.45, // 20% of baseWidth
                        yRelativeBound: 1, // 90% of baseHeight
                        yDirection: "up",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 2,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize * 4,
                            wall: tileSize * 4,
                        },
                    },
                    2: {
                        xRelativeBound: 0.1, 
                        yRelativeBound: 0,
                        yDirection: null,
                        segmentMin: {
                            flat: tileSize,
                            slope: 8,
                        },
                        segmentMax: {
                            flat: tileSize * 2,
                            slope: 20,
                        },
                    },
                    3: {
                        xRelativeBound: 0.45, 
                        yRelativeBound: 1, 
                        yDirection: "down",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 2,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize * 4,
                            wall: tileSize * 4,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            valley: {
                name: "Valley",
                dimensionsData: {
                    baseWidth: config.width * 0.2,
                    baseHeight: config.height * 0.35,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 0.45, // 20% of baseWidth
                        yRelativeBound: 0.9, // 90% of baseHeight
                        yDirection: "down",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 2,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize * 4,
                            wall: tileSize * 4,
                        },
                    },
                    2: {
                        xRelativeBound: 0.1, 
                        yRelativeBound: 0,
                        yDirection: null,
                        segmentMin: {
                            flat: tileSize,
                            slope: 8,
                        },
                        segmentMax: {
                            flat: tileSize * 4,
                            slope: 20,
                        },
                    },
                    3: {
                        xRelativeBound: 0.45, 
                        yRelativeBound: 0.9, 
                        yDirection: "up",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize * 2,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize * 4,
                            wall: tileSize * 4,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            plateau: {
                name: "Plateau",
                dimensionsData: {
                    baseWidth: config.width * 0.4,
                    baseHeight: config.height * 0.4,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 0.15, // 20% of baseWidth
                        yRelativeBound: 1, // 90% of baseHeight
                        yDirection: "up",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 4,
                        },
                    },
                    2: {
                        xRelativeBound: 0.7, // 80% of baseWidth
                        yRelativeBound: 0, // 50% of baseHeight
                        yDirection: null,
                        segmentMin: {
                            flat: tileSize,
                            slope: 8,
                        },
                        segmentMax: {
                            flat: tileSize * 4,
                            slope: 20,
                        },
                    },
                    3: {
                        xRelativeBound: 0.15, // 20% of baseWidth
                        yRelativeBound: 1, // 90% of baseHeight
                        yDirection: "down",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 4,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            quarry: {
                name: "Quarry",
                dimensionsData: {
                    baseWidth: config.width * 0.4,
                    baseHeight: config.height * 0.4,
                },
                anchorPoints: {
                    1: {
                        xRelativeBound: 0.15, // 20% of baseWidth
                        yRelativeBound: 1, // 90% of baseHeight
                        yDirection: "down",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 4,
                        },
                    },
                    2: {
                        xRelativeBound: 0.7, // 80% of baseWidth
                        yRelativeBound: 0, // 50% of baseHeight
                        yDirection: null,
                        segmentMin: {
                            flat: tileSize,
                            slope: 8,
                        },
                        segmentMax: {
                            flat: tileSize * 4,
                            slope: 20,
                        },
                    },
                    3: {
                        xRelativeBound: 0.15, // 20% of baseWidth
                        yRelativeBound: 1, // 90% of baseHeight
                        yDirection: "up",
                        segmentMin: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 2,
                        },
                        segmentMax: {
                            flat: tileSize,
                            slope: tileSize,
                            wall: tileSize * 4,
                        },
                    },
                },
                additionalData: {
                    biomeType: "rocky",
                    difficultyLevel: "hard",
                },
            },
            
        };

        // Initialise Global Dynamic Variables
        let currentXPosition = 0
        let currentYPosition = yBound
        let availableSpace_Ahead = null
        let availableSpace_Up = null
        let availableSpace_Down = null
        let distanceToBaselineHeight = null
        let directionToBaselineHeight = null

        updateGlobalDynamicVariables()

        // Initialise Generative Ruleset
        // TBC

        // Initialise landscape log data
        let landscape = null
        let previousLandscape = null

        // Initialise terrain design data points
        let segment = null
        let previousSegment = null
        let tileType = null
        let length = null
        let yDirection = null

        /* 
        1) Terrain Header
            Standardised start terrain that consists of a wall up to baseline height and then a short flat section to ensure space for transitions between land masses
        */

        if(createTerrainHeader){

            console.log('Generating terrain header...')
            // Wall
            segment = {
                tileType: 'wall',
                length: distanceToBaselineHeight,
                yDirection: directionToBaselineHeight
            }

            addSegmentToDesign(segment)
            
            // Flat
            segment = {
                tileType: 'flat',
                length: availableSpace_Ahead * 0.05,
                yDirection: null
            }

            addSegmentToDesign(segment)

        }

        /* 
        2) Terrain Body
            Generate main body of land masses
        */
            console.log('Generating terrain body...')

            // Select Landscape type
            let selectedLandscape = selectRandomLandscapeType(previousLandscape)

            // Generate segment series for selected landscape
            generateSegmentsForLandscape(selectedLandscape)  
            selectedLandscape = selectRandomLandscapeType(previousLandscape)
            generateSegmentsForLandscape(selectedLandscape)  
            selectedLandscape = selectRandomLandscapeType(previousLandscape)
            generateSegmentsForLandscape(selectedLandscape)  
            selectedLandscape = selectRandomLandscapeType(previousLandscape)
            generateSegmentsForLandscape(selectedLandscape)  
            selectedLandscape = selectRandomLandscapeType(previousLandscape)

  
    


            
            console.log('Final landscape log: ', landscapeLog)

        /* 
        3) Terrain Footer
            Standardised end terrain that consists of a short flat and wall down to yBounds to ensure space for transitions between land masses
        */

        if(createTerrainFooter){

            console.log('Generating terrain footer...')

            // Flat
            segment = {
                tileType: 'flat',
                length: availableSpace_Ahead,
                yDirection: null
            }

            addSegmentToDesign(segment)

            // Wall
            segment = {
                tileType: 'wall',
                length: availableSpace_Down,
                yDirection: 'down'
            }

            addSegmentToDesign(segment)
            
            
        }

        console.log('Terrain Config Generated successfully', terrainDesign)

        return terrainDesign

        // Old Code

            // Set Terrain Objects that can be populated
                // Add Population Logic
            populationConfig = ['obstacle', 'loot', 'enemy']  
            
    }

    generateTerrainV2(x, elevation = 'ground', terrainDesign = null) { 
        // Tile indices for flat, sloped, and fill terrain
        const tileIndices = {
            flat: { ground: 1 },
            slope: {
                up: { ground: 3 },
                down: { ground: 4 },
            },
            wall: {
                up: { ground: 5 },  // Wall facing left (up)
                down: { ground: 7 }, // Wall facing right (down)
            },
            fill: { ground: 6 }, // Tile to fill gaps below slopes
            edges: {
                left: { ground: 0 },
                right: { ground: 2 },
            }
        };
    
        // Elevation Y-position based on input
        const elevationOffsets = { 
            ground: this.scene.scale.height, 
            low: this.scene.scale.height * 0.75, 
            high: this.scene.scale.height * 0.5 };
        const baseY = elevationOffsets[elevation] || this.scene.scale.height;
    
        // Scaling and tile dimensions
        const sourceTileWidth = 16;
        const sourceTileHeight = 16;
        const desiredTileSize = 16;
        const scaleFactorX = desiredTileSize / sourceTileWidth;
        const scaleFactorY = desiredTileSize / sourceTileHeight;
    
        // Define terrain group
        const terrainTilesGroup_Local = this.scene.add.group();

        // Tiles to Create on batch
        let tilesToCreate = [];
        // Physics Bodies to  Create on batch
        let physicsBodies = []
        // Objects to populate Terrain with on batch
        let terrainObjects = []

        // Track position for stitching terrain
        let currentX = x;
        let currentY = baseY;
    
        let previousSegment = null; // Track the previous segment for handling transitions


        // Create terrain design if none provided
        if(!terrainDesign){
            terrainDesign = this.generateTerrainDesignV2(this.scene.scale.width * Phaser.Math.Between(1, 2), this.scene.scale.height * 0.6)
        }

        // Generate terrain map for object creation - to move ot seperate function
        terrainDesign.forEach(segment => {
            const { tileType, length, yDirection, xDirection, populationConfig } = segment;

            //console.log("Next Tile: " + type)
    
            if (tileType === 'flat') {
                // Check if the previous segment was an upward slope
                if (previousSegment && previousSegment.tileType === 'slope' && previousSegment.yDirection === 'up') {
                    // If the previous segment was an upward slope, shift the first flat tile down by 1
                    currentY += desiredTileSize;
                }
    
                // Handle transition from an upward wall (left) to flat (add left edge tile)
                if (previousSegment && previousSegment.tileType === 'wall' && previousSegment.yDirection === 'up') {
                    const edgeTile = this.scene.add.tileSprite(
                        currentX - desiredTileSize,
                        currentY,
                        desiredTileSize,
                        desiredTileSize,
                        'terrainTileset2',
                        tileIndices.edges.left[elevation]
                    )
                        .setOrigin(0, 1)
                        .setScale(scaleFactorX, scaleFactorY);
                        terrainTilesGroup_Local.add(edgeTile)

                    // Create Physics Body for Segment
                    
                    const terrainPhysicsBodySegment = this.terrainGroupsPhysics[elevation].create(currentX, currentY)
                    terrainPhysicsBodySegment.setOrigin(1, 1)
                    terrainPhysicsBodySegment.displayWidth = desiredTileSize
                    terrainPhysicsBodySegment.displayHeight = desiredTileSize
                    terrainPhysicsBodySegment.body.setSize(desiredTileSize, desiredTileSize)
                    terrainPhysicsBodySegment.setImmovable(true)
                    terrainPhysicsBodySegment.body.allowGravity = false
                    terrainPhysicsBodySegment.body.checkCollision.down = false
                    terrainPhysicsBodySegment.setVisible(false)
                    //terrainPhysicsBodySegment.body.updateFromGameObject()

                    terrainPhysicsBodySegment.tileType = 'edge'


                }

                let segmentStart = currentX
    
                // Create flat segment
                for (let i = 0; i < Math.round(length / desiredTileSize); i++) {
                    tilesToCreate.push({
                        x: currentX,
                        y: currentY,
                        xSize: desiredTileSize,
                        ySize: desiredTileSize,
                        texture: 'terrainTileset2',
                        frame: tileIndices.flat[elevation],
                        originX: 0,
                        originY: 1,
                        scaleX: scaleFactorX,
                        scaleY: scaleFactorY,
                        tileType: 'flat',
                    });

                    // Fill the gap below the flat tile until we reach baseY
                    const fillStartY = currentY + desiredTileSize;
                    const fillEndY = baseY;

                    const fillYSize = (fillEndY - fillStartY)

                    tilesToCreate.push({
                        x: currentX,
                        y: fillStartY - desiredTileSize,
                        xSize: desiredTileSize,
                        ySize: fillYSize + desiredTileSize,
                        texture: 'terrainTileset2',
                        frame: tileIndices.fill[elevation],
                        originX: 0,
                        originY: 0,
                        scaleX: scaleFactorX,
                        scaleY: scaleFactorY,
                        tileType: 'fill',
                    });

                    currentX += desiredTileSize;
                }

        
                // Create Physics Body for Segment
                let segmentWidth = Math.round((length / desiredTileSize) * desiredTileSize)

                physicsBodies.push({
                    x: segmentStart,
                    y: currentY - desiredTileSize,
                    width: segmentWidth,
                    height: desiredTileSize,
                    originX: 0,
                    originY: 0,
                    bodyType: 'flat',
                    elevation: elevation
                });

                // Create Population Data for Segment
                if(populationConfig && populationConfig.length > 0){
                    // // Get bounds for segment
                     let boundsMin = segmentStart + segmentWidth * 0.2
                     let boundsMax = segmentStart + segmentWidth * 0.8

                    // Number of random items to pick
                    const numItemsToPick = Phaser.Math.Between(Phaser.Math.Between(0,1), Math.max(1, populationConfig.length - 2)); // Replace with the desired number of items

                    // Shuffle the populationConfig array to randomize order
                    const shuffledConfig = Phaser.Utils.Array.Shuffle([...populationConfig]);

                    // Take the first numItemsToPick items from the shuffled array
                    const selectedItems = shuffledConfig.slice(0, Math.min(numItemsToPick, shuffledConfig.length));

                    // For each selected item, add it to terrainObjects
                    selectedItems.forEach(configItem => {
                        if (configItem != 'loot' && segmentWidth > config.width * 0.1 || configItem == 'loot'){
                            let xPlacement = Phaser.Math.FloatBetween(boundsMin, boundsMax);
                            let topOfBody = currentY - desiredTileSize;

                            // Set X and Y based on segment
                            terrainObjects.push({
                                x: xPlacement,
                                y: topOfBody,
                                type: configItem
                            });
                        }
                    });


                }
                
            } else if (tileType === 'slope') {
                // Calculate step size for slope
                //const stepX = desiredTileSize;
                //const stepY = direction === 'upRight' ? -desiredTileSize : desiredTileSize;
    
                // Adjust position for upwards slope to ensure seamless connection
                if (yDirection === 'up') {
                    currentY -= desiredTileSize;
                }

                let segmentStart = currentX
                let segmentStartY = currentY
    
                // Generate sloped tiles
                for (let i = 0; i < Math.round(length / desiredTileSize); i++) {
                    tilesToCreate.push({
                        x: currentX,
                        y: currentY,
                        xSize: desiredTileSize,
                        ySize: desiredTileSize,
                        texture: 'terrainTileset2',
                        frame: tileIndices.slope[yDirection][elevation],
                        originX: 0,
                        originY: 1,
                        scaleX: scaleFactorX,
                        scaleY: scaleFactorY,
                        tileType: 'slope',
                    });

                    // Fill the gap below the flat tile until we reach baseY
                    const fillStartY = currentY;
                    const fillEndY = baseY;

                    const fillYSize = (fillEndY - fillStartY)

                    tilesToCreate.push({
                        x: currentX,
                        y: fillStartY,
                        xSize: desiredTileSize,
                        ySize: fillYSize,
                        texture: 'terrainTileset2',
                        frame: tileIndices.fill[elevation],
                        originX: 0,
                        originY: 0,
                        scaleX: scaleFactorX,
                        scaleY: scaleFactorY,
                        tileType: 'fill',
                    });

                    // Update position for next slope tile
                    currentX += desiredTileSize;
                    currentY += yDirection === 'up' ? -desiredTileSize : desiredTileSize;
                }

                // Create Physics Body for 
                
                let stepWidth = 2
                let stepHeight = 2
                let numSteps = Math.round((Math.round(length / desiredTileSize) * desiredTileSize) / stepWidth )
                let originX = 0
                let originY = 0

                if(yDirection == 'down'){
                    stepHeight *= -1
                    segmentStartY -= desiredTileSize
                    originX = 1
                } 
            

                for (let i = 0; i < numSteps; i++) {
                    physicsBodies.push({
                        x: segmentStart + i * stepWidth,
                        y: segmentStartY - i * stepHeight,
                        width: stepWidth,
                        height: stepHeight,
                        originX: originX,
                        originY: originY,
                        bodyType: tileType,
                        yDirection: yDirection,
                        elevation: elevation
                    });
                }
                
                
            } else if (tileType === 'wall') {
                // Handle transition to a down wall from flat (add right edge tile)
                if (previousSegment && previousSegment.tileType === 'flat' && tileType === 'wall' && yDirection == 'down') {
                    const edgeTile = this.scene.add.tileSprite(
                        currentX,
                        currentY,
                        desiredTileSize,
                        desiredTileSize,
                        'terrainTileset2',
                        tileIndices.edges.right[elevation]
                    )
                        .setOrigin(0, 1)
                        .setScale(scaleFactorX, scaleFactorY);
                        terrainTilesGroup_Local.add(edgeTile)

                    // Create Physics Body for Segment
                    
                    const terrainPhysicsBodySegment = this.terrainGroupsPhysics[elevation].create(currentX, currentY, null)
                    terrainPhysicsBodySegment.setOrigin(0, 1)
                    terrainPhysicsBodySegment.displayWidth = desiredTileSize
                    terrainPhysicsBodySegment.displayHeight = desiredTileSize
                    terrainPhysicsBodySegment.body.setSize(desiredTileSize, desiredTileSize)
                    terrainPhysicsBodySegment.setImmovable(true)
                    terrainPhysicsBodySegment.body.allowGravity = false
                    terrainPhysicsBodySegment.body.checkCollision.down = false
                    terrainPhysicsBodySegment.setVisible(false)

                    terrainPhysicsBodySegment.tileType = 'edge'
                }
    
                // Handle transition to a up wall from flat (add fill tile)
                if (previousSegment && previousSegment.tileType === 'flat' && tileType === 'wall' && yDirection == 'up') {
                    const fillTile = this.scene.add.tileSprite(
                        currentX,
                        currentY,
                        desiredTileSize,
                        desiredTileSize,
                        'terrainTileset2',
                        tileIndices.fill[elevation]
                    )
                        .setOrigin(0, 1)
                        .setScale(scaleFactorX, scaleFactorY);
                        terrainTilesGroup_Local.add(fillTile)
                        

                }

                // Handle transition to a up wall from slope (add wall tile)
                if (previousSegment && previousSegment.tileType === 'slope' && previousSegment.yDirection === 'up' && tileType === 'wall' && yDirection === 'up') {
                    const fillWallTile = this.scene.add.tileSprite(
                        currentX,
                        currentY,
                        desiredTileSize,
                        desiredTileSize,
                        'terrainTileset2',
                        tileIndices.wall[yDirection][elevation]
                    )
                        .setOrigin(0, 1)
                        .setScale(scaleFactorX, scaleFactorY)
                        .setData('tileType', 'wall'); // Tag as wall tile;
                        terrainTilesGroup_Local.add(fillWallTile)
                }

                // Handle transition to a up wall from slope (add wall tile)
                if (previousSegment && previousSegment.tileType === 'slope' && previousSegment.yDirection === 'down' && tileType === 'wall' && yDirection === 'down') {
                    // If the previous segment was a downwards slope, shift the first wall tile left by 1
                    currentX -= desiredTileSize;
                    // If the previous segment was a downwards slope, shift the first flat tile up by 1
                    currentY -= desiredTileSize;
                }

                // Handle wall direction and generate the wall (up or down)
                const wallHeight = length;
    
                // Track the lowest Y of the wall tiles
                let lowestWallY = currentY;
    
                // Adjust the wall direction and Y position
                if (yDirection === 'up') {
                    //currentY = desiredTileSize;  // Move up for the wall
                } else if (yDirection === 'down') {
                    currentY += desiredTileSize;  // Move down for the wall
                }

                let segmentStart = currentX
                let segmentStartY = currentY
    
                // Generate the wall tiles

                for (let i = 0; i < Math.round(wallHeight / desiredTileSize); i++) {
    
                    tilesToCreate.push({
                        x: currentX,
                        y: currentY,
                        xSize: desiredTileSize,
                        ySize: desiredTileSize,
                        texture: 'terrainTileset2',
                        frame: tileIndices.wall[yDirection][elevation],
                        originX: 0,
                        originY: 1,
                        scaleX: scaleFactorX,
                        scaleY: scaleFactorY,
                        tileType: 'wall',
                    });

                    // Fill the gap below the flat tile until we reach baseY
                    const fillStartY = currentY;
                    const fillEndY = baseY;

                    const fillYSize = (fillEndY - fillStartY)

                    tilesToCreate.push({
                        x: currentX,
                        y: fillStartY,
                        xSize: desiredTileSize,
                        ySize: fillYSize,
                        texture: 'terrainTileset2',
                        frame: tileIndices.fill[elevation],
                        originX: 0,
                        originY: 0,
                        scaleX: scaleFactorX,
                        scaleY: scaleFactorY,
                        tileType: 'fill',
                    });                    

                    // Track the lowest Y of the wall tiles
                    lowestWallY = Math.max(lowestWallY, currentY);
    
                    // Update Y position for next wall tile (either up or down)
                    if (yDirection === 'up') {
                        currentY -= desiredTileSize;  // Move up for the wall
                    } else if (yDirection === 'down') {
                        currentY += desiredTileSize;  // Move down for the wall
                    }
                    
                }

                // Update the X position after generating the wall
                currentX += desiredTileSize;
    

                // Physics Body

                // Create Physics Body for Segment
                let segmentHeight = Math.round(length / desiredTileSize) * desiredTileSize
                let originX = 0
                let originY = 0

                if(yDirection == 'up'){
                    originY = 1
                } 

                // Issue - When using this method, collision doesnt work for some reason
                // physicsBodies.push({
                //     x: segmentStart,
                //     y: segmentStartY,
                //     width: desiredTileSize,
                //     height: segmentHeight,
                //     originX: originX,
                //     originY: originY,
                //     bodyType: tileType
                //     elevation: elevation
                // });

                const terrainPhysicsBodySegment = this.terrainGroupsPhysics[elevation].create(segmentStart, segmentStartY)
                terrainPhysicsBodySegment.setOrigin(originX, originY)
                terrainPhysicsBodySegment.displayHeight = segmentHeight
                terrainPhysicsBodySegment.displayWidth = desiredTileSize
                terrainPhysicsBodySegment.body.setSize(desiredTileSize, segmentHeight)
                terrainPhysicsBodySegment.setImmovable(true)
                terrainPhysicsBodySegment.body.allowGravity = false
                terrainPhysicsBodySegment.body.checkCollision.down = false
                terrainPhysicsBodySegment.setVisible(false)
                terrainPhysicsBodySegment.tileType = 'wall'
    
                
            }

            // Update previous segment
            previousSegment = segment;
  
        });

        // For tiles
        this.createTilesFromPool(tilesToCreate, terrainTilesGroup_Local);

        // For physics bodies
        //this.createPhysicsBodiesFromPool(physicsBodies);

        // Batch-create all terrain objects in one go
        terrainObjects.forEach(objectPlacementData => {
                this.scene[`${objectPlacementData.type}Manager`].add(
                    objectPlacementData.x,
                    objectPlacementData.y
                )     
        });
        
        // Add depth and return the physics body
        const depthMap = { ground: 5, low: 4, high: 2 };
        const depth = depthMap[elevation] || 1;
        terrainTilesGroup_Local.setDepth(depth)

        // Tag first and last tile in terrainTiles group
        const firstChild = terrainTilesGroup_Local.getFirst(true);
        firstChild.terrainStart = true
        const lastChild = terrainTilesGroup_Local.getLast(true);
        lastChild.terrainEnd = true

        let terrainGroupWidth = lastChild.x + lastChild.width - firstChild.x

        terrainTilesGroup_Local.terrainGroupWidth = terrainGroupWidth
        
        this.terrainGroupsTilesprites.add(terrainTilesGroup_Local)
        // Return the terrain group
        return terrainTilesGroup_Local;
    }

        // Create tiles from the pool and add them to the group
        createTilesFromPool(tilesToCreate, terrainTilesGroup_Local) {
            tilesToCreate.forEach(tileData => {
                const tile = this.getTileFromPool(tileData);
                terrainTilesGroup_Local.add(tile);  // Add to group
            });
        }

        // Retrieve a tile from the pool, or create a new one if necessary
        getTileFromPool(tileData) {
            let tile;
            if (this.tilePool.length > 0) {
                tile = this.tilePool.pop();  // Reuse a tile from the pool
                tile.setVisible(true);  // Ensure it's visible after reuse
            } else {
                // Create a new tile if the pool is empty
                tile = this.scene.add.tileSprite(tileData.x, tileData.y, tileData.xSize, tileData.ySize, tileData.texture, tileData.frame)
                    .setOrigin(tileData.originX, tileData.originY)
                    .setScale(tileData.scaleX, tileData.scaleY)
                    .setData('tileType', tileData.tileType);
            }

            // Reset tile properties before reuse
            tile.setPosition(tileData.x, tileData.y)
                .setOrigin(tileData.originX, tileData.originY)
                .setScale(tileData.scaleX, tileData.scaleY)
                .setData('tileType', tileData.tileType)
                .setActive(true)

            // Re-add to terrainGroupsTilesprites
            //this.terrainGroupsTilesprites.add(tile);

            return tile;
        }

        // Return a tile to the pool for reuse
        returnTileToPool(tile) {
            if (this.terrainGroupsTilesprites.contains(tile)) {
                this.terrainGroupsTilesprites.remove(tile); // Remove from group
            }
            tile.setVisible(false);  // Hide the tile before pooling it
            tile.off('update'); // Remove any custom event listeners
            this.tilePool.push(tile);  // Return tile to the pool
        }

        // // Create physics bodies from the pool and add them to the group
        // createPhysicsBodiesFromPool(physicsBodies) {
        //     physicsBodies.forEach(bodyData => {
        //         const terrainSegment = this.getPhysicsBodyFromPool(bodyData);
        //         terrainSegment.setVisible(false);  // Make sure it's visible when added to the scene
        //     });
        // }

        // // Retrieve a physics body from the pool, or create a new one if necessary
        // getPhysicsBodyFromPool(bodyData) {
        //     let terrainSegment;
        //     if (this.terrainPool.length > 0) {
        //         terrainSegment = this.terrainPool.pop();  // Reuse a physics body from the pool
        //         terrainSegment.setVisible(false);  // Ensure it's visible after reuse
        //     } else {
        //         // Create a new physics body if the pool is empty
        //         terrainSegment = this.terrainGroupsPhysics[bodyData.elevation].create(bodyData.x, bodyData.y);
        //         terrainSegment.setOrigin(bodyData.originX, bodyData.originY);  // Align bottom-left corner
        //         terrainSegment.displayWidth = bodyData.width;
        //         terrainSegment.displayHeight = bodyData.height;
        //         terrainSegment.body.setSize(bodyData.width, bodyData.height);
        //         terrainSegment.setImmovable(true);
        //         terrainSegment.body.allowGravity = false;
        //         terrainSegment.body.checkCollision.down = false;
        //         terrainSegment.setVisible(false);  // Set it invisible until it's needed
        //     }

        //     // Reset properties before reuse
        //     terrainSegment.setPosition(bodyData.x, bodyData.y)
        //         .setOrigin(bodyData.originX, bodyData.originY)
        //         .setSize(bodyData.width, bodyData.height)
        //         .setImmovable(true)
        //         .setVisible(false)
        //     terrainSegment.tileType = bodyData.bodyType
        //     terrainSegment.yDirection = bodyData.yDirection;

        //     // Re-add to the correct physics group
        //     if (!this.terrainGroupsPhysics[bodyData.elevation]) {
        //         this.terrainGroupsPhysics[bodyData.elevation] = this.scene.physics.add.group();
        //     }
        //     this.terrainGroupsPhysics[bodyData.elevation].add(terrainSegment);

        //     return terrainSegment;
        // }

        // // Return a physics body to the pool for reuse
        // returnPhysicsBodyToPool(terrainSegment) {
        //     terrainSegment.setVisible(false);  // Hide it before pooling it
        //     this.terrainPool.push(terrainSegment);  // Return physics body to the pool
        // }

        // // Clear all objects from the pools (when needed, such as clearing a scene)
        // clearPools() {
        //     this.tilePool.forEach(tile => tile.setVisible(false));
        //     this.tilePool = [];

        //     this.terrainPool.forEach(segment => segment.setVisible(false));
        //     this.terrainPool = [];
        // }

    updateV2() {
        if(this.scene.sandbox){
            let repositionSpeed = this.scene.baseSpeed
        // Move all terrain physics objects and update
        // Object.values(this.terrainGroupsPhysics).forEach(terrainGroup => {
        //     terrainGroup.children.iterate((object) => {
        //         if(object){
        //         object.x -= repositionSpeed; // Move each container


        //         if (object.body) {
        //             object.body.updateFromGameObject();
        //         }

        //         if(object){
        //         if (object.x < -this.scene.scale.width * 0.5) {
        //             this.returnPhysicsBodyToPool(object);
        //             //console.log('Physics object destroyed')
        //         }
        //         }
        //     }
             
        //     });
        // });

        // Move all terrain tilesprite objects
        this.terrainGroupsTilesprites.getChildren().forEach(tileGroup => {

                tileGroup.getChildren().forEach(tileSprite => {

                if(tileSprite){
                    // Move each TileSprite to the left
                    tileSprite.x -= repositionSpeed;  // Adjust the value (-1) for the speed you want
            
                    if(tileSprite){
                    // Geenerate new terrain
                    if (tileSprite.terrainEnd && tileSprite.x + tileSprite.width < this.scene.scale.width && !tileGroup.generateNewTerrain) {
                        tileGroup.generateNewTerrain = true
                        this.generateTerrainV2((this.scene.scale.width + this.scene.scale.width * 0.125) *
                                Phaser.Math.FloatBetween(
                                    this.chaosFactorSettings.ground.chaosLowerBound,
                                    this.chaosFactorSettings.ground.chaosUpperBound
                                ),
                                'ground'
                        );
                    }

                    // Destroy
                    if (tileSprite.x < -tileSprite.width - this.scene.scale.width * 0.1 ) {
                        this.returnTileToPool(tileSprite);
                        //console.log('Tilesprite destroyed')
                    }

                    }
                }
            });
        });

                    
       
        } else {
        let repositionSpeed = this.scene.baseSpeed
        // Move all terrain physics objects and update
        Object.values(this.terrainGroupsPhysics).forEach(terrainGroup => {
            terrainGroup.children.iterate((object) => {
                if(object){
                object.x -= repositionSpeed; // Move each container


                if (object.body) {
                    object.body.updateFromGameObject();
                }

                if(object){
                if (object.x < -this.scene.scale.width * 0.5) {
                    this.returnPhysicsBodyToPool(object);
                    //console.log('Physics object destroyed')
                }
                }
            }
             
            });
        });

        // Move all terrain tilesprite objects
        this.terrainGroupsTilesprites.getChildren().forEach(tileGroup => {

                tileGroup.getChildren().forEach(tileSprite => {

                if(tileSprite){
                    // Move each TileSprite to the left
                    tileSprite.x -= repositionSpeed;  // Adjust the value (-1) for the speed you want
            
                    if(tileSprite){
                    // Geenerate new terrain
                    if (tileSprite.terrainEnd && tileSprite.x + tileSprite.width < this.scene.scale.width && !tileGroup.generateNewTerrain) {
                        tileGroup.generateNewTerrain = true
                        this.generateTerrain((this.scene.scale.width + this.scene.scale.width * 0.125) *
                                Phaser.Math.FloatBetween(
                                    this.chaosFactorSettings.ground.chaosLowerBound,
                                    this.chaosFactorSettings.ground.chaosUpperBound
                                ),
                                'ground'
                        );
                    }

                    // Destroy
                    if (tileSprite.x < -tileSprite.width - this.scene.scale.width * 0.1 ) {
                        this.returnTileToPool(tileSprite);
                        //console.log('Tilesprite destroyed')
                    }

                    }
                }
            });
        });

        }


    }

}




