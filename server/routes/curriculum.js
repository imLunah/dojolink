const express = require('express');
const router = express.Router();
const { requireManager, requireSensei } = require('../middleware/auth');
const { listResources, getResource } = require('../resources');

// GET /api/curriculum/resources — reference docs for the Resources tab.
// Staff only: these documents contain lesson answers.
router.get('/resources', requireSensei, (req, res) => {
  const program = typeof req.query.program === 'string' ? req.query.program : null;
  res.json(listResources(program));
});

// GET /api/curriculum/resources/:slug — one document, body included.
router.get('/resources/:slug', requireSensei, (req, res) => {
  const doc = getResource(req.params.slug);
  if (!doc) return res.status(404).json({ error: 'Resource not found' });
  res.json(doc);
});

// GET /api/curriculum — public, returns { subPrograms, curriculum } matching progressData.js shape
router.get('/', async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows: modules } = await pool.query(`
      SELECT m.id, m.program, m.sub_program, m.module_name, m.module_order,
             COALESCE(json_agg(
               json_build_object('id', l.id, 'lesson_name', l.lesson_name, 'lesson_order', l.lesson_order)
               ORDER BY l.lesson_order ASC
             ) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
      FROM curriculum_modules m
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      GROUP BY m.id
      ORDER BY m.program ASC, m.sub_program ASC NULLS FIRST, m.module_order ASC
    `);

    if (!modules.length) {
      return res.status(204).end(); // not seeded yet — frontend falls back to static data
    }

    // Build subPrograms map
    const subPrograms = {};
    const programsSeen = new Set();
    for (const m of modules) {
      programsSeen.add(m.program);
      if (m.sub_program && !subPrograms[m.program]) subPrograms[m.program] = [];
      if (m.sub_program && !subPrograms[m.program].includes(m.sub_program)) {
        subPrograms[m.program].push(m.sub_program);
      }
    }
    for (const prog of programsSeen) {
      if (!subPrograms[prog]) subPrograms[prog] = null;
    }

    // Build curriculum map keyed by sub_program (if present) or program
    const curriculum = {};
    for (const m of modules) {
      const key = m.sub_program || m.program;
      if (!curriculum[key]) curriculum[key] = [];
      curriculum[key].push({
        id: m.id,
        module: m.module_name,
        lessons: m.lessons.map(l => l.lesson_name),
        _lessons: m.lessons, // includes ids for admin UI
      });
    }

    res.json({ subPrograms, curriculum });
  } catch (err) {
    // Table doesn't exist yet — migration hasn't been run; frontend falls back to static data
    if (err.code === '42P01') return res.status(204).end();
    console.error('Error fetching curriculum:', err);
    res.status(500).json({ error: 'Failed to fetch curriculum' });
  }
});

// GET /api/curriculum/roadmap — all programs, sub-programs, modules+descriptions, lessons (sensei+)
router.get('/roadmap', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const [{ rows }, { rows: beltRows }] = await Promise.all([
      pool.query(`
        SELECT m.id, m.program, m.sub_program, m.module_name, m.module_order, m.description,
          COALESCE(json_agg(
            json_build_object('id', l.id, 'lesson_name', l.lesson_name, 'lesson_order', l.lesson_order)
            ORDER BY l.lesson_order ASC
          ) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
        FROM curriculum_modules m
        LEFT JOIN curriculum_lessons l ON l.module_id = m.id
        GROUP BY m.id
        ORDER BY m.program ASC, m.sub_program ASC NULLS FIRST, m.module_order ASC
      `),
      pool.query(`
        SELECT id, belt_name, sublevel, project_name
        FROM belt_level_projects
        ORDER BY sublevel ASC, id ASC
      `),
    ]);

    const BELT_ORDER = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black', 'Bronze', 'Silver', 'Platinum', 'Gold'];
    const programOrder = ['CREATE', 'JR', 'AI Academy', 'Robotics Academy', 'VR Coding'];
    const programMap = {};

    // Non-CREATE programs from curriculum_modules
    for (const m of rows) {
      if (!programMap[m.program]) programMap[m.program] = { program: m.program, sub_programs: [], modules: [] };
      if (m.sub_program && !programMap[m.program].sub_programs.includes(m.sub_program)) {
        programMap[m.program].sub_programs.push(m.sub_program);
      }
      programMap[m.program].modules.push({
        id: m.id,
        module_name: m.module_name,
        module_order: m.module_order,
        sub_program: m.sub_program || null,
        description: m.description || null,
        lessons: m.lessons.map(l => ({ id: l.id, lesson_name: l.lesson_name })),
      });
    }

    // CREATE from belt_level_projects — belts as sub_programs, sublevels as modules
    const createBelts = {};
    for (const r of beltRows) {
      if (!createBelts[r.belt_name]) createBelts[r.belt_name] = {};
      if (!createBelts[r.belt_name][r.sublevel]) createBelts[r.belt_name][r.sublevel] = [];
      createBelts[r.belt_name][r.sublevel].push({ id: r.id, lesson_name: r.project_name });
    }
    const createModules = [];
    let mOrder = 0;
    for (const belt of BELT_ORDER) {
      if (!createBelts[belt]) continue;
      const sublevels = Object.keys(createBelts[belt]).map(Number).sort((a, b) => a - b);
      for (const sub of sublevels) {
        createModules.push({
          id: `belt_${belt}_${sub}`,
          module_name: `Level ${sub}`,
          module_order: mOrder++,
          sub_program: belt,
          description: null,
          lessons: createBelts[belt][sub],
        });
      }
    }
    programMap['CREATE'] = {
      program: 'CREATE',
      sub_programs: BELT_ORDER.filter(b => createBelts[b]),
      modules: createModules,
    };

    const sorted = [
      ...programOrder.filter(p => programMap[p]).map(p => programMap[p]),
      ...Object.values(programMap).filter(p => !programOrder.includes(p.program)),
    ];
    res.json(sorted);
  } catch (err) {
    console.error('Roadmap fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch roadmap' });
  }
});

