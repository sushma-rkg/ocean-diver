// ---------- Setup ----------
const canvas = document.getElementById("ocean");
const ctx = canvas.getContext("2d");

// Make the canvas match the window size (and keep it matching on resize)
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ---------- Cursor ----------
// Start in the middle of the screen until the mouse moves
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

// Pointer events cover mouse, finger, and pen with the same code.
// pointerdown also lets a single tap send the diver to that spot.
function updateTarget(event) {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
}
window.addEventListener("pointermove", updateTarget);
window.addEventListener("pointerdown", updateTarget);

// ---------- Diver ----------
const diver = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  follow: 0.06, // how quickly the diver catches up: lower = lazier, higher = snappier
  facing: 1,    // 1 = facing right, -1 = facing left
  scale: 1,     // size multiplier, changes with depth (set every frame in update)
  minScale: 0.7, // size at the top of the screen (shallow, looks farther away)
  maxScale: 1.3, // size at the bottom of the screen (deep, looks closer)
  width: 160,    // size the illustration is drawn at, before the depth scale
  height: 80,
  // Where the regulator mouthpiece is, measured from the diver's center when facing right
  mouthOffsetX: 61,
  mouthOffsetY: 3,
};

// The diver illustration (a transparent SVG that faces right)
const diverImage = new Image();
diverImage.src = "diver.svg";

// ---------- Bubbles ----------
const bubbles = [];

// Create one bubble at the given spot, with slightly random properties
function spawnBubble(x, y) {
  bubbles.push({
    x: x,
    y: y,
    size: 2 + Math.random() * 5,          // radius: 2 to 7 pixels
    speed: 0.6 + Math.random() * 1.4,     // upward speed
    drift: (Math.random() - 0.5) * 0.6,   // sideways drift per frame
    wobble: Math.random() * Math.PI * 2,  // random starting point for the wiggle
    opacity: 0.8,
  });
}

// ---------- Fish ----------
const fish = [];
const FISH_COUNT = 8;

// Create one fish at the given x position, with a random height, size, and speed
function makeFish(x) {
  return {
    x: x,
    y: canvas.height * (0.1 + Math.random() * 0.8), // anywhere from 10% to 90% down
    size: 8 + Math.random() * 10,                   // body length: 8 to 18 pixels
    speed: 0.3 + Math.random() * 0.7,               // slow swim to the right
  };
}

// Start the school spread out across the screen
for (let i = 0; i < FISH_COUNT; i++) {
  fish.push(makeFish(Math.random() * canvas.width));
}

// Move every fish right; when one leaves the right edge, bring it back on the left
function updateFish() {
  for (let i = 0; i < fish.length; i++) {
    fish[i].x += fish[i].speed;

    if (fish[i].x - fish[i].size > canvas.width) {
      fish[i] = makeFish(-fish[i].size * 2);
    }
  }
}

// ---------- Octopuses ----------
const octopuses = [];

// homeX and homeY are fractions of the screen (0 to 1), so an octopus stays in the same
// place on screen when the window is resized. Each one gets its own random drift and sway.
function makeOctopus(homeX, homeY, size) {
  return {
    homeX: homeX,
    homeY: homeY,
    size: size,                                // body radius in pixels
    x: 0,                                      // current position (set every frame)
    y: 0,
    tilt: 0,                                   // slight body rotation (set every frame)
    time: Math.random() * 1000,                // own frame counter, random start so they are out of step
    driftSpeedX: 0.004 + Math.random() * 0.004,
    driftSpeedY: 0.005 + Math.random() * 0.004,
    driftX: 30 + Math.random() * 25,           // how far it wanders sideways from home
    driftY: 8 + Math.random() * 10,            // how far it bobs up and down
    swaySpeed: 0.025 + Math.random() * 0.015,  // how fast the tentacles sway
  };
}

// Exactly three, each with a different spot and size
octopuses.push(makeOctopus(0.18, 0.15, 11));
octopuses.push(makeOctopus(0.50, 0.86, 15));
octopuses.push(makeOctopus(0.83, 0.66, 13));

// Float each octopus slowly around its home position
function updateOctopuses() {
  for (const o of octopuses) {
    o.time += 1;
    o.x = canvas.width * o.homeX + Math.sin(o.time * o.driftSpeedX) * o.driftX;
    o.y = canvas.height * o.homeY + Math.sin(o.time * o.driftSpeedY + 1.7) * o.driftY;
    o.tilt = Math.sin(o.time * o.driftSpeedX * 1.3) * 0.1;
  }
}

