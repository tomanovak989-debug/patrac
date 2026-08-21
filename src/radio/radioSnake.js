/**
 * Snake — mini hra ve stylu Nokia 3310 na LCD vysílačky.
 */
export var SNAKE_TICK_MS = 175;
export var SNAKE_W = 10;
export var SNAKE_H = 6;

export function createSnakeState() {
    var cx = 5;
    var cy = 3;
    return {
        snake: [
            { x: cx, y: cy },
            { x: cx - 1, y: cy },
            { x: cx - 2, y: cy }
        ],
        dir: { x: 1, y: 0 },
        nextDir: { x: 1, y: 0 },
        food: { x: 8, y: 1 },
        score: 0,
        alive: true
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
    return session;
}

function isOpposite(a, b) {
    return a && b && a.x === -b.x && a.y === -b.y;
}

export function snakeSetDirection(session, action) {
    if (!session || !session.alive) return false;
    var cur = session.nextDir || session.dir;
    var next = null;
    if (action === 'up') next = { x: 0, y: -1 };
    else if (action === 'down') next = { x: 0, y: 1 };
    else if (action === 'left') next = { x: -1, y: 0 };
    else if (action === 'right') next = { x: 1, y: 0 };
    if (!next || isOpposite(cur, next)) return false;
    session.nextDir = next;
    return true;
}

function cellOccupied(session, x, y) {
    var i;
    for (i = 0; i < session.snake.length; i++) {
        if (session.snake[i].x === x && session.snake[i].y === y) return true;
    }
    return false;
}

function spawnFood(session) {
    var tries = 0;
    while (tries++ < 200) {
        var x = Math.floor(Math.random() * SNAKE_W);
        var y = Math.floor(Math.random() * SNAKE_H);
        if (!cellOccupied(session, x, y)) return { x: x, y: y };
    }
    return { x: 0, y: 0 };
}

function setChar(row, x, ch) {
    return row.slice(0, x) + ch + row.slice(x + 1);
}

function renderSnakeGrid(session) {
    var lines = [];
    var y;
    for (y = 0; y < SNAKE_H; y++) {
        var row = '';
        var x;
        for (x = 0; x < SNAKE_W; x++) row += '·';
        lines.push(row);
    }
    if (session.food) {
        lines[session.food.y] = setChar(lines[session.food.y], session.food.x, '*');
    }
    var i;
    for (i = 0; i < session.snake.length; i++) {
        var seg = session.snake[i];
        if (seg.y < 0 || seg.y >= SNAKE_H || seg.x < 0 || seg.x >= SNAKE_W) continue;
        lines[seg.y] = setChar(lines[seg.y], seg.x, i === 0 ? 'O' : 'o');
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

    var i;
    for (i = 0; i < session.snake.length; i++) {
        if (session.snake[i].x === nh.x && session.snake[i].y === nh.y) {
            session.alive = false;
            return true;
        }
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
