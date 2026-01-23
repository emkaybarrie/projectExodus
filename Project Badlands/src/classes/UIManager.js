
import { config } from "../config.js";
export default class UIManager {
    constructor(scene) {
        
        this.scene = scene;
        this.avatar = this.scene.avatarManager;

        this.momentumVersion = 2

        // Scale factors relative to screen size
        const baseScreenIncrementX = this.scaleForDPI(this.scene.scale.width * 0.01) ;
        const baseScreenIncrementY = this.scaleForDPI(this.scene.scale.height * 0.01);

        const devicePixelRatio = window.devicePixelRatio; // Get the DPI scale factor

        // Skill Slots
        this.skillIcon1 = this.scene.add.image(baseScreenIncrementX * 14 + config.width * 0.06, baseScreenIncrementY * 1.5, null).setVisible(false)
        .setOrigin(0)
        .setDisplaySize(config.width * 0.05, config.width * 0.05)
        .setDepth(9);

        this.skillIcon2 = this.scene.add.image(baseScreenIncrementX * 14, baseScreenIncrementY * 1.5, null).setVisible(false)
        .setOrigin(0)
        .setDisplaySize(config.width * 0.05, config.width * 0.05)
        .setDepth(9);
        

        // Example: Create the progress bar
        const progressBarX = this.scene.scale.width * 0.65; // Positioned on the right side
        const progressBarY = this.scene.scale.height * 0.125; // Near the top
        const progressBarWidth = this.scene.scale.width * 0.3; // 30% of screen width
        const progressBarHeight = 30;

        this.progressBar = this.createProgressBar(progressBarX, progressBarY, progressBarWidth, progressBarHeight, 0, 100);

        // Initial update
        this.updateProgressBar(this.progressBar, 0, 100);

        

        // Avatar icon size and vitals icon size
        const avatarIconDesiredSize = this.scaleForDPI(this.scene.scale.width * 0.075); // Desired size of avatar icon in pixels
        const vitalsIconScaleFactor = 0.275; // Proportional size of vitals icons relative to avatar icon
        const vitalsSpacingFactor = 0.15; // Spacing between vitals icons relative to avatar icon size

        // Calculate avatar icon size and vitals icon size dynamically
        const avatarIconSize = Math.min(this.scene.scale.width, this.scene.scale.height) * (avatarIconDesiredSize / Math.max(this.scene.scale.width, this.scene.scale.height));
        const vitalsSpacingFromAvatarIcon = baseScreenIncrementX * 1;
        const vitalsIconSize = avatarIconSize * vitalsIconScaleFactor ;
        const vitalsIconsSpacing = avatarIconSize * vitalsSpacingFactor ;

        // Avatar Icon
        this.avatarIcon = this.scene.add.image(baseScreenIncrementX * 1.5, baseScreenIncrementY * 1.5, 'avatarIcon')
            .setOrigin(0)
            .setDisplaySize(avatarIconSize, avatarIconSize)
            .setDepth(9);

        // Vitals Icons Positioning
        const avatarIconRightX = this.avatarIcon.x + this.avatarIcon.displayWidth + vitalsSpacingFromAvatarIcon;
        const avatarIconCenterY = this.avatarIcon.y + this.avatarIcon.displayHeight / 2;

        // First vitals icon (health)
        this.avatarHealthIcon = this.scene.add.image(
            avatarIconRightX,
            avatarIconCenterY - vitalsIconSize - vitalsIconsSpacing / 2,
            'healthIcon'
        )
            .setOrigin(0.5)
            .setDisplaySize(vitalsIconSize, vitalsIconSize)
            .setDepth(9);

        // Second vitals icon (mana)
        this.avatarManaIcon = this.scene.add.image(
            avatarIconRightX,
            avatarIconCenterY,
            'manaIcon'
        )
            .setOrigin(0.5)
            .setDisplaySize(vitalsIconSize, vitalsIconSize)
            .setDepth(9);

        // Third vitals icon (stamina)
        this.avatarStaminaIcon = this.scene.add.image(
            avatarIconRightX,
            avatarIconCenterY + vitalsIconSize + vitalsIconsSpacing / 2,
            'staminaIcon'
        )
            .setOrigin(0.5)
            .setDisplaySize(vitalsIconSize, vitalsIconSize)
            .setDepth(9);

        // Create the vital bars and position them relative to the icon
        this.bars = {
            health: this.createBar(avatarIconRightX, avatarIconCenterY - vitalsIconSize - vitalsIconsSpacing / 2, 0xff0000, 0.25), // 20% width initially
            mana: this.createBar(avatarIconRightX, avatarIconCenterY, 0x0000ff, 0.25), // 20% width initially
            stamina: this.createBar(avatarIconRightX, avatarIconCenterY + vitalsIconSize + vitalsIconsSpacing / 2, 0x00ff00, 0.25), // 20% width initially
        };

        // Property mappings for health, mana, and stamina
        this.propertyMappings = {
            health: 'currentHealth',
            mana: 'currentMana', 
            stamina: 'currentStamina', 
        };

        // Listen for stat changes
        Object.keys(this.propertyMappings).forEach(type => {
            this.avatar.on(`${this.propertyMappings[type]}Changed`, (previousValue, isDelayed) => {
                this.updateBar(type, previousValue, isDelayed);
            });
        });

        // // Momentum BarV1 - REOSURCE BAR
 
        //  // Create Momentum Bar below the avatar icon
        //  const momentumBarX = this.avatarIcon.x;  // Align with the left side of the avatar icon
        //  const momentumBarY = this.avatarIcon.y + this.avatarIcon.displayHeight + 10; // Below the avatar icon
        //  const momentumBarWidth = this.avatarIcon.displayWidth; // Align with the avatar icon width
        //  const momentumBarHeight = 10; // Height of the momentum bar
 
        //  // Create the momentum bar
        //  this.momentumBar = this.createMomentumBar(momentumBarX, momentumBarY, momentumBarWidth, momentumBarHeight);
 
        //  // Initialize momentum value
        //  //this.momentum = 100;  // Initial momentum value (could be updated dynamically)
        //  this.updateMomentumBar();  // Update the bar immediately
 

        // Create Dynamic Momentum Bar below the avatar icon
        const momentumBarX = this.avatarIcon.x;  // Align with the left side of the avatar icon
        const momentumBarY = this.avatarIcon.y + this.avatarIcon.displayHeight + 10; // Below the avatar icon
        const momentumBarWidth = this.avatarIcon.displayWidth; // Align with the avatar icon width
        const momentumBarHeight = 10; // Height of the momentum bar

        // Create the momentum bar
        this.momentumBar = this.createDynamicMomentumBar(momentumBarX, momentumBarY, momentumBarWidth, momentumBarHeight);

        // Initialize momentum value
        //this.momentum = 0;  // Initial momentum value (could be updated dynamically)
        this.updateDynamicMomentumBar();  // Update the bar immediately

        // Register the update event for manager
        this.scene.events.on('update', this.update, this);
      


    }
        // V1 - TO BE USED FOR BAR FOR CORE RESOURCE COLLECTION [?]
        // Create the momentum bar
        // createMomentumBar(x, y, width, height) {
        //     const bar = this.scene.add.rectangle(x, y, width, height, 0x6a0dad); // Dark purple color
        //     bar.setOrigin(0, 0);  // Align to the left-top corner
        //     bar.setDepth(9)
        //     return bar;
        // }
    
