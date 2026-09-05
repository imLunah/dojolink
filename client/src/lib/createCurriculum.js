// The CREATE core learning path, transcribed from the official Code Ninjas
// IMPACT wall posters (the printed series a centre hangs on its wall: posters
// 1-5, White through Black). It is the same curriculum the belt road walks,
// which is why the level counts here match `BELT_LEVEL_PROJECTS` exactly:
// White 4, Yellow 4, Orange 5, Green 5, Blue 6, Purple 6, Brown 10, Red 2,
// Black 1.
//
// What each field is, in the language the posters use:
//   topic    the level's real name ("Loops!", "Nested Block Statements!").
//            The app used to derive a name from the last project in the level,
//            which produced things like "Index and while loops" — close, and
//            never quite what the poster says.
//   sets     a level is taught in BUILD -> EXPLORE -> SOLVE sets: a guided
//            project, the concept it teaches, then a debugging challenge on
//            that concept. `about` is the poster's own description of the set.
//   quest    the Quest & Adventure: the open build at the end of the level
//            where the ninja makes their own version of it.
//   mastery  belts that close a pair end with a Mastery Mission combining
//            everything so far. White, Orange, Blue and Brown have none.
//   language White through Green is block-based MakeCode Arcade; Blue onward
//            is JavaScript. Red is two multi-week games, Black is a capstone.
//
// This is REFERENCE TEXT, not progress. Nothing here knows what a ninja has
// done; it is the description beside whatever `parentProgress` works out.
export const CREATE_CURRICULUM = {
  White: {
    language: "Blocks",
    levels: {
      1: {
        topic: "Computer Science!",
        quest: "Create your own project with a background color, splash screen, sprite, sound effect, and screen effect!",
        sets: [
          { build: "Your First Sprite", explore: "Moving Sprites Around", solve: "Debugging Our First Bugs!", about: "Create your first coding project! Set the background color, add 1 sprite, position it on screen, and then make it say something!" },
          { build: "Spooky Effects", explore: "Project Customizations", solve: "Debugging More Bugs!", about: "Learn about new blocks that will make a project more creative! Use a splash screen, add a sound, and change the sprite image!" },
        ],
      },
      2: {
        topic: "Sequence!",
        quest: "Create your own project with sprites and dialog boxes in the proper sequence!",
        sets: [
          { build: "Meet New Friends!", explore: "Naming Sprites", solve: "Debugging Sequence #1", about: "Add some new friends to this project! Create 2 sprites, position them on screen, then make them both say something and play a sound!" },
          { build: "Where's My Puppy?", explore: "Sequencing Blocks", solve: "Debugging Sequence #2", about: "Create a simple story! Use dialog boxes and 2 sprites to tell a \"lost and found\" story." },
        ],
      },
      3: {
        topic: "Events!",
        quest: "Create your own project with a sprite that moves and other sprites sequenced to appear in the correct order.",
        sets: [
          { build: "Fly Me to the Moon!", explore: "Moving Sprites with the Direction Buttons", solve: "Debugging Sprite Movement", about: "Make a sprite move with the direction buttons on the controller. Then, learn how to keep the sprite from going off screen! Use a background image in the project, too." },
          { build: "Dinner Time!", explore: "Sprite Layers", solve: "Debugging Sprite Layers", about: "Set the table for dinner! Position sprites so they appear in the correct order on screen and move in front of or behind other sprites." },
        ],
      },
      4: {
        topic: "Functions and Parameters!",
        quest: "Create your own project where things happen when a Player sprite overlaps with different sprite kinds.",
        sets: [
          { build: "A Piece of Cake", explore: "Overlapping Sprite Functions", solve: "Debugging Overlap Blocks", about: "Learn how to make something happen when two sprites overlap!" },
          { build: "Underwater Food Chain", explore: "Sprite Kinds and Parameters", solve: "Debugging Sprite Kinds and Parameters", about: "Time for an adventure under the sea! Create a game with 3 different sprite kinds, where you move a Player sprite to overlap a Goal sprite, while avoiding the Enemy sprite." },
        ],
      },
    },
  },
  Yellow: {
    language: "Blocks",
    mastery: "Create a project with all of the awesome skills you have learned throughout White and Yellow Belt!",
    levels: {
      1: {
        topic: "Variables!",
        quest: "Create your own project where variables change when a Player sprite overlaps other sprites!",
        sets: [
          { build: "The Mushroom and the Munchy Munchy Monkey", explore: "Life and Countdown Variables", solve: "Debugging Life and Countdown Variables", about: "Create a game where the Player sprite must keep away from an Enemy sprite to not lose lives. Win by staying away from the Enemy sprite until the timer runs out." },
          { build: "Pearl Collector", explore: "Score and Countdown Variables", solve: "Debugging Life and Score Variables", about: "Create a game in which points increase as the Player sprite \"collects\" as many Food sprites as possible while staying away from the Enemy sprite!" },
        ],
      },
      2: {
        topic: "Loops!",
        quest: "Create your own project with a Player sprite that launches projectiles towards other sprite kinds!",
        sets: [
          { build: "Avoid the Asteroids!", explore: "Game Update Loops and Random Numbers", solve: "Debugging Loops, Velocity, and Randomness!", about: "Create a game with lots of Enemy sprites that keep appearing with the help of a loop! Win by staying away from the Enemy sprites until the timer runs out." },
          { build: "Space Adventure", explore: "Sprite Velocity", solve: "Debugging Projectiles", about: "Create a game where the points variable increases as the Player sprite destroys as many Enemy sprites as possible using projectiles!" },
        ],
      },
      3: {
        topic: "Conditionals!",
        quest: "Create your own project with a Player sprite that must avoid or collect Projectiles that change based on a percent chance.",
        sets: [
          { build: "The Wizard's Mystic Toadstools", explore: "If/Then Conditionals", solve: "Debugging If/Then Conditionals", about: "Create a game where the Player has to collect Food projectiles while avoiding Enemy projectiles. Win the game by collecting enough Food projectiles!" },
          { build: "Unlock the Hidden Treasure!", explore: "If/Then/Else Conditionals", solve: "Debugging If/Then/Else Conditionals", about: "Create a game where the Player has to open as many treasure chests as they can before the time runs out. Collect points only if the treasure chest is full!" },
        ],
      },
      4: {
        topic: "Animations and Music",
        sets: [
          { build: "Animated Aquarium", explore: "Sprite Animation", solve: "Debugging Animations", about: "Create a project that animates sprites in two different ways!" },
          { build: "Musical Mayhem", explore: "Melody Blocks", solve: "Debugging Music Blocks", about: "Create a project that uses music and conditionals to enhance the game experience!" },
        ],
      },
    },
  },
  Orange: {
    language: "Blocks",
    levels: {
      1: {
        topic: "Tilemaps!",
        quest: "Create a project where you use sprite interactions with sprite kinds and a custom tilemap!",
        sets: [
          { build: "Avoid the Snakes!", explore: "Tilemaps and Walls", solve: "Debugging Tilemaps" },
          { build: "Carrot Chase", explore: "Large-Scale Tilemaps", solve: "Debugging Walls and Tiles in Tilemaps" },
        ],
      },
      2: {
        topic: "Tilemap and Lifecycle Events!",
        quest: "Create a tilemap project where a Player sprite must avoid hazard tiles and use powerup tiles to earn more time to reach the goal tile!",
        sets: [
          { build: "The Key to the Castle", explore: "Tilemap Overlap Events", solve: "Debugging Tilemap Overlap Events", about: "Create a project that uses a tilemap and makes something happen when a sprite overlaps different tiles!" },
          { build: "Coin Grabber!", explore: "Lifecycle Events", solve: "Debugging Lifecycle Events", about: "Create a project that uses tilemap and lifecycle events to code a collectible sprite that disappears if the Player does not reach it in time!" },
        ],
      },
      3: {
        topic: "Variables and Arrays!",
        quest: "Create a tilemap project that uses arrays and variables to store and display user input!",
        sets: [
          { build: "All About Me", explore: "Variables and Strings", solve: "Debugging Variables and Strings", about: "Create a project that uses variables and user input to share fun facts about the user!" },
          { build: "Welcome to the Farm", explore: "Image Arrays", solve: "Debugging Image Arrays", about: "Build a project that uses arrays to randomly place animals on the farm!" },
          { build: "Mad Libs", explore: "Text Arrays", solve: "Debugging Text Arrays" },
        ],
      },
      4: {
        topic: "Repeat and For Element Of Loops!",
        quest: "Create a tilemap project that makes something happen to every element in an array!",
        sets: [
          { build: "Memory Game", explore: "Repeat Loops", solve: "Debugging Repeat Loops", about: "Create a project that uses repeat loops and conditionals to test a game player's memory!" },
          { build: "Archeological Dig", explore: "For Element Of Loops", solve: "Debugging For Element Loops", about: "Create a project that uses a for loop to give hints about hidden sprites' locations on a tilemap!" },
        ],
      },
      5: {
        topic: "Functions and Parameters!",
        quest: "Create a tilemap project that uses functions with and without parameters to make different things happen across 2 levels!",
        sets: [
          { build: "Cookie Clicker Game!", explore: "Functions", solve: "Debugging Functions", about: "Create a project that uses a function to set and destroy Food sprites, when a certain button is pressed." },
          { build: "Snowflake Catch", explore: "Functions with Parameters", solve: "Debugging Functions with Parameters", about: "Create a project that uses functions with a parameter to set different levels in a game." },
        ],
      },
    },
  },
  Green: {
    language: "Blocks",
    mastery: "Create a project with all of the awesome skills you have learned throughout Orange and Green Belt!",
    levels: {
      1: {
        topic: "2D Tilemaps and Physics!",
        quest: "Create a 2D platformer project that uses physics and loops to control a sprite's movement!",
        sets: [
          { build: "Cactus Jump", explore: "Acceleration and Velocity", solve: "Debugging 2D Tilemaps", about: "Create a platformer project with a 2D tilemap that requires a Player to jump over obstacles!" },
          { build: "Avoid the Roadblocks", explore: "Spawning Sprites", solve: "Debugging 2D Tilemap Designs", about: "Create a 2D platformer project where the Player sprite moves horizontally across the screen, while jumping over obstacles." },
          { build: "The Floor is Lava!", explore: "2D Tilemaps", solve: "Debugging Acceleration and Velocity", about: "Create a 2D platformer project where a Player sprite must jump up onto platforms to avoid lava tiles and collect stars to open a secret portal door!" },
        ],
      },
      2: {
        topic: "Conditionals and Boolean Statements!",
        quest: "Create a 2D platformer tilemap project where something happens if specific or multiple conditions are true!",
        sets: [
          { build: "Magic Coin Scavenger Hunt", explore: "AND Booleans", solve: "Debugging AND Booleans", about: "Create a platformer project with a 2D tilemap that uses logic operators to uncover hidden sprites!" },
          { build: "Raindrop Invincibility", explore: "NOT Booleans", solve: "Debugging NOT Booleans", about: "Create a 2D platformer project that uses Booleans to make different things happen when sprites overlap!" },
          { build: "Snake Pit!", explore: "OR Booleans", solve: "Debugging OR Booleans", about: "Create a 2D platformer project where a Player sprite must either collect coins or jump on top of snakes to destroy them in order to win!" },
        ],
      },
      3: {
        topic: "Nested Loops!",
        quest: "Create a project that uses loops to place sprites on a tilemap and control the number of sprites appearing on a tilemap!",
        sets: [
          { build: "Bubble Pop!", explore: "For Index Loops", solve: "Debugging For Index Loops", about: "Create a project that uses a nested [for index] loop to create multiple rows of sprites." },
          { build: "Bee Catcher", explore: "While Loops", solve: "Debugging While Loops", about: "Create a project that uses a while loop to add new Enemy sprites while a specific condition is true." },
        ],
      },
      4: {
        topic: "Tilemap Location and Extension Code!",
        quest: "Create a project that switches tilemaps and the user's perspective when different events occur!",
        sets: [
          { build: "Block Jumper", explore: "Tilemap Location Blocks", solve: "Debugging Tilemap Location Blocks", about: "Create a project that uses tilemap location blocks to create wall tiles underneath the Player sprite as it jumps in the air." },
          { build: "Bridge Builder", explore: "Tilemap Location Blocks and Operators", solve: "Debugging Tilemap Location Blocks and Operators", about: "Create a project that uses tilemap location blocks to create a set number of tiles at different locations!" },
          { build: "Dino Defender", explore: "Tilemap Extension Blocks", solve: "Debugging Tilemap Extension Blocks", about: "Create a project that uses tilemap extension blocks to switch between a top down tilemap and a 2D Platformer tilemap." },
        ],
      },
      5: {
        topic: "Scrolling Background and Status Bar Extensions",
        sets: [
          { build: "Scenic Drive", explore: "Scroller Extension Blocks", solve: "Debugging Scroller Extension Blocks", about: "Create a project that uses Scroller extension blocks to create a scrolling background behind the Player sprite as it moves on the tilemap." },
          { build: "Burger Dash", explore: "Status Bar Extension Blocks", solve: "Debugging Status Bar Extension Blocks", about: "Create a project that uses status bar extension blocks to change the Hunger level of sprites by sending projectiles toward them." },
        ],
      },
    },
  },
  Blue: {
    language: "JavaScript",
    levels: {
      1: {
        topic: "JavaScript Syntax!",
        quest: "Create a 2 sprite project in JavaScript!",
        sets: [
          { build: "hello world!", explore: "Setting Sprites", solve: "Debugging Setting Sprites", about: "Create your first project in JavaScript! Set a background image, add 1 sprite, position it on screen, then make it say something!" },
          { build: "Bouncing on the Walls", explore: "Moving Sprites", solve: "Debugging Sprite Effects", about: "Create a project in JavaScript where a sprite bounces around the walls of the screen!" },
          { build: "Follow Me!", explore: "Sprite Movements", solve: "Debugging Sprite Movement", about: "Create a project in JavaScript that places two sprites on the screen and programs them to move in different ways!" },
        ],
      },
      2: {
        topic: "Properties and Code Comments!",
        quest: "Create a multi-scene project in JavaScript!",
        sets: [
          { build: "Greeting Card", explore: "Properties and Text Parameters", solve: "Debugging Properties and Text Parameters" },
          { build: "Show Time!", explore: "Effect Parameters and Sequencing", solve: "Debugging Effect Parameters and Sequencing" },
          { build: "Seasons Change", explore: "Dialog Boxes, Sounds, and Code Comments", solve: "Debugging Code Comments and Dialog Boxes" },
        ],
      },
      3: {
        topic: "Block Statements!",
        quest: "Create a project in JavaScript with projectiles controlled by events and loops!",
        sets: [
          { build: "Screen Saver", explore: "Block Statements and Loops", solve: "Debugging Block Statements and Loops", about: "Create a screen saver project in JavaScript that uses projectiles inside the block statement of a loop to create an ongoing scene!" },
          { build: "Button Clicker!", explore: "Block Statements and Events", solve: "Debugging Block Statements and Events", about: "Create a clicker game project in JavaScript that uses block statements with events that control the A button!" },
          { build: "Two Sprite Showdown!", explore: "Screen Positions and Multiplayer Score", solve: "Debugging Screen Positions and Multiplayer Score", about: "Create a timed clicker game project in JavaScript that uses block statements with events and loops to fill the screen with two different sprites." },
        ],
      },
      4: {
        topic: "Nested Block Statements!",
        quest: "Create a project in JavaScript with conditional statements inside events and loops!",
        sets: [
          { build: "Save the Crab!", explore: "Nested Block Statements and If Conditionals", solve: "Debugging Nested Block Statements and If Conditionals", about: "Create a project in JavaScript that uses conditionals and nested block statements." },
          { build: "Going Bananas!", explore: "Nested Block Statements and If/Else Conditionals", solve: "Debugging Nested Block Statements and If/Else Conditionals", about: "Create a project in JavaScript that uses conditionals and nested block statements to have the user collect items and increase their score." },
          { build: "Grab Bag!", explore: "Nested Block Statements and If/Else If/Else Conditionals", solve: "Debugging Nested Block Statements and If/Else If/Else Conditionals", about: "Create a project in JavaScript that uses conditionals and nested block statements to randomize what present the user receives!" },
        ],
      },
      5: {
        topic: "Assignment and Equality Operators!",
        quest: "Create a project in JavaScript that uses number and Boolean variables and equality and assignment operators!",
        sets: [
          { build: "Shop 'Til You Drop", explore: "Variables, Concatenation, and Assignment Operators", solve: "Debugging Variables, Concatenation, and Assignment Operators", about: "Create a project in JavaScript that uses assignment, equality, and relational operators to track money spent and calculate how much remains." },
          { build: "Cookie Stacker", explore: "Assignment and Equality Operators", solve: "Debugging Variables, Equality Operators, and Math Operators", about: "Create a project in JavaScript that uses assignment, equality, and math operators to create and change variables, in order to calculate the number of cookies stacked on the screen." },
        ],
      },
      6: {
        topic: "Boolean and Relational Operators!",
        quest: "Create a project in JavaScript that uses Boolean AND and OR operators to create different outcomes in a project!",
        sets: [
          { build: "Shooting Hoops!", explore: "Boolean AND Operators and Relational Operators", solve: "Debugging Boolean AND Operators and Relational Operators", about: "Create a project in JavaScript that uses Boolean operators to throw a basketball towards the hoop when the player overlaps the ball and presses the A button." },
          { build: "Guess the Number!", explore: "Boolean OR Operators", solve: "Debugging Boolean OR Operators", about: "Create a project in JavaScript that uses Boolean operators to prompt players to guess one of the secret numbers in a game that increases in challenge with each win." },
        ],
      },
    },
  },
  Purple: {
    language: "JavaScript",
    mastery: "Create a project with all of the awesome skills you have learned throughout Blue and Purple Belt!",
    levels: {
      1: {
        topic: "Namespaces!",
        quest: "Create your own project in JavaScript that uses new sprite kinds and sprite kind events!",
        sets: [
          { build: "Collect the Honey!", explore: "Sprite Kinds and Overlap Events", solve: "Debugging Sprite Kinds and Overlap Events", about: "Create a project that uses sprite overlap events to make something happen when the Player sprite overlaps with different sprite kinds." },
          { build: "Snowball Fight!", explore: "Sprite Kinds and Overlap Events", solve: "Debugging Sprite Kinds and Projectiles", about: "Create a project that uses unique sprite kinds to make something happen when different types of sprites overlap." },
          { build: "Asteroid Attack!", explore: "Sprite Kinds and onCreated Events", solve: "Debugging Sprite Kinds and onCreated Events", about: "Create a project that uses unique sprite kinds to make things happen using sprite overlap and lifecycle events." },
        ],
      },
      2: {
        topic: "For Loops!",
        quest: "Create a project in JavaScript that uses for loops to make something happen, such as creating a grid of sprites on screen!",
        sets: [
          { build: "Fireflies Collector", explore: "For Loops", solve: "Debugging For Loops", about: "Create a project that uses a for loop to create multiple sprites at once!" },
          { build: "Counting Sprites", explore: "Incrementing and Decrementing For Loops", solve: "Debugging Incrementing and Decrementing For Loops", about: "Create a project that uses for loops to give the user a set number of chances to guess the number of sprites on screen." },
          { build: "Mystery Boxes!", explore: "Nested For Loops and Increment Operators", solve: "Debugging Nested For Loops and Increment Operators", about: "Create a project that uses nested for loops to create a grid of sprites!" },
        ],
      },
      3: {
        topic: "Arrays!",
        quest: "Create a project in JavaScript that uses multiple arrays that each store and modify different types of data: strings, image variables, or sprites!",
        sets: [
          { build: "Magic 8 Ball", explore: "Arrays", solve: "Debugging Arrays", about: "Create a project that uses arrays to randomize how a sprite responds to a user's question!" },
          { build: "What's in a Name?", explore: "Empty Arrays and Array Functions", solve: "Debugging Empty Arrays", about: "Create a project that adds user-provided strings to an empty array." },
          { build: "Concentration", explore: "Array Indices and For Element Of Loops", solve: "Debugging Array Indices and For Element Of Loops", about: "Create a project that uses the index of elements in an array to trigger different things to happen." },
        ],
      },
      4: {
        topic: "Array Functions!",
        quest: "Create your own project in JavaScript that uses nested arrays and array functions!",
        sets: [
          { build: "Match Game", explore: "Array Index Values", solve: "Debugging Array Index Values", about: "Create a project that uses arrays to randomly generate 3 images then check for a match!" },
          { build: "Username Generator", explore: "Nested Arrays", solve: "Debugging Nested Arrays", about: "Create a project that uses user input and nested arrays to generate username suggestions." },
          { build: "Memory Match", explore: "Array Functions", solve: "Debugging Array Functions", about: "Create a project that uses index values and empty arrays to create a color matching game!" },
        ],
      },
      5: {
        topic: "Functions!",
        quest: "Create a project in JavaScript that uses functions to change levels and spawn sprites!",
        sets: [
          { build: "Pizza Party", explore: "Functions with Parameters", solve: "Debugging Functions with Parameters", about: "Create a project that uses functions to create a pizza based on user input." },
          { build: "Barn Breakout!", explore: "Refactoring and Function Scope", solve: "Debugging Multiple Functions", about: "Create a multi-level project that uses functions to run code each time a level is changed." },
          { build: "Damage Control", explore: "Function Documentation and Calling Functions", solve: "Debugging Functions with Multiple Parameters", about: "Create a project that uses functions to spawn moving sprites." },
        ],
      },
      6: {
        topic: "Advanced Animations, Music, and Extensions",
        sets: [
          { build: "Escape the Haunted Castle!", explore: "Animation and Music", solve: "Debugging Animation and Music", about: "Create a project that uses image and movement animation to code sprites to move in different ways on screen. Create a unique melody for the project, too!" },
          { build: "City Scroller", explore: "Scroller Extension", solve: "Debugging the Scroller Extension", about: "Create a project that uses the Scroller extension to create a background of different layers, which move at different speeds across the screen." },
          { build: "Find the Ninja!", explore: "Story Extension", solve: "Debugging the Story Extension", about: "Create a project that uses the Story extension to offer different choices to the user and create different outcomes depending on their choice!" },
        ],
      },
    },
  },
  Brown: {
    language: "JavaScript",
    mastery: "Create a project with all of the awesome skills you have learned throughout Brown Belt!",
    levels: {
      1: {
        topic: "Asset Management!",
        quest: "Create a tilemap project with multiple Enemy sprites that block a Player sprite from a Goal sprite.",
        sets: [
          { build: "The Bookcase", explore: "Tilemap Assets", solve: "Debugging Assets and Tilemaps", about: "Create a project that uses a tilemap and sets sprite locations using tilemap coordinates!" },
          { build: "Shark Attack", explore: "Spawn Tiles and Camera Functions", solve: "Debugging Tilemap Location and Camera Functions", about: "Create a project that places different sprites on random tiles of a tilemap." },
        ],
      },
      2: {
        topic: "Using Assets in Code",
        quest: "Create a project that switches between 2 tilemaps when the Player sprite overlaps specific tiles, with obstacle wall tiles that block a Player sprite from getting to an exit tile.",
        sets: [
          { build: "Two Worlds", explore: "Tile Overlap Events", solve: "Debugging Tile Overlap Events", about: "Create a project that switches the tilemap when a sprite overlaps a certain tile." },
          { build: "Avoid the Haystacks!", explore: "Tilemap Wall Events", solve: "Debugging Tilemap Walls", about: "Create a project that uses tilemap overlap events to make something happen when a sprite overlaps different types of wall tiles!" },
        ],
      },
      3: {
        topic: "Controlling Conditions with Boolean Variables",
        quest: "Create a project with a sprite that can move in 4 different ways to avoid obstacles along a 2D platformer tilemap.",
        sets: [
          { build: "Dust Mite Adventure", explore: "2D Tilemap Movement", solve: "Debugging 2D Tilemap Movement" },
          { build: "Gravity Jumper", explore: "Sprite Movement with Functions", solve: "Debugging Sprite Movement with Functions" },
          { build: "Salmon Catch", explore: "Tile Overlaps and While Loops", solve: "Debugging Tile Overlaps and While Loops" },
        ],
      },
      4: {
        topic: "Modifying Image Assets",
        quest: "Create a project with a sprite that \"walks\" through different scenes that use customized assets.",
        sets: [
          { build: "A Walk through the Seasons", explore: "Image Editing and Scrolling Backgrounds", solve: "Debugging Customized Assets and the Scroller Extension", about: "Modify background image assets from the gallery, and use the Scroller extension to create a project where a sprite \"walks\" through 4 scenes!" },
          { build: "A Change of Scenery", explore: "Image Modification and Cycling Through Assets", solve: "Debugging Cycling through Assets", about: "Customize an existing sprite image, background image, and tile assets to create a project with 4 unique scenes!" },
        ],
      },
      5: {
        topic: "Pixel Art Strategies",
        quest: "Create a matching game project with 3 original pixel art assets.",
        sets: [
          { build: "Creating Custom Pixel Art", explore: "Custom Pixel Art", solve: "Debugging Custom Pixel Art", about: "Create and refine an original pixel art image in the MakeCode image editor." },
          { build: "Pixel Art Colors & Outlines", explore: "Pixel Art Colors & Outlines", solve: "Debugging Pixel Art Colors & Outlines", about: "Create and refine an original pixel art image that contains analogous colors and a smooth outline." },
          { build: "Pixel Art Shading — Shadows & Reflections", explore: "Pixel Art Shading", solve: "Debugging Pixel Art Shading", about: "Create and refine an original pixel art image that uses shading to make the image more life-like." },
          { build: "Pixel Art Dithering", explore: "Dithering in Pixel Art", solve: "Debugging Dithering in Pixel Art", about: "Create and refine an original pixel art image that uses dithering to add depth and ease the transition between colors." },
          { build: "Creating Pixel Art in Multiple Sizes", explore: "Pixel Art in Multiple Sizes", solve: "Debugging Pixel Art in Multiple Sizes", about: "Create and refine an original pixel art image in multiple sizes." },
        ],
      },
      6: {
        topic: "Custom Sprite Packs",
        quest: "Create a maze project using a space-themed sprite pack that contains Player, Enemy, Collectible, Goal, and Projectile sprites.",
        sets: [
          { build: "Create Sprites from Multiple Perspectives", explore: "Pixel Art Sprite Perspectives", solve: "Debugging Pixel Art Person Sprites Perspectives", about: "Create multiple points of view for a sprite that can be used to show the direction the sprite is moving or facing." },
          { build: "Create a Color Palette for a Sprite Pack", explore: "Pixel Art Sprite Packs", solve: "Debugging Pixel Art Sprite Packs", about: "Design a construction-themed sprite pack that uses a specific color palette to create original image assets for different sprite kinds." },
          { build: "Creating and Using a Sprite Pack", explore: "Creating and Using Sprite Packs", solve: "Debugging Projectile Sprite Perspectives", about: "Design a sprite pack of assets for a project, using a unifying theme for all of the different sprite kinds in the project." },
        ],
      },
      7: {
        topic: "Animation Techniques",
        quest: "Create a project using animation assets that make paintings in a museum \"come alive\" with movement.",
        sets: [
          { build: "Animation Techniques", explore: "Squash and Stretch", solve: "Debugging Animation Techniques", about: "Practice different examples of animation techniques such as rotating, spinning, and bouncing." },
          { build: "A Cozy Evening", explore: "Animation Layers", solve: "Debugging Animating Realistic Sprite Movement", about: "Animate several images in a scene to make a room come to life!" },
          { build: "Super Ninja!", explore: "Sprite Walk Cycles", solve: "Debugging Sprite Animation", about: "Animate a superhero ninja as it walks and flies in different directions!" },
        ],
      },
      8: {
        topic: "Custom Tile Assets",
        quest: "Create a 2D platformer game with a tilemap composed of original tile assets, in which a sprite must avoid enemies and collect objects by climbing up and down a specific tile type on the tilemap.",
        sets: [
          { build: "Hills and Ladders", explore: "Creating 2D Tilemap Tiles", solve: "Debugging 2D Tilemap Tiles", about: "Design custom tiles to create unique platforms and terrain in a 2D platformer tilemap!" },
          { build: "We Built this City!", explore: "Building with Multiple Custom Tiles", solve: "Debugging Building with Multiple Custom Tiles", about: "Create different custom tile assets to build a tilemap of a city!" },
        ],
      },
      9: {
        topic: "User Interface & User Experience",
        quest: "Create a project that contains multiple scenes, including a splash screen at the beginning, a scene to set up the game's narrative, a menu that allows the player to make a choice, a simple game, and a game over screen.",
        sets: [
          { build: "Maze Masters", explore: "Text Sprites", solve: "Debugging Text Sprites", about: "Create a project with custom splash and game over screens, and a menu for players to choose a level from." },
          { build: "A Pet's Day", explore: "Full Screen Image Assets", solve: "Debugging Scene Sequence and Dialog Text", about: "Create a \"choose your own adventure\" project that uses the Story and Text Sprite extensions to create a personalized experience for the user." },
        ],
      },
      10: {
        topic: "Pixel Code and Extensions",
        sets: [
          { build: "Painter's Palette", explore: "Pixel Color Functions", solve: "Debugging Pixel Color Functions", about: "Create a project that allows the user to paint on the screen in different colors!" },
          { build: "Maps of all Sizes!", explore: "Minimaps", solve: "Debugging Minimaps", about: "Create a project that uses the Minimap extension to show a zoomed out display of the sprites and tilemap on screen!" },
          { build: "Feed The Hungry Dinos!", explore: "Status Bars and Throttle", solve: "Debugging Timers and Status Bars", about: "Create project enhancements using the Status Bar and Timer extensions to show a sprite's health meter and control the timing of actions in a game." },
          { build: "Museum Heist", explore: "Raycasting", solve: "Debugging Raycasting", about: "Create a maze project that uses the Raycasting extension to turn a 2D tilemap into a 3D environment!" },
        ],
      },
    },
  },
  Red: {
    language: "JavaScript",
    levels: {
      1: {
        topic: "Mini Golf",
        sets: [
          { build: "First Hole", explore: "Sprite Physics", solve: "Debugging Sprite Physics", about: "Create the first hole of a mini golf project that uses physics and a status bar to control the movement of the golf ball." },
          { build: "A Multi-Perspective Golf Course", explore: "Multi-Tilemap Game Mechanics", solve: "Debugging Tilemap Transitions", about: "Add on to the Mini Golf project by designing the second and third holes, and using a top down tilemap to navigate between each level!" },
          { build: "Adventure Golf", explore: "UI/UX Features", solve: "Debugging Projects Using the sayText Function", about: "Complete the mini golf project by designing User Interface (UI) features to enhance the User Experience (UX) of the project!" },
        ],
      },
      2: {
        topic: "Tower Defense",
        sets: [
          { build: "First Wave", explore: "Setting Towers and Launching Projectiles", solve: "Debugging Projectile Movement", about: "Create the first level of a Tower Defense project! Tower Defense is a genre of strategy games where the goal is to defend a player's territories or possessions. Enemies appear in timed intervals called \"waves\" to attack the defenses and the tower." },
          { build: "Many Enemies, Many Paths!", explore: "Enemy Sprite Movement and On-Screen Text", solve: "Debugging Sprite Movement and Image Consistency", about: "Continue building a Tower Defense project that includes different Enemy types and multiple paths. Expand to multiple levels and enemy types, create a game economy that allows users to earn and spend money, and add UI/UX features to the project so the user gets feedback on their game experience." },
          { build: "Inventory Menu", explore: "Creating an Inventory Menu / Image Functions", about: "Continue building a Tower Defense project that includes an Inventory menu with different sized towers to choose from! Including a variety of defense towers with different costs will increase the complexity and the user strategy required to improve the overall game experience!" },
          { build: "Finishing Touches", explore: "Project Scene Organization", solve: "Debugging Code by Project Scene", about: "Complete the Tower Defense project by designing the start, level select, and game over screens!" },
        ],
      },
    },
  },
  Black: {
    language: "JavaScript",
    levels: {
      1: {
        topic: "Capstone Project!",
        quest: "Create your own original project using everything you have learned in White through Red Belt!",
      },
    },
  },
};

