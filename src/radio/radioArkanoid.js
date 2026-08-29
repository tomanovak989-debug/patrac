/**
 * Arkanoid — mřížka 48×48, prvek 1× → 2×2 buňky.
 * Levely se zvyšující rychlostí, každých 5 cihel +1 míč, konec až padnou všechny.
 */
export var ARK_TICK_MS = 33;
export var ARK_W = 48;
export var ARK_H = 48;
export var ARK_UNIT = 2;
export var ARK_CELL_COUNT = ARK_W * ARK_H;
export var ARK_PADDLE_W = 16;
export var ARK_PADDLE_STEP = 8;
export var ARK_PADDLE_H = 2;
export var ARK_BRICK_ROWS = 6;
export var ARK_BRICK_COLS = ARK_W / ARK_UNIT;
export var ARK_BALL_R = 0.9;
export var ARK_BASE_VX = 0.26;
export var ARK_BASE_VY = 0.288;
export var ARK_BRICKS_PER_BALL = 5;
/** velocity.x += paddleVelocity.x * k — přenos švihu pálky na kuličku. */
export var ARK_PADDLE_VEL_K = 0.048;

function buildInitialBricks() {
    var rows = [];
    var y;
    var x;
    for (y = 0; y < ARK_BRICK_ROWS; y++) {
        var row = [];
        for (x = 0; x < ARK_BRICK_COLS; x++) row.push(true);
        rows.push(row);
    }
    return rows;
}

function speedMult(session) {
    return Math.max(1, session.level || 1);
}

function scaledVelX(session, sign) {
    return (sign >= 0 ? 1 : -1) * ARK_BASE_VX * speedMult(session);
}

function scaledVelY(session) {
    return -ARK_BASE_VY * speedMult(session);
}

function createBall(session, waiting, velSign) {
    return {
        x: session.paddleX + (ARK_PADDLE_W / 2),
        y: ARK_H - 5,
        velX: scaledVelX(session, velSign == null ? 1 : velSign),
        velY: scaledVelY(session),
        waiting: !!waiting
    };
}

export function createArkanoidState() {
    var session = {
        paddleX: 16,
        paddleXPrev: 16,
        paddleVelX: 0,
        dragActive: false,
        dragVelX: 0,
        balls: [createBall({ paddleX: 16, level: 1 }, true, 1)],
        bricks: buildInitialBricks(),
        score: 0,
        level: 1,
        bricksBroken: 0,
        alive: true,
        waiting: true
    };
    syncWaitingBalls(session);
    return session;
}

function syncWaitingBalls(session) {
    var i;
    var spread = 0;
    for (i = 0; i < session.balls.length; i++) {
        if (!session.balls[i].waiting) continue;
        session.balls[i].x = session.paddleX + (ARK_PADDLE_W / 2) + spread;
        session.balls[i].y = ARK_H - 5;
        spread += 1.4;
    }
}

export function resetArkanoidState(session) {
    if (!session) return createArkanoidState();
    var fresh = createArkanoidState();
    session.paddleX = fresh.paddleX;
    session.paddleXPrev = fresh.paddleX;
    session.paddleVelX = 0;
    session.dragActive = false;
    session.dragVelX = 0;
    session.balls = fresh.balls;
    session.bricks = fresh.bricks;
    session.score = 0;
    session.level = 1;
    session.bricksBroken = 0;
    session.alive = true;
    session.waiting = true;
    return session;
}

function clampPaddleX(x) {
    if (x < 0) return 0;
    if (x > ARK_W - ARK_PADDLE_W) return ARK_W - ARK_PADDLE_W;
    return x;
}

export function arkanoidSetPaddleX(session, x) {
    if (!session || !session.alive) return false;
    var next = clampPaddleX(x);
    if (next === session.paddleX) return false;
    session.paddleX = next;
    if (session.waiting) syncWaitingBalls(session);
    return true;
}

export function arkanoidMovePaddle(session, dir) {
    if (!session || !session.alive) return false;
    var delta = dir === 'right' ? ARK_PADDLE_STEP : -ARK_PADDLE_STEP;
    var next = clampPaddleX(session.paddleX + delta);
    if (next === session.paddleX) return false;
    session.paddleVelX = next - session.paddleX;
    session.paddleX = next;
    if (session.waiting) syncWaitingBalls(session);
    return true;
}

