// Belt + bonus-track order for the CREATE program. Belts run White→Black; the
// three bonus tracks (Bronze/Silver/Platinum) live at the end of CREATE.
// `bonus: true` marks the bonus tracks so the UI can group/label them apart.
export const BELTS = [
  { name: 'White',    color: '#ffffff', textColor: '#000000' },
  { name: 'Yellow',   color: '#fbbf24', textColor: '#000000' },
  { name: 'Orange',   color: '#f97316', textColor: '#000000' },
  { name: 'Green',    color: '#22c55e', textColor: '#000000' },
  { name: 'Blue',     color: '#3b82f6', textColor: '#ffffff' },
  { name: 'Purple',   color: '#a855f7', textColor: '#ffffff' },
  { name: 'Brown',    color: '#92400e', textColor: '#ffffff' },
  { name: 'Red',      color: '#cc0000', textColor: '#ffffff' },
  { name: 'Black',    color: '#111111', textColor: '#ffffff' },
  { name: 'Bronze',   color: '#cd7f32', textColor: '#ffffff', bonus: true },
  { name: 'Silver',   color: '#c0c0c0', textColor: '#1f2937', bonus: true },
  { name: 'Platinum', color: '#e5e4e2', textColor: '#1f2937', bonus: true },
  { name: 'Gold',     color: '#d4af37', textColor: '#1f2937', bonus: true },
];

export const PROJECTS = ['Build 1', 'Build 2', 'Build 3', 'Build 4', 'Build 5', 'Solve 1', 'Solve 2', 'Solve 3', 'Solve 4', 'Solve 5', 'Adventure'];
export const STATUSES = ['Started', 'Working On', 'Completed'];
// The programs a ninja can be enrolled in.
//
// Silver, Gold Unity and Gold Godot were here and are gone (session 49). They
// were the advanced tracks as MEMBERSHIPS, and they duplicated the top of the
// CREATE ladder, which already runs Bronze, Silver, Platinum and Gold as belts
// with their own projects. Nobody was ever enrolled in any of the three except
// one test record. Note that `Silver` remains a BELT in BELTS above and 17
// levels of it are seeded in `server/db/seed_belt_projects.js`: what was
// removed is the program of the same name, not the rank.
export const PROGRAMS = ['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding'];

export const PROGRAM_LOGOS = {
  'CREATE':           '/programs/create_logo.webp',
  'JR':               '/programs/jr_logo.webp',
  // PNG, not webp, and not by preference: these two were recut from the
  // official lockups (badge only, wordmark dropped) and there is no webp
  // encoder on the machine that cut them. Convert whenever one is to hand.
  'Robotics Academy': '/programs/robotics_logo.png',
  'AI Academy':       '/programs/ai_logo.png',
  'VR Coding':        '/programs/vr_coding_logo.webp',
};

// Wide banner art for the programs that have it. Anything absent falls back to
// the CSS gradient the banner surfaces already carry.
export const PROGRAM_BANNERS = {
  'Robotics Academy': '/programs/robotics_banner.webp',
  'AI Academy':       '/programs/ai_banner.webp',
};

