export default class Allies {
    constructor(scene) {
        this.scene = scene;
        this.allies = [];
    }

    addAlly(x, y) {
        const ally = this.scene.physics.add.sprite(x, y, 'allyImage'); // Load your ally image in preload
        this.allies.push(ally);
    }

    update() {
        // Update allies logic here
    }
}
