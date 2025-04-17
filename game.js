const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GOOD_SHIP_SIZE = 40;
const BAD_SHIP_ROWS = 4;
const BAD_SHIP_COLS = 5;
const BAD_SHIP_WIDTH = 50;
const BAD_SHIP_HEIGHT = 30;
const BULLET_SPEED = 3;
const MAX_SPEED_UPS = 4;
const MOVE_SPEED = 5; // Base movement speed for diagonal movement
const SCORE_FEEDBACK_DURATION = 1000; // Duration of score feedback in ms

let shootKey = " ";
let gameDuration = 120;
let startTime;
let isPaused = false;
let scoreFeedbacks = []; // Array to store score feedback animations
let goodShip = {
  x: canvas.width / 2 - GOOD_SHIP_SIZE / 2, // Center horizontally
  y: canvas.height - GOOD_SHIP_SIZE - 10, // Fixed position at bottom
  width: GOOD_SHIP_SIZE,
  height: GOOD_SHIP_SIZE,
  color: "#00f",
  bullets: [],
  dx: 0, // Horizontal movement direction
  dy: 0  // Vertical movement direction
};

let badShips = [];
let badDirection = { x: 1, y: 0 }; // Now includes vertical direction
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
let lastShootTime = 0;
const SHOOT_COOLDOWN = 300; 
let shootInterval = null;
let isShooting = false;
let speedIncreaseTimer;

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
  // Reset ship to starting position
  goodShip.x = canvas.width / 2 - GOOD_SHIP_SIZE / 2;
  goodShip.y = canvas.height - GOOD_SHIP_SIZE - 10;
  goodShip.dx = 0;
  goodShip.dy = 0;
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

  // Add speed increase timer
  clearInterval(speedIncreaseTimer);
  speedIncreaseTimer = setInterval(increaseSpeed, 5000);
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
  
  // Draw the point value
  const points = (4 - ship.rowIndex) * 5;
  ctx.fillStyle = "white";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(points.toString(), 0, 0);
  
  ctx.restore();
}

function togglePause() {
  isPaused = !isPaused;
  const pauseButton = document.getElementById('pauseButton');
  pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
  
  if (isPaused) {
    stopMusic();
  } else {
    playMusic();
  }
}

function addScoreFeedback(x, y, points) {
  scoreFeedbacks.push({
    x: x,
    y: y,
    points: points,
    startTime: Date.now(),
    alpha: 1
  });
}

