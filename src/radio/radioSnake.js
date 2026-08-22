/**
 * Snake — mini hra na LCD vysílačky.
 * Logická mřížka 24×24, vykreslení přes CSS grid.
 * Mlska 2×2, extra 4×4 každých 5 normálních.
 */
export var SNAKE_TICK_MS = 195;
export var SNAKE_W = 24;
export var SNAKE_H = 24;
export var SNAKE_CELL_COUNT = SNAKE_W * SNAKE_H;
export var SNAKE_FOOD_NORMAL = 2;
export var SNAKE_FOOD_BIG = 4;
export var SNAKE_BIG_EVERY = 5;

function wrapCoord(value, size) {
    return ((value % size) + size) % size;
}

export function createSnakeState() {
    var cx = 12;
    var cy = 12;
    var session = {
        snake: [
            { x: cx, y: cy },
            { x: cx - 1, y: cy },
            { x: cx - 2, y: cy }
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

function cellOccupied(session, x, y, ignoreTail) {
    var limit = session.snake.length - (ignoreTail ? 1 : 0);
    var i;
    for (i = 0; i < limit; i++) {
        if (session.snake[i].x === x && session.snake[i].y === y) return true;
    }
    return false;
}

function rectFits(session, x, y, span) {
    var dx;
    var dy;
    for (dy = 0; dy < span; dy++) {
        for (dx = 0; dx < span; dx++) {
            var px = x + dx;
            var py = y + dy;
            if (px < 0 || px >= SNAKE_W || py < 0 || py >= SNAKE_H) return false;
            if (cellOccupied(session, px, py, false)) return false;
        }
    }
    return true;
}

function trySpawnFood(session, span) {
    var tries = 0;
    while (tries++ < 800) {
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
    return head.x >= food.x && head.x < food.x + span &&
        head.y >= food.y && head.y < food.y + span;
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
        var span = food.span || SNAKE_FOOD_NORMAL;
        var kind = span >= SNAKE_FOOD_BIG ? 'food-big' : 'food';
        var dx;
        var dy;
        for (dy = 0; dy < span; dy++) {
            for (dx = 0; dx < span; dx++) {
                setCell(grid, food.x + dx, food.y + dy, kind);
            }
        }
    }
    if (session && session.snake) {
        for (i = 0; i < session.snake.length; i++) {
            var seg = session.snake[i];
            setCell(grid, seg.x, seg.y, i === 0 ? 'head' : 'body');
        }
    }
    return grid;
}

function setCell(grid, x, y, val) {
    if (y < 0 || y >= SNAKE_H || x < 0 || x >= SNAKE_W) return;
    grid[cellIndex(x, y)] = val;
}

export function snakeTick(session) {
    if (!session || !session.alive) return false;
    session.dir = session.nextDir || session.dir;
    var head = session.snake[0];
    var nh = {
        x: wrapCoord(head.x + session.dir.x, SNAKE_W),
        y: wrapCoord(head.y + session.dir.y, SNAKE_H)
    };

    if (cellOccupied(session, nh.x, nh.y, true)) {
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
