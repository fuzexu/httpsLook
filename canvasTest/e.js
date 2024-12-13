const magnitude = ({ x, y }) => Math.hypot(x, y);
const makeVector = ([x1, y1], [x2, y2]) => ({ x: x2 - x1, y: y2 - y1 });
const unitVector = (vector) => {
  const mag = magnitude(vector);
  if (mag === 0) {
    console.warn('试图从零长度向量创建单位向量，默认为{x:0, y:0}');
    return { x: 0, y: 0 };
  }
  return { x: vector.x / mag, y: vector.y / mag };
};
const vectorDotProduct = (v1, v2) => v1.x * v2.x + v1.y * v2.y;
class Instrument {
  constructor(container = document.body) {
    this.GRAVITY = 0.0168;
    this.DOT_RADIUS = 4;
    this.LINE_WIDTH = 2;
    this.BG_COLOR = '#ffffff';
    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dots = [];
    this.lines = [];
    this.currentBallColor = 'red';
    this.BOUNCE_REDUCTION_FACTOR = 0.67;
    this.lastSpawnTime = performance.now();
    this.spawnInterval = 1000;
    this.initCanvas();
    this.spawnDot();
    this.animate();

    this.bindEvents();
  }
  bindEvents() {
    // Unified event handling for mouse and touch
    // 鼠标和触摸的统一事件处理
    const start = (event) => {
      this.startLine(event);
    };
    const move = (event) => {
      this.drawLine(event);
    };
    const end = (event) => {
      this.endLine(event);
    };

    // Canvas event listeners
    // 画布事件监听器
    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    this.canvas.addEventListener('mouseup', end);

    // Global event listeners to handle mouseup and touchend outside the canvas
    // 全局事件监听器处理画布外的鼠标up和触摸端
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);

    // Handle cases where the mouse leaves the window or canvas
    // 处理鼠标离开窗口或画布的情况
    window.addEventListener('mouseout', (e) => {
      if (this.isDrawing) {
        this.endLine(e);
      }
    });

