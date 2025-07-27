export default class InputManager {
    constructor(scene) {
        this.scene = scene
        this.cursors = null;
        this.actionKey1 = null;
        this.actionKey2 = null;
        this.specialKey1 = null;
        this.specialKey2 = null;
        this.modeKey = null;
        this.gamepad = null;

        // Flags for mouse/touch
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        this.isSingleTap = false;
        this.isDoubleTap = false;

        this.lastTapTime = 0; // For detecting double-tap

        // Swipe properties
        this.swipeStart = null;
        this.swipeEnd = null;
        this.swipeDirection = null;
        this.swipeThreshold = 50; // Minimum distance for a swipe

        this.touchControls = {}; // Store touch control buttons here
        this.isMobile = Phaser.Input.Touch && this.scene.sys.game.device.input.touch;
        

    }

    setupControls() {
        // Set up arrow keys and space key
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        // Set up additional keys for attack and defend
        this.actionKey1 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.actionKey2 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.specialKey1 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.specialKey2 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);

        this.modeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

        // Set up gamepad controls (if needed)
        this.scene.input.gamepad.once('connected', (pad) => {
            this.gamepad = pad;
            console.log(this.gamepad)
        });

        // Mouse click listeners
        this.scene.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.isLeftMouseDown = true;
            }
            if (pointer.rightButtonDown()) {
                this.isRightMouseDown = true;
            }

            // Start tracking swipe
            this.swipeStart = { x: pointer.x, y: pointer.y };

            // Check for double-tap
            const currentTime = this.scene.time.now;
            if (currentTime - this.lastTapTime < 500) { // 300ms threshold for double-tap
                this.isDoubleTap = true;
            } else {
                this.isSingleTap = true;
            }
            this.lastTapTime = currentTime;
        });

        this.scene.input.on('pointerup', (pointer) => {
            if (pointer.leftButtonReleased()) {
                this.isLeftMouseDown = false;
            }
            if (pointer.rightButtonReleased()) {
                this.isRightMouseDown = false;
            }

            // Detect swipe direction
            if (this.swipeStart) {
                this.swipeEnd = { x: pointer.x, y: pointer.y };
                this.detectSwipe();
            }

            // Reset single-tap/double-tap flags after releasing
            this.isSingleTap = false;
            this.isDoubleTap = false;

            // Reset swipe data
            this.swipeStart = null;
            this.swipeEnd = null;
        });

        // Set up touch controls if on mobile
        if (this.isMobile) {
            //this.setupTouchControls();
        }
    }

    setupTouchControls() {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        const dPadRadius = Math.min(width, height) * 0.05; // Relative size
        const actionButtonRadius = Math.min(width, height) * 0.05;

        const dPadX = width * 0.15;
        const dPadY = height * 0.75;

        const actionX = width * 0.85;
        const actionY = height * 0.7;

        // Create directional buttons
        this.touchControls.up = this.createCircleButton(dPadX, dPadY - dPadRadius * 1.5, dPadRadius, 'up');
        this.touchControls.down = this.createCircleButton(dPadX, dPadY + dPadRadius * 1.5, dPadRadius, 'down');
        this.touchControls.left = this.createCircleButton(dPadX - dPadRadius * 1.5, dPadY, dPadRadius, 'left');
        this.touchControls.right = this.createCircleButton(dPadX + dPadRadius * 1.5, dPadY, dPadRadius, 'right');

        // Create action buttons
        this.touchControls.action1 = this.createCircleButton(actionX + actionButtonRadius * 1.5, actionY, actionButtonRadius, 'A');
        this.touchControls.action2 = this.createCircleButton(actionX - actionButtonRadius * 1.5, actionY, actionButtonRadius, 'B');
        this.touchControls.special1 = this.createCircleButton(actionX, actionY - actionButtonRadius * 1.5, actionButtonRadius, 'X');
        this.touchControls.special2 = this.createCircleButton(actionX, actionY + actionButtonRadius * 1.5, actionButtonRadius, 'Y');
    }

    createCircleButton(x, y, radius, label) {
        const button = this.scene.add.circle(x, y, radius, 0x000000, 0.5).setInteractive().setDepth(9);
        const text = this.scene.add.text(x, y, label, {
            fontSize: `${radius}px`,
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(9);

        // Highlight effect
        button.on('pointerdown', () => {
            this.updateControls(label, true);
            button.setFillStyle(0xffffff, 1);
            text.setColor('#000000');
        });

        button.on('pointerup', () => {
            this.updateControls(label, false);
            button.setFillStyle(0x000000, 0.5);
            text.setColor('#ffffff');
        });

        button.on('pointerout', () => {
            this.updateControls(label, false);
            button.setFillStyle(0x000000, 0.5);
            text.setColor('#ffffff');
        });

        return { button, text }; // Group button and text
    }

    updateControls(label, isActive) {
        switch (label) {
            case 'up': this.cursors.up = { isDown: isActive }; break;
            case 'down': this.cursors.down = { isDown: isActive }; break;
            case 'left': this.cursors.left = { isDown: isActive }; break;
            case 'right': this.cursors.right = { isDown: isActive }; break;
            case 'A': this.actionKey1 = { isDown: isActive }; break;
            case 'B': this.actionKey2 = { isDown: isActive }; break;
            case 'X': this.specialKey1 = { isDown: isActive }; break;
            case 'Y': this.specialKey2 = { isDown: isActive }; break;
        }
    }

    hideTouchControls() {
        if (this.isMobile) {
            Object.values(this.touchControls).forEach(({ button, text }) => {
                button.setVisible(false);
                text.setVisible(false);
            });
        }
    }

    detectSwipe() {
        if (!this.swipeStart || !this.swipeEnd) return;

        const deltaX = this.swipeEnd.x - this.swipeStart.x;
        const deltaY = this.swipeEnd.y - this.swipeStart.y;

        if (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                this.swipeDirection = deltaX > 0 ? 'right' : 'left';
            } else {
                // Vertical swipe
                this.swipeDirection = deltaY > 0 ? 'down' : 'up';
            }
        } else {
            this.swipeDirection = null; // Not a valid swipe
        }
    }

    update() {



        const controls = {
            left: this.cursors && this.cursors.left.isDown,
            right: this.cursors && this.cursors.right.isDown,
            up: this.cursors && this.cursors.up.isDown,
            down: this.cursors && this.cursors.down.isDown,
            jump: this.cursors && this.cursors.space.isDown,
            action1: this.actionKey1 && this.actionKey1.isDown, // Check for A key attack
            action2: this.actionKey2 && this.actionKey2.isDown, // Check for A key attack
            special1: this.specialKey1 && this.specialKey1.isDown, // Check for A key attack
            special2: this.specialKey2 && this.specialKey2.isDown, // Check for W key attack
            mode: this.modeKey && Phaser.Input.Keyboard.JustDown(this.modeKey),

            // Swipe-based actions
            swipeUp: this.swipeDirection === 'up',
            swipeDown: this.swipeDirection === 'down',
            swipeLeft: this.swipeDirection === 'left',
            swipeRight: this.swipeDirection === 'right'
        };

        // Mouse/Touch controls
        if(!this.isMobile){
            controls.jump = controls.jump || this.isSingleTap || this.isLeftMouseDown 
            controls.action2 = controls.action2 || this.isDoubleTap || this.isRightMouseDown
        }
         
        // Handle gamepad controls if connected
        if (this.gamepad) {
            // Joystick for movement
            const leftStickX = this.gamepad.axes[0] ? this.gamepad.axes[0].getValue() : 0;
            const leftStickY = this.gamepad.axes[1] ? this.gamepad.axes[1].getValue() : 0;

            controls.left = leftStickX < -0.5; // Tilt joystick left
            controls.right = leftStickX > 0.5; // Tilt joystick right
            controls.up = leftStickY < -0.85; // Tilt joystick up
            controls.down = leftStickY > 0.85; // Tilt joystick down

            // Buttons for actions
            controls.jump = this.gamepad.buttons[0] && this.gamepad.buttons[0].pressed; // A button
            controls.action1 = this.gamepad.buttons[5] && this.gamepad.buttons[5].pressed; // Right bumper
            controls.action2 = this.gamepad.buttons[4] && this.gamepad.buttons[4].pressed; // Left bumper
            controls.special1 = this.gamepad.buttons[7] && this.gamepad.buttons[7].pressed; // Right trigger
            controls.special2 = this.gamepad.buttons[6] && this.gamepad.buttons[6].pressed; // Left trigger

            
        }

        // Reset swipe direction after processing
        this.swipeDirection = null;

        return controls;
    }
}
