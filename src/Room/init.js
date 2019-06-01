/**
 * Initial a room, set up its memory and fields.
 *
 * Design and save a build plan
 * 0) check whether if this room is new to me or it's a netural room
 * 1) clean all old structure except
 * 2) check source count & decide which plan to use
 * 2.1
 */
Room.prototype.init = function() {
  if (!this.room.spawnQueue) this.memory.spawnQueue = [];
  if (this.room.preSpawn === undefined) this.memory.preSpawn = false;
  // only init new room, set time out &
  // if room == mine, set area & defense
  // if room == hostile, set avoid & scan for structures
  // source, mineral, portal, powerBank
  switch (this.type) {
    case "my":
      const sources = this.find(FIND_SOURCES);
      const squareBy7 = this.findSpaceForSquare(7);
      switch (sources.length) {
        case 2:
          // 2 source
          for (source of sources) {
            let pos = source.findClosestByPath(squareBy7, {
              algorithm: "dijkstra"
            });
            if (source.pos.inRangeToPos(pos, 10)) {
              /* place 30 extension outpost layout */
            } else {
              /* place 6 stars of 5 layout */
            }
          }
          break;
        case 1:
          // 1 source
          // TODO Desing star layout & 60 extension layout
          /* if (haveSpace) place 60 extension outposet */
          /* else place star design source */
      }
      break;
    case "hostile":
      /** structures: Object[] Format as [_.groupBy]{@link https://lodash.com/docs/3.10.1#groupBy} @example {STRUCTURE_CONST_A:[StructureA1, StructureA2, ...], STRUCTURE_CONST_B: [StructureB1, ...]} */
      const structures = _.groupBy(this.find(FIND_HOSTILE_STRUCTURES)
        .map(({
          id,
          pos,
          structureType
        }) => ({
          id,
          pos,
          structureType /* Trim off other properties */
        })), "structureType"); /* Group by property "structureType" */
      // save room structure

      /* Generated by planer
      {
        "structures": {
          "extension": {
            "pos": [{
              "x": 7,
              "y": 19
            }, {
              "x": 6,
              "y": 20
            }, {
              "x": 7,
              "y": 20
            }, {
              "x": 8,
              "y": 20
            }, {
              "x": 7,
              "y": 21
            }]
          },
          "container": {
            "pos": [{
              "x": 13,
              "y": 28
            }, {
              "x": 14,
              "y": 28
            }, {
              "x": 15,
              "y": 28
            }]
          }
        }
      }
      */
      // TODO save below to memory
      this.memory.sources
      this.memory.minerals
      this.memory.hostileStructures
      this.memory.intel = {
        structures,
        sources,
        minerals,
      }
    case "alley":
      // TODO Look for power bank & portal
      break;
    case "sourceKeeper":
      // TODO look for source
      break;
    case "core":
      // TODO Look for portal
      break;
  }
};

/**
 * Find all RoomPositions where a square of given size can fit in.
 *
 * @method
 * @param  {number} sideLength the length of the side of the square
 * @param  {RoomPosition[]} [avoid] Anything else you might want to avoid, eg. structures
 * @return {RoomPosition[]} All the centers of such squares
 */
Room.prototype.findSpaceForSquare = function(sideLength, avoid) {
  // The index of `avoid` is the distance at which it should treat the values as obstacles
  // For example, index 2 makes all tiles in radius 2 around the controller "unwalkable"
  const radius = ~~(sideLength / 2);
  avoid.map(o => o instanceof RoomPosition ? o : o.pos);
  let avoid = {
    0: avoid,
    1: [..._.map(this.find(FIND_SOURCES), s => s.pos), ..._.map(this.find(FIND_MINERALS), s => s.pos)],
    3: [this.controller.pos]
  };
  let grid = new PathFinder.CostMatrix();
  let terrain = this.getTerrain();
  let spots = [];
  let y = 50;
  // Iteration from right to left, bottom to top. â¬…â¬…â¬†
  while (y--) {
    let x = 50;
    nextPos: while (x--) {
      // Set gird as default (0) if it's a wall
      if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
        continue;
      }
      const pos = new RoomPosition(x, y, this.name);
      // Set gird as default (0) if it's close to an object of avoidance
      for (let r in avoid) {
        let objs = avoid[r];
        if (objs.find(o => o.inRangeToPos(pos, r))) {
          // move on to next RoomPosition upon finding object of avoidance
          continue nextPos;
        }
      }
      // The `score` of a tile is the minimum of its right, bottom, and bottom-right tile
      const adj = [grid.get(x + 1, y), grid.get(x, y + 1), grid.get(x + 1, y + 1)];
      const score = Math.min(...adj) + 1;
      grid.set(x, y, score);
      this.visual.text(score, pos);
      if (score >= sideLength) spots.push(new RoomPosition(x + radius, y + radius, this.name));
    }
  }
  return spots.length ? spots : null;
};
/**
 * [description]
 * @method
 * @param   {RoomPosition}  start  The start position.
 * @param   {RoomObject|RoomPosition}  goal  A goal or goal position.
 * @param   {Object}  [opts]  Options
 * @return  {Object}  Same as [PathFinder.search()]{@link https://docs.screeps.com/api/#PathFinder.search}
 */
Room.prototype.planRoad = function(start, goal, opts) {
  // Avoid: minerals, source, existed unwalkable rObj -> set 0xff
  // priorize: existed road/roadConstructSite -> set 1
  // All cost = maintain cost; -> set number based on terrain; > 1
  opts = opts || {};
  const plainCost = opts.plaincost || 1;
  let grid = new PathFinder.CostMatrix();
  if (start.pos) start = start.pos;
  if (goal.pos) goal = goal.pos;
  // set all wall as 150 * plain maintenance cost
  const terrain = this.getTerrain();
  let y = 50;
  while (y--) {
    let x = 50;
    while (x--) {
      if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
        // console.log("setted")
        grid.set(x, y, CONSTRUCTION_COST_ROAD_WALL_RATIO * plainCost);
      }
    }
  }
  // set all road/construction site of road as 1.
  [...this.find(FIND_STRUCTURES), ...this.find(FIND_CONSTRUCTION_SITES)].forEach(s => {
    if (s.structureType === STRUCTURE_ROAD) {
      // Favor roads
      grid.set(s.pos.x, s.pos.y, 1);
    } else if (s.structureType !== STRUCTURE_CONTAINER &&
      (s.structureType !== STRUCTURE_RAMPART ||
        !s.my)) {
      // set unwalkable structures
      grid.set(s.pos.x, s.pos.y, 0xff);
    }
  });
  // set sources/mineral as unwalkable
  [...this.find(FIND_SOURCES), ...this.find(FIND_MINERALS)].forEach(o => grid.set(o.pos.x, o.pos.y, 0xff));

  const plannedRoad = PathFinder.search(
    start, goal, {
      roomCallback: () => grid,
      plainCost,
      swampCost: CONSTRUCTION_COST_ROAD_SWAMP_RATIO * plainCost,
      maxRooms: 1
    });
  new RoomVisual(roomName)
    .poly(plannedRoad.path);
  return plannedRoad;
};

// Game.rooms["W27N41"].planRoad(new RoomPosition(19,9,"W26N44"), new RoomPosition(26,4,"W26N44"),"W26N44");