export function levelInfo(belt, level) {
  return CREATE_CURRICULUM[belt]?.levels?.[Number(level)] || null;
}

export function beltInfo(belt) {
  return CREATE_CURRICULUM[belt] || null;
}

// The levels that ship a screenshot of the game being built, cut from the same
// posters. Not all of them do: Brown 5 and 10 lead with a pixel-art panel
// rather than a game, Red 2 opens on the Tower Defense write-up, and Black is
// a capstone with nothing to show yet. Those levels simply have no picture,
// which is honester than borrowing one from a level next door.
const LEVEL_SHOTS = new Set([
  'white-1', 'white-2', 'white-3', 'white-4',
  'yellow-1', 'yellow-2', 'yellow-3', 'yellow-4',
  'orange-1', 'orange-2', 'orange-3', 'orange-4', 'orange-5',
  'green-1', 'green-2', 'green-3', 'green-4', 'green-5',
  'blue-1', 'blue-2', 'blue-3', 'blue-4', 'blue-5', 'blue-6',
  'purple-1', 'purple-2', 'purple-3', 'purple-4', 'purple-5', 'purple-6',
  'brown-1', 'brown-2', 'brown-3', 'brown-4', 'brown-6', 'brown-7', 'brown-8', 'brown-9',
  'red-1',
]);

