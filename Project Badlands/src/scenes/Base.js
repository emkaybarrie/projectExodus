import { config } from "../config.js";
import { saveSpiritDataToDb } from "../functions/Db_Functions.js";


export default class Base extends Phaser.Scene {
    constructor() {
        super('Base');
        this.scriptId = 'AKfycbw1zakrf0zclJNWzBSXjIKTfudd6Q9-YHNq6EvP7JGQ4OrtPIs0SwrgJCsAyoB4Y5eu'
        this.sheetUrl = `https://script.google.com/macros/s/${this.scriptId}/exec`;
        this.selectedRegion = Phaser.Math.Between(1,1)
    }

    init(data) {
        console.log(data)

        this.playerData = data.dataPacket 
        
    }

    create() {
        this.bg = this.add.image(0, 0, 'city').setOrigin(0).setScale(1).setDisplaySize(config.width, config.height);
        
        // Spirit Information
        this.sAPointX = this.scale.width * 0.2
        this.sAPointY = this.scale.height * 0.95
        this.initialiseSpiritSegment()

        this.initialiseAvatarSegment()
        

        // The Badlands

        // Create a container for the right side menu
        const regionButtons = ['North', 'South', 'East', 'West'];
        const regionPositions = {
            North: { x: this.scale.width * 0.5, y: this.scale.height * 0.75 },
            South: { x: this.scale.width * 0.5, y: this.scale.height * 0.95 },
            East: { x: this.scale.width * 0.575, y: this.scale.height * 0.85 },
            West: { x: this.scale.width * 0.425, y: this.scale.height * 0.85 },
        };

        // Create region buttons (N, S, E, W)
        this.regionButtonMap = {};
        regionButtons.forEach((region, index) => {
            this.regionButtonMap[region] = this.add.text(regionPositions[region].x, regionPositions[region].y, region, {
                fontSize: '24px',
                fill: '#fff',
                backgroundColor: '#444',
                padding: { x: 10, y: 10 },
            })
            .setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => this.selectRegion(region));
        });