        // // Update the momentum bar based on the momentum value (0 to 100)
        // updateMomentumBar() {
        //     if (!this.momentumBar) return;
    
        //     const momentumPercentage = Phaser.Math.Clamp(this.avatar.traversalSpeedModifier / 250, 0, 1);  // Ensure the value stays between 0 and 1
        //     this.momentumBar.setScale(momentumPercentage, 1); // Adjust width based on momentum percentage
        // }
    
        // // Method to set the momentum value
        // setMomentum(value) {
        //     this.momentum = Phaser.Math.Clamp(value, 0, 250); // Ensure momentum is between 0 and 100
        //     this.updateMomentumBar();
        // }

        // V2
    // Create a dynamic momentum bar with center-based fill
    createDynamicMomentumBar(x, y, width, height) {
        const bar = this.scene.add.rectangle(x, y, width, height, 0x6a0dad); // Initial dark purple color
        bar.setOrigin(0.5, 0.5);  // Set origin to center (for center-based filling)
        bar.setDepth(9)
        return bar;
    }

    // Update the dynamic momentum bar based on the momentum value
    updateDynamicMomentumBar() {
        if (!this.momentumBar) return;

        const momentumBarWidth = this.avatarIcon.displayWidth;  // Use avatar icon width as the full width
        const centerX = this.avatarIcon.x + this.avatarIcon.displayWidth / 2; // Center X of the bar

        if (this.avatar.traversalSpeedModifier < 100) {
            // Fill left (red) if momentum is 0 to 99
            //const leftFillWidth = (momentumBarWidth * (this.avatar.traversalSpeedModifier / 100));
            const leftFillWidth = momentumBarWidth * (1 - (this.avatar.traversalSpeedModifier / 100));
            this.momentumBar.setFillStyle(0xff0000, 1); // Red color
            this.momentumBar.setPosition(centerX - leftFillWidth / 2, this.momentumBar.y); // Center it based on the left fill
            this.momentumBar.setSize(leftFillWidth, this.momentumBar.height); // Set width to represent the momentum
        } else if (this.avatar.traversalSpeedModifier >= 100) {
            // Fill right (green) if momentum is 101 to 250
            const rightFillWidth = (momentumBarWidth * ((this.avatar.traversalSpeedModifier - 100) / 150));  // Map 101-250 to 0-100
            this.momentumBar.setFillStyle(0x00ff00, 1); // Green color
            this.momentumBar.setPosition(centerX - rightFillWidth / 2, this.momentumBar.y); // Center it based on the right fill
            this.momentumBar.setSize(rightFillWidth, this.momentumBar.height); // Set width to represent the momentum
        }

        // Set position and size (ensures it stays below avatar icon)
        this.momentumBar.setPosition(centerX, this.avatarIcon.y + this.avatarIcon.displayHeight + 10);  // Positioned below avatar
    }

