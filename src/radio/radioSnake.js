/**
 * Snake II — Nokia 3310 LCD (84×48 bodů).
 * Prostup okraji, bludiště, statická mlska, časovaný bonus, levely, zrychlování.
 */
export var SNAKE_TICK_MS = 180;
export var SNAKE_TICK_MIN = 68;
export var SNAKE_W = 84;
export var SNAKE_H = 48;
export var SNAKE_UNIT = 3;
export var SNAKE_CELL_COUNT = SNAKE_W * SNAKE_H;
export var SNAKE_FOOD_SPAN = 3;
export var SNAKE_BONUS_SPAN = 3;

export var SNAKE_PLAY_X0 = 1;
export var SNAKE_PLAY_X1 = 80;
export var SNAKE_PLAY_Y0 = 1;
export var SNAKE_PLAY_Y1 = 44;

export var SNAKE_BONUS_LIFE_MS = 11000;
export var SNAKE_BONUS_BLINK_MS = 4500;

var FOOD_DIAMOND = [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0]
];

var BONUS_BUG = [
    [1, 1, 1],
    [0, 1, 0],
    [1, 0, 1]
];

var LEVELS = [
    { id: 1, foodsToClear: 6, walls: [] },
    { id: 2, foodsToClear: 8, walls: 'cross' },
    { id: 3, foodsToClear: 8, walls: 'pillars' },
    { id: 4, foodsToClear: 10, walls: 'maze' },
    { id: 5, foodsToClear: 10, walls: 'dense' }
];

function wrapPlayCoord(val, min, max) {
    var range = max - min + 1;
    return min + (((val - min) % range) + range) % range;
}

function alignCoord(val, min, max) {
    val = wrapPlayCoord(val, min, max);
    var offset = (val - min) % SNAKE_UNIT;
    return val - offset;
}

function wallKey(x, y) {
    return x + ',' + y;
}

function fillWallRect(walls, x, y, w, h) {
    var dy;
    var dx;
    for (dy = 0; dy < h; dy++) {
        for (dx = 0; dx < w; dx++) {
            walls[wallKey(x + dx, y + dy)] = true;
        }
    }
}

function buildLevelWalls(kind) {
    var walls = {};
    if (kind === 'cross') {
        fillWallRect(walls, 39, 10, 4, 12);
        fillWallRect(walls, 39, 32, 4, 12);
        fillWallRect(walls, 18, 21, 14, 4);
        fillWallRect(walls, 50, 21, 14, 4);
    } else if (kind === 'pillars') {
        fillWallRect(walls, 12, 10, 6, 6);
        fillWallRect(walls, 64, 10, 6, 6);
        fillWallRect(walls, 12, 32, 6, 6);
        fillWallRect(walls, 64, 32, 6, 6);
        fillWallRect(walls, 36, 20, 10, 6);
    } else if (kind === 'maze') {
        fillWallRect(walls, 15, 8, 3, 28);
        fillWallRect(walls, 30, 16, 3, 26);
        fillWallRect(walls, 48, 8, 3, 22);
        fillWallRect(walls, 63, 18, 3, 24);
        fillWallRect(walls, 24, 28, 20, 3);
    } else if (kind === 'dense') {
        fillWallRect(walls, 20, 12, 42, 3);
        fillWallRect(walls, 20, 24, 42, 3);
        fillWallRect(walls, 20, 36, 42, 3);
        fillWallRect(walls, 38, 12, 3, 27);
    }
    return walls;
}

function applyLevel(session, levelIndex) {
    levelIndex = levelIndex || 0;
    if (levelIndex >= LEVELS.length) levelIndex = LEVELS.length - 1;
    var def = LEVELS[levelIndex];
    session.levelIndex = levelIndex;
    session.levelFoodsEaten = 0;
    session.walls = buildLevelWalls(def.walls);
    session.foodsToClear = def.foodsToClear;
}

function defaultSnake() {
    return [
        { x: 42, y: 24 },
        { x: 39, y: 24 },
        { x: 36, y: 24 }
    ];
}

export function createSnakeState() {
    var session = {
        snake: defaultSnake(),
        dir: { x: 1, y: 0 },
        nextDir: { x: 1, y: 0 },
        food: null,
        bonus: null,
        score: 0,
        alive: true,
        lastDirAt: 0,
        growPending: 0,
        levelIndex: 0,
        levelFoodsEaten: 0,
        foodsToClear: LEVELS[0].foodsToClear,
        walls: {},
        tickMs: SNAKE_TICK_MS,
        totalEaten: 0,
        bonusSpawnCounter: 0
    };
    applyLevel(session, 0);
    session.food = spawnFood(session);
    return session;
}

