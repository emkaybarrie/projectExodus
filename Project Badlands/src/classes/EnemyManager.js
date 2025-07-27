export default class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemyGroup = this.scene.physics.add.group()
        this.enemyProjectileGroup = this.scene.physics.add.group()
        this.monsterList = this.scene.monsterList; // A hierarchical list of monsters by region, stage, and rarity
        
        // Register the update event for manager
        this.scene.events.on('update', this.update, this);
        
    }

    getMonsterData(region, stage, rarity, overrideMonster = null) {
        const monstersForRegion = this.monsterList['region' + region];
        if (!monstersForRegion) throw new Error(`Region ${region} not found in monster list.`);

        const monstersForStage = monstersForRegion['stage' + stage];
        if (!monstersForStage) throw new Error(`Stage ${stage} not found in region ${region}.`);

        const monstersForRarity = monstersForStage[rarity];
        if (!monstersForRarity || monstersForRarity.length === 0) {
            throw new Error(`No monsters found for rarity ${rarity} in stage ${stage}, region ${region}.`);
        }

        // If overrideMonster is specified, use it; otherwise, randomly select one
        if (overrideMonster) {
            const monster = monstersForRarity.find(m => m.name === overrideMonster);
            if (!monster) throw new Error(`Monster ${overrideMonster} not found in rarity ${rarity}, stage ${stage}, region ${region}.`);
            return monster;
        }

        // Random selection
        return Phaser.Utils.Array.GetRandom(monstersForRarity);
    }

    add(x, y, region = 1, stage = 1, rarity = 'random', overrideMonster = null) {
    
        // Rarity selection
        if(rarity == 'random'){
            
            // Predefined rarity chances
            const rarityChances = {
                rare: 5,     // 5% chance for 'rare'
                uncommon: 15, // 15% chance for 'uncommon'
                common: 80    // 70% chance for 'common' (default)
            };
            const rand = Phaser.Math.FloatBetween(0, 100);  // Get a random number between 0 and 100

            // Check for rare, uncommon, or common based on the predefined chance ranges
            if (rand < rarityChances.rare) {
                rarity = 'rare';
            } else if (rand < rarityChances.rare + rarityChances.uncommon) {
                rarity =  'uncommon';
            } else {
                rarity =  'common'; // Default if no other rarity is picked
            }
        }

        // Get monster data
        const monsterData = this.getMonsterData(region, stage, rarity, overrideMonster);

        // Create the enemy sprite
        const enemy = this.enemyGroup.create(x, y - 25, monsterData.name)

        // Configure physics and appearance
        enemy.setOrigin(0,1)
            .setDepth(5)
            .setScale(monsterData.scale || 1)
            .setSize(monsterData.dimensions.frameWidth, monsterData.dimensions.frameHeight * 0.8)
            .setTint(monsterData.tint || 0xFFFFFF);

        // Set physics body dimensions
        const { physicsBox } = monsterData;
        if (physicsBox) {
            const { width, height, offsetX = 0, offsetY = 0 } = physicsBox;
            enemy.body.setSize(width, height).setOffset(offsetX, offsetY);
        } else {
            // Default to sprite size
            enemy.body.setSize(enemy.width, enemy.height);
        }

        // Assign animations
        this.assignAnimations(enemy, monsterData);

        // Custom behavior based on type
        enemy.name = monsterData.name
        enemy.flipReversed = monsterData.flipReversed
        enemy.type = monsterData.type || 'default'
        enemy.attackType = monsterData.attackType || 'melee';
        enemy.attackRange = enemy.attackType === 'melee' 
        ? this.scene.scale.width * 0.1 
        : this.scene.scale.width * 0.5;
        //enemy.projectileImageKey = 'nightborne_arrow'
        enemy.projectileTriggerFrame = 6
        enemy.attackPower = monsterData.attackPower || 25
        enemy.maxAttackCombo = monsterData.maxAttackCombo || 1
        enemy.currentAttackCombo = 0
        enemy.attackRecoveryTime = monsterData.attackRecoveryTime || 3000 
        enemy.jumpPower = Phaser.Math.Between(500, 1250);

        enemy.currentHealth = monsterData.baseHealthModifier * Phaser.Math.Between(75 + (this.scene.stage * 10), 100 + (this.scene.stage * 15));
        enemy.maxHealth = enemy.currentHealth
        enemy.canBeHurt = true
        enemy.canHurt = true
        enemy.canAct = true
        enemy.canAttack = true

        // Play the default animation (e.g., idle)
        enemy.play(`${monsterData.name}_idle`);

        enemy.id = Phaser.Utils.String.UUID();

        // Create the health bar for the enemy
        this.createHealthBar(enemy);

        //console.log(`Enemy Created: ${enemy.id}, Type: ${enemy.type}`);

        return enemy

    }

    addColliders(){
        // Add a collider for each enemy and frindly projectiles
           this.scene.physics.add.overlap(
               this.enemyGroup, 
               this.scene.friendlyProjectileGroup, 
               this.enemyTakeHit, // Reference the callback function here
               null,
               this
           );

        // Collider with player and enemy
        this.scene.physics.add.overlap(
            this.scene.avatarManager.sprite, 
            this.enemyGroup, 
            (sprite, enemy) => this.handleAvatarCollisions(this.scene.avatarManager, enemy),
            null,
            this
        ); 
    }

       handleAvatarCollisions(avatar, enemy){
        if(enemy.canHurt){
            // Check if the enemy is attacking
        const damage = enemy.isAttacking ? enemy.attackPower : 10; // Use attackPower if attacking, else default to 10
        
        avatar.takeHit(damage);
        //console.log(`Avatar collided with Enemy: ${enemy.id}, Damage: ${damage}`);
        }
       }

    assignAnimations(enemy, monsterData) {
        const { name, spriteSheetPath, dimensions, animations } = monsterData;

        // Load the sprite sheet if not already loaded
        if (!this.scene.textures.exists(name)) {
            this.scene.load.spritesheet(name, spriteSheetPath, dimensions);
            this.scene.load.once('complete', () => {
                this.createAnimations(name, animations);
            });
            this.scene.load.start();
        } else {
            this.createAnimations(name, animations);
        }
    }

    createAnimations(spriteKey, animations) {
        animations.forEach(anim => {
            const animKey = `${spriteKey}_${anim.type}`;
            if (!this.scene.anims.exists(animKey)) {
                this.scene.anims.create({
                    key: animKey,
                    frames: this.scene.anims.generateFrameNumbers(spriteKey, { start: anim.start, end: anim.end }),
                    frameRate: anim.frameRate,
                    repeat: anim.repeat,
                });
            }
        });
    }

    // Create a health bar for the enemy with a background
    createHealthBar(enemy) {
        // Set health bar size based on max health
        const barWidth = 100; // Fixed width for the health bar (adjust as needed)
        const barHeight = 10; // Height of the health bar
        const backgroundWidth = barWidth; // Background width will match max health
        const x = enemy.x + 10;
        const y = enemy.y + 20; // Position below the enemy

        // Create the background of the health bar (gray or black)
        const backgroundBar = this.scene.add.rectangle(x, y, backgroundWidth, barHeight, 0x000000)
            .setOrigin(0, 0.5) // Center the background
            .setDepth(9); // Ensure it's rendered below the foreground bar

        // Create the health bar foreground (red)
        const healthBar = this.scene.add.rectangle(x, y, barWidth, barHeight, 0xff0000)
            .setOrigin(0, 0.5) // Set origin to the right (shrinks from right to left)
            .setDepth(10); // Ensure it's rendered above the background bar

        // Store both bars on the enemy
        enemy.backgroundHealthBar = backgroundBar;
        enemy.healthBar = healthBar;

        // Track when the health bar should disappear
        enemy.lastHitTime = Date.now();

        // Update the health bar position each frame
        this.scene.events.on('update', () => {
            this.updateHealthBarPosition(enemy);
        });
    }

    // Update the health bar position based on the enemy's position
    updateHealthBarPosition(enemy) {
        if (enemy.healthBar && enemy.backgroundHealthBar) {
            // Update health bar position to stay below the enemy
            enemy.healthBar.setPosition(enemy.x + 10, enemy.y + 20); // Adjust as needed
            enemy.backgroundHealthBar.setPosition(enemy.x + 10, enemy.y + 20); // Background follows the enemy too
        }
    }

    // Update the health bar based on the current health
    updateHealthBar(enemy) {
        if (enemy.healthBar && enemy.backgroundHealthBar) {
            // Ensure health is never below 0
            if (enemy.currentHealth < 0) enemy.currentHealth = 0;

            const healthPercent = enemy.currentHealth / enemy.maxHealth;
            const backgroundWidth = enemy.backgroundHealthBar.width;
            const newWidth = backgroundWidth * healthPercent;
            
            // Update the health bar's width based on current health
            enemy.healthBar.setSize(newWidth, enemy.healthBar.height);



        }
    }

    // Destroy the enemy and remove the health bar
    destroyEnemy(enemy) {
        if (enemy.healthBar) {
            enemy.healthBar.destroy(); // Destroy health bar foreground
            enemy.backgroundHealthBar.destroy(); // Destroy health bar background
        }
        enemy.destroy(); // Destroy the enemy sprite
    }

    enemyTakeHit(enemy, hitSource) {

    // Check if the projectile has already hit this enemy
    if (hitSource.hitTargets.has(enemy)) {
        return; // Skip further processing if the enemy has already been hit by this projectile
    }

    // Mark the enemy as hit
    hitSource.hitTargets.add(enemy);
    //console.log('Enemy hit by projectile')
        
    // Destroy the projectile if pass-through is disabled
        if (hitSource.maxPierce <= 0) {
            hitSource.destroy();
        } else {
            hitSource.maxPierce -= 1
        }

        // Stop enemy movement
            enemy.setVelocityX(0);

        if (enemy.canBeHurt){
            enemy.canHurt = false
            if (enemy.currentHealth > 0){
    

                // Trigger onHit function (e.g., critical hit or special effects)
                if (hitSource.onHit) {
                    hitSource.onHit(enemy, hitSource);
                }

                console.log(hitSource)

                console.log('Enemy Taking Hit: ' + hitSource.actualDamage)
                // Reduce enemy health
                enemy.currentHealth -= hitSource.actualDamage;

                // Reset the time when the enemy took damage
                enemy.lastHitTime = Date.now();

                // Update health and visual feedback
                this.updateHealthBar(enemy);
                enemy.emit('healthChanged', enemy.currentHealth, enemy.maxHealth);
                this.createDamageText(enemy, hitSource.actualDamage, hitSource.damageType);
                // Hit Effect
                if(!hitSource.hitAnim) hitSource.hitAnim = 'hitAnim_bow'
                 // Create the new object for the hit effect animation
                let hitEffect = this.scene.add.sprite(enemy.x + enemy.displayWidth / 2, enemy.y - enemy.displayHeight / 2); // Replace 'hitEffectSprite' with your actual sprite name
                hitEffect.setOrigin(0.5, 0.5).setDepth(enemy.depth).setScale(0.75);  // Center the sprite for the animation

                // Optionally adjust size, rotation, or tint of the hit effect sprite
                //hitEffect.setTint(0x800080); // Example: purple tint for the hit effect

                // Determine the animation to play based on the hitSource
                let hitAnim = hitSource.hitAnim; // Default hit animation

                // if (hitSource.damageType === 'fire') {
                //     hitAnim = 'fire_hit'; // Animation for fire damage
                // } else if (hitSource.damageType === 'ice') {
                //     hitAnim = 'ice_hit'; // Animation for ice damage
                // } else if (hitSource.damageType === 'critical') {
                //     hitAnim = 'critical_hit'; // Animation for critical damage
                // } else if (hitSource.customAnim) {
                //     hitAnim = hitSource.customAnim; // Custom animation from hitSource
                // }

                // Play the determined animation on the hitEffect
                hitEffect.anims.play(hitAnim);

                // Update hitEffect position to follow the enemy
                // hitEffect.update = () => {
                //     // Continuously update the position of hitEffect to match the enemy's position
                //     hitEffect.setPosition(enemy.x, enemy.y);
                // };

                // In the scene update method:
                this.scene.events.on('postupdate', () => {
                    if (hitEffect) {
                        hitEffect.setPosition(enemy.x + enemy.displayWidth / 2, enemy.y - enemy.displayHeight / 2);
                    }
                });

                // Set up the animation completion callback to destroy the hitEffect object
                hitEffect.on('animationcomplete', () => {
                    hitEffect.setAlpha(0); // Optionally make it invisible first
                    hitEffect.destroy();   // Destroy the hitEffect object after animation
                });
                

                // Flash effect
                let dmgTint = hitSource.actualDamage > 0 ? 0xff0000 : 0xffffff;
                this.scene.tweens.add({
                    targets: enemy,
                    tint: { from: 0xffffff, to: dmgTint },
                    alpha: { from: 1, to: 0.7 },
                    duration: 100,
                    yoyo: true,
                    repeat: 2,
                    onComplete: () => {
                        enemy.clearTint();
                        enemy.setAlpha(1);
                    }
                });

                // Check if the enemy is dead after taking the hit
                if (enemy.currentHealth <= 0) {
                    // Trigger death logic
                    this.handleEnemyDeath(enemy);
                    
                } else {
                    // Play hit animation if the enemy is still alive
                    enemy.anims.stop();
                    enemy.play(`${enemy.name}_takeHit`, true);
                    enemy.setVelocityX(0);

                    setTimeout(() => {
                        enemy.canHurt = true
                    }, 1000);
                }
            } else if (enemy.currentHealth <= 0) {
            // Handle immediate death if already below 0 health
            this.handleEnemyDeath(enemy);

            }
        }

    }

    // Separate the death logic into a reusable function
    handleEnemyDeath(enemy) {


        // Stop any animations and disable enemy actions
        enemy.anims.stop();
        enemy.canAct = false;
        enemy.isAttacking = false;
        enemy.canBeHurt = false;
        enemy.canHurt = false;

        // Play death animation
        enemy.play(`${enemy.name}_death`, true);

        enemy.once('animationcomplete', () => {
            enemy.setVelocityX(0);
            this.destroyEnemy(enemy);
            this.scene.score += 15; // Increment score
                        
            
        });
    }


    createDamageText(enemy, damage, damageType) {
        // Determine the damage text style based on the type of damage
        let textStyle = {
            font: '28px Arial',
            fill: '#ffffff',
            align: 'center'
        };
    
        // Apply custom styles based on damage type
        switch (damageType) {
            case 'critical':
                textStyle.fill = '#ffd700'; // Gold color for critical hits
                textStyle.font = '32px Arial'; // Bigger text for critical hits
                break;
            case 'poison':
                textStyle.fill = '#00ff00'; // Green color for poison
                break;
            case 'ice':
                textStyle.fill = '#00ffff'; // Blue color for ice
                break;
            default:
                textStyle.fill = '#ffffff'; // White for normal damage
                break;
        }
    
        // Create the damage text above the enemy
        const damageText = this.scene.add.text(enemy.x, enemy.y - enemy.displayHeight / 2, `${Math.round(damage)}`, textStyle)
            .setOrigin(0.5, 1)  // Center the text horizontally and position it above the enemy
            .setDepth(10);  // Make sure the text is on top of the enemy sprite
    
        // Animate the text to move upwards and fade out
        this.scene.tweens.add({
            targets: damageText,
            y: damageText.y - 50,  // Move text upwards
            alpha: 0,  // Fade out the text
            duration: 1000,  // The text will last 1 second before disappearing
            ease: 'Linear',
            onComplete: () => {
                damageText.destroy();  // Destroy the text once the animation is complete
            }
        });
    }


    update() {
        // Enemy Attacking disbled until physic sbox / disappear issue resolved - CONFIRMED ISSUE RELATED TO THIS
        this.enemyGroup.getChildren().forEach(enemy => {
            enemy.x -= this.scene.baseSpeed;
            // Enemy Attack Recovery
            if (enemy.currentAttackCombo >= enemy.maxAttackCombo){
                //console.log('Enemy Recovering')
                enemy.canAttack = false
                enemy.currentAttackCombo = 0;
                setTimeout(() => {
                    enemy.canAttack = true
                }, enemy.attackRecoveryTime);
            }

            if (enemy.x < -enemy.displayWidth * 2) {
                this.destroyEnemy(enemy)
                //console.log(`Destroying enemy at ` + enemy.x);
            } else {
                // // Handle specific behaviors
                // const avatarX = this.scene.avatarManager.sprite.x;
                // const avatarY = this.scene.avatarManager.sprite.y;
                // const enemyX = enemy.x;
                // const enemyY = enemy.y;

                // const aggroRange = this.scene.scale.width * 0.75; // Aggro range on the x-axis
                // const yAggroRange = this.scene.scale.height * 0.25 // Vertical proximity to trigger aggro
                // const attackRange = enemy.attackRange || this.scene.scale.width * 0.1; // Attack range


                // // Check if the player is within aggro range
                // const isInAggroX = Math.abs(enemyX - avatarX) < aggroRange;
                // const isInAggroY = Math.abs(enemyY - avatarY) <= yAggroRange;
                // const isAggressive = isInAggroX && isInAggroY;

                // if (!enemy.isTakingHit && enemy.canAct){

                //     // Handle specific behaviors
                //     if (isAggressive && enemy.canAttack) {
                //         enemy.isAggressive = true;

                //         // Flip enemy to face the player
                //         if (enemyX > avatarX) {
                //             enemy.flipX = enemy.flipReversed ? true : false;
                //         } else {
                //             enemy.flipX = enemy.flipReversed ? false : true;
                //         }

                //         // Determine if the enemy is in attack range
                //         const isInAttackRange = Math.abs(enemyX - avatarX) <= attackRange;

                //         if (isInAttackRange) {
                //             // Stop moving and attack
                //             if (!enemy.isAttacking && !enemy.isTakingHit) {
                //                 enemy.isAttacking = true;
                //                 enemy.setVelocityX(0); // Stop movement

                //                 // Play the attack animation
                //                 enemy.play(`${enemy.name}_attack`, true)
                //                 .once('animationcomplete', () => {
                //                     enemy.isAttacking = false; // Allow movement again after attack animation
                //                     enemy.currentAttackCombo += 1
                //                 })
                //                 .on('animationupdate', (anim, frame) => {
                //                     // Check if this frame matches the projectile trigger frame
                //                     if (anim.key === `${enemy.name}_attack` && frame.index === enemy.projectileTriggerFrame && enemy.attackType === 'ranged' && !enemy.isTakingHit) {
                //                         this.fireProjectile(enemy, enemy.attackPower);

                //                         // Remove the animationupdate listener
                //                         enemy.off('animationupdate');
                //                     }
                //                 });

                                
                //             }
                //         } else {
                //             // Move toward the player if not in attack range
                //             if (!enemy.isAttacking) {
                //                 const moveSpeed = enemy.type === 'chaser' ? 400 : 150;
                //                 if (enemyX > avatarX) {
                //                     enemy.setVelocityX(-moveSpeed - this.scene.addedSpeed);
                //                 } else {
                //                     enemy.setVelocityX(moveSpeed + this.scene.addedSpeed);
                //                 }
                //                 enemy.play(`${enemy.name}_run`, true);
                //             }
                //         }
                //     } else {
                //         // Return to idle if the player is out of aggro range
                //         enemy.isAggressive = false;
                //         enemy.isAttacking = false;
                //         enemy.setVelocityX(0); // Stop movement
                //         enemy.play(`${enemy.name}_idle`, true);
                //     }
                // }

                // Tween the alpha based on inactivity
                if (Date.now() - enemy.lastHitTime > 4000) {  // 2000ms = 2 seconds of inactivity
                    if (enemy.healthBar.alpha !== 0) {
                        this.scene.tweens.add({
                            targets: [enemy.healthBar, enemy.backgroundHealthBar],
                            alpha: 0,
                            duration: 500, // 1 second fade out duration
                            ease: 'Linear'
                        });
                    }
                } else {
                    if (enemy.healthBar.alpha !== 1) {
                        this.scene.tweens.add({
                            targets: [enemy.healthBar, enemy.backgroundHealthBar],
                            alpha: 1,
                            duration: 250, // 1 second fade in duration
                            ease: 'Linear'
                        });
                    }
                }
            }
        });
       

        // Update projectile positions based on baseSpeed
        this.enemyProjectileGroup.getChildren().forEach(projectile => {
            projectile.x -= this.scene.baseSpeed ;

            // Destroy if out of bounds to prevent memory leaks
            if (projectile.x < 0 || projectile.x > this.scene.scale.width) {
                projectile.destroy();
                //console.log('Projectile destroyed as it went out of bounds');
            }
        });
    }

    fireProjectile(enemy, damage = 5) {
        const projectile = this.scene.physics.add.sprite(
            enemy.x,
            enemy.y - (enemy.displayHeight / 1.5),
            `${enemy.name}_projectile` // The image key for the projectile
        );

        // Add projectile to the group
        this.projectileGroup.add(projectile);

        projectile.setScale(2,3).setDepth(6)
        projectile.body.allowGravity = false;

        projectile.damage = damage;

  
        const speed = 650 ; // Projectile speed
        var modifierArrow = 0
        // Determine direction based on enemy facing
        const leftDir = enemy.flipReversed ? -1 : 1;
        const rightDir = enemy.flipReversed ? 1 : -1;

        const direction = enemy.flipX ? leftDir : rightDir; // Determine the direction based on enemy facing

        if (direction < 0){
            projectile.flipX = true
        } else {
            modifierArrow = 250
        }
    
        projectile.setVelocityX(direction * (speed + modifierArrow));
        projectile.setCollideWorldBounds(true);
        projectile.body.onWorldBounds = true; // Enable worldbounds event

        // Destroy the projectile when it hits the edge of the screen
        this.scene.physics.world.on('worldbounds', (body) => {
            if (body.gameObject === projectile) {
                projectile.destroy();
                //console.log('Projectile destroyed on world bounds');
            }
        });

        
    
        // Optional: Add additional behaviors for the projectile here
        //console.log(`Fired projectile from ${enemy.name} at frame ${enemy.projectileTriggerFrame}`);
    }
}
