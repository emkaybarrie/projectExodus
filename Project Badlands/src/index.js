import { config } from './config.js';

import Start from './scenes/Start.js';
import Base from './scenes/Base.js';
import Badlands from './scenes/Badlands.js';
import MainMenu from './scenes/MainMenu.js';
import Login from './scenes/Login.js';
import LoadingScreen from './scenes/LoadingScreen.js';
import PauseScreen from './scenes/PauseScreen.js';
import BlessingsScreen from './scenes/BlessingsScreen.js';
import Sandbox from './scenes/Sandbox.js';

// Add scenes to the configuration

config.scene.push(Start);
config.scene.push(LoadingScreen)
config.scene.push(PauseScreen)
config.scene.push(BlessingsScreen)
config.scene.push(MainMenu)
config.scene.push(Login)
config.scene.push(Base);
config.scene.push(Badlands);
config.scene.push(Sandbox)


// Initialize the game
const game = new Phaser.Game(config);