export function resetSnakeState(session) {
    if (!session) return createSnakeState();
    var fresh = createSnakeState();
    Object.keys(fresh).forEach(function(k) { session[k] = fresh[k]; });
    return session;
}

export function snakeLevel(session) {
    session = session || {};
    return (session.levelIndex || 0) + 1;
}

export function snakeTickMs(session) {
    session = session || {};
    return session.tickMs || SNAKE_TICK_MS;
}

function isOpposite(a, b) {
    return a && b && a.x === -b.x && a.y === -b.y;
}

export function snakeSetDirection(session, action) {
    if (!session || !session.alive) return false;
    var now = Date.now();
    if (session.lastDirAt && now - session.lastDirAt < 40) return false;
    var cur = session.nextDir || session.dir;
    var next = null;
    if (action === 'up') next = { x: 0, y: -1 };
    else if (action === 'down') next = { x: 0, y: 1 };
    else if (action === 'left') next = { x: -1, y: 0 };
    else if (action === 'right') next = { x: 1, y: 0 };
    if (!next || isOpposite(cur, next)) return false;
    session.nextDir = next;
    session.lastDirAt = now;
    return true;
}

function segmentCells(x, y) {
    return [
        [x, y], [x + 1, y], [x + 2, y],
        [x, y + 1], [x + 1, y + 1], [x + 2, y + 1],
        [x, y + 2], [x + 1, y + 2], [x + 2, y + 2]
    ];
}

function isWall(session, x, y) {
    return !!(session.walls && session.walls[wallKey(x, y)]);
}

function pointOccupiedBySegment(session, px, py, segIndex) {
    var seg = session.snake[segIndex];
    var cells = segmentCells(seg.x, seg.y);
    var i;
    for (i = 0; i < cells.length; i++) {
        if (cells[i][0] === px && cells[i][1] === py) return true;
    }
    return false;
}

function cellOccupied(session, x, y, ignoreTail) {
    var limit = session.snake.length - (ignoreTail ? 1 : 0);
    var i;
    for (i = 0; i < limit; i++) {
        if (pointOccupiedBySegment(session, x, y, i)) return true;
    }
    return false;
}

function patternCells(pattern, x, y) {
    var out = [];
    var py;
    var px;
    for (py = 0; py < pattern.length; py++) {
        for (px = 0; px < pattern[py].length; px++) {
            if (pattern[py][px]) out.push([x + px, y + py]);
        }
    }
    return out;
}

function patternFits(session, x, y, pattern) {
    var cells = patternCells(pattern, x, y);
    var i;
    for (i = 0; i < cells.length; i++) {
        var cx = cells[i][0];
        var cy = cells[i][1];
        if (cx < SNAKE_PLAY_X0 || cy < SNAKE_PLAY_Y0 ||
            cx > SNAKE_PLAY_X1 + 2 || cy > SNAKE_PLAY_Y1 + 2) return false;
        if (isWall(session, cx, cy)) return false;
        if (cellOccupied(session, cx, cy, false)) return false;
    }
    return true;
}

function trySpawnAt(session, pattern) {
    var tries = 0;
    var span = pattern.length;
    while (tries++ < 2500) {
        var x = SNAKE_PLAY_X0 + Math.floor(Math.random() * (SNAKE_PLAY_X1 - SNAKE_PLAY_X0 - span + 2));
        var y = SNAKE_PLAY_Y0 + Math.floor(Math.random() * (SNAKE_PLAY_Y1 - SNAKE_PLAY_Y0 - span + 2));
        if (patternFits(session, x, y, pattern)) return { x: x, y: y };
    }
    return null;
}

function spawnFood(session) {
    var placed = trySpawnAt(session, FOOD_DIAMOND);
    if (placed) return placed;
    return { x: SNAKE_PLAY_X0 + 6, y: SNAKE_PLAY_Y0 + 6 };
}

function maybeSpawnBonus(session) {
    if (session.bonus) return;
    session.bonusSpawnCounter = (session.bonusSpawnCounter || 0) + 1;
    if (session.bonusSpawnCounter < 3 && Math.random() > 0.35) return;
    var placed = trySpawnAt(session, BONUS_BUG);
    if (!placed) return;
    session.bonus = {
        x: placed.x,
        y: placed.y,
        spawnAt: Date.now()
    };
    session.bonusSpawnCounter = 0;
}