    // Method to set the momentum value
    setMomentum(value) {
        this.momentum = Phaser.Math.Clamp(value, 0, 250); // Ensure momentum is between 0 and 250
        this.updateDynamicMomentumBar();
    }



    scaleForDPI(baseValue) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        return baseValue * devicePixelRatio;
    }

    // Create a bar for health, mana, or stamina
    createBar(x, y, color, initialWidthFactor = 0.4) {
        const initialWidth = this.scaleForDPI(this.scene.scale.width * 0.3 * initialWidthFactor); // 30% of screen width
        const bg = this.scene.add.rectangle(x, y, initialWidth, 20, 0x555555).setOrigin(0, 0.5).setDepth(8);
        const bar = this.scene.add.rectangle(x, y, 0, 20, color).setOrigin(0, 0.5).setDepth(8);
        const overlay = this.scene.add.rectangle(x, y, 0, 20, 0xff8800).setOrigin(0, 0.5).setAlpha(0).setDepth(8);

        // Add text anchored to the right edge of the bg
        const text = this.scene.add.text(x + bg.width - 5, y, '0/0', {
            fontSize: '16px',
            color: '#ffffff',
            align: 'right',
        })
            .setOrigin(1, 0.5) // Align to right edge, vertically centered
            .setDepth(9);

        return { bg, bar, overlay, text };
    }

    // Update the bar dynamically with damage or instant changes
    updateBar(type, previousValue, isDelayed = false) {
        const statKey = this.propertyMappings[type]; 
        const maxStatKey = `max${type.charAt(0).toUpperCase() + type.slice(1)}`; 
        const maxStat = this.avatar[maxStatKey];
    
        if (maxStat <= 0) return;
    
        const currentStat = this.avatar[statKey];
    
        // Calculate the new width based on the current value
        const newWidth = Math.max((currentStat / maxStat) * this.bars[type].bg.width, 0);
    
        // Handle delayed damage changes
        if (isDelayed) {
            // Calculate the width of the overlay based on the new damage
            const damageWidth = Math.max(((previousValue - currentStat) / maxStat) * this.bars[type].bg.width, 0);
    
            const currentBarWidth = this.bars[type].bar.width;
            const targetBarWidth = currentBarWidth - damageWidth;
    
            // Stop ongoing overlay tweens
            this.scene.tweens.killTweensOf(this.bars[type].overlay);
            this.scene.tweens.killTweensOf(this.bars[type].bar);
    
            // Instantly apply the previous overlay effect to the bar
            this.bars[type].bar.width = targetBarWidth;
    
            // Start a new overlay for the current damage
            this.bars[type].overlay.width = damageWidth;
            this.bars[type].overlay.x = this.bars[type].bar.x + targetBarWidth;
            this.bars[type].overlay.setAlpha(1);
    
            // Tween the overlay to fade out and shrink
            this.scene.tweens.add({
                targets: this.bars[type].overlay,
                alpha: 0,
                duration: 500,
                delay: 300,
                onComplete: () => {
                    // After the overlay fades, update the bar to the final width
                    this.scene.tweens.add({
                        targets: this.bars[type].bar,
                        width: newWidth,
                        duration: 500,
                        ease: 'Linear',
                    });
                }
            });
        } else {
            // For instant changes, update the bar directly without affecting the overlay
            this.scene.tweens.add({
                targets: this.bars[type].bar,
                width: newWidth,
                duration: 500,
                ease: 'Linear',
            });
    
            // Ensure the overlay resets (in case of concurrent regen/damage)
            this.bars[type].overlay.setAlpha(0); // Hide overlay immediately if not delayed
        }

        // Update the text to reflect the current and max values
        this.bars[type].text.setText(`${Math.round(currentStat)}/${maxStat}`);

        // Reposition the text to remain anchored to the right edge of the bg
        this.bars[type].text.setX(this.bars[type].bg.x + this.bars[type].bg.width - 5);
    }
 
    // Create the progress bar (used for stage progress)
    createProgressBar(x, y, width, height, stageProgress, stageLength) {
        // Create the background
        const bg = this.scene.add.rectangle(x, y, width, height, 0x555555).setOrigin(0, 0.5).setDepth(8);
        const bar = this.scene.add.rectangle(x, y, 0, height, 0xc14192).setOrigin(0, 0.5).setDepth(8);
    
        // Add markers at 25%, 50%, 75%, and 100%
        const markers = [];
        const markerPositions = [0, 0.25, 0.5, 0.75, 1];
        markerPositions.forEach((fraction) => {
            const markerX = x + (width * fraction) ; // Center-based positioning
            const circle = this.scene.add.circle(markerX, y, height / 2, 0xffffff).setDepth(10); // White fill
            const border = this.scene.add.circle(markerX, y, height / 2, 0x000000)
                .setStrokeStyle(2, 0x000000) // Black border
                .setDepth(9); // Border above the fill
            markers.push({ circle, border });
        });

        markers.forEach((marker, index) => {
            var icon = null
            if(index > 0){
                icon = this.scene.add.image(marker.circle.x, marker.circle.y, 'landmark_encounter').setScale(0.5).setDepth(11);
            } else {
                icon = this.scene.add.text(marker.circle.x, marker.circle.y, 1, {
                    fontSize: '18px',
                    color: '#000000',
                    align: 'center',
                    fontStyle: 'bold'
                })
                    .setOrigin(0.5) // Align to right edge, vertically centered
                    .setDepth(11);
            }
            
            marker.icon = icon; // Store reference for updates if needed
        });
    
        // Return the progress bar and markers
        return { bg, bar, markers };
    }

    // Update the progress bar dynamically
    updateProgressBar(progressBar, stageProgress, stageLength) {
        const progressFraction = Math.min(stageProgress / stageLength, 1);
        const newWidth = progressFraction * progressBar.bg.width;
    
        // Update the progress bar width
        this.scene.tweens.add({
            targets: progressBar.bar,
            width: newWidth,
            duration: 500,
            ease: 'Linear',
        });
    }

    update() {
        // Update the progress bar markers (stage progress)
        this.progressBar.markers[0].icon.setText(this.scene.stage);
        //this.updateMomentumBar();
        this.updateDynamicMomentumBar()

        if(this.scene.avatarManager.currentMana < this.scene.avatarManager.special1Cost){
            this.skillIcon1.setAlpha(0.35)
        } else {
            this.skillIcon1.setAlpha(1)
        }

        if(this.scene.avatarManager.currentMana < this.scene.avatarManager.special2Cost){
            this.skillIcon2.setAlpha(0.35)
        } else {
            this.skillIcon2.setAlpha(1)
        }

    
    }

    
}











