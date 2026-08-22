/**
 * Snake — LCD vysílačky, mřížka 48×48.
 * Herní prvek 1× → vykreslení 2×2 buňky. Mlska zmenšená o polovinu (1×1 / 2×2).
 */
export var SNAKE_TICK_MS = 195;
export var SNAKE_W = 48;
export var SNAKE_H = 48;
export var SNAKE_UNIT = 2;
export var SNAKE_CELL_COUNT = SNAKE_W * SNAKE_H;
export var SNAKE_FOOD_NORMAL = 1;
export var SNAKE_FOOD_BIG = 2;
export var SNAKE_BIG_EVERY = 5;

function wrapCoord(value, size) {
    return ((value % size) + size) % size;
}

function segmentCells(x, y) {
    return [
        [x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]
    ];
}

export function createSnakeState() {
    var cx = 22;
    var cy = 22;
    var session = {
        snake: [
            { x: cx, y: cy },
            { x: cx - SNAKE_UNIT, y: cy },
            { x: cx - SNAKE_UNIT * 2, y: cy }
        ],
        dir: { x: 1, y: 0 },
        nextDir: { x: 1, y: 0 },
        food: null,
        score: 0,
        alive: true,
        lastDirAt: 0,
        normalFoodEaten: 0,
        pendingBigFood: false,
        growPending: 0
    };
    session.food = spawnFood(session);
    return session;
}

export function resetSnakeState(session) {
    if (!session) return createSnakeState();
    var fresh = createSnakeState();
    session.snake = fresh.snake;
    session.dir = fresh.dir;
    session.nextDir = fresh.nextDir;
    session.food = fresh.food;
    session.score = 0;
    session.alive = true;
    session.lastDirAt = 0;
    session.normalFoodEaten = 0;
    session.pendingBigFood = false;
    session.growPending = 0;
    return session;
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

function pointOccupiedBySegment(session, px, py, segIndex, segCount) {
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
        if (pointOccupiedBySegment(session, x, y, i, limit)) return true;
    }
    return false;
}

function blockInBounds(x, y, span) {
    return x >= 0 && y >= 0 && x + span <= SNAKE_W && y + span <= SNAKE_H;
}

function rectFits(session, x, y, span) {
    if (!blockInBounds(x, y, span)) return false;
    var dx;
    var dy;
    for (dy = 0; dy < span; dy++) {
        for (dx = 0; dx < span; dx++) {
            if (cellOccupied(session, x + dx, y + dy, false)) return false;
        }
    }
    return true;
}

function trySpawnFood(session, span) {
    var tries = 0;
    while (tries++ < 1200) {
        var x = Math.floor(Math.random() * (SNAKE_W - span + 1));
        var y = Math.floor(Math.random() * (SNAKE_H - span + 1));
        if (rectFits(session, x, y, span)) return { x: x, y: y, span: span };
    }
    return null;
}

function nextFoodSpan(session) {
    if (session.pendingBigFood) return SNAKE_FOOD_BIG;
    return SNAKE_FOOD_NORMAL;
}

function spawnFood(session) {
    var span = nextFoodSpan(session);
    session.pendingBigFood = false;
    var placed = trySpawnFood(session, span);
    if (placed) return placed;
    if (span > SNAKE_FOOD_NORMAL) {
        placed = trySpawnFood(session, SNAKE_FOOD_NORMAL);
        if (placed) return placed;
    }
    return { x: 0, y: 0, span: SNAKE_FOOD_NORMAL };
}

function cellIndex(x, y) {
    return y * SNAKE_W + x;
}

function headOnFood(session, head) {
    if (!session.food) return false;
    var food = session.food;
    var span = food.span || SNAKE_FOOD_NORMAL;
    var hx1 = head.x;
    var hy1 = head.y;
    var hx2 = head.x + SNAKE_UNIT;
    var hy2 = head.y + SNAKE_UNIT;
    var fx2 = food.x + span;
    var fy2 = food.y + span;
    return hx1 < fx2 && hx2 > food.x && hy1 < fy2 && hy2 > food.y;
}