function expireBonus(session) {
    if (!session.bonus) return;
    if (Date.now() - session.bonus.spawnAt > SNAKE_BONUS_LIFE_MS) session.bonus = null;
}

export function bonusBlinkPhase(session) {
    if (!session || !session.bonus) return false;
    var age = Date.now() - session.bonus.spawnAt;
    if (age < SNAKE_BONUS_LIFE_MS - SNAKE_BONUS_BLINK_MS) return false;
    return Math.floor(age / 180) % 2 === 0;
}

function headHitsPattern(head, item, pattern) {
    var hx1 = head.x;
    var hy1 = head.y;
    var hx2 = head.x + SNAKE_UNIT;
    var hy2 = head.y + SNAKE_UNIT;
    var cells = patternCells(pattern, item.x, item.y);
    var i;
    for (i = 0; i < cells.length; i++) {
        var fx = cells[i][0];
        var fy = cells[i][1];
        if (fx >= hx1 && fx < hx2 && fy >= hy1 && fy < hy2) return true;
    }
    return false;
}

function scoreForFood(session) {
    var lv = snakeLevel(session);
    return lv * (2 + Math.floor(session.tickMs ? (SNAKE_TICK_MS - session.tickMs) / 20 : 0));
}

function scoreForBonus(session) {
    if (!session.bonus) return 0;
    var age = Date.now() - session.bonus.spawnAt;
    var lv = snakeLevel(session);
    var speedBonus = 2 + Math.floor((SNAKE_TICK_MS - (session.tickMs || SNAKE_TICK_MS)) / 15);
    var timeLeft = Math.max(0, 1 - age / SNAKE_BONUS_LIFE_MS);
    return Math.round(lv * speedBonus * (8 + timeLeft * 12));
}

function accelerate(session) {
    session.tickMs = Math.max(SNAKE_TICK_MIN, (session.tickMs || SNAKE_TICK_MS) - 4);
}

function advanceLevel(session) {
    var next = (session.levelIndex || 0) + 1;
    if (next >= LEVELS.length) next = LEVELS.length - 1;
    applyLevel(session, next);
    session.tickMs = Math.max(SNAKE_TICK_MIN, (session.tickMs || SNAKE_TICK_MS) - 12);
    session.snake = defaultSnake();
    session.dir = { x: 1, y: 0 };
    session.nextDir = { x: 1, y: 0 };
    session.bonus = null;
    session.food = spawnFood(session);
}

function drawPattern(grid, x, y, pattern, kind) {
    var cells = patternCells(pattern, x, y);
    var i;
    for (i = 0; i < cells.length; i++) {
        setCell(grid, cells[i][0], cells[i][1], kind);
    }
}

function drawBorder(grid) {
    var x;
    var y;
    for (x = 0; x < SNAKE_W; x++) {
        setCell(grid, x, 0, 'border');
        setCell(grid, x, SNAKE_H - 1, 'border');
    }
    for (y = 0; y < SNAKE_H; y++) {
        setCell(grid, 0, y, 'border');
        setCell(grid, SNAKE_W - 1, y, 'border');
    }
}

function drawWalls(grid, session) {
    if (!session.walls) return;
    var key;
    for (key in session.walls) {
        if (!session.walls[key]) continue;
        var parts = key.split(',');
        setCell(grid, parseInt(parts[0], 10), parseInt(parts[1], 10), 'wall');
    }
}

function fillSegment(grid, x, y, kind) {
    var dx;
    var dy;
    for (dy = 0; dy < SNAKE_UNIT; dy++) {
        for (dx = 0; dx < SNAKE_UNIT; dx++) {
            var px = x + dx;
            var py = y + dy;
            var cellKind = kind;
            if (kind !== 'head') {
                cellKind = ((px + py) % 2 === 0) ? 'body-a' : 'body-b';
            }
            setCell(grid, px, py, cellKind);
        }
    }
}

