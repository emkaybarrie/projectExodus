export default class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacleGroup = this.scene.physics.add.group()

        // Register the update event for manager
        this.scene.events.on('update', this.update, this);

    }

    add(x, y, texture = 'dTerrainPlaceholder', options = {}) {
        const obstacle = this.scene.physics.add.sprite(x, y, texture).setOrigin(0.5, 1);

        // Add Terrain to Terrain group in Stage Manager
        this.obstacleGroup.add(obstacle);

        obstacle.setDepth(5)
        obstacle.body.setImmovable(true);
        obstacle.body.allowGravity = false;

        obstacle.setScale(Phaser.Math.FloatBetween(0.75,1.25))

        // Scale and adjust physics 
        obstacle.setSize(obstacle.width, obstacle.height * 0.8);
         // Additional effects for appearance, like tint or rotation, if desired
         //obstacle.setTint(0xff0000); // Example red tint for visibility

         // Set properties based on options
        obstacle.passThrough = options.passThrough || true;
        obstacle.slowDownEffect = options.slowDownEffect || false;
        obstacle.stopEffect = options.stopEffect || false;

        //console.log(obstacle)
        
    }

    update() {

            this.obstacleGroup.getChildren().forEach(obstacle => {
                obstacle.x -= this.scene.baseSpeed;

                if (obstacle.x < -obstacle.displayWidth){
                    obstacle.destroy();
                    //console.log(`Destroying ${obstacle.elevation} terrain`);
                }
            });
        

    }

    addColliders(){
        // Add a collider for each loot group with the player
           this.scene.physics.add.overlap(
               this.scene.avatarManager.sprite, 
               this.obstacleGroup, 
               (sprite, obstacle) => this.handleAvatarCollisions(this.scene.avatarManager, obstacle),
               null,
               this
           ); 
    }

       handleAvatarCollisions(avatar, loot){
        // Call the avatar's takeHit function if a collision occurs
        avatar.takeHit();
        //console.log('Avatar collided with Obstacle')

        // // Behavior based on obstacle's properties
        // if (obstacle.passThrough) {
        //     // If pass-through, temporarily disable collision
        //     obstacle.body.checkCollision.none = true;
        //     this.scene.time.delayedCall(500, () => obstacle.body.checkCollision.none = false); // Enable collision after 0.5s
        // } else if (obstacle.slowDownEffect) {
        //     // If slow-down, reduce player speed temporarily
        //     avatar.normalSpeed = 0
        //     avatar.sprite.setVelocityX(avatar.sprite.body.velocity.x * 0.5);
        //     this.scene.time.delayedCall(500, () => avatar.setVelocityX(avatar.normalSpeed)); // Reset speed after 0.5s
        // } else {
        //     // If stop effect, stop the avatar
        //     avatar.sprite.setVelocityX(0);
        // } 
       }

}
