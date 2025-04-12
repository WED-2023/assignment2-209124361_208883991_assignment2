const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GOOD_SHIP_SIZE = 40;
const BAD_SHIP_ROWS = 4;
const BAD_SHIP_COLS = 5;
const BAD_SHIP_WIDTH = 50;
const BAD_SHIP_HEIGHT = 30;
const BULLET_SPEED = 3;
const MAX_SPEED_UPS = 4;

let shootKey = " ";
let gameDuration = 120;
let startTime;
let goodShip = {
  x: Math.random() * (canvas.width - GOOD_SHIP_SIZE),
  y: canvas.height - GOOD_SHIP_SIZE - 10,
  width: GOOD_SHIP_SIZE,
  height: GOOD_SHIP_SIZE,
  color: "#00f",
  bullets: []
};

let badShips = [];
let badDirection = 1;
let badBullets = [];
let speedFactor = 1;
let score = 0;
let lives = 3;
let remainingTime = gameDuration;
let gameInterval;
let speedupCount = 0;
let lastBadBulletTime = 0;
let scoreHistory = [];
let username = "player";

function startGame() {
  shootKey = document.getElementById("shootKey").value || " ";
  gameDuration = Math.max(parseInt(document.getElementById("gameTime").value), 2) * 60;
  remainingTime = gameDuration;
  goodShip.color = document.getElementById("goodColor").value;
  const badColor = document.getElementById("badColor").value;
  score = 0;
  lives = 3;
  speedFactor = 0.5;
  speedupCount = 0;
  badShips = [];
  badBullets = [];
  goodShip.bullets = [];
  goodShip.x = Math.random() * (canvas.width - GOOD_SHIP_SIZE);
  startTime = Date.now();

  document.getElementById("score").textContent = `Score: ${score}`;
  document.getElementById("lives").textContent = `Lives: ${lives}`;
  document.getElementById("timer").textContent = `Time: ${formatTime(remainingTime)}`;

  for (let row = 0; row < BAD_SHIP_ROWS; row++) {
    for (let col = 0; col < BAD_SHIP_COLS; col++) {
      badShips.push({
        x: col * (BAD_SHIP_WIDTH + 10) + 100,
        y: row * (BAD_SHIP_HEIGHT + 10) + 50,
        width: BAD_SHIP_WIDTH,
        height: BAD_SHIP_HEIGHT,
        rowIndex: row,
        color: badColor
      });
    }
  }

  navigateTo("game");
  playMusic();
  clearScoreBoard();
  clearInterval(gameInterval);
  gameInterval = setInterval(updateGame, 1000 / 60);
  clearInterval(gameIntervalTimer);
  gameIntervalTimer = setInterval(() => {
    remainingTime--;
    if (remainingTime <= 0) {
      endGame("time");
    }
  }, 1000);
}