export function levelShot(belt, level) {
  const key = `${String(belt).toLowerCase()}-${Number(level)}`;
  return LEVEL_SHOTS.has(key) ? `/levels/shots/${key}.png` : null;
}

// The spot art each belt's poster hangs beside its ninjas: little app-icon
// stickers, white-rimmed, one set per belt. They say what the belt is about
// before a word is read — a compass and a speech frame on Blue, a treasure
// chest and a tilemap on Brown — which is the same job the poster gives them.
//
// They live in /belt-stickers, deliberately NOT in /stickers: that folder is
// the Code.AI login avatar set the JR ninjas pick from, and its names are
// pinned to a DB CHECK.
//
// They are the original transparent uploads out of the franchise asset set,
// not crops off a poster, so every one carries its own white rim and none of
// them needed keying out of a sky.
//
// The count is whatever that belt has to give rather than a number we chose:
// Red ships two achievement icons and Black one, Yellow three, most belts
// five. The four Degrees belts have none at all, so anything reading this has
// to cope with an empty list.
const BELT_STICKERS = {
  White: 4, Yellow: 3, Orange: 5, Green: 5, Blue: 5, Purple: 5, Brown: 5, Red: 2, Black: 1,
};

export function beltStickers(belt) {
  const n = BELT_STICKERS[belt] || 0;
  const key = String(belt).toLowerCase();
  return Array.from({ length: n }, (_, i) => `/belt-stickers/${key}-${i + 1}.png`);
}
