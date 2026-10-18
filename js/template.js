/* Infra Upgrades — the default survey form.
   Taken from the site-visit checklist (3 sheets) plus planning fields.
   Everything here can be changed in the app: Menu > Edit survey form.
   IDs are fixed so data stays matched when the same form is shared between phones. */
(function () {
  'use strict';
  const f = (id, label, type, extra) => Object.assign({ id, label, type: type || 'text' }, extra || {});
  const it = (id, no, what, how) => ({ id, no, what, how: how || '' });

  const CONDITIONS = [
    { id: 'good', label: 'Good', tone: 'ok', hint: 'Item is there and in good condition. No work needed.' },
    { id: 'repair', label: 'Repair needed', tone: 'warn', hint: 'Item can be repaired and reused.' },
    { id: 'replace', label: 'Replace needed', tone: 'bad', hint: 'Too damaged to repair. Needs to be replaced. Write the reason in Notes.' },
    { id: 'notavail', label: 'Not available', tone: 'new', hint: 'Item is not there at all and a new one is needed.' },
    { id: 'na', label: 'Not applicable', tone: 'mute', hint: 'This item does not apply at this school.' },
    { id: 'rebuild', label: 'Needs rebuild', tone: 'bad', hint: 'Too damaged — needs to be rebuilt. Inform your manager; rebuilding needs written approval.' },
  ];

  const SCHOOL = [
    { id: 'sec_school', title: '1. School details', fields: [
      f('sd_name', 'School name'),
      f('sd_udise', 'UDISE code'),
      f('sd_date', 'Date of visit', 'date', { today: true }),
      f('sd_village', 'Village / Ward'),
      f('sd_block', 'Block / Tehsil'),
      f('sd_district', 'District'),
      f('sd_state', 'State'),
      f('sd_pin', 'PIN code', 'number'),
      f('sd_gps', 'Map location (GPS: latitude, longitude)', 'gps'),
      f('sd_address', 'Full address / landmark', 'longtext'),
      f('sd_runby', 'Who runs the school?', 'choice', { options: ['Government', 'Nagar Nigam', 'Aided', 'Other'] }),
      f('sd_level', 'School level', 'choice', { options: ['Primary', 'Upper primary', 'Both', 'Composite', 'Secondary'] }),
      f('sd_engineer', 'Engineer name'),
      f('sd_engmobile', 'Engineer mobile number', 'phone'),
      f('sd_hm', 'Head Master / Principal name'),
      f('sd_hmmobile', 'Head Master mobile number', 'phone'),
      f('sd_nodal', 'Nodal officer & contact number (if any)'),
    ] },
    { id: 'sec_students', title: '2. Students and building', fields: [
      f('sd_boys', 'Boys', 'number'),
      f('sd_girls', 'Girls', 'number'),
      f('sd_totstu', 'Total students (auto)', 'calc', { calc: 'sum', of: ['sd_boys', 'sd_girls'] }),
      f('sd_teachers', 'Total teachers', 'number'),
      f('sd_buildings', 'Number of buildings', 'number'),
      f('sd_floors', 'Number of floors', 'number'),
      f('sd_year', 'Year built (approximately)', 'number'),
      f('sd_btype', 'Building type', 'choice', { options: ['Brick walls (load bearing)', 'RCC columns and beams', 'Mixed', 'Other'] }),
      f('sd_rooms', 'Number of classrooms', 'number'),
      f('sd_bua', 'Built-up area (sq. m, approximately)', 'number'),
      f('sd_plot', 'Plot / campus area (sq. m, approximately)', 'number'),
      f('sd_timing', 'School timings'),
    ] },
    { id: 'sec_before', title: '3. Before work starts', fields: [
      f('sd_vehicle', 'Can material vehicles reach the school?', 'longtext', { hint: 'Road width, type of vehicle that can reach, nearest unloading spot, place to store material.' }),
      f('sd_power', 'Electricity supply', 'choice', { options: ['Single phase', 'Three phase', 'Not available'] }),
      f('sd_water', 'Water source during work', 'choice', { options: ['Borewell', 'Handpump', 'Municipal supply', 'Tanker', 'Not available'] }),
      f('sd_workertoilet', 'Toilet available for workers', 'yesno'),
      f('sd_holidays', 'Holidays and exam dates', 'longtext'),
    ] },
    { id: 'sec_take', title: '4. Take with you', fields: [
      f('tk_tape', 'Measuring tape (30 m and 5 m)', 'yesno'),
      f('tk_phone', 'Phone with location (GPS) on', 'yesno'),
      f('tk_hammer', 'Small hammer (to tap plaster)', 'yesno'),
      f('tk_torch', 'Torch', 'yesno'),
      f('tk_tester', 'Tester / moisture meter (if available)', 'yesno'),
      f('tk_power', 'Power bank', 'yesno'),
    ] },
    { id: 'sec_collect', title: '5. Collect from school', fields: [
      f('cl_records', 'Earlier repair / renovation records and any CSR work already going on', 'yesno'),
      f('cl_plan', 'Site plan / building drawing (if available)', 'yesno'),
      f('cl_notes', 'Details of records collected', 'longtext'),
    ] },
    { id: 'sec_close', title: '6. Close of visit', fields: [
      f('cv_priority', "School's priority list (read back to the Head Master)", 'longtext'),
      f('cv_entry', 'Entry, timings and contact person confirmed', 'longtext'),
      f('cv_remarks', "Engineer's remarks", 'longtext'),
      f('cv_overall', 'Overall condition of school', 'choice', { options: ['Good', 'Fair', 'Poor', 'Very poor'] }),
      f('cv_status', 'Survey status', 'choice', { options: ['In progress', 'Complete', 'Needs second visit'] }),
    ] },
  ];

  const CHECKLIST = [
    { id: 'ck_a', title: 'A. Site access and services', items: [
      it('ck_a1', 'A1', 'Can material vehicles reach the school?', 'Note road width, the type of vehicle that can reach, the nearest unloading spot, and a place to store material.'),
      it('ck_a2', 'A2', 'Electricity and water during work', 'Is electricity available (single phase / three phase)? What is the water source? Is a toilet available for workers? Note holidays and exam dates.'),
    ] },
    /* uploads: rough plan and the school's own demand list (images up to 15 MB each, kept at full quality) */
    { id: 'ck_b', title: 'B. Rough site plan', items: [
      Object.assign(it('ck_b1', 'B1', 'Rough site plan of the school', 'Draw a rough plan on paper (buildings, rooms, toilets, gate, playground, water points, trees) and upload a clear photo of it, or upload an existing plan / drawing. Images up to 15 MB each.'), { ans: [], work: [], upload: true }),
    ] },
    { id: 'ck_c', title: 'C. Demand list / notes from school management', items: [
      Object.assign(it('ck_c1', 'C1', 'Demand list / notes from school management', 'Upload photos of the written demand list or notes given by the Head Master / school management (images up to 15 MB each). Write the main points in Notes.'), { ans: [], work: [], upload: true }),
    ] },
    { id: 'ck_1', title: '1. Terrace waterproofing', items: [
      it('ck_1_1', '1.1', 'Existing waterproofing', 'What type is it and how old? Look for cracks, bubbles, peeling and plants growing.'),
      it('ck_1_2', '1.2', 'Slope and water collection', 'Look for water marks and low spots. The roof should slope towards the drain (about 1 in 100).'),
      it('ck_1_3', '1.3', 'Rainwater pipes and outlets', 'Count the pipes and note size. Are any blocked? Are more needed?'),
      it('ck_1_4', '1.4', 'Terrace access', 'Is there a staircase or ladder? Where can a new ladder be fixed?'),
    ] },
    { id: 'ck_2', title: '2. External painting', items: [
      it('ck_2_1', '2.1', 'Wall / ceiling surface', 'Look for peeling or powdery paint, green algae, white salt marks and damp. Use a moisture meter if you have one.'),
      it('ck_2_2', '2.2', 'Plaster repair', 'Look for hollow plaster. Note fine cracks and big cracks. Estimate the area to be repaired. (Polymer modified mortar required?)'),
      it('ck_2_3', '2.3', 'Metal and wood parts', 'Check grills, gates and doors. Are they rusted? Do they need primer?'),
      it('ck_2_4', '2.4', 'External dimensions and sketch for painting', 'Measure all outside faces of the building and make a sketch for the painting area.'),
    ] },
    { id: 'ck_3', title: '3. Indoor sports', items: [
      it('ck_3_1', '3.1', 'Space', 'Which room, hall or verandah is used? Measure its size.'),
      it('ck_3_2', '3.2', 'Equipment', 'Cricket kit, football, ludo, chess, carrom: count them and note condition.'),
      it('ck_3_3', '3.3', 'Tables and chairs', 'Note how many tables and chairs are needed. Carrom table size and space available.'),
      it('ck_3_4', '3.4', 'Walls, ceiling and floor', 'Look for cracks, leaks, damp and broken floor.'),
      it('ck_3_5', '3.5', 'Electrical', 'Check lights, fans and sockets. Do they work?'),
    ] },
    { id: 'ck_4', title: '4. Computer room / innovation lab', items: [
      it('ck_4_1', '4.1', 'Power points', 'How many points are there? Is there a separate circuit and spare capacity on the main board?'),
      it('ck_4_2', '4.2', 'Earthing (safety ground connection)', 'Is there an earth pit? If you have a tester, write the reading.'),
      it('ck_4_3', '4.3', 'Furniture', 'Count tables and chairs and note their condition.'),
      it('ck_4_4', '4.4', 'Floor, walls and ceiling', 'Note their condition.'),
    ] },
    { id: 'ck_5', title: '5. Flag pole', items: [
      it('ck_5_1', '5.1', 'Existing pole', 'Is there a pole? Note height, material and condition.'),
      it('ck_5_2', '5.2', 'Base of the pole', 'Look for cracks, leaning and rust at the bottom. Check that the pole stands straight.'),
      it('ck_5_3', '5.3', 'Fittings', 'Check the flag rod, pulley, rope and cleat (rope holder).'),
    ] },
    { id: 'ck_6', title: '6. Playground and sports courts', items: [
      it('ck_6_1', '6.1', 'Open area', 'Measure length x breadth. Note slope, pits, stones and water-logging.'),
      it('ck_6_2', '6.2', 'Play equipment', 'Swings, slide, merry-go-round: count them. Look for rust, sharp edges and loose fixing.'),
      it('ck_6_3', '6.3', 'Courts and nets', 'Volleyball, football, badminton, kabaddi, kho-kho: check markings, poles and net posts.'),
    ] },
    { id: 'ck_7', title: '7. Pathways / paver blocks', items: [
      it('ck_7_1', '7.1', 'Existing surface', 'Note the type, the damaged area and any uneven levels.'),
      it('ck_7_2', '7.2', 'Base below the surface', 'Is the ground firm? Is there a sand layer? Is there an edge support (kerb)?'),
    ] },
    { id: 'ck_8', title: '8. Boys toilets', items: [
      it('ck_8_1', '8.1', 'Building and roof', "Is the roof present and are walls sound? If it is open-roofed or broken down, choose 'Needs rebuild'. Rebuilding needs written approval."),
      it('ck_8_2', '8.2', 'Number of fittings', 'Count toilet seats (WC), urinals and wash basins: total and working.'),
      it('ck_8_3', '8.3', 'Condition of fittings', 'Look for cracked pans, broken seats and missing flush tank or flush.'),
      it('ck_8_4', '8.4', 'Water supply', 'Note water source, tank connection, pipes, taps, water pressure and leaks.'),
      it('ck_8_5', '8.5', 'Drainage', 'Check the trap, blockage, floor slope, soak pit or septic tank and manhole cover.'),
      it('ck_8_6', '8.6', 'Floor and wall tiles', 'Look for broken tiles and slippery floor. Wall tiles are to be fixed up to 3 ft height.'),
      it('ck_8_7', '8.7', 'Urinals', 'Check partitions or trough, spacing and flushing.'),
    ] },
    { id: 'ck_9', title: '9. Girls toilets', items: [
      it('ck_9_1', '9.1', 'Building and roof', "Is the roof present and are walls sound? If it is open-roofed or broken down, choose 'Needs rebuild'. Rebuilding needs written approval."),
      it('ck_9_2', '9.2', 'Number of fittings', 'Count toilet seats (WC), urinals and wash basins: total and working.'),
      it('ck_9_3', '9.3', 'Condition of fittings', 'Look for cracked pans, broken seats and missing flush tank or flush.'),
      it('ck_9_4', '9.4', 'Water supply', 'Note water source, tank connection, pipes, taps, water pressure and leaks.'),
      it('ck_9_5', '9.5', 'Drainage', 'Check the trap, blockage, floor slope, soak pit or septic tank and manhole cover.'),
      it('ck_9_6', '9.6', 'Floor and wall tiles', 'Look for broken tiles and slippery floor. Wall tiles are to be fixed up to 3 ft height.'),
    ] },
    { id: 'ck_10', title: '10. Staff toilets', items: [
      it('ck_10_1', '10.1', 'Building and roof', "Is the roof present and are walls sound? If it is open-roofed or broken down, choose 'Needs rebuild'. Rebuilding needs written approval."),
      it('ck_10_2', '10.2', 'Number of fittings', 'Count toilet seats (WC), urinals and wash basins: total and working.'),
      it('ck_10_3', '10.3', 'Condition of fittings', 'Look for cracked pans, broken seats and missing flush tank or flush.'),
      it('ck_10_4', '10.4', 'Drainage', 'Check the trap, blockage, floor slope, soak pit or septic tank and manhole cover.'),
      it('ck_10_5', '10.5', 'Floor and wall tiles', 'Look for broken tiles and slippery floor. Wall tiles are to be fixed up to 3 ft height.'),
    ] },
    { id: 'ck_11', title: '11. Handwash area', items: [
      it('ck_11_1', '11.1', 'Places and number', 'Near toilets and meal area. How many students use one tap?'),
      it('ck_11_2', '11.2', 'Basin / trough and taps', 'Note condition. Is the height suitable for children? Any leaks?'),
      it('ck_11_3', '11.3', 'Drain', 'Check the trap, slope and soak pit. There should be no standing water.'),
      it('ck_11_4', '11.4', 'Wall tiles (splash area)', 'Note tile height and condition.'),
      it('ck_11_5', '11.5', 'Soap holders', 'Are they present? Are they fixed on the wall?'),
      it('ck_11_6', '11.6', 'Water supply', 'Note water source, pressure and storage.'),
    ] },
    { id: 'ck_12', title: '12. Drinking water', items: [
      it('ck_12_1', '12.1', 'Water source', 'Handpump, borewell, municipal supply or tank? Is the supply reliable?'),
      it('ck_12_2', '12.2', 'Water tank', 'Note capacity, material, cover, condition and when it was last cleaned.'),
      it('ck_12_3', '12.3', 'Tank location and support', 'Is the tank in a shaded place? Can the roof slab or stand take the weight?'),
      it('ck_12_4', '12.4', 'Water filter', 'Is an RO / UF filter present and working? Are power and drain available?'),
      it('ck_12_5', '12.5', 'Taps and bottle-filling points', 'Count them and note condition. Check the platform and drain.'),
      it('ck_12_6', '12.6', 'Power for the filter', 'Is there a power point near the filter? Is it earthed?'),
    ] },
    { id: 'ck_13', title: '13. Gates and school name board', items: [
      it('ck_13_1', '13.1', 'Main gate', 'Note width, type and material. Look for rust, drooping, hinges, lock and pillars.'),
      it('ck_13_2', '13.2', 'Other gates', 'Count them and note condition.'),
      it('ck_13_3', '13.3', 'School name board', 'Is there one? Note size and language (Hindi / English). Is it fixed above or on the gate?'),
      it('ck_13_4', '13.4', 'Board support', 'Where can the steel frame be fixed? Is it exposed to strong wind? Is it visible from the road?'),
    ] },
    { id: 'ck_14', title: '14. Access for disabled persons', items: [
      it('ck_14_1', '14.1', 'Entrance and level changes', 'Count steps and note step height and door threshold.'),
      it('ck_14_2', '14.2', 'Ramp', 'Is there one, or is a new one needed? Slope should not be steeper than 1 in 12. Note width and flat landing.'),
      it('ck_14_3', '14.3', 'Handrails', 'Are they present? Note height on ramps and stairs.'),
      it('ck_14_4', '14.4', 'Walking path', 'Note clear width of paths and doors. Is the floor non-slip?'),
      it('ck_14_5', '14.5', 'Toilet for disabled persons', 'Is there one? Check grab bars, door width and sign board.'),
    ] },
    { id: 'ck_15', title: '15. Boundary wall', items: [
      it('ck_15_1', '15.1', 'Length and height', 'Measure total length and each side. Brick, block, stone or fence?'),
      it('ck_15_2', '15.2', 'Strength', 'Look for cracks, leaning, missing parts, pillars and top coping.'),
      it('ck_15_3', '15.3', 'Foundation', 'Is the base exposed or washed out? Is there a drain along the wall?'),
      it('ck_15_4', '15.4', 'Plaster and finish', 'Mark the damaged areas that need new plaster.'),
      it('ck_15_5', '15.5', 'Painting area', 'Both sides or inside only? Measure the area.'),
    ] },
    { id: 'ck_16', title: '16. Landscaping / green area', items: [
      it('ck_16_1', '16.1', 'Open area available', 'Measure the area available for plants and lawn.'),
    ] },
    { id: 'ck_17', title: '17. Rain water harvesting', items: [
      it('ck_17_1', '17.1', 'Rain water harvesting', 'Condition. Is it in operating condition?'),
    ] },
    { id: 'ck_18', title: '18. Mid-day meal area / prayer / assembly', items: [
      it('ck_18_1', '18.1', 'Floor condition', 'Size, floor finishing, condition, drainage, safe access.'),
      it('ck_18_2', '18.2', 'Roof and GI shed condition', 'Structure condition and roofing condition.'),
    ] },
  ];

  /* Measurements and counts asked in rooms / spaces.
     groups = which kinds of space show the box: room, toilet, corridor, open, wall, water (none = all). */
  const ROOMS = ['room'], ROOMLIKE = ['room', 'toilet', 'corridor'];
  const SPACE_FIELDS = [
    { id: 'sp_size', title: 'Size', fields: [
      f('sp_len', 'Length (m)', 'number'),
      f('sp_bre', 'Breadth (m)', 'number', { groups: ['room', 'toilet', 'corridor', 'open', 'water'] }),
      f('sp_ht', 'Height (m)', 'number', { groups: ['room', 'toilet', 'corridor', 'wall'] }),
      f('sp_area', 'Floor area (sq. m, auto)', 'calc', { calc: 'mul', of: ['sp_len', 'sp_bre'], groups: ['room', 'toilet', 'corridor', 'open', 'water'] }),
      f('sp_wall', 'Wall area, gross (sq. m, auto)', 'calc', { calc: 'wall', of: ['sp_len', 'sp_bre', 'sp_ht'], groups: ['room', 'toilet'] }),
      f('sp_wall1', 'Wall area, one face (sq. m, auto)', 'calc', { calc: 'mul', of: ['sp_len', 'sp_ht'], groups: ['wall'] }),
      f('sp_seats', 'Students who can sit', 'number', { groups: ROOMS }),
    ] },
    { id: 'sp_counts', title: 'Counts', fields: [
      f('sp_doors', 'Doors (nos.)', 'number', { groups: ['room', 'toilet'] }),
      f('sp_windows', 'Windows (nos.)', 'number', { groups: ROOMLIKE }),
      f('sp_lights', 'Lights total (nos.)', 'number', { groups: ['room', 'toilet', 'corridor', 'open'] }),
      f('sp_lightsok', 'Lights working (nos.)', 'number', { groups: ['room', 'toilet', 'corridor', 'open'] }),
      f('sp_fans', 'Fans total (nos.)', 'number', { groups: ['room', 'corridor'] }),
      f('sp_fansok', 'Fans working (nos.)', 'number', { groups: ['room', 'corridor'] }),
      f('sp_sockets', 'Switch boards / sockets (nos.)', 'number', { groups: ROOMS }),
      f('sp_benches', 'Benches / desks total (nos.)', 'number', { groups: ROOMS }),
      f('sp_benchgood', 'Benches good (nos.)', 'number', { groups: ROOMS }),
      f('sp_benchrep', 'Benches repairable (nos.)', 'number', { groups: ROOMS }),
      f('sp_benchbad', 'Benches beyond repair (nos.)', 'number', { groups: ROOMS }),
      f('sp_boards', 'Writing boards (nos.)', 'number', { groups: ROOMS }),
      f('sp_almirah', 'Almirahs / cupboards (nos.)', 'number', { groups: ROOMS }),
    ] },
    { id: 'sp_toilet', title: 'Toilet fittings', groups: ['toilet'], fields: [
      f('sp_wc', 'WC seats total (nos.)', 'number'),
      f('sp_wcok', 'WC seats working (nos.)', 'number'),
      f('sp_uri', 'Urinals total (nos.)', 'number'),
      f('sp_uriok', 'Urinals working (nos.)', 'number'),
      f('sp_basin', 'Wash basins total (nos.)', 'number'),
      f('sp_basinok', 'Wash basins working (nos.)', 'number'),
      f('sp_taps', 'Taps (nos.)', 'number'),
      f('sp_exhaust', 'Exhaust fans (nos.)', 'number'),
    ] },
    { id: 'sp_water', title: 'Taps and platform', groups: ['water'], fields: [
      f('sp_wtaps', 'Taps total (nos.)', 'number'),
      f('sp_wtapsok', 'Taps working (nos.)', 'number'),
      f('sp_plat', 'Platform / trough length (m)', 'number'),
    ] },
    { id: 'sp_work', title: 'Work needed', fields: [
      f('sp_worktypes', 'Work needed here', 'multi', { options: ['Painting', 'Plaster repair', 'Waterproofing', 'Flooring', 'Wall tiles', 'Electrical', 'Plumbing', 'Doors / windows', 'Grills', 'Furniture', 'Writing board', 'False ceiling', 'Rebuild', 'No work'] }),
      f('sp_overall', 'Overall condition', 'choice', { options: ['Good', 'Fair', 'Poor', 'Very poor'] }),
    ] },
  ];

  const ROOM_CHECKLIST = [
    { id: 'rk_1', title: '1. Room — size, walls, ceiling, floor', items: [
      it('rk_1_1', '1.1', 'Room size and seating', 'Measure length x breadth. Note how many students can sit.'),
      it('rk_1_2', '1.2', 'Wall plaster', 'Tap the wall with a hammer. A hollow sound means loose plaster. Look for cracks, peeling and damp patches.'),
      it('rk_1_3', '1.3', 'Ceiling', 'Look for leak stains, falling plaster, broken concrete or rusted rod showing.'),
      it('rk_1_4', '1.4', 'Floor', 'Look for broken, uneven or sunken floor.'),
      it('rk_1_5', '1.5', 'Electrical points', 'Count switches, sockets, lights and fan points. Note how many work and how many do not.'),
    ] },
    { id: 'rk_2', title: '2. Student benches', items: [
      it('rk_2_1', '2.1', 'Number of benches', 'Count benches / desks and seats on each bench.'),
      it('rk_2_2', '2.2', 'Condition of benches', 'Count how many are good, how many can be repaired and how many are beyond repair. Can be given as a percentage also.'),
      it('rk_2_3', '2.3', 'Are the benches stable?', 'Shake each bench. Look for loose bolts, broken welds, rotten wood or termite.'),
      it('rk_2_4', '2.4', 'Can they be reused?', 'Note the material (wood or steel). Can it be repaired instead of replaced?'),
    ] },
    { id: 'rk_3', title: '3. Writing boards', items: [
      it('rk_3_1', '3.1', 'Board in the room', 'Count boards in the room. Note if there is no board.'),
      it('rk_3_2', '3.2', 'Board size', 'Measure width x height.'),
      it('rk_3_3', '3.3', 'What to do with each board', 'Decide for each board: keep, repair or replace.'),
    ] },
    { id: 'rk_4', title: '4. Almirahs / cupboards', items: [
      it('rk_4_1', '4.1', 'Number and type', 'Count the cupboards. Steel, wood or built-in shelf?'),
      it('rk_4_2', '4.2', 'Condition', 'Look for rust, doors that do not close, broken hinges or handles. Do locks work? Are keys available?'),
      it('rk_4_3', '4.3', 'Shelves', 'Look for sagging shelves. Note number of shelves and gap between them. Is any stone (Kota) shelf cracked or without support?'),
    ] },
    { id: 'rk_5', title: '5. Lights and fans', items: [
      it('rk_5_1', '5.1', 'Lights', 'Count lights and how many work. Type: tube, CFL or LED.'),
      it('rk_5_2', '5.2', 'Fans', 'Count fans and how many work. Check the regulators. Fan blades should be at least 2.4 m (8 ft) above the floor.'),
      it('rk_5_3', '5.3', 'Wiring', 'Is wiring hidden in the wall or on the surface? Look for damaged wire cover, loose joints and overloaded points.'),
      it('rk_5_4', '5.4', 'Main electrical board and switches', 'Is there a main board (DB) with safety switches (MCB / RCCB)? Note condition and whether there is space for extra load.'),
      it('rk_5_5', '5.5', 'Earthing (safety ground connection)', 'Is there an earthing wire or earth pit? If you have a tester, write the reading.'),
    ] },
    { id: 'rk_6', title: '6. Doors and windows', items: [
      it('rk_6_1', '6.1', 'Number and type', 'Count doors and windows. Wood, steel or aluminium? Measure width x height.'),
      it('rk_6_2', '6.2', 'Frames', 'Look for rust, rotting wood, termite, loose fixing and cracks above or below the opening.'),
      it('rk_6_3', '6.3', 'Opening and closing', 'Look for bent, stuck or dropping shutters. Does it close fully?'),
      it('rk_6_4', '6.4', 'Glass', 'Look for broken or missing glass and sharp edges.'),
      it('rk_6_5', '6.5', 'Safety grills and mesh', 'Are they there? Rusted? Can children climb them? Make sure the exit is not blocked.'),
    ] },
    { id: 'rk_7', title: '7. Internal painting', items: [
      it('rk_7_1', '7.1', 'Wall / ceiling surface', 'Look for peeling or powdery paint, green algae, white salt marks and damp. Use a moisture meter if you have one.'),
      it('rk_7_2', '7.2', 'Plaster repair', 'Look for hollow plaster. Note fine cracks and big cracks. Estimate the area to be repaired. (Polymer modified mortar required?)'),
      it('rk_7_3', '7.3', 'Metal and wood parts', 'Check grills, gates and doors. Are they rusted? Do they need primer?'),
    ] },
  ];

  const TOILET_CHECKLIST = [
    { id: 'tk_1', title: '1. Toilet — building, fittings, water, drainage', items: [
      it('tk_1_1', '1.1', 'Building and roof', "Is the roof present and are walls sound? If it is open-roofed or broken down, choose 'Needs rebuild'. Rebuilding needs written approval."),
      it('tk_1_2', '1.2', 'Number of fittings', 'Count toilet seats (WC), urinals and wash basins: total and working.'),
      it('tk_1_3', '1.3', 'Condition of fittings', 'Look for cracked pans, broken seats and missing flush tank or flush.'),
      it('tk_1_4', '1.4', 'Water supply', 'Note water source, tank connection, pipes, taps, water pressure and leaks.'),
      it('tk_1_5', '1.5', 'Drainage', 'Check the trap, blockage, floor slope, soak pit or septic tank and manhole cover.'),
      it('tk_1_6', '1.6', 'Floor and wall tiles', 'Look for broken tiles and slippery floor. Wall tiles are to be fixed up to 3 ft height.'),
      it('tk_1_7', '1.7', 'Urinals', 'Check partitions or trough, spacing and flushing.'),
    ] },
  ];

  /* Kinds of room / space.
     group = which room boxes it shows; checklist = 'room' (room checklist), 'toilet' (toilet checklist) or false. */
  const SPACE_TYPES = [
    { id: 'classroom', label: 'Classroom', group: 'room', checklist: 'room' },
    { id: 'principal', label: 'Principal room', group: 'room', checklist: 'room' },
    { id: 'staff', label: 'Staff room', group: 'room', checklist: 'room' },
    { id: 'office', label: 'Office', group: 'room', checklist: 'room' },
    { id: 'store', label: 'Store room', group: 'room', checklist: 'room' },
    { id: 'computer', label: 'Computer room / Innovation lab', group: 'room', checklist: 'room' },
    { id: 'library', label: 'Library', group: 'room', checklist: 'room' },
    { id: 'lab', label: 'Science lab', group: 'room', checklist: 'room' },
    { id: 'hall', label: 'Hall', group: 'room', checklist: 'room' },
    { id: 'sports', label: 'Indoor sports room', group: 'room', checklist: 'room' },
    { id: 'kitchen', label: 'Kitchen / Mid-day meal', group: 'room', checklist: 'room' },
    { id: 'gallery', label: 'Corridor / Gallery', group: 'corridor', checklist: false },
    { id: 'verandah', label: 'Verandah', group: 'corridor', checklist: false },
    { id: 'stair', label: 'Staircase', group: 'corridor', checklist: false },
    { id: 'terrace', label: 'Terrace / Roof', group: 'open', checklist: false },
    { id: 'toiletb', label: 'Boys toilet', group: 'toilet', checklist: 'toilet' },
    { id: 'toiletg', label: 'Girls toilet', group: 'toilet', checklist: 'toilet' },
    { id: 'toilets', label: 'Staff toilet', group: 'toilet', checklist: 'toilet' },
    { id: 'toiletd', label: 'Toilet for disabled persons', group: 'toilet', checklist: 'toilet' },
    { id: 'handwash', label: 'Handwash area', group: 'water', checklist: false },
    { id: 'water', label: 'Drinking water point', group: 'water', checklist: false },
    { id: 'assembly', label: 'Assembly / Prayer area', group: 'open', checklist: false },
    { id: 'play', label: 'Playground / Play area', group: 'open', checklist: false },
    { id: 'garden', label: 'Garden / Green area', group: 'open', checklist: false },
    { id: 'gate', label: 'Main gate / Entrance', group: 'wall', checklist: false },
    { id: 'boundary', label: 'Boundary wall', group: 'wall', checklist: false },
    { id: 'open', label: 'Open area / Parking', group: 'open', checklist: false },
    { id: 'outside', label: 'Building outside (elevation)', group: 'wall', checklist: false },
    { id: 'other', label: 'Other', group: 'room', checklist: false },
  ];

  /* Answer buttons that fit the question. Points not listed here use the condition buttons
     (Good / Repair needed / Replace needed / Not available / Not applicable / Needs rebuild).
     [choices, choices that mean work is needed]. An empty list = no buttons (only Count / Size and Notes). */
  const SUFF = ['Sufficient', 'More needed', 'Not available'];
  const ANSWERS = {
    ck_a1: [['Yes', 'Small vehicles only', 'No'], []],
    ck_a2: [['Both available', 'Electricity only', 'Water only', 'Not available'], []],
    ck_1_4: [['Staircase', 'Ladder', 'No access — ladder needed'], ['No access — ladder needed']],
    ck_2_4: [['Done', 'Not done'], []],
    ck_3_1: [['Available', 'Not available'], ['Not available']],
    ck_8_2: [SUFF, ['More needed', 'Not available']],
    ck_9_2: [SUFF, ['More needed', 'Not available']],
    ck_10_2: [SUFF, ['More needed', 'Not available']],
    ck_11_1: [SUFF, ['More needed', 'Not available']],
    ck_12_1: [['Handpump', 'Borewell', 'Municipal supply', 'Tank', 'Not available'], ['Not available']],
    ck_12_3: [['Suitable', 'Not suitable'], ['Not suitable']],
    ck_12_6: [['Available and earthed', 'Available, not earthed', 'Not available'], ['Available, not earthed', 'Not available']],
    ck_13_4: [['Suitable place available', 'Not suitable'], []],
    ck_14_1: [['Level entry', 'Steps — ramp needed'], ['Steps — ramp needed']],
    ck_15_1: [['Brick', 'Block', 'Stone', 'Fence', 'Not available'], ['Not available']],
    ck_15_5: [['Both sides', 'Inside only', 'Not required'], []],
    ck_16_1: [['Available', 'Not available'], []],
    rk_1_1: [['Sufficient', 'Not sufficient'], ['Not sufficient']],
    rk_2_1: [SUFF, ['More needed', 'Not available']],
    rk_2_3: [['Stable', 'Some loose', 'Not stable'], ['Some loose', 'Not stable']],
    rk_2_4: [['Yes — repair and reuse', 'Partly', 'No — replace'], ['Yes — repair and reuse', 'Partly', 'No — replace']],
    rk_3_1: [['Available', 'Not available'], ['Not available']],
    rk_3_2: [[], []],
    rk_3_3: [['Keep', 'Repair', 'Replace'], ['Repair', 'Replace']],
    rk_4_1: [['Steel', 'Wood', 'Built-in shelf', 'Not available'], []],
    rk_5_3: [['Concealed — good', 'Surface — good', 'Damaged — repair', 'Replace'], ['Damaged — repair', 'Replace']],
    rk_6_1: [['Wood', 'Steel', 'Aluminium', 'Mixed'], []],
    tk_1_2: [SUFF, ['More needed', 'Not available']],
  };
  const withAnswers = (sections) => sections.map((sec) => Object.assign({}, sec, { items: sec.items.map((x) => {
    const a = ANSWERS[x.id];
    if (!a) return x;
    const ans = a[0].length && !a[0].includes('Not applicable') ? a[0].concat('Not applicable') : a[0].slice();
    return Object.assign({}, x, { ans, work: a[1].slice() });
  }) }));

  /* Work quantities (optional, Settings › Work quantities). calc: how the quantity is worked out
     area = Nos × L × B · wall = Nos × L × H · vol = Nos × L × B × H · len = Nos × L · nos = Nos */
  const q = (id, name, unit, calc) => ({ id, name, unit, calc });
  const QTY_CATALOG = [
    { id: 'qc_civil', name: 'Civil', items: [
      q('qi_plrep', 'Plaster repair (hack and re-plaster)', 'sq.m', 'wall'),
      q('qi_plnew', 'New cement plaster 12 mm', 'sq.m', 'wall'),
      q('qi_pmm', 'Polymer modified mortar repair', 'sq.m', 'wall'),
      q('qi_crack', 'Crack filling', 'm', 'len'),
      q('qi_brick', 'Brick work (new / rebuild)', 'cu.m', 'vol'),
      q('qi_pcc', 'PCC', 'cu.m', 'vol'),
      q('qi_rcc', 'RCC', 'cu.m', 'vol'),
      q('qi_dismantle', 'Dismantling', 'cu.m', 'vol'),
      q('qi_att', 'Anti-termite treatment (ATT)', 'sq.m', 'area'),
    ] },
    { id: 'qc_paint', name: 'Painting', items: [
      q('qi_pint', 'Interior wall painting (putty + primer + 2 coats)', 'sq.m', 'wall'),
      q('qi_pceil', 'Ceiling painting', 'sq.m', 'area'),
      q('qi_pext', 'Exterior painting (weather proof)', 'sq.m', 'wall'),
      q('qi_enamel', 'Enamel paint on doors / windows / grills', 'sq.m', 'area'),
      q('qi_pbound', 'Boundary wall painting', 'sq.m', 'wall'),
    ] },
    { id: 'qc_floor', name: 'Flooring and tiles', items: [
      q('qi_floor', 'Flooring (tiles / kota)', 'sq.m', 'area'),
      q('qi_dado', 'Wall tiles / dado', 'sq.m', 'wall'),
      q('qi_skirt', 'Skirting', 'm', 'len'),
      q('qi_paver', 'Paver blocks', 'sq.m', 'area'),
    ] },
    { id: 'qc_wp', name: 'Waterproofing', items: [
      q('qi_wpterr', 'Terrace waterproofing', 'sq.m', 'area'),
      q('qi_wptoilet', 'Toilet / wet area waterproofing', 'sq.m', 'area'),
      q('qi_rwp', 'Rain water pipe', 'm', 'len'),
    ] },
    { id: 'qc_dw', name: 'Doors, windows and grills', items: [
      q('qi_door', 'Door shutter (new / replace)', 'nos', 'nos'),
      q('qi_window', 'Window shutter (new / replace)', 'nos', 'nos'),
      q('qi_glass', 'Glass replacement', 'sq.m', 'area'),
      q('qi_grill', 'MS grill', 'sq.m', 'area'),
      q('qi_hw', 'Hardware (hinges, locks, handles)', 'nos', 'nos'),
    ] },
    { id: 'qc_elec', name: 'Electrical', items: [
      q('qi_led', 'LED tube light', 'nos', 'nos'),
      q('qi_fan', 'Ceiling fan', 'nos', 'nos'),
      q('qi_exh', 'Exhaust fan', 'nos', 'nos'),
      q('qi_sb', 'Switch board', 'nos', 'nos'),
      q('qi_point', 'Wiring points', 'nos', 'nos'),
      q('qi_wire', 'Wiring', 'm', 'len'),
      q('qi_db', 'Distribution board with MCB / RCCB', 'nos', 'nos'),
      q('qi_earth', 'Earthing pit', 'nos', 'nos'),
    ] },
    { id: 'qc_plumb', name: 'Plumbing and sanitary', items: [
      q('qi_wc', 'WC (Indian / western)', 'nos', 'nos'),
      q('qi_urinal', 'Urinal', 'nos', 'nos'),
      q('qi_basin', 'Wash basin', 'nos', 'nos'),
      q('qi_tap', 'Taps', 'nos', 'nos'),
      q('qi_pipe', 'CPVC / UPVC pipe', 'm', 'len'),
      q('qi_tank', 'Water tank', 'nos', 'nos'),
      q('qi_ro', 'RO / water filter', 'nos', 'nos'),
      q('qi_drain', 'Drain / soak pit repair', 'nos', 'nos'),
    ] },
    { id: 'qc_furn', name: 'Furniture and boards', items: [
      q('qi_benchrep', 'Bench repair', 'nos', 'nos'),
      q('qi_benchnew', 'New bench / desk', 'nos', 'nos'),
      q('qi_board', 'Writing board', 'nos', 'nos'),
      q('qi_almirah', 'Almirah', 'nos', 'nos'),
    ] },
    { id: 'qc_other', name: 'Other works', items: [
      q('qi_ramp', 'Ramp', 'sq.m', 'area'),
      q('qi_rail', 'Handrail', 'm', 'len'),
      q('qi_flag', 'Flag pole', 'nos', 'nos'),
      q('qi_nameboard', 'School name board', 'sq.m', 'area'),
      q('qi_bwall', 'Boundary wall (new / rebuild)', 'm', 'len'),
      q('qi_gate', 'Gate (new / repair)', 'nos', 'nos'),
      q('qi_play', 'Play equipment', 'nos', 'nos'),
    ] },
  ];

  const PHOTO_TAGS = ['Wide view', 'Close-up', 'Front wall', 'Back wall', 'Left wall', 'Right wall',
    'Ceiling', 'Floor', 'Door', 'Window', 'Electrical', 'Furniture', 'Damage', 'Leak / damp', 'Crack', 'Reference'];

  /* Boxes that belong to ONE school only. Everything else is copied to the next new school. */
  self.CU_PER_SCHOOL = ['sd_name', 'sd_udise', 'sd_date', 'sd_village', 'sd_pin', 'sd_gps', 'sd_address', 'sd_hm', 'sd_hmmobile',
    'sd_boys', 'sd_girls', 'sd_totstu', 'sd_teachers', 'sd_buildings', 'sd_floors', 'sd_year', 'sd_rooms', 'sd_bua', 'sd_plot', 'sd_vehicle',
    'cl_records', 'cl_plan', 'cl_notes', 'cv_priority', 'cv_entry', 'cv_remarks', 'cv_overall', 'cv_status'];

  self.CU_TEMPLATE_VERSION = 3;
  self.CU_DEFAULT_TEMPLATE = function () {
    return JSON.parse(JSON.stringify({
      v: 1,
      tv: 3,
      name: 'School site visit — Civil, MEP and infrastructure',
      conditions: CONDITIONS,
      school: SCHOOL,
      checklist: withAnswers(CHECKLIST),
      spaceFields: SPACE_FIELDS,
      roomChecklist: withAnswers(ROOM_CHECKLIST),
      toiletChecklist: withAnswers(TOILET_CHECKLIST),
      qtyCatalog: QTY_CATALOG,
      spaceTypes: SPACE_TYPES,
      photoTags: PHOTO_TAGS,
    }));
  };

  /* Guidance shown in Help — from the checklist's own rules for the visit. */
  self.CU_VISIT_RULES = [
    'Measure on site. Do not guess any quantity.',
    'Take photos of every item you check: one wide photo and one close-up. Photos must be of this school only. Add a reference photo if you have one.',
    'Count room by room. Add each room as its own space so its name is on every photo.',
    "Repair and reuse first. Choose 'Replace needed' only if the item cannot be repaired, and write the reason in Notes.",
    "If a toilet, shed or room is too damaged and needs to be rebuilt, choose 'Needs rebuild' and inform your manager. Rebuilding needs written approval.",
    'Do not promise anything to the school. Any extra work or change needs written approval first. Write it in Notes.',
    "At the end, read the school's priority list back to the Head Master. Confirm entry, timings and contact person.",
  ];
})();
