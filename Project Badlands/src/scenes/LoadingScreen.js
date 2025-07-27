export default class LoadingScreen extends Phaser.Scene {
    constructor() {
        super('LoadingScreen');
    }

    init(data) {
        // Data passed from the calling scene
        this.targetScene = data.targetScene || 'Badlands';
        this.category = data.category || 'default';
        this.subCategory = data.subCategory || null; // Optional sub-category
        this.region = data.region || 1;
        this.playerData = data.playerData || null;
    }

    preload() {
        // Preload assets for the loading screen itself

            // Terrain

            // In your preload method
            // this.load.spritesheet('terrainTileset', 'assets/images/world_tileset.png', {
            //     frameWidth: 16,  // Width of each tile (in pixels)
            //     frameHeight: 16, // Height of each tile (in pixels)
            // });


            // Loot

            this.load.spritesheet('coin', 'assets/images/coin.png', { frameWidth: 16, frameHeight: 16 });
            //
            this.load.spritesheet('animation_MajorReward', 'assets/images/animation_MajorReward.png', { frameWidth: 128, frameHeight: 128 });
            //
            this.load.spritesheet('hitAnim_bow', 'assets/images/hitAnimation_bow.png', { frameWidth: 512, frameHeight: 512 });
            this.load.spritesheet('hitAnim_powerShot', 'assets/images/hitAnimation_powerShot.png', { frameWidth: 512, frameHeight: 512 });
            this.load.spritesheet('hitAnim_huntingHawk', 'assets/images/hitAnimation_huntingHawk.png', { frameWidth: 512, frameHeight: 512 });

            this.load.image('icon_crescentBarrage', 'assets/images/icon_crescentBarrage.png');
            this.load.image('icon_powerShot', 'assets/images/icon_powerShot.png');
            this.load.image('icon_huntingHawk', 'assets/images/icon_huntingHawk.png');
            this.load.image('icon_huntersStep', 'assets/images/icon_huntersStep.png');

            this.load.image('gold', 'assets/images/gold.png');
            this.load.image('dTerrainPlaceholder', 'assets/images/dTerrainPlaceholder.png');

    }

    create() {
        // Define libraries for different categories and subcategories
        const assetLibrary = {
            badlands: {
                default: [
                    { type: 'image', key: 'landmark_encounter', path: 'assets/images/badlands/landmark_encounter.png' },
                    { type: 'sound', key: 'backgroundMusic1', path: 'assets/music/placeholder_142.mp3' },
                    { type: 'sound', key: 'backgroundMusic2', path: 'assets/music/placeholder_BlameBrett.mp3' },
                    { type: 'sound', key: 'backgroundMusic3', path: 'assets/music/placeholder_Francesca.mp3' },
                    { type: 'sound', key: 'backgroundMusic4', path: 'assets/music/placeholder_FromEden.mp3' },
                    { type: 'sound', key: 'backgroundMusic5', path: 'assets/music/placeholder_KingsSeason.mp3' },
                    { type: 'sound', key: 'backgroundMusic6', path: 'assets/music/placeholder_Spartacus.mp3' },
                    { type: 'sound', key: 'backgroundMusic7', path: 'assets/music/placeholder_StayCrunchy.mp3' },
                    { type: 'sound', key: 'backgroundMusic8', path: 'assets/music/placeholder_XylemUp.mp3' },
                    { type: 'spritesheet', key: 'terrainTileset', path: 'assets/images/world_tileset.png', frameConfig: {frameWidth: 16,frameHeight: 16} },
                    //{ type: 'spritesheet', key: 'terrainTileset2', path: 'assets/images/ground_tileset.png', frameConfig: {frameWidth: 16,frameHeight: 16} },
                ],
                region1: [
                    { type: 'image', key: 'badlandsCactus', path: 'assets/images/badlands/cactus.png' },
                ],
            },
            forest: {
                default: [
                    { type: 'image', key: 'forestTree', path: 'assets/images/forest/tree.png' },
                    { type: 'image', key: 'forestBush', path: 'assets/images/forest/bush.png' },
                ],
                region2: [
                    { type: 'image', key: 'forestStream', path: 'assets/images/forest/stream.png' },
                ],
            },
            default: {
                default: [
                    { type: 'image', key: 'genericItem', path: 'assets/images/default/item.png' },
                ],
            },
        };

        // Choose assets to load based on category and subcategory
        const categoryAssets = assetLibrary[this.category]?.default || [];
        const subCategoryAssets = this.subCategory ? assetLibrary[this.category]?.[this.subCategory] || [] : [];
        this.assets = [...categoryAssets, ...subCategoryAssets];

        // Define libraries for different categories
        const imageLibrary = {
            badlands: ['titleScreen2b'],
            forest: ['forest1', 'forest2', 'forest3'],
            default: ['default1', 'default2', 'default3'],
        };

        const textLibrary = {
            badlands: ['Beware the barren lands...', 'Survive the wasteland.', 'Watch out for quicksand!'],
            forest: ['The forest is alive...', 'Stay quiet. They’re watching.', 'Beware of shadows.'],
            default: ['Loading...', 'Prepare yourself...', 'It’s about to begin.'],
        };

        const selectedImage = Phaser.Utils.Array.GetRandom(imageLibrary[this.category] || imageLibrary['default']);
        const selectedText = Phaser.Utils.Array.GetRandom(textLibrary[this.category] || textLibrary['default']);

        // Add and fade in the chosen image
        const image = this.add.image(this.scale.width / 2, this.scale.height / 2, selectedImage).setAlpha(0);
        image.setScale(Math.min(this.scale.width / image.width, this.scale.height / image.height));
        this.tweens.add({
            targets: image,
            alpha: 1,
            duration: 1000,
            ease: 'Power2',
        });

        // Add and fade in the chosen text
        const text = this.add.text(this.scale.width / 2, this.scale.height * 0.8, selectedText, {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
        })
            .setOrigin(0.5)
            .setAlpha(0);
        this.tweens.add({
            targets: text,
            alpha: 1,
            duration: 1000,
            ease: 'Power2',
        });

        // Delay loading by 1 second
        this.time.delayedCall(1000, () => {
            this.startLoading();
        });
    }

    startLoading() {
        const barWidth = this.scale.width * 0.6;
        const barHeight = 20;
        const barX = (this.scale.width - barWidth) / 2;
        const barY = this.scale.height * 0.9;

        const barBackground = this.add.graphics();
        barBackground.fillStyle(0x444444, 1); // Set the color and opacity of the background
        barBackground.fillRect(barX, barY, barWidth, barHeight); // Draw the background rectangle
        barBackground.setDepth(7); // Ensure it stays behind the loading bar

        const loadingBar = this.add.graphics();
        const fluidEffect = this.add.graphics();

        // Ensure the loading bar is on top
        loadingBar.setDepth(8);
        fluidEffect.setDepth(9);

        const drawBar = (progress) => {
            loadingBar.clear();
            fluidEffect.clear();

            loadingBar.fillStyle(0x222222, 1).fillRect(barX, barY, barWidth, barHeight);

            const progressWidth = barWidth * progress;
            loadingBar.fillStyle(0x800080, 1).fillRect(barX, barY, progressWidth, barHeight);

            const glowAlpha = Phaser.Math.Interpolation.Linear([0.2, 0.5, 1], progress);
            fluidEffect.fillStyle(0xe000ff, glowAlpha).fillCircle(barX + progressWidth, barY + barHeight / 2, 10 * progress);
        };

        this.load.on('progress', (value) => drawBar(value));

        this.load.on('complete', () => {
            drawBar(1);
            this.time.delayedCall(1000, () => {
                this.scene.start(this.targetScene, { region: this.region, playerData: this.playerData });
            });
        });

        // Load assets for the chosen category
        this.assets.forEach((asset) => {
            if (asset.type === 'image') {
                this.load.image(asset.key, asset.path);
            } else if (asset.type === 'spritesheet') {
                this.load.spritesheet(asset.key, asset.path, asset.frameConfig);
            } else if (asset.type === 'sound'){
                this.load.audio(asset.key, asset.path);
            }
        });

        this.time.delayedCall(1000, () => {
            if (this.load.totalToLoad > 0) {
                this.load.start();
            } else {
                let progress = 0;
                const timer = this.time.addEvent({
                    delay: 50,
                    callback: () => {
                        progress = Math.min(progress + 0.05, 1);
                        drawBar(progress);
                        if (progress >= 1) {
                            timer.remove();
                            this.scene.start(this.targetScene, { region: this.region, playerData: this.playerData });
                        }
                    },
                    loop: true,
                });
            }
        });
    }
}
