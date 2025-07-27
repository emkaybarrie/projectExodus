import { config } from "../config.js";

export default class Login extends Phaser.Scene {
  constructor() {
    super({ key: 'Login' });
    this.scriptId = 'AKfycbw1zakrf0zclJNWzBSXjIKTfudd6Q9-YHNq6EvP7JGQ4OrtPIs0SwrgJCsAyoB4Y5eu'
    this.sheetUrl = `https://script.google.com/macros/s/${this.scriptId}/exec`;
    this.isProcessing = false; // Track if a request is in progress

    this.statusText = null
    this.promptText1 = null
    this.promptText2 = null

    this.submitButton = null
  }

  init(data){
    this.imageKey = data.imageKey
    console.log(this.imageKey)
  }

  preload() {

  }

 


  create() {
    
    // Image and dynamic text
    const bg = this.add.image(0, 0, this.imageKey).setOrigin(0).setScale(1).setDisplaySize(config.width, config.height);
    

    // Right side: Input fields and button
    this.add.text(200, 160, 'Alias/Email', { fontSize: '16px', fill: '#fff', fontFamily: 'Arial' });
    this.aliasOrEmailInput = this.createInputBox(350, 220, false);

    this.add.text(200, 260, 'Password', { fontSize: '16px', fill: '#fff', fontFamily: 'Arial' });
    this.passwordInput = this.createInputBox(350, 320, true);

    this.loginButton = this.add.text(350, 400, 'Login', {
      fontSize: '20px',
      fill: '#fff',
      backgroundColor: '#171423',
      padding: { x: 20, y: 10 },
      fontFamily: 'Arial',
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.handleLogin(this.aliasOrEmailInput.text, this.passwordInput.text))
      .on('pointerover', () => this.highlightButton(this.loginButton, true)) // Highlight on hover
      .on('pointerout', () => this.highlightButton(this.loginButton, false)); // Remove highlight

    this.additionalInput = this.createInputBox(350, 550, false).setVisible(false);

    // Initially set emailInput as active
    this.activeInput = this.aliasOrEmailInput;
    this.setActiveInput(this.aliasOrEmailInput);


    // Keyboard input listener
    this.input.keyboard.on('keydown', (event) => this.handleKeyboardInput(event));
  }

  createInputBox(x, y, isPassword = false) {
    // Create a container for the input box
    const inputBox = this.add.rectangle(x, y, 300, 50, 0x222222, 0.8).setStrokeStyle(2, 0xffffff).setOrigin(0.5);
    const text = this.add.text(x - 140, y - 15, '', { fontSize: '18px', fill: '#fff', fontFamily: 'Arial' }).setOrigin(0);
  
    inputBox.text = ''; // Store the current input
    inputBox.isPassword = isPassword;
  
    // Enable clicking on the input box to activate it
    inputBox.setInteractive()
      .on('pointerdown', () => this.setActiveInput(inputBox))
      .on('pointerover', () => this.highlightInput(inputBox, true)) // Highlight on hover
      .on('pointerout', () => this.highlightInput(inputBox, false)); // Remove highlight
  
    // Add a blinking cursor
    inputBox.cursor = '|';
    const cursorBlink = this.time.addEvent({
      delay: 500,
      callback: () => {
        inputBox.cursor = inputBox.cursor === '|' ? '' : '|';
        if (this.activeInput === inputBox) {
          const displayText = inputBox.isPassword
            ? '*'.repeat(inputBox.text.length)
            : inputBox.text;
          text.setText(displayText + inputBox.cursor);
        }
      },
      loop: true,
    });
  
    inputBox.textObject = text; // Link the text object to the input box

    // Create and store the input field for triggering the virtual keyboard
    inputBox.inputField = document.createElement('input');
    inputBox.inputField.type = 'text';
    inputBox.inputField.style.position = 'absolute';
    inputBox.inputField.style.left = '-9999px'; // Hide offscreen
    document.body.appendChild(inputBox.inputField); // Add to the document

    // Focus input field when this input box is selected
    inputBox.setFocus = () => {
        inputBox.inputField.focus();
    };

    // Sync the value of the HTML input field with the active input box's text
    inputBox.inputField.addEventListener('input', (event) => {
      inputBox.text = inputBox.inputField.value;
    });

    // Blur the input field to close the virtual keyboard
    inputBox.blur = () => {
        inputBox.inputField.blur();
    };

    return inputBox;
  }

  highlightButton(button, highlight) {
    if (highlight) {
      button.setStyle({ fill: '#ffcc00', backgroundColor: '#0056b3' });
    } else {
      button.setStyle({ fill: '#fff', backgroundColor: '#171423' });
    }
  }

  highlightInput(inputBox, highlight) {
    if (highlight) {
      inputBox.setStrokeStyle(4, 0x00ff00); // Highlight input box
    } else {
      inputBox.setStrokeStyle(2, 0xffffff); // Reset input box style
    }
  }


  async handleLogin(aliasOrEmail, password) {

    if (this.isProcessing) return; // Prevent double submissions

    // Close the keyboard by blurring the active input field
    if (this.activeInput && this.activeInput.blur) {
      this.activeInput.blur();
    }

    this.clearMessages();
    this.isProcessing = true;    

    const inputAliasOrEmail = aliasOrEmail.trim();
    const inputPassword = password.trim();

    if (!inputAliasOrEmail || !inputPassword) {
      console.error("Alias/Email and Password are required.");
      this.showError("Alias/Email and Password are required.")
      this.isProcessing = false;  
      return;
    }

    // Show loading spinner and disable interactivity
    this.showLoadingIndicator("Logging in...");
    this.disableInteractivity();

    try {
      const response = await fetch(
        `${this.sheetUrl}?request=playerLogin&aliasOrEmail=${inputAliasOrEmail}&password=${inputPassword}`,{
          method: "POST",
        }
      );

      const result = await response.json();
      this.hideLoadingIndicator(); // Hide the loading indicator

      console.log(result)

      if (result.status === "success") {
        this.additionalInput.setVisible(false)
        // Player found and authenticated
        const { id, alias } = result.player;
        console.log(`Login successful! Player ID: ${id}, Alias: ${alias}`);
        console.log(result.player);
        this.scene.start("Base", { dataPacket: result.player});
      } else if (result.status === "error") {
        if (result.message === "Player not found") {
          // Alias or email not found, handle accordingly
          this.showError("Player not found. Please check your alias/email, or continue to account creation.");
          // // Optionally clear the alias/email input
          // this.aliasOrEmailInput.text = '';
          // this.setActiveInput(this.aliasOrEmailInput);

          this.promptAccountCreation(inputAliasOrEmail, inputPassword);
        } else if (result.message === "Incorrect password") {
          // Password incorrect, handle accordingly
          this.showError("Incorrect password. Please try again.");
          this.setActiveInput(this.additionalInput);
          this.additionalInput.text = '';
          // Optionally clear the password input
          this.passwordInput.text = '';
          this.setActiveInput(this.passwordInput);
          
        } else {
          console.error(result.message);
        }
      }
    } catch (error) {
      console.error("Error logging in:", error);
      this.showError("Login failed. Please try again.");
    }

    this.isProcessing = false;
}

  promptAccountCreation(aliasOrEmail, password) {
    const isEmail = aliasOrEmail.includes("@");
    console.log('Email entered: ' + isEmail)

   this.promptText1 = this.add.text(200, 450, `Account not found. Create one?`).setInteractive()
      .on('pointerover', () => {
        this.promptText1.setStyle({ fill: '#00ff00' }); // Change text color on hover
      })
      .on('pointerout', () => {
        this.promptText1.setStyle({ fill: '#fff' }); // Reset color when hover ends
      })
      .on('pointerdown', () => this.collectAdditionalInfo(aliasOrEmail, password, isEmail));
  }

  collectAdditionalInfo(aliasOrEmail, password, isEmail) {
    this.additionalInput.setVisible(true)
    this.setActiveInput(this.additionalInput);

    const promptText = isEmail ? "Enter Alias:" : "Enter Email:";
    this.promptText2 = this.add.text(200, 500, promptText);
    this.submitButton = this.add.text(350, 625, "Submit",{
      fontSize: '20px',
      fill: '#fff',
      backgroundColor: '#171423',
      padding: { x: 20, y: 10 },
      fontFamily: 'Arial',
    }).setOrigin(0.5)
      .setInteractive()
      .on('pointerover', () => this.highlightButton(this.submitButton, true))
      .on('pointerout', () => this.highlightButton(this.submitButton, false))

      this.submitButton.on('pointerdown', async () => {
      const alias = isEmail ? this.additionalInput.text.trim() : aliasOrEmail;
      const email = isEmail ? aliasOrEmail : this.additionalInput.text.trim();


      if (!alias || !email || !email.includes("@")) {
        console.error("Alias and Email are required for account creation.");
        this.showError("Alias, Password and Email are required for account creation.")
        return;
      }


      try {
        this.clearMessages();
        this.showLoadingIndicator("Creating account...");
          this.disableInteractivity();

        const response = await fetch(
          `${this.sheetUrl}?request=addPlayer&alias=${alias}&email=${email}&password=${password}`,{
            method: "POST",
          }
        );
      
        const result = await response.json();
        this.hideLoadingIndicator(); // Hide the loading indicator

        if (result.status === "success") {
          const { id, alias } = result.player;
          console.log(`Account created successfully! Player ID: ${id}, Alias: ${alias}`);
          this.scene.start("Base", { dataPacket: result.player} );
        } else {
          console.error(result.message);
        }
      } catch (error) {
        console.error("Error creating account:", error);
        this.showError("Account creation failed. Please try again.");
      }
    });
  }

  showLoadingIndicator(message) {
    this.statusText = this.add.text(config.width / 2, config.height / 2, message, {
      fontSize: '18px',
      fill: '#fff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);
    this.loadingSpinner = this.add.graphics();
    this.loadingSpinner.lineStyle(4, 0xffffff);
    this.loadingSpinner.arc(config.width / 2, config.height / 2 + 40, 30, 0, Math.PI * 2, false);
    this.loadingSpinner.strokePath();

    // Rotate the spinner continuously
    this.tweens.add({
      targets: this.loadingSpinner,
      angle: 360,
      duration: 1000,
      repeat: -1, // Repeat forever
    });
  }

  hideLoadingIndicator() {
    if (this.statusText) this.statusText.destroy();
    if (this.loadingSpinner) this.loadingSpinner.destroy();
  }

  disableInteractivity() {
    this.isProcessing = true;
    this.loginButton.setInteractive(false);
    this.aliasOrEmailInput.setInteractive(false);
    this.passwordInput.setInteractive(false);
    if (this.additionalInput) this.additionalInput.setInteractive(false);
  }

  enableInteractivity() {
    this.isProcessing = false;
    this.loginButton.setInteractive(true);
    this.aliasOrEmailInput.setInteractive(true);
    this.passwordInput.setInteractive(true);
    if (this.additionalInput) this.additionalInput.setInteractive(true);
  }

  showError(message) {
    this.clearMessages();
    this.statusText = this.add.text(config.width / 2, config.height / 2, message, {
      fontSize: '18px',
      //fill: '#f00',
      fill: '#fff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: this.statusText,
      alpha: { from: 0, to: 1 },
      duration: 500,
    });
  }

  clearMessages() {
    if (this.statusText) {
      this.statusText.destroy();
      this.statusText = null;
    }

  }



  setActiveInput(inputBox) {
    // If there was a previously active input box, reset its style
  if (this.activeInput && this.activeInput !== inputBox) {
    this.activeInput.setStrokeStyle(2, 0xffffff); // Reset previous input box style
    // Deactivate the previous active input
    if (this.activeInput.blur) {
      this.activeInput.blur();
    }
  }

  // Set the new active input and focus it
  this.activeInput = inputBox;
  this.activeInput.setFocus();

  // Set the stroke style to highlight the active input box
  this.activeInput.setStrokeStyle(4, 0x00ff00); // Highlight the active box

  // Ensure the active input box text is showing
  if (this.activeInput.isPassword) {
    const maskedText = '*'.repeat(this.activeInput.text.length);
    this.activeInput.textObject.setText(maskedText + this.activeInput.cursor);
  } else {
    this.activeInput.textObject.setText(this.activeInput.text + this.activeInput.cursor);
  }

    
  }


  handleKeyboardInput(event) {
    // Ensure we only handle input for the active input box
    if (!this.activeInput) return;
  
    const inputBox = this.activeInput;
  
    if (event.key === 'Backspace') {
      inputBox.text = inputBox.text.slice(0, -1); // Remove last character
    } else if (event.key.length === 1 && inputBox.text.length < 25) {
      inputBox.text += event.key; // Add typed character
  
      if (inputBox.isPassword) {
        // Temporarily show the last typed character
        const currentText = inputBox.text;
        inputBox.textObject.setText(currentText + inputBox.cursor);
  
        // Mask the character after a short delay
        this.time.delayedCall(750, () => {
          if (inputBox.text === currentText && this.activeInput === inputBox) {
            inputBox.textObject.setText('*'.repeat(inputBox.text.length) + inputBox.cursor);
          }
        });
      }
    }
  
    if (!inputBox.isPassword) {
      // Regular input field
      inputBox.textObject.setText(inputBox.text + inputBox.cursor);
    }
  }
  


  // Hash the password using SHA-256 and return the hashed result
// async hashPassword(password) {
//   // Convert password string to a Uint8Array
//   const encoder = new TextEncoder();
//   const data = encoder.encode(password);

//   // Hash the password using SHA-256
//   const hashBuffer = await crypto.subtle.digest('SHA-256', data);

//   // Convert the hash buffer into a hexadecimal string
//   const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert buffer to byte array
//   const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

//   return hashHex; // Return the hashed password as a hex string
// }

  // updateButtonState() {
  //   this.loginButton.setText(this.isNewAccount ? 'Create Account' : 'Login');
  // }

  // clearMessages() {
  //   if (this.errorText) {
  //     this.errorText.destroy();
  //     this.errorText = null;
  //   }
  //   if (this.welcomeText) {
  //     this.welcomeText.destroy();
  //     this.welcomeText = null;
  //   }

  //   if (this.newAccountText) {
  //     this.newAccountText.destroy();
  //     this.newAccountText = null;
  //   }
  // }

  // showError(message) {
  //   // Clear any existing error message
  //     // Clear existing messages
  //     this.clearMessages();

  //   const errorText = this.add.text(400, 500, message, {
  //     fontSize: '16px',
  //     fill: '#f00',
  //     fontFamily: 'Arial',
  //   }).setOrigin(0.5).setAlpha(0); // Start fully transparent
  
  //   // Fade in the error text
  //   this.tweens.add({
  //     targets: errorText,
  //     alpha: { from: 0, to: 1 },
  //     duration: 500, // 500ms fade-in duration
  //   });

  //   // Assign the new error text for future reference
  //   this.errorText = errorText;
  // }

  // showWelcomeMessage(alias) {
  //   // Clear existing messages
  //   this.clearMessages();

  //   const welcome = this.add.text(400, 500, `Welcome back, ${alias}!`, {
  //     fontSize: '16px',
  //     fill: '#0f0',
  //     fontFamily: 'Arial',
  //   }).setOrigin(0.5);
  //   this.tweens.add({
  //     targets: welcome,
  //     alpha: { from: 0, to: 1 },
  //     duration: 500,
  //   });

  //   this.welcomeText = welcome
  // }

  // showNewAccountMessage(alias) {
  //   // Clear existing messages
  //   this.clearMessages();

  //   const newAccount = this.add.text(400, 500, `Creating account for ${alias}...`, {
  //     fontSize: '16px',
  //     fill: '#0f0',
  //     fontFamily: 'Arial',
  //   }).setOrigin(0.5);
  //   this.tweens.add({
  //     targets: newAccount,
  //     alpha: { from: 0, to: 1 },
  //     duration: 500,
  //   });

  //   this.newAccountText = newAccount
  // }

  // updateDynamicText() {
  //   // Placeholder for dynamic text logic
  //   const randomTexts = ['Welcome to the Badlands!', 'Explore the unknown.', 'Ready for adventure?'];
  //   this.dynamicText.setText(randomTexts[Math.floor(Math.random() * randomTexts.length)]);
  // }
}