        // Center Start Button
        this.startButton = this.add.text(this.scale.width * 0.5, this.scale.height * 0.85, 'Start', { fontSize: '32px', fill: '#fff', backgroundColor: '#007bff', padding: { x: 20, y: 10 } })
            .setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => this.startBadlands());

        // Placeholder image for region
        this.regionImage = this.add.image(this.scale.width * 0.5, this.scale.height * 0.25, 'regionNorth').setOrigin(0.5).setScale(0.125);

        // Add glowing effect to the text (you can modify the effect as needed)
        this.tweens.add({
            targets: this.regionImage,
            alpha: { from: 1, to: 0.65 }, // Pulse effect
            duration: 1000,
            yoyo: true,
            repeat: -1, // Repeat indefinitely
        });

        // Placeholder text below the image
        this.regionText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.695, 'Select a region to start', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);

    }

    initialiseSpiritSegment(){
        
        
        this.add.text(this.sAPointX, this.sAPointY, 'Spirit Information', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);

        // Stats with buttons
        const stats = ['Vitality', 'Focus', 'Adaptability'];
        const statPositionsY = [this.sAPointY - this.scale.height * 0.15 , this.sAPointY - this.scale.height * 0.1, this.sAPointY - this.scale.height * 0.05];

        this.statButtons = stats.map((stat, index) => {
            const statText = this.add.text(this.sAPointX - this.scale.width * 0.075, statPositionsY[index], `${stat}: ${this.playerData[stat.toLowerCase()]}`, { fontSize: '28px', fill: '#fff' });
            statText.setOrigin(0, 0.5)
            
            const button = this.add.text(this.sAPointX + this.scale.width * 0.075 , statPositionsY[index], '+', { fontSize: '30px', fill: '#0f0' })
                .setInteractive()
                .setOrigin(0.5)
                .on('pointerdown', () => this.allocateSpiritPoint(stat));

            button.setAlpha(this.playerData.spiritPoints > 0 ? 1 : 0.5); // Button is disabled if no points available
            // Store the stat name inside the button object
            return { statText, button, stat: stat };  // Store the stat name here
        });

        // Spirit Points counter
        this.spiritPointsText = this.add.text(this.sAPointX , this.sAPointY - this.scale.height * 0.2, `Spirit Points: ${this.playerData.spiritPoints}`, { fontStyle: 'bold', fontSize: '24px', fill: '#fff' });
        this.spiritPointsText.setOrigin(0.5)

        // Spirit Level and Power Bar
        const centerX = this.sAPointX, centerY = this.sAPointY - this.scale.height * 0.35, radius = 75, thickness = 20;

        const power = this.playerData.power; // The current power value
        const powerToNextLevel = this.playerData.powerToNextLevel; // The total power required to reach the next level
        const spiritLevel = this.playerData.spiritLevel; // This is the spirit level you want to display in the center of the doughnut

        // Create a doughnut graph
        this.doughnut = this.add.graphics();

        // Set the lineStyle for the doughnut
        this.doughnut.lineStyle(30, 0x800080, 1);  // Purple color, thicker outline

        // First, draw the empty doughnut (base ring)
        this.doughnut.clear();
        this.doughnut.beginPath();
        this.doughnut.arc(centerX, centerY, radius, 0, Phaser.Math.PI2, false); // Outer ring (full circle)
        this.doughnut.arc(centerX, centerY, radius - thickness, 0, Phaser.Math.PI2, true); // Inner ring (hole)
        this.doughnut.closePath();
        this.doughnut.fillStyle(0x333333, 1); // Dark color to represent the empty area of the doughnut
        this.doughnut.fillPath();

        // Draw the "filled" part of the doughnut based on the current power
        //this.fillDoughnut(centerX, centerY, radius, thickness, powerToNextLevel - power, powerToNextLevel);

        this.animateFillDoughnut(centerX, centerY, radius, thickness, power, powerToNextLevel, 2000)

        // Create the text element that shows the spiritLevel at the center
        this.spiritLevelText = this.add.text(centerX, centerY, `${this.playerData.spiritLevel}`, {
            fontSize: '48px',
            fill: '#800080', // Purple color
            fontFamily: 'Arial',
            align: 'center',
            stroke: '#000000', // Optional: Stroke to make the text pop
            strokeThickness: 4,
        }).setOrigin(0.5, 0.5); // Center the text

        // Add glowing effect to the text (you can modify the effect as needed)
        this.tweens.add({
            targets: this.spiritLevelText,
            alpha: { from: 1, to: 0.5 }, // Pulse effect
            duration: 500,
            yoyo: true,
            repeat: -1, // Repeat indefinitely
        });
    }

        // Function to animate the filling of the doughnut
        animateFillDoughnut(centerX, centerY, radius, thickness, targetValue, totalValue, duration) {
            // Start from 0 and tween to the target value (currentValue)
            this.currentValue = 0;

            // Create the tween to animate the filling process
            this.tweens.add({
                targets: this,
                currentValue: -targetValue,  // Target the currentValue to fill to the desired value
                duration: duration,         // Duration of the tween in milliseconds
                ease: 'Linear',             // Ease type (Linear for consistent filling speed)
                onUpdate: () => {
                    // Recalculate the fill percentage based on the current value
                    const startAngle = Phaser.Math.DegToRad(90);  // Start from the bottom (90 degrees in radians)
                    const fillPercentage = this.currentValue / totalValue; // Calculate the fill percentage
                    const endAngle = Phaser.Math.DegToRad(90 - (fillPercentage * 360)); // End angle based on percentage (clockwise)

                    // Clear previous drawing
                    //this.doughnut.clear();

                    // Draw the outer arc (clockwise)
                    this.doughnut.beginPath();
                    this.doughnut.arc(centerX, centerY, radius, startAngle, endAngle, false); // Outer arc (clockwise)

                    // Draw the inner arc (counter-clockwise) to create the hole in the middle
                    this.doughnut.arc(centerX, centerY, radius - thickness, endAngle, startAngle, true); // Inner arc (counter-clockwise)

                    // Close the path and fill with color
                    this.doughnut.closePath();
                    this.doughnut.fillStyle(0x800080, 1); // Purple color fill for the "filled" part
                    this.doughnut.fillPath();

        
                }
            });
        }

        updateSpiritLevelText(spiritLevel) {
            // Update the spirit level text at the center of the doughnut
            this.spiritLevelText.setText(`${Math.floor(spiritLevel)}`);  // Show the current power as text
        }

        allocateSpiritPoint(stat) {
            console.log(stat)
            if (this.playerData.spiritPoints > 0) {
                this.playerData[stat.toLowerCase()] += 1;  // Allocate 1 point to the stat
                this.playerData.spiritPoints -= 1; // Deduct 1 point
                this.updateSpiritInfo();
            }
        }
        
        updateSpiritInfo() {
            // Update the text and button visibility
            this.spiritPointsText.setText(`Spirit Points: ${this.playerData.spiritPoints}`);
            this.statButtons.forEach((button) => {
                // Update the stat text (using the stat property stored inside button)
                console.log(`Updating ${button.stat}: ${this.playerData[button.stat.toLowerCase()]}`);
                button.statText.setText(`${button.stat}: ${this.playerData[button.stat.toLowerCase()]}`);
                button.button.setAlpha(this.playerData.spiritPoints > 0 ? 1 : 0.5);  // Disable button when no points left
            });
        }

    initialiseAvatarSegment(){
    
    
        this.add.text(this.sAPointX * 4, this.sAPointY, 'Avatar Information', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);

        // Stats with buttons
        const stats = ['Stat 1', 'Stat 2', 'Stat 3'];
        const statPositionsY = [this.sAPointY - this.scale.height * 0.15 , this.sAPointY - this.scale.height * 0.1, this.sAPointY - this.scale.height * 0.05];


        // Spirit Points counter
        this.avatarName = this.add.text(this.sAPointX * 4 , this.sAPointY - this.scale.height * 0.2, 'Eros', { fontStyle: 'bold', fontSize: '24px', fill: '#fff' });
        this.avatarName.setOrigin(0.5)

        this.avatarIcon = this.add.image(this.sAPointX * 4 , this.sAPointY - this.scale.height * 0.35, 'avatarIcon1').setOrigin(0.5).setScale(0.25)


    }

    // When a region is selected
    selectRegion(region) {
        this.selectedRegion = region;
        this.updateRegionDisplay(region);
 
    }

    updateRegionDisplay(region) {
        // Update region image based on selected region
        const imageKey = `region${region}`; // Assume you have images for each region like `regionNorth`, `regionSouth`, etc.
        this.regionImage.setTexture(imageKey);
        this.regionText.setText(`You selected ${region}`);
    }

    startBadlands() {
        // Save Latest Spirit Data
        if(this.playerData.id > 0){
        saveSpiritDataToDb(this.sheetUrl,this.playerData.id,this.playerData.spiritPoints, this.playerData.vitality, this.playerData.focus, this.playerData.adaptability)
        }
        console.log(this.selectedRegion)

        switch (this.selectedRegion){
            case 'North':
            this.selectedRegion = 1
            break
            case 'South':
            this.selectedRegion = 2
            break
            case 'East':
            this.selectedRegion = 3
            break
            case 'West':
            this.selectedRegion = 4
            break

        }
        // Assuming region data is passed into 'Badlands' scene
        //this.scene.start('Badlands', { region: this.selectedRegion, playerData: this.playerData });
        this.scene.start('LoadingScreen', {
            targetScene: 'Badlands',
            category: 'badlands',
            assets: [
                //{ type: 'image', key: 'terrain', path: 'assets/terrain.png' },
                //{ type: 'spritesheet', key: 'enemy', path: 'assets/enemy_spritesheet.png', frameConfig: { frameWidth: 64, frameHeight: 64 } }
            ],
            region: this.selectedRegion,
            playerData: this.playerData
        });
    }

    
}