// Project names per belt + level. Keyed by belt name → level number → ordered
// project options (each level's Build/Solve titles then its Adventure).
// Levels are NOT always 1-based: Green runs 6–10 (it continues Orange's count,
// matching the printed curriculum). Use getLevels() to enumerate a belt's levels.
export const BELT_LEVEL_PROJECTS = {
  White: {
    1: ['Your First Sprite', 'Debugging Our First Bugs!', 'Spooky Effect', 'Debugging More Bugs!', 'Creating with Code!'],
    2: ['Meeting New Friends', 'Debugging Sequence #1', "Where's My Puppy?", 'Debugging Sequence #2', 'Creating with Sequence!'],
    3: ['Fly Me to the Moon!', 'Debugging Sprite Movement', 'Dinner Time!', 'Debugging Sprite Layers', 'Creating with Events!'],
    4: ['A Piece of Cake', 'Debugging Overlap Blocks', 'Underwater Food Chain', 'Debugging Sprite Kinds and Parameters', 'Creating with Functions!'],
  },
  Yellow: {
    1: ['Munchy Munchy Monkey', 'Debugging Life and Countdown Variables', 'Pearl Collector', 'Debugging Life and Score Variables', 'Creating with Variables!'],
    2: ['Avoid the Asteroids!', 'Debugging Loops, Velocity, and Randomness', 'Space Adventure', 'Debugging Projectiles', 'Creating with Loops!'],
    3: ["The Wizard's Mystic Toadstools", 'Debugging If/Then Conditionals', 'Unlock the Hidden Treasure', 'Debugging If/Then/Else Conditionals', 'Creating with Conditionals!'],
    4: ['Animated Aquarium', 'Debugging Animations', 'Musical Mayhem', 'Debugging Music Blocks', 'White Belt Belt-Up Project!'],
  },
  Orange: {
    1: ['Avoid the Snakes!', 'Debugging Tilemaps', 'Carrot Chase', 'Debugging Walls and Tiles in Tilemaps', 'Creating with Tilemaps!'],
    2: ['The Key to the Castle', 'Debugging Tilemap Overlap Events', 'Coin Grabber!', 'Debugging Lifecycle Events', 'Creating with Tilemap and Lifecycle Events!'],
    3: ['All About Me', 'Debugging Variables and Strings', 'Welcome to the Farm', 'Debugging Image Arrays', 'Mad Libs', 'Debugging Text Arrays', 'Creating with User Input, Variables, and Arrays!'],
    4: ['Memory Game', 'Debugging Repeat Loops', 'Archeological Dig', 'Debugging for Element Loops', 'Creating with User Input, Variables, and Arrays!'],
    5: ['Cookie Clicker Game!', 'Debugging Functions', 'Snowflake Catch', 'Debugging Functions with Parameters', 'Creating with Functions!'],
  },
  Green: {
    1: ['Cactus Jump', 'Debugging Acceleration and Velocity', 'Avoid the Roadblocks', 'Debugging 2D Tilemaps Designs', 'Lava Escape Platformer', 'Debugging 2D Tilemaps', 'Creating with 2D Platformer Tilemaps and Physics!'],
    2: ['Magic Coin Scavenger Hunt', 'Debugging AND Booleans', 'Raindrop Invincibility', 'Debugging NOT Booleans', 'Snake Pit!', 'Debugging OR Booleans', 'Creating with Booleans and Logic Operators!'],
    3: ['Bubble Pop!', 'Debugging For Index Loops', 'Bee Catcher', 'Debugging While Loops', 'Creating with Index and While Loops!'],
    4: ['Block Jumper', 'Debugging Tilemap Location Blocks', 'Bridge Builder', 'Debugging Tilemap Location Blocks and Operators', 'Dino Defender', 'Debugging Tilemap Extension Blocks', 'Creating with Tilemap Location and Extension Blocks!'],
    5: ['Scenic Drive', 'Debugging Scroller Extension Blocks', 'Burger Dash', 'Debugging Status Bar Extension Blocks', 'Yellow Belt Belt-Up Project!'],
  },
  Blue: {
    1: ['Hello World!', 'Debugging Setting Sprites', 'Bouncing on the Walls', 'Debugging Sprite Effects', 'Follow Me!', 'Debugging Sprite Movement', 'Creating with Javascript Code and Syntax!'],
    2: ['Greeting Card', 'Debugging Properties and Text Parameters', 'Show Time!', 'Debugging Effect Parameters and Sequencing', 'Seasons Change', 'Debugging Code Comments and Dialog Boxes', 'Creating with Properties!'],
    3: ['Screen Saver', 'Debugging Block Statements and Loops', 'Button Clicker!', 'Debugging Block Statements and Events', 'Two Sprite Showdown!', 'Debugging Screen Positions and Multiplayer Score', 'Creating with Block Statements!'],
    4: ['Save the Crab!', 'Debugging Nested Block Statements and If Conditionals', 'Going Bananas!', 'Debugging Nested Block Statements and If/Else Conditionals', 'Grab Bag!', 'Debugging Nested Block Statements and If/Else If/Else Conditionals', 'Creating with Nested Block Statements!'],
    5: ["Shop 'Til You Drop", 'Debugging Variables, Concatenation, and Assignment Operators', 'Cookie Stackers', 'Debugging Variables, Equality Operators, and Math Operators', 'Creating with Assignment and Equality Operators!'],
    6: ['Shooting Hoops!', 'Debugging Boolean AND Operators and Relational Operators', 'Guess the Number!', 'Debugging Boolean OR Operators', 'Creating with Boolean and Relational Operators!'],
  },
  Purple: {
    1: ['Collect the Honey!', 'Debugging Sprite Kinds and Overlap Events', 'Snowball Fight!', 'Debugging Sprite Kinds and Projectiles', 'Asteroid Attack!', 'Debugging Sprite Kinds and onCreated Events', 'Creating with Sprite Kinds and Sprite Overlap Events!'],
    2: ['Fireflies Collector', 'Debugging For Loops', 'Counting Sprites', 'Debugging Incrementing and Decrementing For Loops', 'Mystery Boxes!', 'Debugging Nested For Loops and Increment Operators', 'Creating with For Loops!'],
    3: ['Magic 8 Ball', 'Debugging Arrays', "What's in a Name?", 'Debugging Empty Arrays', 'Concentration', 'Debugging Array Indices and For Element Of Loops', 'Creating with Arrays!'],
    4: ['Match Game', 'Debugging Array Index Values', 'Username Generator', 'Debugging Nested Arrays', 'Memory Match', 'Debugging Array Functions', 'Creating with Nested Arrays!'],
    5: ['Pizza Party', 'Debugging Functions with Parameters', 'Barn Breakout!', 'Debugging Multiple Functions', 'Damage Control', 'Debugging Functions with Multiple Parameters', 'Creating with Functions!'],
    6: ['Escape the Haunted Castle!', 'Debugging Animation and Music', 'City Scroller', 'Debugging the Background Scroll Extension', 'Find the Ninja!', 'Debugging the Story Extension', 'Orange Belt Belt-Up Project!'],
  },
  Brown: {
    1:  ['The Bookcase', 'Debugging Assets and Tilemaps', 'Shark Attack', 'Debugging Tilemap Location and Camera Functions', 'Creating with the Assets Menu!'],
    2:  ['Two Worlds', 'Debugging Tile Overlap Events', 'Avoid the Haystacks!', 'Debugging Tilemap Walls', 'Creating with Tilemap Overlap Events!'],
    3:  ['Dust Mite Adventure', 'Debugging 2D Tilemap Movement', 'Gravity Jumper', 'Debugging Sprite Movement with Functions', 'Salmon Catch', 'Debugging Tile Overlaps and While Loops', 'Creating with 2D Platform Tilemaps!'],
    4:  ['A Walk through the Seasons', 'Debugging Customized Assets and the Scroller Extension', 'A Change of Scenery', 'Debugging Cycling through Assets', "Painter's Palette", 'Debugging Pixel Color Functions', 'Creating with Modified Pixel Art Assets!'],
    5:  ['Creating Custom Pixel Art', 'Debugging Custom Pixel Art', 'Pixel Art Colors & Outlines', 'Debugging Pixel Art Colors & Outlines', 'Pixel Art Shading - Shadows & Reflections', 'Debugging Pixel Art Shading', 'Pixel Dithering', 'Debugging Dithering in Pixel Art', 'Creating Pixel Art in Multiple Sizes', 'Debugging Pixel Art in Multiple Sizes', 'Creating with Original Pixel Art Images!'],
    6:  ['Creating Sprites with Multiple Perspectives', 'Debugging Pixel Art Person Sprites Perspectives', 'Create a Color Palette for a Sprite Pack', 'Debugging Pixel Art Sprite Packs', 'Creating and Using a Sprite Pack', 'Debugging Projectile Sprite Perspectives', 'Creating with Pixel Art Sprite Packs!'],
    7:  ['Animation Techniques', 'Debugging Animation Techniques', 'A Cozy Evening', 'Debugging Realistic Sprite Movement', 'Super Ninja!', 'Debugging Sprite Animation', 'Creating with Pixel Art Animation Assets!'],
    8:  ['Hills and Ladders', 'Debugging 2D Tilemap Tiles', 'We Built this City!', 'Debugging Building with Multiple Custom Tiles', 'Creating with Original Tile Assets!'],
    9:  ['Maze Masters', 'Debugging Text Sprites', "A Pet's Day", 'Debugging Scene Sequence and Dialog Text', 'Creating with User Interface and User Experience Features!'],
    10: ['Maps of all Sizes!', 'Debugging Minimaps', 'Feed the Hungry Dinos!', 'Debugging Timers and Status Bars', 'Museum Heist', 'Debugging Raycasting', 'Green Belt Belt-Up Project!'],
  },
  Red: {
    1: ['First Hole', 'Debugging Sprite Physics', 'A Multi-Perspective Golf Course', 'Debugging Tilemap Transitions', 'Adventure Golf', 'Debugging Projects Using the sayText Function', 'Creating with Mini Golf Concepts'],
    2: ['First Wave', 'Debugging Projectile Movement', 'Many Enemies, Many Paths!', 'Debugging Sprite Movement and Image Consistency', 'Inventory Menu', 'Image Functions', 'Finishing Touches', 'Debugging Code by Project Scene', 'Creating with Tower Defense Concepts'],
  },
  Black: {
    1: ['Capstone Project'],
  },
  // ── Bonus tracks (after Black) ──
  Bronze: {
    1:  ['Dropping Bombs', 'Prove Yourself - Color Drop'],
    2:  ['Scavenger Hunt', 'Prove Yourself - Particle Hunt'],
    3:  ['Meany Bird', 'Prove Yourself - Meaner Bird'],
    4:  ['Sketch Head', 'Prove Yourself - TrickHead'],
    5:  ["Don't Touch the Cubes", "Prove Yourself - Don't Touch the Chopsticks"],
    6:  ['SuperShapes', 'Prove Yourself - Super Duper Shapes'],
    7:  ['Poly Run', 'Prove Yourself - Poly Run v2'],
    8:  ['Dropping Bombs Part 2'],
    9:  ['Dropping Bombs Part 3'],
    10: ['Dropping Bombs Part 4'],
    11: ['Dropping Bombs Part 5'],
  },
  Silver: {
    1:  ['Robomania', 'Prove Yourself - Robomania'],
    2:  ['Find the Exit', 'Prove Yourself - Find the Exit'],
    3:  ['Cloud Hop', 'Prove Yourself - Cloud Hop'],
    4:  ['Jungle Escape', 'Prove Yourself - Jungle Escape'],
    5:  ['Ninja Run', 'Prove Yourself - Ninja Run'],
    6:  ['Evil Fortress of Doctor Worm', 'Prove Yourself - Evil Fortress of Dr. Worm'],
    7:  ['CyberFu Part 1', 'Prove Yourself - CyberFu Part 1'],
    8:  ['Shape Jam', 'Prove Yourself - Shape Jam'],
    9:  ['Labyrinth', 'Prove Yourself - Labyrinth'],
    10: ['CyberFu Part 2', 'Prove Yourself - CyberFu Part 2'],
    11: ['Amazing Ninja Worlds Part 1', 'Prove Yourself - Amazing Ninja Worlds Pt 1'],
    12: ['World of Color', 'Prove Yourself - World of Color'],
    13: ['Amazing Ninja Worlds Part 2', 'Prove Yourself - Amazing Ninja Worlds Pt 2'],
    14: ['Amazing Ninja Worlds Part 3', 'Prove Yourself - Amazing Ninja Worlds Pt 3'],
    15: ['Scavenger Hunt Deluxe', 'Prove Yourself - Scavenger Hunt Deluxe'],
    16: ['Food Frenzy Part 1'],
    17: ['Food Frenzy Part 2'],
  },
  Platinum: {
    1: ['Gravity Trails'],
    2: ['Codey Raceway'],
    3: ['Sulky Slimes'],
    4: ['Chef Codey'],
  },
  Gold: {
    1: ['Planning Phase'],
    2: ['Prototyping Phase'],
    3: ['Alpha Phase'],
    4: ['Beta Phase'],
    5: ['Release Candidate Phase'],
    6: ['Going Gold Phase'],
  },
};