/** Tažení prstem/myší — delta v jednotkách hřiště, přepočtená na jeden snímek. */
export function arkanoidNotePaddleDrag(session, deltaX, dtMs) {
    if (!session) return;
    session.dragActive = true;
    var dt = dtMs && dtMs > 0 ? dtMs : ARK_TICK_MS;
    session.dragVelX = deltaX * (ARK_TICK_MS / dt);
}

export function arkanoidEndPaddleDrag(session) {
    if (!session) return;
    session.dragActive = false;
    session.dragVelX = 0;
}

function samplePaddleMotion(session) {
    var prev = session.paddleXPrev;
    if (prev == null) prev = session.paddleX;
    session.paddleVelX = session.paddleX - prev;
    session.paddleXPrev = session.paddleX;
}

function paddleEnglishVx(session) {
    if (session.dragActive) return session.dragVelX || 0;
    return session.paddleVelX || 0;
}

function brickAt(session, bx, by) {
    if (!session.bricks || by < 0 || by >= session.bricks.length) return false;
    if (bx < 0 || bx >= ARK_BRICK_COLS) return false;
    return !!session.bricks[by][bx];
}

function clearBrickAtCell(session, cx, cy) {
    var bx = Math.floor(cx / ARK_UNIT);
    var by = Math.floor(cy / ARK_UNIT);
    if (!brickAt(session, bx, by)) return false;
    session.bricks[by][bx] = false;
    session.score = (session.score || 0) + 10;
    session.bricksBroken = (session.bricksBroken || 0) + 1;
    if (session.bricksBroken % ARK_BRICKS_PER_BALL === 0) {
        var sign = session.balls.length % 2 === 0 ? 1 : -1;
        var nb = createBall(session, session.waiting, sign);
        if (!session.waiting) nb.waiting = false;
        session.balls.push(nb);
        if (session.waiting) syncWaitingBalls(session);
    }
    return true;
}

function remainingBricks(session) {
    var n = 0;
    var y;
    var x;
    for (y = 0; y < session.bricks.length; y++) {
        for (x = 0; x < ARK_BRICK_COLS; x++) {
            if (session.bricks[y][x]) n++;
        }
    }
    return n;
}

function launchBalls(session) {
    session.waiting = false;
    var i;
    for (i = 0; i < session.balls.length; i++) {
        if (!session.balls[i].waiting) continue;
        session.balls[i].waiting = false;
        session.balls[i].velX = scaledVelX(session, i % 2 === 0 ? 1 : -1);
        session.balls[i].velY = scaledVelY(session);
    }
}

function nextLevel(session) {
    session.level = (session.level || 1) + 1;
    session.bricks = buildInitialBricks();
    session.waiting = true;
    var i;
    for (i = 0; i < session.balls.length; i++) {
        session.balls[i].waiting = true;
        session.balls[i].velX = scaledVelX(session, i % 2 === 0 ? 1 : -1);
        session.balls[i].velY = scaledVelY(session);
    }
    syncWaitingBalls(session);
}

export function arkanoidOk(session) {
    if (!session) return false;
    if (!session.alive) {
        resetArkanoidState(session);
        return true;
    }
    if (session.waiting) {
        launchBalls(session);
        return true;
    }
    return false;
}

function reflectFromPaddle(session, ball) {
    var speed = speedMult(session);
    var paddleVx = paddleEnglishVx(session);

    ball.velY = -Math.abs(ball.velY);
    ball.velX += paddleVx * ARK_PADDLE_VEL_K;

    var maxVx = 0.64 * speed;
    if (ball.velX > maxVx) ball.velX = maxVx;
    if (ball.velX < -maxVx) ball.velX = -maxVx;

    var minUp = -0.16 * speed;
    var maxUp = -0.58 * speed;
    if (ball.velY > minUp) ball.velY = minUp;
    if (ball.velY < maxUp) ball.velY = maxUp;

    ball.y = ARK_H - 6;
}