// POST /api/curriculum/modules — add a module
router.post('/modules', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { program, sub_program, module_name } = req.body;
  if (!program || !module_name) return res.status(400).json({ error: 'program and module_name are required' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM curriculum_modules WHERE program = $1 AND module_name = $2 AND (sub_program = $3 OR (sub_program IS NULL AND $3::text IS NULL))',
      [program, module_name, sub_program || null]
    );
    if (existing.length) return res.status(409).json({ error: 'A module with that name already exists in this program' });

    const { rows: maxOrder } = await pool.query(
      'SELECT COALESCE(MAX(module_order), -1) AS max FROM curriculum_modules WHERE program = $1 AND (sub_program = $2 OR (sub_program IS NULL AND $2::text IS NULL))',
      [program, sub_program || null]
    );
    const nextOrder = maxOrder[0].max + 1;

    const { rows } = await pool.query(
      'INSERT INTO curriculum_modules (program, sub_program, module_name, module_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [program, sub_program || null, module_name, nextOrder]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding module:', err);
    res.status(500).json({ error: 'Failed to add module' });
  }
});

// PATCH /api/curriculum/modules/:id — rename a module or update description
router.patch('/modules/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { module_name, description } = req.body;
  if (!module_name && description === undefined) return res.status(400).json({ error: 'module_name or description required' });

  try {
    const updates = [];
    const params = [];
    if (module_name) { params.push(module_name); updates.push(`module_name = $${params.length}`); }
    if (description !== undefined) { params.push(description || null); updates.push(`description = $${params.length}`); }
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE curriculum_modules SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Module not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating module:', err);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

// DELETE /api/curriculum/modules/:id — deletes module + all its lessons (CASCADE)
router.delete('/modules/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rowCount } = await pool.query('DELETE FROM curriculum_modules WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Module not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting module:', err);
    res.status(500).json({ error: 'Failed to delete module' });
  }
});

// POST /api/curriculum/modules/:id/lessons — add a lesson
router.post('/modules/:moduleId/lessons', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { lesson_name } = req.body;
  if (!lesson_name) return res.status(400).json({ error: 'lesson_name is required' });

  try {
    const { rows: maxOrder } = await pool.query(
      'SELECT COALESCE(MAX(lesson_order), -1) AS max FROM curriculum_lessons WHERE module_id = $1',
      [req.params.moduleId]
    );
    const nextOrder = maxOrder[0].max + 1;

    const { rows } = await pool.query(
      'INSERT INTO curriculum_lessons (module_id, lesson_name, lesson_order) VALUES ($1, $2, $3) RETURNING *',
      [req.params.moduleId, lesson_name, nextOrder]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding lesson:', err);
    res.status(500).json({ error: 'Failed to add lesson' });
  }
});

