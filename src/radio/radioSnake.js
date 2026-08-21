/**
 * Snake — mini hra na LCD vysílačky.
 * Logická mřížka 12×12, vykreslení přes CSS grid (čtvercové buňky, ne znaky).
 */
export var SNAKE_TICK_MS = 195;
export var SNAKE_W = 12;
export var SNAKE_H = 12;
export var SNAKE_CELL_COUNT = SNAKE_W * SNAKE_H;

export function createSnakeState() {
    var cx = 6;
    var cy = 6;
    return {
        snake: [
            { x: cx, y: cy },
            { x: cx - 1, y: cy },
            { x: cx - 2, y: cy }
        ],
        dir: { x: 1, y: 0 },
        nextDir: { x: 1, y: 0 },
        food: { x: 9, y: 3 },
        score: 0,
        alive: true,
        lastDirAt: 0
    };
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

function spawnFood(session) {
    var tries = 0;
    while (tries++ < 300) {
        var x = Math.floor(Math.random() * SNAKE_W);
        var y = Math.floor(Math.random() * SNAKE_H);
        if (!cellOccupied(session, x, y, false)) return { x: x, y: y };
    }
    return { x: 0, y: 0 };
}

function cellIndex(x, y) {
    return y * SNAKE_W + x;
}

/**
 * @returns {string[]} — '' | 'food' | 'head' | 'body' pro každou buňku mřížky
 */
export function buildSnakeCellGrid(session) {
    var grid = [];
    var i;
    for (i = 0; i < SNAKE_CELL_COUNT; i++) grid[i] = '';

    if (session && session.food) {
        grid[cellIndex(session.food.x, session.food.y)] = 'food';
    }
    if (session && session.snake) {
        for (i = 0; i < session.snake.length; i++) {
            var seg = session.snake[i];
            var idx = cellIndex(seg.x, seg.y);
            grid[idx] = i === 0 ? 'head' : 'body';
        }
    }
    return grid;
}

export function snakeTick(session) {
    if (!session || !session.alive) return false;
    session.dir = session.nextDir || session.dir;
    var head = session.snake[0];
    var nh = { x: head.x + session.dir.x, y: head.y + session.dir.y };

    if (nh.x < 0 || nh.x >= SNAKE_W || nh.y < 0 || nh.y >= SNAKE_H) {
        session.alive = false;
        return true;
    }

    if (cellOccupied(session, nh.x, nh.y, true)) {
        session.alive = false;
        return true;
    }

    session.snake.unshift(nh);
    if (session.food && nh.x === session.food.x && nh.y === session.food.y) {
        session.score = (session.score || 0) + 1;
        session.food = spawnFood(session);
    } else {
        session.snake.pop();
    }
    return true;
}

export function buildSnakeOsView(session) {
    session = session || createSnakeState();
    var footer = 'Směr · Zpět';
    var status = 'SNAKE · ' + (session.score || 0);
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
        useBoard: useBoard
    };
}