function fillRect(grid, x, y, span, val) {
    var dx;
    var dy;
    for (dy = 0; dy < span; dy++) {
        for (dx = 0; dx < span; dx++) {
            setCell(grid, x + dx, y + dy, val);
        }
    }
}

/**
 * @returns {string[]} — '' | 'food' | 'food-big' | 'head' | 'body'
 */
export function buildSnakeCellGrid(session) {
    var grid = [];
    var i;
    for (i = 0; i < SNAKE_CELL_COUNT; i++) grid[i] = '';

    if (session && session.food) {
        var food = session.food;
        var fspan = food.span || SNAKE_FOOD_NORMAL;
        var kind = fspan >= SNAKE_FOOD_BIG ? 'food-big' : 'food';
        fillRect(grid, food.x, food.y, fspan, kind);
    }
    if (session && session.snake) {
        for (i = 0; i < session.snake.length; i++) {
            var seg = session.snake[i];
            fillRect(grid, seg.x, seg.y, SNAKE_UNIT, i === 0 ? 'head' : 'body');
        }
    }
    return grid;
}

function setCell(grid, x, y, val) {
    if (y < 0 || y >= SNAKE_H || x < 0 || x >= SNAKE_W) return;
    grid[cellIndex(x, y)] = val;
}

function headHitsBody(session, nx, ny) {
    var cells = segmentCells(nx, ny);
    var i;
    var c;
    for (c = 0; c < cells.length; c++) {
        if (cellOccupied(session, cells[c][0], cells[c][1], true)) return true;
    }
    return false;
}

export function snakeTick(session) {
    if (!session || !session.alive) return false;
    session.dir = session.nextDir || session.dir;
    var head = session.snake[0];
    var nh = {
        x: wrapCoord(head.x + session.dir.x * SNAKE_UNIT, SNAKE_W),
        y: wrapCoord(head.y + session.dir.y * SNAKE_UNIT, SNAKE_H)
    };

    if (!blockInBounds(nh.x, nh.y, SNAKE_UNIT) || headHitsBody(session, nh.x, nh.y)) {
        session.alive = false;
        return true;
    }

    session.snake.unshift(nh);
    if (headOnFood(session, nh)) {
        var foodSpan = session.food.span || SNAKE_FOOD_NORMAL;
        session.score = (session.score || 0) + (foodSpan >= SNAKE_FOOD_BIG ? 5 : 1);
        if (foodSpan >= SNAKE_FOOD_BIG) {
            session.growPending = (session.growPending || 0) + 3;
            session.normalFoodEaten = 0;
        } else {
            session.normalFoodEaten = (session.normalFoodEaten || 0) + 1;
            if (session.normalFoodEaten >= SNAKE_BIG_EVERY) {
                session.pendingBigFood = true;
                session.normalFoodEaten = 0;
            }
        }
        session.food = spawnFood(session);
        return 'ate';
    }
    if (session.growPending > 0) {
        session.growPending--;
    } else {
        session.snake.pop();
    }
    return true;
}

export function buildSnakeOsView(session) {
    session = session || createSnakeState();
    var footer = 'Směr · Zpět';
    var status = 'SNAKE';
    var lines = ['', '', '', '', '', ''];
    var useBoard = !!session.alive;

    if (!session.alive) {
        lines = ['', '  KONEC', '  SKÓRE ' + (session.score || 0), '  OK = nová', '', ''];
        footer = 'OK restart · Zpět';
        status = 'SNAKE · KONEC';
        useBoard = false;
    }

    return {
        mode: 'snake',
        status: status,
        lines: lines,
        focusLine: -1,
        footer: footer,
        buffer: '',
        useBoard: useBoard,
        score: session.score || 0
    };
}