// PATCH /api/curriculum/lessons/:id — rename a lesson
router.patch('/lessons/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { lesson_name } = req.body;
  if (!lesson_name) return res.status(400).json({ error: 'lesson_name is required' });

  try {
    const { rows } = await pool.query(
      'UPDATE curriculum_lessons SET lesson_name = $1 WHERE id = $2 RETURNING *',
      [lesson_name, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Lesson not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating lesson:', err);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

// DELETE /api/curriculum/lessons/:id
router.delete('/lessons/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rowCount } = await pool.query('DELETE FROM curriculum_lessons WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Lesson not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting lesson:', err);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

// POST /api/curriculum/seed — initialize from defaults (admin only, only if tables are empty)
router.post('/seed', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const client = await pool.connect();
  try {
    // Auto-create tables if migration hasn't been run
    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_modules (
        id SERIAL PRIMARY KEY,
        program TEXT NOT NULL,
        sub_program TEXT,
        module_name TEXT NOT NULL,
        module_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_lessons (
        id SERIAL PRIMARY KEY,
        module_id INTEGER NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
        lesson_name TEXT NOT NULL,
        lesson_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: countRows } = await client.query('SELECT COUNT(*) FROM curriculum_modules');
    if (parseInt(countRows[0].count) > 0) {
      return res.status(409).json({ error: 'Curriculum already seeded. Use the editor to make changes.' });
    }

    const SUB_PROGRAM_TO_PROGRAM = {
      'LEGO Spike Essentials': 'Robotics Academy',
      'LEGO Spike Prime': 'Robotics Academy',
      'VEX GO': 'Robotics Academy',
      'Ozobot Evo': 'Robotics Academy',
      'JR Coding': 'JR',
      'Snap Circuits': 'JR',
      'VR CS Breakthroughs': 'VR Coding',
      'VR CS Dimensions': 'VR Coding',
    };

    const CURRICULUM = {
      'AI Academy': [
        { module: 'Module 1', lessons: ['1. What is AI? How does it work?', '2. What are the different types of AI? What do they do?', '3. What is data? How does AI use data?', '4. What is an LLM? How does it work?', '5. How do I get what I want from AI?', '6. Can we trust AI?'] },
        { module: 'Module 2', lessons: ['1. Draw something with AI!', '2. How AI Creates Pictures', '3. Prompting an Image', '4. Image Fusion', '5. Animate your Drawings', '6. AI Music Generation', '7. AI Copyright and Ethics', '8. Choose your own AI Adventure!'] },
        { module: 'Module 3', lessons: ['1. Writing with AI, Part 1', '2. Writing with AI, Part 2', '3. AI Writing Assistants', '4. AI-Driven Podcast / Video Scripts', '5. Collaborative Book Creation with AI', '6. How does AI write?', '7. Deep Research with AI', '8. AI-Generated Writing Portfolios'] },
        { module: 'Module 4', lessons: ['1. How Is AI Transforming Life?', '2. How Is AI Transforming Life Online?', '3. Motion and Facial Recognition', '4. Image and Object Recognition', '5. How Is AI Used to Learn New Things?', '6. Create An AI Chatbot', '7. Making Predictions with AI', '8. Navigation and Pathfinding with AI'] },
        { module: 'Module 5', lessons: ['1. How AI Upgrades Coding', '2. Learn to Code with AI', '3. Debugging AI', '4. Pair Programming with AI', '5. What is Vibe Coding?', '6. Vibe Coding a Platformer Game', '7. Vibe Coding a Website', '8. Capping it Off (with a Capstone Project)'] },
        { module: 'Module 6', lessons: ['1. Introduction to AI in Gaming', '2. AI Computer Vision in Games', '3. Rule-Based AI and Finite State Machines', '4. AI Movement in Games', '5. AI Perception in Games', '6. Procedural Generation in Games', '7. NPCs, Memory, and Learning-Based AI', '8. Rule-Based vs Learning-Based AI'] },
        { module: 'Module 7', lessons: ["1. How is AI Changing Robotics?", "2. AI-Powered Sensors (Micro:bit)", "3. AI Movement Tracker (Micro:bit)", "4. AI Robotic Friend (Micro:bit + Climate Action Kit)", "5. Exploring AI Ethics + Introduction to Ozobot Color Codes (Ozobot)", "6. Coding with the Ozobot Editor's LLM Block (Ozobot)", "7. Ozobot + Computer Vision (Ozobot)", "8. AI Quality Inspection on the Assembly Line (Ozobot)", "9. Autonomous Driving Intelligence (Ozobot)"] },
        { module: 'Module 8', lessons: ['1. How has AI Changed Our Lives?', '2. Humans + AI, Working Together', '3. Can Humans Be Smarter than AI?', '4. Can AI Be Misleading?', '5. Can AI Harm Humans?', '6. Solving Future Problems with AI', '7. Solving Common AI Training Bugs', '8. Solving Problems with AI Assistants'] },
        { module: 'Module 9', lessons: ['1. Introduction To Design Thinking', '2. tldraw Computer', '3. The Ask Phase', '4. The Imagine Phase', '5. The Plan Phase', '6. The Prototype Phase', '7. The Test, Improve, Repeat Phase', '8. The Share Phase'] },
      ],
      'LEGO Spike Essentials': [
        { module: 'E 1', lessons: ['1. Intro to Lego Spike Essentials', '2. River Ferry', '3. Taxi! Taxi!', '4. Hovering Helicopter', '5. Swamp Boat', '6. Cable Car', '7. Big Bus', '8. Get Around Town'] },
        { module: 'E 2', lessons: ['1. Good Morning Machine', '2. Big Little Helper', '3. High-Tech Playground', '4. Trash Monster Machine', '5. Winning Goal', '6. Literary Randomizer', '7. Your Dojo Creation (Part 1)', '8. Your Dojo Creation (Part 2)'] },
        { module: 'E 3', lessons: ['1. Mini Mini-Golf', '2. Bowling Fun', '3. High Stick Hockey', '4. A-Maze-Ing', '5. Avoid The Edge', '6. Junior Pinball', '7. Creative Carnival Games (Part 1)', '8. Creative Carnival Games (Part 2)'] },
        { module: '1. Great Adventure', lessons: ['1. Boat Trip', '2. Cave Car', '3. Animal Alarm', '4. Underwater Quest', '5. The Great Desert Adventure'] },
        { module: '2. Amazing Amusement Park', lessons: ['1. The Fast Lane', '2. Classic Carousel', '3. Twiling Teacups', '4. The Most Amazing Amusement Park'] },
        { module: '3. Reimagine the World', lessons: ['1. Surfing', '2. Dancer Model', '3. Gymnastics Boy', '4. Basketball Game', '5. Sit Up', '6. Rollo the Robot', '7. Pirate Ship', '8. Scott the Skier', '9. Perry the Plane', '10. My World Reimagined'] },
        { module: '4. Useful Inventions', lessons: ['1. Automatic Feeder', '2. Smart Roof', '3. Smart Bin', '4. Harvestor', '5. Wake Up Giant', '6. Vertical Farm', '7. My Amazing Invention'] },
        { module: '5. Animal Friends', lessons: ['1. Crabby the Crab', '2. Sammi the Seal', '3. Sally the Spider', '4. Freddy the Fish', '5. Undersea Creature', '6. Gregory the Gorilla', '7. Peggy the Penguin', '8. Manny the Manta Ray', '9. Danny the Dino', '10. Elli the Elephant', '11. Bernie the Bird', '12. My Animal Friend'] },
        { module: '6. Happy Traveler', lessons: [] },
        { module: '7. Crazy Carnival Games', lessons: [] },
      ],
      'LEGO Spike Prime': [
        { module: 'P 1', lessons: ['1. Intro to LEGO Spike Prime', '2. Pass The Brick', '3. Going The Distance', '4. Ready, Set, Goal!'] },
        { module: 'P 2', lessons: ['1. Help! Help!', '2. Hopper Race', '3. Super Cleanup', '4. Broken', '5. Rain or Shine?', '6. Wind Speed', '7. Veggie Lover', '8. Break Dancer'] },
        { module: 'P 3', lessons: ['1. Place Your Order', '2. Out Of Order', '3. Track Your Packages', '4. Keep It Safe', '5. Keep It Really Safe', '6. Automate It', '7. Automatoe It More'] },
        { module: 'P 4', lessons: ['1. Training Camp 1: Driving Around', '2. Training Camp 2: Playing With Objects', '3. Training Camp 3: Reacting To Lines'] },
      ],
      'VEX GO': [
        { module: 'VG 1', lessons: ['1. Introduction to Building with VEX GO', '2. Intro to Building: Outer Space Exploration Part 1', '3. Intro to Building: Outer Space Exploration Part 2', '4. Simple Machines: Inclined Plane', '5. Simple Machines: Lever', '6. Simple Machines: Wheel & Axle', '7. Simple Machines: Gears', '8. Physical Science: Unpowered Super Car', '9. Physical Science: Super Car', '10. Physical Science: Motorized Super Car'] },
        { module: 'VG 2', lessons: ['1. Mars Rover Surface Operations: Collect a Sample', '2. Mars Rover Surface Operations: Collect and Bury Mission', '3. Mars Rover Landing Challenge: Detect Obstacles', '4. Mars Rover Landing Challenge: Clear the Landing Area', '5. Exploring Mars Geology: Collect a Martian Rock Sample', '6. Exploring Mars Geology: Study Your Martian Rock Sample', '7. Exploring Mars Geology: Sort Your Samples', '8. Exploring Mars Geology: Planetary Geologist'] },
        { module: 'VG 3', lessons: ['1. Remote Control Robot', '2. Code and Drive', '3. Using the LED Bumper', '4. Color Disk Maze', '5. Self-Driving Code Base: Move Until Line', '6. Self-Driving Code Base: Stop Sign', '7. Self-Driving Code Base: Construction Zone'] },
        { module: 'VG 4', lessons: ['1. Robot Jobs: Sewer Robot', '2. Robot Jobs: Warehouse Robot', '3. Robot Jobs: Dangerous and Dirty Jobs!', '4. Ocean Emergency', '5. Robot Arm: Introduction', '6. Robot Arm: Using the Electromagnet', '7. Robot Arm: Using the Eye Sensor', '8. Robot Arm: Decision Making'] },
      ],
      'Ozobot Evo': [
        { module: 'O 1', lessons: ['1. Introduction to Color Codes: Basic Training', '2. Introduction to Color Codes: Speed', '3. Introduction to Color Codes: Special Moves & Win/Exit', '4. Introduction to Color Codes: Direction', '5. Write Your Name With Color Codes', '6. Loop My Day', '7. Ozobot Race Track', '8. Polar Animals', '9. Clean Energy Cruise'] },
        { module: 'O 2', lessons: ["1. Introduction to Color Codes: Skills Check 1", "2. Introduction to Color Codes: Timers", "3. Introduction to Color Codes: Line Switch", "4. Introduction to Color Codes: Skills Check 2", "5. How to Make Earth Happy", "6. Stargazing with Ozobot", "7. Skater Safety", "8. Pollination Garden", "9. What's the Object?"] },
      ],
      'JR Coding': [
        { module: 'Module 1', lessons: ['1. Dance Party', '2. Algorithms and Sequencing Lesson 1.1', '3. Dance Party (3 Stars)', '4. Algorithms and Sequencing Lesson 1.2', '5. Sound Farm', '6. Algorithms and Sequencing Lesson 1.2', '7. Unplugged Day', '8. Algorithms and Sequencing Lesson 1.3 (Unplugged Activities)', '9. My World', '10. Algorithms and Sequencing Lesson 1.3'] },
        { module: 'Module 2', lessons: ["1. Bump, You're It!", '2. Debugging Lesson 2.1', "3. Bump, You're It! (3 Stars)", '4. Debugging Lesson 2.2', '5. Seasons', '6. Debugging Lesson 2.2', '7. Unplugged Day', '8. Debugging Lesson 2.3', '9. Ocean of Code', '10. Debugging Lesson 2.3'] },
        { module: 'Module 3', lessons: ['1. Repeat Repeat Repeat', '2. Loops Lesson 3.1', '3. Unplugged Day!', '4. Loops Lesson 3.1', '5. Dribble Dribble', '6. Loops Lesson 3.2', '7. Close and Far', '8. Loops Lesson 3.2', '9. Close and Far (3 Stars)', '10. Loops Lesson 3.3'] },
        { module: 'Module 4', lessons: ['1. Unplugged Day!', '2. Decomposition 4.1', '3. Catch Me If You Can!', '4. Decomposition 4.2', '5. Custom Characters!', '6. Decomposition 4.2 (Go for 3 Stars!)', '7. Stage of Code', '8. Decomposition 4.2 (Go for 3 Stars!)', '9. Stage of Code (3 Stars)', '10. Decomposition 4.2 (Go for 3 Stars!)'] },
        { module: 'Module 5', lessons: ['1. My House', '2. Advanced Sequencing Lesson 5.1', '3. Unplugged Day!', '4. Advanced Sequencing Lesson 5.2', '5. Safari Adventure', '6. Advanced Sequencing Lesson 5.2', '7. Safari Adventure (3 Stars)', '8. Advanced Sequencing Lesson 5.2', '9. Where Am I?', '10. Advanced Sequencing Lesson 5.3'] },
        { module: 'Module 6', lessons: ['1. Say it!', '2. Events Lesson 6.1', '3. Say It! (3 Stars)', '4. Events Lesson 6.1', '5. Unplugged Day!', '6. Events Lesson 6.2', '7. School Story!', '8. Events Lesson 6.2', '9. Hot Potato!', '10. Events Lesson 6.2'] },
        { module: 'Module 7', lessons: ['1. Enter the Castle', '2. Conditional Lesson 7.1', '3. Space Station', '4. Conditional Lesson 7.1', '5. Unplugged Day!', '6. Conditional Lesson 7.2', '7. Turn the Page', '8. Conditional Lesson 7.2', '9. Turn the Page (3 Stars)', '10. Conditional Lesson 7.3'] },
        { module: 'Module 8', lessons: ['1. One of These Things', '2. Stacks and Queues Lesson 8.1', '3. Choose Your Own Adventure', '4. Stacks and Queues Lesson 8.1', '5. Choose Your Own Adventure (3 Stars)', '6. Stacks and Queues Lesson 8.2', '7. Makey Makey Synchronization', '8. Stacks and Queues Lesson 8.2', '9. Flying Fish', '10. Stacks and Queues Lesson 8.2'] },
        { module: 'Module 9', lessons: ['1. Keep Away', '2. Pair Programming Lesson 9.1', '3. Keep Away (Switch Roles)', '4. Pair Programming Lesson 9.1', '5. Super Wheelie', '6. Pair Programming Lesson 9.1', '7. Super Wheelie (Switch Roles)', '8. Pair Programming Lesson 9.2', '9. Crossy Road', '10. Pair Programming Lesson 9.2'] },
        { module: 'Module 10', lessons: ['1. Underwater Treasures', '2. Game Make Lesson 10.2', '3. Underwater Treasures (3 Stars)', '4. Game Make Lesson 10.2', '5. Unplugged Day!', '6. Game Make Lesson 10.2', '7. My Story', '8. Game Make Lesson 10.2', '9. My Game', '10. Game Make Lesson 10.2'] },
      ],
      'Snap Circuits': [
        { module: 'Elenco', lessons: Array.from({ length: 24 }, (_, i) => `Project ${i + 1}`) },
      ],
      'VR CS Breakthroughs': [
        { module: 'Level 1', lessons: ['1. VR Tutorial', '2. Our Class Pet', '3. Team Battle', '4. Future Me'] },
        { module: 'Level 2', lessons: ['1. Hide and Seek', '2. Animal Whisperer', '3. Alien Invasion'] },
        { module: 'Level 3', lessons: ['1. Obstacle Course', '2. Carnival Rides', '3. Escape the Maze'] },
        { module: 'Level 4', lessons: ['1. Spy Mission', '2. Tiny Town', '3. Passion Project'] },
      ],
      'VR CS Dimensions': [
        { module: 'Level 1', lessons: ['1. VR Tutorial', '2. Animal Trainer', '3. City Builder', '4. Island Survivors', '5. Scavenger Hunt', '6. Magic Show'] },
        { module: 'Level 2', lessons: ['1. Time Traveler', '2. Physics Game', '3. Obstacle Course', '4. Crack the Case', '5. Complex Contraption'] },
        { module: 'Level 3', lessons: ['1. Music Playlist', '2. Dunk Tank Challenge', '3. Tower Conquest'] },
      ],
    };

    let modulesInserted = 0;
    let lessonsInserted = 0;
    for (const [key, modules] of Object.entries(CURRICULUM)) {
      const program = SUB_PROGRAM_TO_PROGRAM[key] || key;
      const subProgram = SUB_PROGRAM_TO_PROGRAM[key] ? key : null;
      for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        const { module: moduleName, lessons } = modules[mIdx];
        const { rows: existing } = await client.query(
          'SELECT id FROM curriculum_modules WHERE program = $1 AND module_name = $2 AND (sub_program = $3 OR (sub_program IS NULL AND $3 IS NULL))',
          [program, moduleName, subProgram]
        );
        let moduleId;
        if (existing.length) {
          moduleId = existing[0].id;
        } else {
          const { rows } = await client.query(
            'INSERT INTO curriculum_modules (program, sub_program, module_name, module_order) VALUES ($1, $2, $3, $4) RETURNING id',
            [program, subProgram, moduleName, mIdx]
          );
          moduleId = rows[0].id;
          modulesInserted++;
        }
        for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
          const { rows: el } = await client.query(
            'SELECT id FROM curriculum_lessons WHERE module_id = $1 AND lesson_name = $2',
            [moduleId, lessons[lIdx]]
          );
          if (!el.length) {
            await client.query(
              'INSERT INTO curriculum_lessons (module_id, lesson_name, lesson_order) VALUES ($1, $2, $3)',
              [moduleId, lessons[lIdx], lIdx]
            );
            lessonsInserted++;
          }
        }
      }
    }

    res.json({ ok: true, modulesInserted, lessonsInserted });
  } catch (err) {
    console.error('Error seeding curriculum:', err);
    res.status(500).json({ error: 'Failed to seed curriculum' });
  } finally {
    client.release();
  }
});

// ── Belt level projects (CREATE program) ─────────────────────────────────────

// GET /api/curriculum/belt-projects — returns { [belt_name]: { [sublevel]: [{id, project_name}] } }
router.get('/belt-projects', async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      'SELECT id, belt_name, sublevel, project_name, project_order FROM belt_level_projects ORDER BY belt_name ASC, sublevel ASC, project_order ASC'
    );
    if (!rows.length) return res.status(204).end();

    const data = {};
    for (const r of rows) {
      if (!data[r.belt_name]) data[r.belt_name] = {};
      if (!data[r.belt_name][r.sublevel]) data[r.belt_name][r.sublevel] = [];
      data[r.belt_name][r.sublevel].push({ id: r.id, project_name: r.project_name, project_order: r.project_order });
    }
    res.json(data);
  } catch (err) {
    if (err.code === '42P01') return res.status(204).end();
    console.error('Error fetching belt projects:', err);
    res.status(500).json({ error: 'Failed to fetch belt projects' });
  }
});

