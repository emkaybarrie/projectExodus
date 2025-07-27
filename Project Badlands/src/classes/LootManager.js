export default class LootManager {
    constructor(scene) {
        this.scene = scene;
        this.lootGroup = this.scene.physics.add.group()

        this.scene.anims.create({
            key: 'coinAnim',  // The key that will be used to refer to this animation
            frames: this.scene.anims.generateFrameNumbers('coin', { start: 0, end: 11 }),  // Frame range (adjust according to your spritesheet)
            frameRate: 10,  // Animation speed (frames per second)
            repeat: -1  // Repeat the animation indefinitely
        });

        // Register the update event for manager
        this.scene.events.on('update', this.update, this);


    }

    add(x, y, texture = 'coin', options = {}) {
        const loot = this.scene.physics.add.sprite(x, y, texture).setOrigin(0, 1);

        // Play the coin animation immediately after creating the loot sprite
        loot.anims.play('coinAnim');  // Start the animation created earlier

        // Add Terrain to Terrain group in Stage Manager
        this.lootGroup.add(loot);


        // Set physics properties
        loot.body.setImmovable(true);
        loot.body.allowGravity = false;

        loot.setDepth(5)
                .setScale(3)
                .setSize(loot.width, loot.height * 0.8)
                .setTint();


        // Initialize custom properties
        loot.id = Phaser.Utils.String.UUID()
        loot.collected = false;
        // loot.passThrough = options.passThrough || false;
        // loot.slowDownEffect = options.slowDownEffect || false;
        // loot.stopEffect = options.stopEffect || false;
   

        //console.log("Loot Created: " + loot.id)

        
    }

    addColliders(){
         // Add a collider for each loot group with the player
            this.scene.physics.add.overlap(
                this.scene.avatarManager.sprite, 
                this.lootGroup, 
                (sprite, loot) => this.handleAvatarCollisions(this.scene.avatarManager,loot),
                null,
                this
            );
      
    }

        handleAvatarCollisions(avatar, loot){

        
            if(!loot.collected){
                console.log('Score increased')   
            // Increase the score
            this.scene.score += 10;
            this.scene.scoreText.setText(`Score: ${this.scene.score}`);

            
            loot.collected = true

                // Flash effect before bouncing
                this.scene.tweens.add({
                    targets: loot,
                    alpha: { from: 1, to: 0.5 },
                    duration: 150,
                    yoyo: true,
                    onStart: () => {
                        // Bounce effect
                        this.scene.tweens.add({
                            targets: loot,
                            y: loot.y - 50, // Bounce upwards
                            duration: 250,
                            ease: 'Power2',
                            yoyo: true,
                            onComplete: () => {
                                // Destroy the coin after bounce
                                loot.destroy();
                            }
                        });
                    }
                });
        }
        }

    update() {
 
      

            this.lootGroup.getChildren().forEach(loot => {
                loot.x -= this.scene.baseSpeed;

                if (loot.x < -loot.displayWidth){
                    loot.destroy();
                    //console.log(`Destroying ${loot.elevation} loot`);
                } 
            });
      

    }

}