function drawGoodShip(ship) {
  ctx.save();
  ctx.translate(ship.x + ship.width / 2, ship.y + ship.height / 2);
  ctx.fillStyle = ship.color;
  ctx.beginPath();
  ctx.moveTo(0, -ship.height / 2);
  ctx.lineTo(ship.width / 2, ship.height / 2);
  ctx.lineTo(-ship.width / 2, ship.height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBadShip(ship) {
  ctx.save();
  ctx.translate(ship.x + ship.width / 2, ship.y + ship.height / 2);
  ctx.fillStyle = ship.color;
  ctx.beginPath();
  ctx.moveTo(0, -ship.height / 2);
  ctx.lineTo(ship.width / 2, 0);
  ctx.lineTo(0, ship.height / 2);
  ctx.lineTo(-ship.width / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGoodShip(goodShip);

  for (let i = goodShip.bullets.length - 1; i >= 0; i--) {
    let b = goodShip.bullets[i];
    b.y -= BULLET_SPEED * speedFactor;
    ctx.fillStyle = "lime";
    ctx.fillRect(b.x, b.y, 4, 10);
    if (b.y < 0) goodShip.bullets.splice(i, 1);
  }

  let shiftDown = false;
  for (let ship of badShips) {
    ship.x += badDirection * 1.2 * speedFactor;
    if (ship.x < 0 || ship.x + ship.width > canvas.width) shiftDown = true;
    drawBadShip(ship);
  }
  if (shiftDown) {
    badDirection *= -1;
    for (let ship of badShips) {
      ship.y += 10;
    }
  }

  if (badBullets.length === 0 || Date.now() - lastBadBulletTime > 1000) {
    let shooter = badShips[Math.floor(Math.random() * badShips.length)];
    if (shooter) {
      badBullets.push({
        x: shooter.x + shooter.width / 2,
        y: shooter.y + shooter.height,
        width: 4,
        height: 10
      });
      lastBadBulletTime = Date.now();
    }
  }

  for (let i = badBullets.length - 1; i >= 0; i--) {
    let b = badBullets[i];
    b.y += BULLET_SPEED * speedFactor;
    ctx.fillStyle = "red";
    ctx.fillRect(b.x, b.y, b.width, b.height);
    if (b.y > canvas.height) badBullets.splice(i, 1);
    else if (
      b.x < goodShip.x + goodShip.width &&
      b.x + b.width > goodShip.x &&
      b.y < goodShip.y + goodShip.height &&
      b.y + b.height > goodShip.y
    ) {
      lives--;
      document.getElementById("lives").textContent = `Lives: ${lives}`;
      badBullets.splice(i, 1);
      if (lives === 0) endGame("disqualified");
    }
  }

  for (let i = goodShip.bullets.length - 1; i >= 0; i--) {
    let bullet = goodShip.bullets[i];
    for (let j = badShips.length - 1; j >= 0; j--) {
      let ship = badShips[j];
      if (
        bullet.x < ship.x + ship.width &&
        bullet.x + 4 > ship.x &&
        bullet.y < ship.y + ship.height &&
        bullet.y + 10 > ship.y
      ) {
        const points = (4 - ship.rowIndex) * 5;
        score += points;
        document.getElementById("score").textContent = `Score: ${score}`;
        badShips.splice(j, 1);
        goodShip.bullets.splice(i, 1);
        break;
      }
    }
  }

  if (badShips.length === 0) endGame("cleared");
  document.getElementById("timer").textContent = `Time: ${formatTime(remainingTime)}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function clearScoreBoard() {
  const existing = document.getElementById("scoreBoard");
  if (existing) existing.remove();
}

function endGame(reason) {
  clearInterval(gameInterval);
  clearInterval(gameIntervalTimer);

  const timeTaken = Math.floor((Date.now() - startTime) / 1000);
  scoreHistory.push({ score, time: timeTaken, user: username });

  let message;
  if (reason === "disqualified") message = "You Lost!";
  else if (reason === "time") message = score < 100 ? `You can do better (${score} points)` : "Winner!";
  else message = "Champion!";

  const sortedScores = scoreHistory.slice().sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 5);
  const isTop5 = sortedScores.some(s => s.score === score && s.time === timeTaken && s.user === username);

  let historyHtml = `<div id="scoreBoard" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#000d;color:#0ff;padding:2rem;text-align:center;z-index:1000;border:2px solid #0ff;border-radius:10px;">
    <h2>Game Over: ${message}</h2>
    <p>Your score: ${score}, Time: ${timeTaken}s</p>
    <h3>High Scores</h3>
    <table style="margin:0 auto;text-align:left;">
      <tr><th>Rank</th><th>User</th><th>Score</th><th>Time</th></tr>
      ${sortedScores.map((s, i) => `<tr><td>${i + 1}</td><td>${s.user}</td><td>${s.score}</td><td>${s.time}s</td></tr>`).join("")}
    </table>
    <p><strong>${isTop5 ? "Your score made the top 5!" : "Try again to reach top 5."}</strong></p>
    <button onclick="navigateTo('config')">New Game</button>
    <button onclick="navigateTo('welcome')">Exit</button>
  </div>`;

  clearScoreBoard();
  const gameScreen = document.getElementById("game");
  const div = document.createElement("div");
  div.innerHTML = historyHtml;
  gameScreen.appendChild(div);
}

document.addEventListener("keydown", (e) => {
  const moveAmount = 5;
  const limitY = canvas.height * 0.6;
  if (e.key === "ArrowLeft" && goodShip.x > 0) goodShip.x -= moveAmount;
  if (e.key === "ArrowRight" && goodShip.x + goodShip.width < canvas.width) goodShip.x += moveAmount;
  if (e.key === "ArrowUp" && goodShip.y > limitY) goodShip.y -= moveAmount;
  if (e.key === "ArrowDown" && goodShip.y + goodShip.height < canvas.height) goodShip.y += moveAmount;

  if (e.key === shootKey) {
    goodShip.bullets.push({ x: goodShip.x + goodShip.width / 2, y: goodShip.y });
  }
});

let gameIntervalTimer = null;

// Capture username during login
$('#loginForm').on('submit', function (e) {
  e.preventDefault();
  const loginInput = $('#loginUsername').val();
  const passInput = $('#loginPassword').val();
  const user = users.find(u => u.username === loginInput && u.password === passInput);
  if (user) {
    username = loginInput;
    navigateTo('config');
  } else {
    $('#loginMsg').text('Invalid username or password.');
  }
});