// ---------- Update: change numbers a little each frame ----------
function update() {
  updateFish();
  updateOctopuses();

  // Move the diver a fraction of the way toward the cursor
  const dx = (mouse.x - diver.x) * diver.follow;
  const dy = (mouse.y - diver.y) * diver.follow;
  diver.x += dx;
  diver.y += dy;

  // Turn to face the direction of travel, but only for clearly horizontal movement.
  // Otherwise keep the current facing (vertical movement, or tiny steps while settling).
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 0.5) {
    diver.facing = dx > 0 ? 1 : -1;
  }

  // Depth: 0 at the top of the screen, 1 at the bottom. The diver's own y is used
  // (not the cursor's) because it already moves smoothly, so the size does too.
  const depth = Math.min(Math.max(diver.y / canvas.height, 0), 1);
  diver.scale = diver.minScale + (diver.maxScale - diver.minScale) * depth;

  // The bubbles come out of the regulator at his mouth, so the spawn point switches sides
  // when he turns and moves closer to or farther from his center as he changes size
  const bubbleX = diver.x + diver.mouthOffsetX * diver.facing * diver.scale;
  const bubbleY = diver.y + diver.mouthOffsetY * diver.scale;

  // Spawn a bubble on about 1 in 3 frames
  if (Math.random() < 0.35) {
    spawnBubble(bubbleX, bubbleY);
  }

  // Move every bubble, going backwards so removing one is safe
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.speed;
    b.wobble += 0.08;
    b.x += b.drift + Math.sin(b.wobble) * 0.3;
    b.opacity -= 0.003;

    // Remove bubbles that have faded out or left the top of the screen
    if (b.opacity <= 0 || b.y < -10) {
      bubbles.splice(i, 1);
    }
  }
}

// ---------- Draw: paint everything at its new position ----------
// Each octopus is a shaded body, two small eyes, and eight tapered tentacles
function drawOctopuses() {
  for (const o of octopuses) {
    const s = o.size;

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.tilt);

    // Tentacles: each is a chain of short segments that get thinner toward the tip,
    // and sway from side to side at a slightly different timing
    ctx.strokeStyle = "#7d3d3a";
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const baseX = (i - 3.5) * s * 0.2;
      let prevX = baseX;
      let prevY = s * 0.4;

      for (let step = 1; step <= 8; step++) {
        const t = step / 8; // 0 at the body, 1 at the tip
        const x = baseX * (1 + t * 1.2) + Math.sin(o.time * o.swaySpeed + i * 0.9 + t * 3) * s * 0.3 * t;
        const y = s * 0.4 + t * s * 1.7;

        ctx.lineWidth = Math.max(s * 0.2 * (1 - t), 0.8);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();

        prevX = x;
        prevY = y;
      }
    }

    // Body, shaded lighter on the upper left
    const shade = ctx.createRadialGradient(-s * 0.25, -s * 0.4, s * 0.1, 0, 0, s);
    shade.addColorStop(0, "#c77563");
    shade.addColorStop(1, "#7d3d3a");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.8, s * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes: small and dark, with a tiny highlight
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#1b1114";
      ctx.beginPath();
      ctx.arc(side * s * 0.38, s * 0.15, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(side * s * 0.38 - s * 0.04, s * 0.11, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Each fish is an oval body with a triangle tail on its left (they swim right)
function drawFish() {
  ctx.fillStyle = "rgba(255, 183, 77, 0.6)";
  for (const f of fish) {
    // Body
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.size, f.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(f.x - f.size * 0.8, f.y);
    ctx.lineTo(f.x - f.size * 1.5, f.y - f.size * 0.5);
    ctx.lineTo(f.x - f.size * 1.5, f.y + f.size * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBubbles() {
  for (const b of bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.35})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// The diver illustration, drawn centered on the diver's position
function drawDiver() {
  // Wait until the image file has finished loading
  if (!diverImage.complete || diverImage.naturalWidth === 0) return;

  // Move the origin to the diver, mirror horizontally when facing left,
  // and resize for depth. The image is drawn relative to the diver's center.
  ctx.save();
  ctx.translate(diver.x, diver.y);
  ctx.scale(diver.facing * diver.scale, diver.scale);
  ctx.drawImage(diverImage, -diver.width / 2, -diver.height / 2, diver.width, diver.height);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawOctopuses(); // painted first, so they sit at the very back
  drawFish();      // then the fish, in front of the octopuses
  drawBubbles();
  drawDiver();
}

// ---------- The loop: runs about 60 times per second ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