function tickBall(session, ball) {
    if (ball.waiting) return null;

    ball.x += ball.velX;
    ball.y += ball.velY;

    if (ball.x < ARK_BALL_R) {
        ball.x = ARK_BALL_R;
        ball.velX = Math.abs(ball.velX);
    } else if (ball.x > ARK_W - ARK_BALL_R) {
        ball.x = ARK_W - ARK_BALL_R;
        ball.velX = -Math.abs(ball.velX);
    }

    if (ball.y < ARK_BALL_R) {
        ball.y = ARK_BALL_R;
        ball.velY = Math.abs(ball.velY);
    }

    var bx = Math.round(ball.x);
    var by = Math.round(ball.y);
    var brickRowCells = ARK_BRICK_ROWS * ARK_UNIT;

    if (by < brickRowCells && clearBrickAtCell(session, bx, by)) {
        ball.velY = Math.abs(ball.velY);
        if (remainingBricks(session) === 0) {
            nextLevel(session);
            return 'level';
        }
        return 'hit';
    }

    var paddleY = ARK_H - ARK_PADDLE_H - 1;
    if (ball.y >= paddleY - 1.5 &&
        ball.y <= paddleY + ARK_PADDLE_H + 1.5 &&
        ball.x >= session.paddleX - 0.5 &&
        ball.x <= session.paddleX + ARK_PADDLE_W + 0.5 &&
        ball.velY > 0) {
        reflectFromPaddle(session, ball);
        return 'paddle';
    }

    if (ball.y > ARK_H + 1) return 'lost';

    return true;
}

export function arkanoidTick(session) {
    if (!session || !session.alive) return false;
    samplePaddleMotion(session);
    if (session.waiting) return false;
    if (!session.balls || !session.balls.length) {
        session.alive = false;
        return 'lose';
    }

    var aliveBalls = [];
    var i;
    var result;
    for (i = 0; i < session.balls.length; i++) {
        result = tickBall(session, session.balls[i]);
        if (result === 'lost') continue;
        aliveBalls.push(session.balls[i]);
    }
    session.balls = aliveBalls;

    if (!session.balls.length) {
        session.alive = false;
        return 'lose';
    }

    return true;
}

function fillBrickBlock(grid, bx, by, val) {
    var dx;
    var dy;
    var px = bx * ARK_UNIT;
    var py = by * ARK_UNIT;
    for (dy = 0; dy < ARK_UNIT; dy++) {
        for (dx = 0; dx < ARK_UNIT; dx++) {
            setCell(grid, px + dx, py + dy, val);
        }
    }
}

function fillCircle(grid, cx, cy, r, val) {
    var y;
    var x;
    var r2 = r * r;
    for (y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
        for (x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
            var dx = x + 0.5 - cx;
            var dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r2) setCell(grid, x, y, val);
        }
    }
}

export function buildArkanoidCellGrid(session) {
    var grid = [];
    var i;
    for (i = 0; i < ARK_CELL_COUNT; i++) grid[i] = '';

    if (!session) return grid;

    var y;
    var x;
    for (y = 0; y < ARK_BRICK_ROWS; y++) {
        for (x = 0; x < ARK_BRICK_COLS; x++) {
            if (brickAt(session, x, y)) fillBrickBlock(grid, x, y, 'brick');
        }
    }

    var py = ARK_H - ARK_PADDLE_H - 1;
    for (x = session.paddleX; x < session.paddleX + ARK_PADDLE_W; x++) {
        var dy;
        for (dy = 0; dy < ARK_PADDLE_H; dy++) {
            setCell(grid, x, py + dy, 'paddle');
        }
    }

    if (session.balls) {
        for (i = 0; i < session.balls.length; i++) {
            var ball = session.balls[i];
            fillCircle(grid, ball.x, ball.y, ARK_BALL_R + 0.15, 'ball');
        }
    }

    return grid;
}

function cellIndex(x, y) {
    return y * ARK_W + x;
}

function setCell(grid, x, y, val) {
    if (y < 0 || y >= ARK_H || x < 0 || x >= ARK_W) return;
    var idx = cellIndex(x, y);
    if (!grid[idx] || val === 'ball') grid[idx] = val;
}

function activeBallCount(session) {
    if (!session.balls) return 0;
    var n = 0;
    var i;
    for (i = 0; i < session.balls.length; i++) {
        if (!session.balls[i].waiting) n++;
    }
    return n;
}

export function buildArkanoidOsView(session) {
    session = session || createArkanoidState();
    var footer = session.waiting ? '◀▶ / táhni · OK start' : '◀▶ / táhni · Zpět';
    var lv = session.level || 1;
    var status = 'ARKANOID · LV ' + lv;
    var useBoard = !!session.alive;

    if (!session.alive) {
        return {
            mode: 'arkanoid',
            status: 'ARKANOID · KONEC',
            lines: ['', '  KONEC HRY', '  SKÓRE ' + (session.score || 0), '  LV ' + lv, '  OK = nová', ''],
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
        balls: session.balls ? session.balls.length : 0,
        activeBalls: activeBallCount(session)
    };
}