    // Prevent context menu on right-click to allow drawing with right mouse button
    // 防止右键单击上下文菜单以允许使用鼠标右键绘图
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Prevent scrolling on touch devices
    // 防止在触摸设备上滚动
    document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }
  getMousePos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return [clientX - rect.left, clientY - rect.top];
  }
  startLine(event) {
    event.preventDefault();

    this.isDrawing = true;
    const [x, y] = this.getMousePos(event);
    this.lineInProgress = {
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      color: "#fab",
      mode: this.currentMode,
      // 对于切换线
      isActive: true, // For toggle lines
    };

    // Attempt to resume AudioContext if not already running
    // 如果AudioContext尚未运行，请尝试恢复
    if (this.audioContext.state === 'suspended' && this.isSoundOn) {
      this.resumeAudioContext();
    }
  }
  drawLine(event) {
    if (!this.isDrawing || !this.lineInProgress) {
      return;
    }
    event.preventDefault();
    let [x, y] = this.getMousePos(event);

    // Handle edge cases when drawing lines outside the canvas
    x = clamp(x, 0, this.width);
    y = clamp(y, 0, this.height);

    // Update line in progress
    this.lineInProgress.x2 = x;
    this.lineInProgress.y2 = y;

    // this.redraw();
  }
  endLine(event) {
    if (!this.isDrawing || !this.lineInProgress) {
      return;
    }
    event.preventDefault();
    this.isDrawing = false;

    // Use the last known position of the line endpoint
    const x2 = this.lineInProgress.x2;
    const y2 = this.lineInProgress.y2;

    // Clamp line endpoints to canvas boundaries
    const clampedStart = clampPoint(
      [this.lineInProgress.x1, this.lineInProgress.y1],
      this
    );
    const clampedEnd = clampPoint([x2, y2], this);

    // Prevent zero-length lines
    if (clampedStart[0] === clampedEnd[0] && clampedStart[1] === clampedEnd[1]) {
      this.lineInProgress = null;
      return;
    }

    const newLine = {
      x1: clampedStart[0],
      y1: clampedStart[1],
      x2: clampedEnd[0],
      y2: clampedEnd[1],
      color: '#fab',
      mode: this.currentMode,
      isActive: true, // For toggle lines
    };

    if (this.currentMode === 'erase') {
      // Erase lines that intersect with the red line, including the predrawn line
    //   this.eraseLines(newLine);
    } else {
      this.lines.push(newLine);
    }

    this.lineInProgress = null;
  }
  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.background = this.BG_COLOR;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.lineCap = 'round';
    this.container.appendChild(this.canvas);
    this.updatePredrawnLinePosition();
  }
  // 线
  updatePredrawnLinePosition() {
    const colorButtonsHeight = 50;
    const margin = 20;
    this.predrawnLine = {
      x1: this.width * 0.1,
      y1: this.height - colorButtonsHeight - margin,
      x2: this.width * 0.9,
      y2: (this.height * 0.96) - colorButtonsHeight - margin,
      color: 'black',
    };
  }
  // 球
  spawnDot(color) {
    const x = this.width / 2;
    const y = 10;
    const velocity = { x: 0, y: 3.5 };
    const dotColor = color || this.currentBallColor;
    this.dots.push({
      position: [x, y],
      velocity,
      color: dotColor,
      gravityModifier: 1,
      lastSplit: 0,
    });
  }
  animate() {
    const currentTime = performance.now();
    console.log('animate', currentTime, this.lastSpawnTime, this.spawnInterval);
    if (currentTime - this.lastSpawnTime >= this.spawnInterval) {
      if (this.spawnInterval !== Infinity) {
        this.spawnDot();
        this.lastSpawnTime = currentTime;
      }
    }
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
  update() {
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const dot = this.dots[i];
      dot.velocity.y += this.GRAVITY;
      const currentPos = { x: dot.position[0], y: dot.position[1] };
      const nextPos = {
        x: currentPos.x + dot.velocity.x * 0.85,
        y: currentPos.y + dot.velocity.y * 0.85,
      };
      let earliestCollision = null;
      let collisionLine = null;
      let collisionTime = 1;
      const allLines = this.predrawnLine ? [...this.lines, this.predrawnLine] : [...this.lines];
      console.log('allLines', allLines);
      for (const line of allLines) {
        const collision = this.getCollision(currentPos, nextPos, line);
        console.log('collision', collision);
        if (collision && collision.time < collisionTime) {
          earliestCollision = collision.point;
          collisionLine = line;
          collisionTime = collision.time;
        }
      }
      console.log('earliestCollision',earliestCollision);
      if (earliestCollision) {
        dot.position[0] = earliestCollision.x;
        dot.position[1] = earliestCollision.y;
        this.reflect(dot, collisionLine);
        const remainingTime = 1 - collisionTime;
        dot.position[0] += dot.velocity.x * remainingTime;
        dot.position[1] += dot.velocity.y * remainingTime;
      } else {
        dot.position[0] = nextPos.x;
        dot.position[1] = nextPos.y;
      }
      if (
        dot.position[0] < 0 ||
        dot.position[0] > this.width ||
        dot.position[1] > this.height
      ) {
        this.dots.splice(i, 1);
      }
    }
  }
  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    console.log('this.predrawnLine', this.predrawnLine);
    if (this.predrawnLine) {
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = this.LINE_WIDTH;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.predrawnLine.x1, this.predrawnLine.y1);
      this.ctx.lineTo(this.predrawnLine.x2, this.predrawnLine.y2);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);
    for (const dot of this.dots) {
      this.ctx.fillStyle = dot.color;
      this.ctx.strokeStyle = dot.color;
      this.ctx.beginPath();
      this.ctx.arc(dot.position[0], dot.position[1], this.DOT_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }
  getCollision(p1, p2, line) {
    const s1_x = p2.x - p1.x;
    const s1_y = p2.y - p1.y;
    const s2_x = line.x2 - line.x1;
    const s2_y = line.y2 - line.y1;
    const denominator = -s2_x * s1_y + s1_x * s2_y;
    if (denominator === 0) {
      return null;
    }
    const s = (-s1_y * (p1.x - line.x1) + s1_x * (p1.y - line.y1)) / denominator;
    const t =
      (s2_x * (p1.y - line.y1) - s2_y * (p1.x - line.x1)) / denominator;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      const collisionX = p1.x + t * s1_x;
      const collisionY = p1.y + t * s1_y;
      return { point: { x: collisionX, y: collisionY }, time: t };
    }
    return null;
  }
  reflect(dot, line) {
    console.log("reflect", dot, line);
    const lineVec = makeVector([line.x1, line.y1], [line.x2, line.y2]);
    const lineMagnitude = magnitude(lineVec);
    if (lineMagnitude === 0) {
      return;
    }
    const normal = unitVector({ x: -lineVec.y, y: lineVec.x });
    const dotProd = vectorDotProduct(dot.velocity, normal);
    dot.velocity.x -= 2 * dotProd * normal.x;
    dot.velocity.y -= 2 * dotProd * normal.y;
    dot.velocity.y *= this.BOUNCE_REDUCTION_FACTOR;
    const speed = magnitude(dot.velocity);
    const maxSpeed = 5;
    if (speed > maxSpeed) {
      dot.velocity.x = (dot.velocity.x / speed) * maxSpeed;
      dot.velocity.y = (dot.velocity.y / speed) * maxSpeed;
    }
  }
}
window.onload = () => {
  new Instrument();
};