export function getBelt(name) {
  return BELTS.find(b => b.name === name);
}

// Ordered list of valid level numbers for a belt (handles non-1-based belts
// like Green = [6,7,8,9,10] and the variable-length bonus tracks).
export function getLevels(beltName) {
  const lv = BELT_LEVEL_PROJECTS[beltName];
  if (!lv) return [];
  return Object.keys(lv).map(Number).sort((a, b) => a - b);
}

export function getMaxLevel(beltName) {
  const levels = getLevels(beltName);
  return levels.length ? levels[levels.length - 1] : null;
}

export function getLevelProjects(beltName, sublevel) {
  if (!beltName || !sublevel) return null;
  return BELT_LEVEL_PROJECTS[beltName]?.[parseInt(sublevel)] ?? null;
}

// Flat-project-list belts (no level / Build-Solve labels): Black capstone + bonus tracks.
export const UPPER_BELTS = ['Black', 'Bronze', 'Silver', 'Platinum'];

// The projects a belt/level offers, from the live curriculum where it has the
// belt and this static ladder otherwise. Both the log form and the log editor
// read it: the form to fill its dropdown, the editor to tell a standard project
// from a custom one and so know which field to open a saved log in.
export function createProjectOptions({ beltLevel, beltSublevel, beltProjects }) {
  const isUpperBelt = UPPER_BELTS.includes(beltLevel);
  const dynBelt = beltProjects?.[beltLevel];
  const dynLevel = dynBelt ? Object.fromEntries(
    Object.entries(dynBelt).map(([sub, projs]) => [sub, projs.map((p) => p.project_name)])
  ) : null;
  const dynLevelProjects = dynLevel?.[beltSublevel] ?? null;
  const dynAllUpper = isUpperBelt && dynBelt ? Object.values(dynBelt).flat().map((p) => p.project_name) : null;

  const levelProjects = dynLevelProjects ?? getLevelProjects(beltLevel, beltSublevel);
  const allUpperBeltProjects = dynAllUpper ?? (isUpperBelt && BELT_LEVEL_PROJECTS[beltLevel]
    ? Object.values(BELT_LEVEL_PROJECTS[beltLevel]).flat()
    : null);

  const hasBeltProjects = beltLevel && !!(dynBelt || BELT_LEVEL_PROJECTS[beltLevel]);
  return {
    options: isUpperBelt ? (allUpperBeltProjects ?? PROJECTS) : (levelProjects ?? PROJECTS),
    needsSublevel: !isUpperBelt && hasBeltProjects && (!beltSublevel || parseInt(beltSublevel) < 1),
    showLabels: !!levelProjects && !isUpperBelt,
  };
}
