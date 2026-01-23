const preload = (scene) => {

    scene.input.mouse.disableContextMenu();
    // Load images
    scene.load.image('titleScreenText1', 'assets/images/titleScreens/titleText_01.png');
    scene.load.image('titleScreenText2', 'assets/images/titleScreens/titleText_02.png');
    scene.load.image('titleScreenText3', 'assets/images/titleScreens/titleText_03.png');
    scene.load.image('titleScreenText4', 'assets/images/titleScreens/titleText_04.png');
    scene.load.image('titleScreenText5', 'assets/images/titleScreens/titleText_05.png');
    scene.load.image('titleScreenText6', 'assets/images/titleScreens/titleText_06.png');

    scene.load.image('titleScreen1', 'assets/images/titleScreens/titleScreen_01.png');
    scene.load.image('titleScreen2a', 'assets/images/titleScreens/titleScreen_02aFixed1.png');
    scene.load.image('titleScreen2b', 'assets/images/titleScreens/titleScreen_02aFixed2.png');
    scene.load.image('titleScreen2c', 'assets/images/titleScreens/titleScreen_02bFixed.png');

    scene.load.image('prologue', 'assets/images/MainMenu/prologue.png');
    scene.load.image('story0', 'assets/images/MainMenu/story.png');
    scene.load.image('story1', 'assets/images/MainMenu/story_01.png');
    scene.load.image('story2', 'assets/images/MainMenu/story_02.png');
    scene.load.image('story3', 'assets/images/MainMenu/story_03.png');
    scene.load.image('story4', 'assets/images/MainMenu/story_04.png');
    scene.load.image('story5', 'assets/images/MainMenu/story_05.png');
    scene.load.image('story6', 'assets/images/MainMenu/story_06.png');
    scene.load.image('story7', 'assets/images/MainMenu/story_07.png');
    scene.load.image('story8', 'assets/images/MainMenu/story_08.png');
    scene.load.image('story9', 'assets/images/MainMenu/story_09.png');
    scene.load.image('story10', 'assets/images/MainMenu/story_10.png');
    scene.load.image('story11', 'assets/images/MainMenu/story_11.png');
    scene.load.image('story12', 'assets/images/MainMenu/story_12.png');
    scene.load.image('story13', 'assets/images/MainMenu/story_13.png');
    scene.load.image('story14', 'assets/images/MainMenu/story_14.png');
    scene.load.image('explore_1', 'assets/images/MainMenu/explore_01.png');

    scene.load.image('city', 'assets/images/Base/city.png');
    scene.load.image('regionNorth', 'assets/images/Base/regionNorth.png');
    scene.load.image('regionSouth', 'assets/images/Base/regionSouth.png');
    scene.load.image('regionEast', 'assets/images/Base/regionEast.png');
    scene.load.image('regionWest', 'assets/images/Base/regionWest.png');

    scene.load.image('avatarIcon1', 'assets/avatars/1/icons/avatarIcon_01.png')

    // Lyelle
    // Norelle

    // Music 
    //scene.load.audio('music_Hub', 'assets/music/hub.mp3')
    scene.load.audio('music_mainMenu', 'assets/music/mainMenu.mp3')
    //scene.load.audio('music_prologue', 'assets/music/prologue.mp3')

    //Stub

    scene.load.image('nightborne_archer_projectile', 'assets/enemies/region1/nightborne_archer_projectile.png')
    scene.load.image('avatar1_projectile', 'assets/avatars/1/animations/arrow.png')

    scene.load.image('majorRewardShrine', 'assets/majorRewardShrine_Processed.png')


};

export default preload;                                                                                