// POST /api/curriculum/belt-projects/seed — seed from defaults (admin only)
router.post('/belt-projects/seed', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const client = await pool.connect();
  try {
    // Auto-create table if migration hasn't been run yet
    await client.query(`
      CREATE TABLE IF NOT EXISTS belt_level_projects (
        id SERIAL PRIMARY KEY,
        belt_name TEXT NOT NULL,
        sublevel INTEGER NOT NULL,
        project_name TEXT NOT NULL,
        project_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS belt_level_projects_idx ON belt_level_projects(belt_name, sublevel)
    `);

    const { rows: countRows } = await client.query('SELECT COUNT(*) FROM belt_level_projects');
    if (parseInt(countRows[0].count) > 0) {
      return res.status(409).json({ error: 'Belt projects already seeded.' });
    }

    const BELT_LEVEL_PROJECTS = {
      White: {
        1: ['Your First Sprite', 'Debugging Our First Bugs!', 'Spooky Effect', 'Debugging More Bugs!', 'Creating with Code!'],
        2: ['Meeting New Friends', 'Debugging Sequence #1', "Where's My Puppy?", 'Debugging Sequence #2', 'Creating with Sequence!'],
        3: ['Fly Me to the Moon!', 'Debugging Sprite Movement', 'Dinner Time!', 'Debugging Sprite Layers', 'Creating with Events!'],
        4: ['A Piece of Cake', 'Debugging Overlap Blocks', 'Underwater Food Chain', 'Debugging Sprite Kinds and Parameters', 'Creating with Functions!'],
        5: ['Munchy Munchy Monkey', 'Debugging Life and Countdown Variables', 'Pearl Collector', 'Debugging Life and Score Variables', 'Creating with Variables!'],
        6: ['Avoid the Asteroids!', 'Debugging Loops, Velocity, and Randomness', 'Space Adventure', 'Debugging Projectiles', 'Creating with Loops!'],
        7: ["The Wizard's Mystic Toadstools", 'Debugging If/Then Conditionals', 'Unlock the Hidden Treasure', 'Debugging If/Then/Else Conditionals', 'Creating with Conditionals!'],
        8: ['Animated Aquarium', 'Debugging Animations', 'Musical Mayhem', 'Debugging Music Blocks', 'White Belt Belt-Up Project!'],
      },
      Yellow: {
        1:  ['Avoid the Snakes!', 'Debugging Tilemaps', 'Carrot Chase', 'Debugging Walls and Tiles in Tilemaps', 'Creating with Tilemaps!'],
        2:  ['The Key to the Castle', 'Debugging Tilemap Overlap Events', 'Coin Grabber!', 'Debugging Lifecycle Events', 'Creating with Tilemap and Lifecycle Events!'],
        3:  ['All About Me', 'Debugging Variables and Strings', 'Welcome to the Farm', 'Debugging Image Arrays', 'Mad Libs', 'Debugging Text Arrays', 'Creating with User Input, Variables, and Arrays!'],
        4:  ['Memory Game', 'Debugging Repeat Loops', 'Archeological Dig', 'Debugging for Element Loops', 'Creating with User Input, Variables, and Arrays!'],
        5:  ['Cookie Clicker Game!', 'Debugging Functions', 'Snowflake Catch', 'Debugging Functions with Parameters', 'Creating with Functions!'],
        6:  ['Cactus Jump', 'Debugging Acceleration and Velocity', 'Avoid the Roadblocks', 'Debugging 2D Tilemaps Designs', 'Lava Escape Platformer', 'Debugging 2D Tilemaps', 'Creating with 2D Platformer Tilemaps and Physics!'],
        7:  ['Magic Coin Scavenger Hunt', 'Debugging AND Booleans', 'Raindrop Invincibility', 'Debugging NOT Booleans', 'Snake Pit!', 'Debugging OR Booleans', 'Creating with Booleans and Logic Operators!'],
        8:  ['Bubble Pop!', 'Debugging For Index Loops', 'Bee Catcher', 'Debugging While Loops', 'Creating with Index and While Loops!'],
        9:  ['Block Jumper', 'Debugging Tilemap Location Blocks', 'Bridge Builder', 'Debugging Tilemap Location Blocks and Operators', 'Dino Defender', 'Debugging Tilemap Extension Blocks', 'Creating with Tilemap Location and Extension Blocks!'],
        10: ['Scenic Drive', 'Debugging Scroller Extension Blocks', 'Burger Dash', 'Debugging Status Bar Extension Blocks', 'Yellow Belt Belt-Up Project!'],
      },
      Orange: {
        1:  ['Hello World!', 'Debugging Setting Sprites', 'Bouncing on the Walls', 'Debugging Sprite Effects', 'Follow Me!', 'Debugging Sprite Movement', 'Creating with Javascript Code and Syntax!'],
        2:  ['Greeting Card', 'Debugging Properties and Text Parameters', 'Show Time!', 'Debugging Effect Parameters and Sequencing', 'Seasons Change', 'Debugging Code Comments and Dialog Boxes', 'Creating with Properties!'],
        3:  ['Screen Saver', 'Debugging Block Statements and Loops', 'Button Clicker!', 'Debugging Block Statements and Events', 'Two Sprite Showdown!', 'Debugging Screen Positions and Multiplayer Score', 'Creating with Block Statements!'],
        4:  ['Save the Crab!', 'Debugging Nested Block Statements and If Conditionals', 'Going Bananas!', 'Debugging Nested Block Statements and If/Else Conditionals', 'Grab Bag!', 'Debugging Nested Block Statements and If/Else If/Else Conditionals', 'Creating with Nested Block Statements!'],
        5:  ["Shop 'Til You Drop", 'Debugging Variables, Concatenation, and Assignment Operators', 'Cookie Stackers', 'Debugging Variables, Equality Operators, and Math Operators', 'Creating with Assignment and Equality Operators!'],
        6:  ['Shooting Hoops!', 'Debugging Boolean AND Operators and Relational Operators', 'Guess the Number!', 'Debugging Boolean OR Operators', 'Creating with Boolean and Relational Operators!'],
        7:  ['Collect the Honey!', 'Debugging Sprite Kinds and Overlap Events', 'Snowball Fight!', 'Debugging Sprite Kinds and Projectiles', 'Asteroid Attack!', 'Debugging Sprite Kinds and onCreated Events', 'Creating with Sprite Kinds and Sprite Overlap Events!'],
        8:  ['Fireflies Collector', 'Debugging For Loops', 'Counting Sprites', 'Debugging Incrementing and Decrementing For Loops', 'Mystery Boxes!', 'Debugging Nested For Loops and Increment Operators', 'Creating with For Loops!'],
        9:  ['Magic 8 Ball', 'Debugging Arrays', "What's in a Name?", 'Debugging Empty Arrays', 'Concentration', 'Debugging Array Indices and For Element Of Loops', 'Creating with Arrays!'],
        10: ['Match Game', 'Debugging Array Index Values', 'Username Generator', 'Debugging Nested Arrays', 'Memory Match', 'Debugging Array Functions', 'Creating with Nested Arrays!'],
        11: ['Pizza Party', 'Debugging Functions with Parameters', 'Barn Breakout!', 'Debugging Multiple Functions', 'Damage Control', 'Debugging Functions with Multiple Parameters', 'Creating with Functions!'],
        12: ['Escape the Haunted Castle!', 'Debugging Animation and Music', 'City Scroller', 'Debugging the Background Scroll Extension', 'Find the Ninja!', 'Debugging the Story Extension', 'Orange Belt Belt-Up Project!'],
      },
      Green: {
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
      Blue: {
        1: ['First Hole', 'Debugging Sprite Physics', 'A Multi-Perspective Golf Course', 'Debugging Tilemap Transitions', 'Adventure Golf', 'Debugging Projects Using the sayText Function', 'Creating with Mini Golf Concepts'],
        2: ['First Wave', 'Debugging Projectile Movement', 'Many Enemies, Many Paths!', 'Debugging Sprite Movement and Image Consistency', 'Inventory Menu', 'Image Functions', 'Finishing Touches', 'Debugging Code by Project Scene', 'Creating with Tower Defense Concepts'],
        3: ['Belt-Up Project'],
      },
      Purple: {
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
      Brown: {
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
      Red: {
        1: ['Gravity Trails'],
        2: ['Codey Raceway'],
        3: ['Sulky Slimes'],
        4: ['Chef Codey'],
      },
    };

    let inserted = 0;
    for (const [beltName, sublevels] of Object.entries(BELT_LEVEL_PROJECTS)) {
      for (const [sublevel, projects] of Object.entries(sublevels)) {
        for (let i = 0; i < projects.length; i++) {
          const { rows: existing } = await client.query(
            'SELECT id FROM belt_level_projects WHERE belt_name = $1 AND sublevel = $2 AND project_name = $3',
            [beltName, parseInt(sublevel), projects[i]]
          );
          if (!existing.length) {
            await client.query(
              'INSERT INTO belt_level_projects (belt_name, sublevel, project_name, project_order) VALUES ($1, $2, $3, $4)',
              [beltName, parseInt(sublevel), projects[i], i]
            );
            inserted++;
          }
        }
      }
    }

    res.json({ ok: true, inserted });
  } catch (err) {
    console.error('Error seeding belt projects:', err);
    res.status(500).json({ error: 'Failed to seed belt projects' });
  } finally {
    client.release();
  }
});

// POST /api/curriculum/belt-projects — add a project to a belt+sublevel
router.post('/belt-projects', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { belt_name, sublevel, project_name } = req.body;
  if (!belt_name || !sublevel || !project_name) return res.status(400).json({ error: 'belt_name, sublevel, and project_name are required' });
  const sublevelInt = parseInt(sublevel, 10);
  if (isNaN(sublevelInt) || sublevelInt < 0) return res.status(400).json({ error: 'sublevel must be a non-negative integer' });
  try {
    const { rows: maxOrder } = await pool.query(
      'SELECT COALESCE(MAX(project_order), -1) AS max FROM belt_level_projects WHERE belt_name = $1 AND sublevel = $2',
      [belt_name, sublevel]
    );
    const { rows } = await pool.query(
      'INSERT INTO belt_level_projects (belt_name, sublevel, project_name, project_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [belt_name, sublevelInt, project_name, maxOrder[0].max + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding belt project:', err);
    res.status(500).json({ error: 'Failed to add project' });
  }
});

// PATCH /api/curriculum/belt-projects/:id — rename a project
router.patch('/belt-projects/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { project_name } = req.body;
  if (!project_name) return res.status(400).json({ error: 'project_name is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE belt_level_projects SET project_name = $1 WHERE id = $2 RETURNING *',
      [project_name, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error renaming belt project:', err);
    res.status(500).json({ error: 'Failed to rename project' });
  }
});

// DELETE /api/curriculum/belt-projects/:id
router.delete('/belt-projects/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rowCount } = await pool.query('DELETE FROM belt_level_projects WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting belt project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