function updateGame() {
  if (isPaused) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGoodShip(goodShip);

  // Update score feedbacks
  for (let i = scoreFeedbacks.length - 1; i >= 0; i--) {
    const feedback = scoreFeedbacks[i];
    const elapsed = Date.now() - feedback.startTime;
    const progress = elapsed / SCORE_FEEDBACK_DURATION;
    
    if (progress >= 1) {
      scoreFeedbacks.splice(i, 1);
      continue;
    }

    feedback.y -= 2; // Move upward
    feedback.alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = feedback.alpha;
    ctx.fillStyle = "yellow";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`+${feedback.points}`, feedback.x, feedback.y);
    ctx.restore();
  }

  // Update good ship position based on current direction
  goodShip.x += goodShip.dx * MOVE_SPEED;
  goodShip.y += goodShip.dy * MOVE_SPEED;

  // Keep good ship within bounds
  goodShip.x = Math.max(0, Math.min(canvas.width - goodShip.width, goodShip.x));
  goodShip.y = Math.max(canvas.height * 0.6, Math.min(canvas.height - goodShip.height, goodShip.y));

  // Update good ship bullets with diagonal movement
  for (let i = goodShip.bullets.length - 1; i >= 0; i--) {
    let b = goodShip.bullets[i];
    b.x += b.dx * BULLET_SPEED * speedFactor;
    b.y += b.dy * BULLET_SPEED * speedFactor;
    ctx.fillStyle = "lime";
    ctx.fillRect(b.x, b.y, 4, 10);
    if (b.y < 0 || b.x < 0 || b.x > canvas.width) goodShip.bullets.splice(i, 1);
  }

  // Update bad ships with diagonal movement
  let shiftDown = false;
  let hitWall = false;
  for (let ship of badShips) {
    ship.x += badDirection.x * 1.2 * speedFactor;
    ship.y += badDirection.y * 1.2 * speedFactor;
    
    if (ship.x < 0 || ship.x + ship.width > canvas.width) {
      hitWall = true;
    }
    if (ship.y < 0 || ship.y + ship.height > canvas.height * 0.6) {
      shiftDown = true;
    }
    drawBadShip(ship);
  }

  // Handle bad ships direction change
  if (hitWall) {
    badDirection.x *= -1;
    badDirection.y = Math.random() * 0.2 - 0.1; // Add slight vertical movement
  }
  if (shiftDown) {
    badDirection.y *= -1;
  }

  // Update bad bullets with diagonal movement
  for (let i = badBullets.length - 1; i >= 0; i--) {
    let b = badBullets[i];
    b.x += b.dx * BULLET_SPEED * speedFactor;
    b.y += b.dy * BULLET_SPEED * speedFactor;
    ctx.fillStyle = "red";
    ctx.fillRect(b.x, b.y, b.width, b.height);
    if (b.y > canvas.height || b.x < 0 || b.x > canvas.width) {
      badBullets.splice(i, 1);
    } else if (
      b.x < goodShip.x + goodShip.width &&
      b.x + b.width > goodShip.x &&
      b.y < goodShip.y + goodShip.height &&
      b.y + b.height > goodShip.y
    ) {
      lives--;
      playHit();
      document.getElementById("lives").textContent = `Lives: ${lives}`;
      badBullets.splice(i, 1);
      // Reset good ship to starting position
      goodShip.x = canvas.width / 2 - GOOD_SHIP_SIZE / 2;
      goodShip.y = canvas.height - GOOD_SHIP_SIZE - 10;
      goodShip.dx = 0;
      goodShip.dy = 0;
      if (lives === 0) endGame("disqualified");
    }
  }

  // Add new bad bullets with diagonal movement
  if (badBullets.length === 0 || Date.now() - lastBadBulletTime > 1000) {
    let shooter = badShips[Math.floor(Math.random() * badShips.length)];
    if (shooter) {
      // Check if the previous shot has passed 3/4 of the canvas or hit the good ship
      let canShoot = true;
      if (badBullets.length > 0) {
        const lastBullet = badBullets[badBullets.length - 1];
        // Check if the last bullet has passed 3/4 of the canvas
        const hasPassedThreeQuarters = lastBullet.y > canvas.height * 0.75;
        // Check if the last bullet hit the good ship
        const hasHitGoodShip = lastBullet.x < goodShip.x + goodShip.width &&
                              lastBullet.x + lastBullet.width > goodShip.x &&
                              lastBullet.y < goodShip.y + goodShip.height &&
                              lastBullet.y + lastBullet.height > goodShip.y;
        
        canShoot = hasPassedThreeQuarters || hasHitGoodShip;
      }

      if (canShoot) {
        badBullets.push({
          x: shooter.x + shooter.width / 2,
          y: shooter.y + shooter.height,
          width: 4,
          height: 10,
          dx: (Math.random() - 0.5) * 0.5, // Random horizontal movement
          dy: 1 // Always move downward
        });
        lastBadBulletTime = Date.now();
      }
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
        addScoreFeedback(ship.x + ship.width/2, ship.y, points);
        document.getElementById("score").textContent = `Score: ${score}`;
        badShips.splice(j, 1);
        goodShip.bullets.splice(i, 1);
        playEnemyHit();
        break;
      }
    }
  }

  if (badShips.length === 0) endGame("cleared");
  document.getElementById("timer").textContent = `Time: ${formatTime(remainingTime)}`;

  const scoreElement = document.getElementById("score");
  scoreElement.style.transform = "scale(1.2)";
  setTimeout(() => {
    scoreElement.style.transform = "scale(1)";
  }, 200);
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

function startNewGame() {
  // Clear all intervals
  clearInterval(gameInterval);
  clearInterval(gameIntervalTimer);
  if (shootInterval) {
    clearInterval(shootInterval);
    shootInterval = null;
  }

  // Reset game state
  goodShip.bullets = [];
  badBullets = [];
  badShips = [];
  score = 0;
  lives = 3;
  remainingTime = gameDuration;
  speedFactor = 1;
  speedupCount = 0;
  lastShootTime = 0;
  isShooting = false;
  isPaused = false;
  scoreFeedbacks = [];
  
  // Reset ship to starting position
  goodShip.x = canvas.width / 2 - GOOD_SHIP_SIZE / 2;
  goodShip.y = canvas.height - GOOD_SHIP_SIZE - 10;
  goodShip.dx = 0;
  goodShip.dy = 0;

  // Reset UI
  document.getElementById("score").textContent = `Score: ${score}`;
  document.getElementById("lives").textContent = `Lives: ${lives}`;
  document.getElementById("timer").textContent = `Time: ${formatTime(remainingTime)}`;
  document.getElementById("pauseButton").textContent = "Pause";

  // Start new game
  startGame();
}

