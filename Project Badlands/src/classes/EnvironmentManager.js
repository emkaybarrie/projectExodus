export default class EnvironmentManager {
    constructor(scene) {
        // Initialize stage elements here
        this.scene = scene; // Reference to the Phaser scene
        this.stageConfig = this.scene.stageConfig;

        this.layers = [];   // Array to hold generated layers

        // Load Stage Background
        console.log("Loading Stage Background using following Stage Config:", this.stageConfig); // Log the configuration to the console
        this.loadBackgroundTextures(this.stageConfig.regionId, this.stageConfig.zoneId, this.stageConfig.sectorId, this.stageConfig.numberOfLayers, this.stageConfig.parallaxSpeeds);
    }

    // Backgrounds
    // Generate stage layers based on input parameters
    loadBackgroundTextures(regionId, zoneId, sectorId, numberOfLayers, parallaxSpeeds) {
        // Clear existing layers if any
        this.layers.forEach(layer => layer.destroy());
        this.layers = [];

        // Remove old textures to allow reloading
        for (let layerNumber = 1; layerNumber <= numberOfLayers; layerNumber++) {
            const textureKey = `stage_BGlayer_${layerNumber}`;
            if (this.scene.textures.exists(textureKey)) {
                this.scene.textures.remove(textureKey);
            }
        }

        // Calculate screen width and height to scale the images accordingly
        const { width, height } = this.scene.scale;

        // Loop through the number of layers to generate
        for (let layerNumber = 1; layerNumber <= numberOfLayers; layerNumber++) {
            // Construct the path to the image
            const layerPath = `assets/stages/region_${String(regionId).padStart(2, '0')}/zone_${String(zoneId).padStart(2, '0')}/sector_${String(sectorId).padStart(2, '0')}/stageBGs/BG_${String(layerNumber).padStart(2, '0')}.png`;

            // Load the image dynamically
            this.scene.load.image(`stage_BGlayer_${layerNumber}`, layerPath);
        }

        // Ensure assets are loaded, then add them to the scene
        this.scene.load.once('complete', () => {
            for (let layerNumber = numberOfLayers; layerNumber > 0; layerNumber--) {
                // Get the loaded texture
                const texture = this.scene.textures.get(`stage_BGlayer_${layerNumber}`);
                const textureWidth = texture.getSourceImage().width;
                const textureHeight = texture.getSourceImage().height;

                // Calculate scaling factors to cover the screen
                const scaleX = width / textureWidth;
                const scaleY = height / textureHeight;
                const scale = Math.max(scaleX, scaleY); // Ensures full coverage of the canvas

                // Create the tileSprite with the original dimensions
                const layer = this.scene.add.tileSprite(0, 0, textureWidth, textureHeight, `stage_BGlayer_${layerNumber}`);
                layer.setOrigin(0, 0);   // Set origin to top-left corner

                // Set the tileSprite to the correct scaling to fit the screen
                layer.setDisplaySize(width, height);  // Scale to screen size

                // Store each layer in the layers array for potential future reference
                this.layers.push(layer);
            }

            // Start the parallax effect
            this.initiateParallaxEffect(parallaxSpeeds);
        });

        // Start loading the assets
        this.scene.load.start();
    }

    // Parallax function to set varying speeds for each layer
    initiateParallaxEffect(parallaxSpeeds) {
        this.parallaxSpeeds = parallaxSpeeds.slice().reverse();

        // Remove any existing update event to prevent stacking listeners
        this.scene.events.off('update', this.manageEnvironment, this);


        // Register the update event for parallax scrolling
        this.scene.events.on('update', this.manageEnvironment, this);
    }

    // Update function for applying the parallax effect to each layer
    manageEnvironment() {
        this.layers.forEach((layer, index) => {
            const speedFactor = this.parallaxSpeeds[index] || 0; // Default to 0 if not provided
            layer.tilePositionX += this.scene.baseSpeed * speedFactor;
        });
    }

}

