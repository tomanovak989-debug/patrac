/**
 * Snake — mini hra ve stylu Nokia 3310 na LCD vysílačky.
 * Mřížka 12×12 (6 řádků displeje × 2 herní řádky na řádek).
 */
export var SNAKE_TICK_MS = 195;
export var SNAKE_W = 12;
export var SNAKE_H = 12;
export var SNAKE_DISPLAY_LINES = 6;

var HALF_TOP = '\u2580';
var HALF_BOT = '\u2584';
var FULL = '\u2588';
var EMPTY = '\u00b7';

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

function cellChar(grid, x, y) {
    if (y < 0 || y >= SNAKE_H || x < 0 || x >= SNAKE_W) return 0;
    return grid[y * SNAKE_W + x] || 0;
}

function setCell(grid, x, y, val) {
    if (y < 0 || y >= SNAKE_H || x < 0 || x >= SNAKE_W) return;
    grid[y * SNAKE_W + x] = val;
}

function mergeHalfChars(top, bot) {
    if (top && bot) return FULL;
    if (top) return HALF_TOP;
    if (bot) return HALF_BOT;
    return EMPTY;
}

function renderSnakeGrid(session) {
    var grid = [];
    var i;
    for (i = 0; i < SNAKE_W * SNAKE_H; i++) grid[i] = 0;

    if (session.food) {
        setCell(grid, session.food.x, session.food.y, 2);
    }
    for (i = 0; i < session.snake.length; i++) {
        var seg = session.snake[i];
        setCell(grid, seg.x, seg.y, i === 0 ? 3 : 1);
    }

    var lines = [];
    var dy;
    for (dy = 0; dy < SNAKE_DISPLAY_LINES; dy++) {
        var rowTop = dy * 2;
        var rowBot = rowTop + 1;
        var line = '';
        var x;
        for (x = 0; x < SNAKE_W; x++) {
            var top = cellChar(grid, x, rowTop);
            var bot = cellChar(grid, x, rowBot);
            line += mergeHalfChars(!!top, !!bot);
        }
        lines.push(line);
    }
    return lines;
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
    var lines = renderSnakeGrid(session);
    var footer = 'Směr · Zpět';
    var status = 'SNAKE · ' + (session.score || 0);

    if (!session.alive) {
        lines = ['', '  KONEC', '  SKÓRE ' + (session.score || 0), '  OK = nová', '', ''];
        footer = 'OK restart · Zpět';
        status = 'SNAKE · KONEC';
    }

    return {
        mode: 'snake',
        status: status,
        lines: lines,
        focusLine: -1,
        footer: footer,
        buffer: ''
    };
}