function endGame(reason) {
  clearInterval(gameInterval);
  clearInterval(gameIntervalTimer);

  const timeTaken = Math.floor((Date.now() - startTime) / 1000);
  
  // Only save score if it's a proper game end (not from New Game button)
  if (reason !== "newgame") {
    scoreHistory.push({ score, time: timeTaken, user: username });
  }

  let message;
  if (reason === "disqualified") message = "You Lost!";
  else if (reason === "time") message = score < 100 ? `You can do better (${score} points)` : "Winner!";
  else if (reason === "cleared") message = "Champion!";
  else if (reason === "newgame") return; // Don't show end game screen for new game

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

function handleShooting() {
  const now = Date.now();
  if (now - lastShootTime >= SHOOT_COOLDOWN) {
    // Create bullet with current ship's movement direction
    goodShip.bullets.push({
      x: goodShip.x + goodShip.width / 2,
      y: goodShip.y,
      dx: goodShip.dx * 0.5, // Add horizontal movement based on ship direction
      dy: -1 // Always move upward
    });
    const shootSound = document.getElementById('sfxShoot');
    if (shootSound) {
      shootSound.currentTime = 0;
      shootSound.play().catch(() => {});
    }
    lastShootTime = now;
  }
}

document.addEventListener("keydown", (e) => {
  // Only prevent default if we're in the game screen
  if (!document.getElementById("game").classList.contains("hidden")) {
    // Prevent default behavior for game controls
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", shootKey].includes(e.key)) {
      e.preventDefault();
    }
  }

  // Update good ship movement direction
  if (e.key === "ArrowLeft") goodShip.dx = -1;
  if (e.key === "ArrowRight") goodShip.dx = 1;
  if (e.key === "ArrowUp") goodShip.dy = -1;
  if (e.key === "ArrowDown") goodShip.dy = 1;

  if (e.key === shootKey && !isShooting) {
    isShooting = true;
    handleShooting();
    shootInterval = setInterval(handleShooting, SHOOT_COOLDOWN);
  }

  if (e.key.toLowerCase() === 'p' && !document.getElementById("game").classList.contains("hidden")) {
    togglePause();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === shootKey) {
    isShooting = false;
    if (shootInterval) {
      clearInterval(shootInterval);
      shootInterval = null;
    }
  }
  
  // Reset movement direction when key is released
  if (e.key === "ArrowLeft" && goodShip.dx < 0) goodShip.dx = 0;
  if (e.key === "ArrowRight" && goodShip.dx > 0) goodShip.dx = 0;
  if (e.key === "ArrowUp" && goodShip.dy < 0) goodShip.dy = 0;
  if (e.key === "ArrowDown" && goodShip.dy > 0) goodShip.dy = 0;
});

let gameIntervalTimer = null;

document.addEventListener('DOMContentLoaded', function() {
  const bgMusic = document.getElementById('bgMusic');
  const sfxHit = document.getElementById('sfxHit');
  
  window.playHit = function() {
    if (sfxHit) {
      sfxHit.currentTime = 0;
      sfxHit.play().catch(() => {}); 
    }
  };
});

$('#loginForm').on('submit', function (e) {
  e.preventDefault();
  const loginInput = $('#loginUsername').val();
  const passInput = $('#loginPassword').val();
  const user = users.find(u => u.username === loginInput && u.password === passInput);
  if (user) {
    // Clear score history if it's a different player
    if (username !== loginInput) {
      scoreHistory = [];
    }
    username = loginInput;
    navigateTo('config');
  } else {
    $('#loginMsg').text('Invalid username or password.');
  }
});

function playMusic() {
  const gameScreen = document.getElementById('game');
  if (!gameScreen.classList.contains('hidden')) {
    bgMusic.volume = 0.3;
    bgMusic.play().catch(() => {}); 
  }
}

function stopMusic() {
  bgMusic.pause();
  bgMusic.currentTime = 0;
}

function navigateTo(screenId) {
  $('.screen').addClass('hidden');
  $('#' + screenId).removeClass('hidden');
  
  // If exiting the game screen, stop all game-related intervals and reset state
  if (screenId !== 'game') {
    stopMusic();
    clearInterval(gameInterval);
    clearInterval(gameIntervalTimer);
    if (shootInterval) {
      clearInterval(shootInterval);
      shootInterval = null;
    }
    // Reset game state
    goodShip.bullets = [];
    badBullets = [];
    badShips = [];
    score = 0;
    lives = 3;
    remainingTime = gameDuration;
    speedFactor = 1;
    speedupCount = 0;
    lastShootTime = 0;
    isShooting = false;
  }
}

function playEnemyHit() {
  const sfxEnemyHit = document.getElementById('sfxEnemyHit');
  if (sfxEnemyHit) {
    sfxEnemyHit.currentTime = 0;
    sfxEnemyHit.play().catch(() => {}); // Avoid autoplay issues
  }
}

function increaseSpeed() {
  if (speedupCount < MAX_SPEED_UPS) {
    speedupCount++;
    speedFactor += 0.5; // Increase speed by 50% each time
    // Add visual feedback for speed increase
    const speedFeedback = document.createElement('div');
    speedFeedback.style.position = 'absolute';
    speedFeedback.style.top = '50%';
    speedFeedback.style.left = '50%';
    speedFeedback.style.transform = 'translate(-50%, -50%)';
    speedFeedback.style.color = '#ff0';
    speedFeedback.style.fontSize = '24px';
    speedFeedback.style.fontWeight = 'bold';
    speedFeedback.style.textShadow = '0 0 10px #ff0';
    speedFeedback.style.zIndex = '1000';
    speedFeedback.textContent = `Speed Level ${speedupCount}!`;
    document.getElementById('game').appendChild(speedFeedback);
    setTimeout(() => speedFeedback.remove(), 1000);
  } else {
    clearInterval(speedIncreaseTimer);
  }
}