export function buildSnakeCellGrid(session, opts) {
    opts = opts || {};
    var grid = [];
    var i;
    for (i = 0; i < SNAKE_CELL_COUNT; i++) grid[i] = '';

    drawBorder(grid);
    drawWalls(grid, session);

    if (session && session.food) {
        drawPattern(grid, session.food.x, session.food.y, FOOD_DIAMOND, 'food');
    }
    if (session && session.bonus) {
        var bkind = opts.bonusBlink ? 'bonus-blink' : 'bonus';
        drawPattern(grid, session.bonus.x, session.bonus.y, BONUS_BUG, bkind);
    }
    if (session && session.snake) {
        for (i = 0; i < session.snake.length; i++) {
            fillSegment(grid, session.snake[i].x, session.snake[i].y, i === 0 ? 'head' : 'body-a');
        }
    }
    return grid;
}

function setCell(grid, x, y, val) {
    if (y < 0 || y >= SNAKE_H || x < 0 || x >= SNAKE_W) return;
    grid[y * SNAKE_W + x] = val;
}

function headHitsBody(session, nx, ny) {
    var cells = segmentCells(nx, ny);
    var ignoreTail = (session.growPending || 0) <= 0;
    var lastIndex = session.snake.length - 1;
    var c;
    var i;
    for (c = 0; c < cells.length; c++) {
        var px = cells[c][0];
        var py = cells[c][1];
        for (i = 1; i < session.snake.length; i++) {
            if (ignoreTail && i === lastIndex) continue;
            if (pointOccupiedBySegment(session, px, py, i)) return true;
        }
    }
    return false;
}

function headHitsWall(session, nx, ny) {
    var cells = segmentCells(nx, ny);
    var c;
    for (c = 0; c < cells.length; c++) {
        if (isWall(session, cells[c][0], cells[c][1])) return true;
    }
    return false;
}

export function snakeTick(session) {
    if (!session || !session.alive) return false;

    expireBonus(session);

    session.dir = session.nextDir || session.dir;
    var head = session.snake[0];
    var nh = {
        x: alignCoord(head.x + session.dir.x * SNAKE_UNIT, SNAKE_PLAY_X0, SNAKE_PLAY_X1),
        y: alignCoord(head.y + session.dir.y * SNAKE_UNIT, SNAKE_PLAY_Y0, SNAKE_PLAY_Y1)
    };

    if (headHitsBody(session, nh.x, nh.y) || headHitsWall(session, nh.x, nh.y)) {
        session.alive = false;
        return true;
    }

    session.snake.unshift(nh);

    var ate = false;
    if (session.food && headHitsPattern(nh, session.food, FOOD_DIAMOND)) {
        session.score = (session.score || 0) + scoreForFood(session);
        session.totalEaten = (session.totalEaten || 0) + 1;
        session.levelFoodsEaten = (session.levelFoodsEaten || 0) + 1;
        session.growPending = (session.growPending || 0) + 2;
        accelerate(session);
        maybeSpawnBonus(session);
        if (session.levelFoodsEaten >= (session.foodsToClear || 6)) {
            advanceLevel(session);
            return 'level';
        }
        session.food = spawnFood(session);
        ate = true;
    } else if (session.bonus && headHitsPattern(nh, session.bonus, BONUS_BUG)) {
        session.score = (session.score || 0) + scoreForBonus(session);
        session.growPending = (session.growPending || 0) + 3;
        accelerate(session);
        session.bonus = null;
        ate = true;
    }

    if (session.growPending > 0) {
        session.growPending--;
    } else {
        session.snake.pop();
    }

    return ate ? 'ate' : true;
}

export function buildSnakeOsView(session) {
    session = session || createSnakeState();
    var lv = snakeLevel(session);
    var footer = 'Směr · Zpět';
    var status = 'SNAKE II · LV ' + lv;
    var useBoard = !!session.alive;

    if (!session.alive) {
        return {
            mode: 'snake',
            status: 'SNAKE · KONEC',
            lines: ['', '  KONEC HRY', '  SKÓRE ' + (session.score || 0), '  OK = nová', '', ''],
            focusLine: -1,
            footer: 'OK restart · Zpět',
            buffer: '',
            useBoard: false,
            score: session.score || 0,
            snakeLevel: lv
        };
    }

    return {
        mode: 'snake',
        status: status,
        lines: ['', '', '', '', '', ''],
        focusLine: -1,
        footer: footer,
        buffer: '',
        useBoard: useBoard,
        score: session.score || 0,
        snakeLevel: lv,
        levelProgress: (session.levelFoodsEaten || 0) + '/' + (session.foodsToClear || 6)
    };
}
