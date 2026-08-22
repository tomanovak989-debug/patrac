/**
 * Arkanoid — klasický breakout na LCD vysílačky (mřížka 12×11).
 * ◀▶ posun pálky, míč odraz od zdi / cihel / pálky.
 */
export var ARK_TICK_MS = 165;
export var ARK_W = 12;
export var ARK_H = 11;
export var ARK_CELL_COUNT = ARK_W * ARK_H;
export var ARK_PADDLE_W = 3;
export var ARK_BRICK_ROWS = 3;

export function createArkanoidState() {
    var session = {
        paddleX: 4,
        ballX: 5.5,
        ballY: 8.5,
        velX: 0.22,
        velY: -0.24,
        bricks: buildInitialBricks(),
        score: 0,
        lives: 3,
        alive: true,
        waiting: true
    };
    return session;
}

function buildInitialBricks() {
    var rows = [];
    var y;
    var x;
    for (y = 0; y < ARK_BRICK_ROWS; y++) {
        var row = [];
        for (x = 0; x < ARK_W; x++) row.push(true);
        rows.push(row);
    }
    return rows;
}

export function resetArkanoidState(session) {
    if (!session) return createArkanoidState();
    var fresh = createArkanoidState();
    session.paddleX = fresh.paddleX;
    session.ballX = fresh.ballX;
    session.ballY = fresh.ballY;
    session.velX = fresh.velX;
    session.velY = fresh.velY;
    session.bricks = fresh.bricks;
    session.score = 0;
    session.lives = 3;
    session.alive = true;
    session.waiting = true;
    return session;
}

export function arkanoidMovePaddle(session, dir) {
    if (!session || !session.alive) return false;
    var next = session.paddleX + (dir === 'right' ? 1 : -1);
    if (next < 0 || next > ARK_W - ARK_PADDLE_W) return false;
    session.paddleX = next;
    if (session.waiting) {
        session.ballX = session.paddleX + (ARK_PADDLE_W / 2) - 0.5;
        session.ballY = ARK_H - 2.5;
    }
    return true;
}

function brickAt(session, x, y) {
    if (!session.bricks || y < 0 || y >= session.bricks.length) return false;
    if (x < 0 || x >= ARK_W) return false;
    return !!session.bricks[y][x];
}

function clearBrick(session, x, y) {
    if (!brickAt(session, x, y)) return false;
    session.bricks[y][x] = false;
    session.score = (session.score || 0) + 10;
    return true;
}

function remainingBricks(session) {
    var n = 0;
    var y;
    var x;
    for (y = 0; y < session.bricks.length; y++) {
        for (x = 0; x < ARK_W; x++) {
            if (session.bricks[y][x]) n++;
        }
    }
    return n;
}

function launchBall(session) {
    session.waiting = false;
    session.velX = session.velX >= 0 ? 0.22 : -0.22;
    session.velY = -0.24;
}

export function arkanoidOk(session) {
    if (!session) return false;
    if (!session.alive) {
        resetArkanoidState(session);
        return true;
    }
    if (session.waiting) {
        launchBall(session);
        return true;
    }
    return false;
}

function reflectFromPaddle(session) {
    var center = session.paddleX + (ARK_PADDLE_W / 2);
    var hit = (session.ballX - center) / (ARK_PADDLE_W / 2);
    if (hit < -1) hit = -1;
    if (hit > 1) hit = 1;
    session.velX = hit * 0.28;
    session.velY = -Math.abs(session.velY);
    session.ballY = ARK_H - 2.6;
}

export function arkanoidTick(session) {
    if (!session || !session.alive || session.waiting) return false;

    session.ballX += session.velX;
    session.ballY += session.velY;

    if (session.ballX < 0) {
        session.ballX = 0;
        session.velX = Math.abs(session.velX);
    } else if (session.ballX > ARK_W - 1) {
        session.ballX = ARK_W - 1;
        session.velX = -Math.abs(session.velX);
    }

    if (session.ballY < 0) {
        session.ballY = 0;
        session.velY = Math.abs(session.velY);
    }

    var bx = Math.round(session.ballX);
    var by = Math.round(session.ballY);

    if (by < ARK_BRICK_ROWS && brickAt(session, bx, by)) {
        clearBrick(session, bx, by);
        session.velY = Math.abs(session.velY);
        if (remainingBricks(session) === 0) {
            session.alive = false;
            return 'win';
        }
        return 'hit';
    }

    if (session.ballY >= ARK_H - 1.8 &&
        session.ballX >= session.paddleX - 0.2 &&
        session.ballX <= session.paddleX + ARK_PADDLE_W + 0.2 &&
        session.velY > 0) {
        reflectFromPaddle(session);
        return 'paddle';
    }

    if (session.ballY > ARK_H) {
        session.lives = (session.lives || 1) - 1;
        if (session.lives <= 0) {
            session.alive = false;
            return 'lose';
        }
        session.waiting = true;
        session.ballX = session.paddleX + (ARK_PADDLE_W / 2) - 0.5;
        session.ballY = ARK_H - 2.5;
        session.velY = -0.24;
        return 'life';
    }

    return true;
}

export function buildArkanoidCellGrid(session) {
    var grid = [];
    var i;
    for (i = 0; i < ARK_CELL_COUNT; i++) grid[i] = '';

    if (!session) return grid;

    var y;
    var x;
    for (y = 0; y < ARK_BRICK_ROWS; y++) {
        for (x = 0; x < ARK_W; x++) {
            if (brickAt(session, x, y)) setCell(grid, x, y, 'brick');
        }
    }

    var py = ARK_H - 1;
    for (x = session.paddleX; x < session.paddleX + ARK_PADDLE_W; x++) {
        setCell(grid, x, py, 'paddle');
    }

    var bx = Math.round(session.ballX);
    var by = Math.round(session.ballY);
    if (by >= 0 && by < ARK_H && bx >= 0 && bx < ARK_W) {
        setCell(grid, bx, by, 'ball');
    }

    return grid;
}

function cellIndex(x, y) {
    return y * ARK_W + x;
}

function setCell(grid, x, y, val) {
    if (y < 0 || y >= ARK_H || x < 0 || x >= ARK_W) return;
    grid[cellIndex(x, y)] = val;
}

export function buildArkanoidOsView(session) {
    session = session || createArkanoidState();
    var footer = session.waiting ? '◀▶ pálka · OK vystřelit' : '◀▶ · Zpět';
    var status = 'ARKANOID';
    var useBoard = !!session.alive;

    if (!session.alive) {
        var won = remainingBricks(session) === 0;
        return {
            mode: 'arkanoid',
            status: won ? 'ARKANOID · VÍTĚZSTVÍ' : 'ARKANOID · KONEC',
            lines: ['', won ? '  VŠECHNY CIHLY!' : '  KONEC HRY', '  SKÓRE ' + (session.score || 0), '  OK = nová', '', ''],
            focusLine: -1,
            footer: 'OK restart · Zpět',
            buffer: '',
            useBoard: false,
            score: session.score || 0
        };
    }

    return {
        mode: 'arkanoid',
        status: status,
        lines: ['', '', '', '', '', ''],
        focusLine: -1,
        footer: footer,
        buffer: '',
        useBoard: useBoard,
        score: session.score || 0,
        lives: session.lives || 0
    };
}
