// main.js
import {
  randomInt,
  distance,
  getLineLength,
  magnitude,
  makeVector,
  unitVector,
  vectorDotProduct,
  isOutOfBounds,
  clampPoint,
  clamp,
} from './helper.js';
import {
  encodeState,
  decodeState,
  getShareableURL,
  handleIncomingShare,
} from './share.js';

class Instrument {
  constructor(container = document.body) {
    // Constants
    this.GRAVITY = 0.0168;
    this.DOT_RADIUS = 4;
    this.LINE_WIDTH = 2;
    this.BG_COLOR = '#ffffff'; // Light background for iOS aesthetic

    // Instrument State
    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dots = [];
    this.lines = [];
    this.lineInProgress = null;
    this.isDrawing = false;
    // 当前模式
    this.currentMode = 'draw'; // 'draw', 'erase', or 'toggle'
    // 当前球的颜色--默认球色
    this.currentBallColor = 'black'; // Default ball color
    // 弹跳减少因子
    this.BOUNCE_REDUCTION_FACTOR = 0.67;
    // 分割冷却时间--500 ms的冷却时间
    this.SPLIT_COOLDOWN = 200; // 500ms cooldown
    // 分割偏移--以像素为单位的偏移距离
    this.SPLIT_OFFSET = 5;     // Offset distance in pixels

    // Ball spawning timing
    // 最后一次刷出时间--球生成时间
    this.lastSpawnTime = performance.now();
    // 产卵时间间隔--默认为每秒1个球
    this.spawnInterval = 1000; // Default to 1 ball per second

    // Audio State--音频状态-声音是关闭的，直到用户点击播放
    this.isSoundOn = false; // Sound is off until user clicks play

    // Initialize Audio Context (kept suspended initially)
    // 初始化音频上下文(初始保持挂起)
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.audioContext
      .suspend()
      .then(() => {
        console.log('AudioContext initialized and suspended.');
        this.updateSoundIcon();
      })
      .catch((err) => {
        console.error('Failed to suspend AudioContext:', err);
      });

    // Initialize Canvas and UI
    // 初始化画布和UI
    this.initCanvas();

    // Event Handlers
    // 事件处理程序
    this.bindEvents();

    // Show the play overlay
    // 显示播放叠加
    this.showPlayOverlay();

    // Handle incoming shared state from URL
    // 处理来自URL的传入共享状态
    handleIncomingShare(this);
  }

  /**
   * Initializes the canvas and UI elements, including the header with
   * Mode Select, Sound Toggle, Drop Rate Slider, Drop Rate Dropdown, and Share Button.
   * 初始化画布和UI元素，包括header
   * 模式选择，声音切换，跌落率滑块，跌落率下拉，和共享按钮。
   */
  initCanvas() {
    // Main canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.background = this.BG_COLOR;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.lineCap = 'round'; // Improved line appearance

    // Append canvas to container
    // 将画布附加到容器
    this.container.appendChild(this.canvas);

    // Create Top Controls Wrapper
    // 创建顶部控件包装器
    this.topControlsWrapper = document.createElement('div');
    this.topControlsWrapper.classList.add('top-controls-wrapper');
    this.container.appendChild(this.topControlsWrapper);

    // Create Left Controls Container
    // 创建左侧控件容器
    this.leftControls = document.createElement('div');
    this.leftControls.classList.add('left-controls');
    this.topControlsWrapper.appendChild(this.leftControls);

    // Mode Select Dropdown
    // 模式选择下拉菜单
    this.modeSelect = document.createElement('select');
    this.modeSelect.classList.add('mode-select');

    // Create options
    const modes = [
      { value: 'draw', text: '✏️ Draw' },
      { value: 'erase', text: '🧹 Erase' },
      { value: 'toggle', text: '🔀 Toggle' },
      { value: 'silent', text: '◻️ Silent' }, // Added Silent mode
      { value: 'burner', text: '🔥 Burner' }, // Added Burner mode
      { value: 'splitter', text: '✨ Splitter' },
    ];

    modes.forEach((mode) => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.text;
      this.modeSelect.appendChild(option);
    });

    // Set default mode to 'draw'
    // 设置默认模式为“绘制”
    this.modeSelect.value = 'draw';

    // Event listener for mode change
    // 用于模式更改的事件侦听器
    this.modeSelect.addEventListener('change', () => {
      this.currentMode = this.modeSelect.value;
    });

    this.leftControls.appendChild(this.modeSelect);

    // Sound Toggle
    // 声音切换
    this.soundToggle = document.createElement('div');
    this.soundToggle.classList.add('sound-toggle');
    this.updateSoundIcon();
    this.soundToggle.addEventListener('click', (event) => {
      event.preventDefault();
      this.toggleSound();
    });
    this.leftControls.appendChild(this.soundToggle);

    // Create Right Controls Container
    // 创建右控件容器
    this.rightControls = document.createElement('div');
    this.rightControls.classList.add('right-controls');
    this.topControlsWrapper.appendChild(this.rightControls);

    // Drop Rate Slider (visible on desktop)
    // 掉落率滑块(在桌面上可见)
    this.dropRateSlider = document.createElement('input');
    this.dropRateSlider.type = 'range';
    this.dropRateSlider.min = 0;
    this.dropRateSlider.max = 4;
    // 默认值:每秒一个球
    this.dropRateSlider.value = 1; // Default: 1 ball per second
    this.dropRateSlider.step = 0.5;
    this.dropRateSlider.classList.add('drop-rate-slider');
    this.dropRateSlider.addEventListener('input', () => {
      this.syncDropRate('slider');
      this.updateBallDropRate();
    });
    this.rightControls.appendChild(this.dropRateSlider);

    // Drop Rate Dropdown (visible on mobile)
    // 掉落率下拉菜单(在手机上可见)
    this.dropRateDropdown = document.createElement('select');
    this.dropRateDropdown.classList.add('drop-rate-dropdown');

    // Populate dropdown with options
    // 用选项填充下拉列表
    const dropRateOptions = [
      { value: 0, text: 'Manual' },
      { value: 0.5, text: '0.5 dots / sec' },
      { value: 1, text: '1 dot / sec' },
      { value: 1.5, text: '1.5 dots / sec' },
      { value: 2, text: '2 dots / sec' },
      { value: 2.5, text: '2.5 dots / sec' },
      { value: 3, text: '3 dots / sec' },
      { value: 3.5, text: '3.5 dots / sec' },
      { value: 4, text: '4 dots / sec' },
    ];

    dropRateOptions.forEach((optionData) => {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.text;
      this.dropRateDropdown.appendChild(option);
    });

    // Set the dropdown to the initial value of the slider
    // 将下拉菜单设置为滑块的初始值
    this.dropRateDropdown.value = this.dropRateSlider.value;

    this.dropRateDropdown.addEventListener('change', () => {
      this.syncDropRate('dropdown');
      this.updateBallDropRate();
    });

    this.rightControls.appendChild(this.dropRateDropdown);

    // Share Button
    this.shareButton = document.createElement('button');
    this.shareButton.classList.add('share-button');
    this.shareButton.textContent = '🔗';
    this.shareButton.title = 'Share your Franzelio creation';
    this.shareButton.addEventListener('click', () => this.showShareOverlay());
    this.rightControls.appendChild(this.shareButton);

    // Color buttons wrapper
    this.colorButtonsWrapper = document.createElement('div');
    this.colorButtonsWrapper.classList.add('color-buttons-wrapper');
    this.container.appendChild(this.colorButtonsWrapper);

    // Color buttons
    const colors = ['black', 'red', 'green', 'blue'];
    colors.forEach((color) => {
      const button = document.createElement('button');
      button.classList.add('color-button');
      button.style.backgroundColor = color;
      button.dataset.color = color;
      button.addEventListener('click', () => {
        const dropRateValue = parseFloat(this.dropRateSlider.value);
        if (dropRateValue === 0) {
          // Manual mode: spawn a dot of this color
          this.spawnDot(color);
        } else {
          // Change current ball color
          this.changeBallColor(color);
        }
      });
      this.colorButtonsWrapper.appendChild(button);
    });


    // Initialize the predrawn line position
    // 初始化预绘制的线位置
    this.updatePredrawnLinePosition();

    // Handle window resize
    // 处理窗口大小调整
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Synchronizes the drop rate between slider and dropdown.
   * 同步滑块和下拉之间的下降率。
   * @param {String} source - 'slider' or 'dropdown'
   */
  syncDropRate(source) {
    const value = parseFloat(
      source === 'slider' ? this.dropRateSlider.value : this.dropRateDropdown.value
    );
    if (source === 'slider') {
      this.dropRateDropdown.value = value;
    } else if (source === 'dropdown') {
      this.dropRateSlider.value = value;
    }
  }

  updateBallDropRate() {
    this.dropRateValue = parseFloat(this.dropRateSlider.value);
    this.spawnInterval = this.dropRateValue === 0 ? Infinity : 1000 / this.dropRateValue; // Convert rate to interval in ms
  }



  /**
    * Updates the predrawn line position to be just above the color buttons.
    * 将预先绘制的线条位置更新到颜色按钮的正上方。
    */
  updatePredrawnLinePosition() {
    // Adjust the predrawn line to be just above the color buttons
    // Assuming the color buttons have a fixed height of 50px
    // 调整预绘制的线刚好在颜色按钮的上方
    // 假设颜色按钮的固定高度为50px
    // 匹配 color-buttons-wrapper的CSS高度
    const colorButtonsHeight = 50; // Match the CSS height of .color-buttons-wrapper
    // 预绘制的线条和颜色按钮之间的空间
    const margin = 20; // Space between the predrawn line and the color buttons
    this.predrawnLine = {
      x1: this.width * 0.1,
      y1: this.height - colorButtonsHeight - margin,
      x2: this.width * 0.9,
      y2: (this.height * 0.96) - colorButtonsHeight - margin,
      color: 'black',
    };
  }


  /**
   * Updates the sound icon based on the sound state.
   * 根据声音状态更新声音图标。
   */
  updateSoundIcon() {
    this.soundToggle.textContent = this.isSoundOn ? '🔊' : '🔇';
  }

  /**
   * Handles window resize events and updates canvas dimensions and elements accordingly.
   * 处理窗口大小更改事件，并根据需要更新画布尺寸和元素。
   */
  handleResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Update predrawn line position
    // 更新预先绘制的线位置
    this.updatePredrawnLinePosition();

    // Redraw the canvas to reflect new dimensions
    // 重新绘制画布以反映新的维度
    this.redraw();
  }

  /**
   * Redraws the canvas.
   * 重绘画布。
   */
  redraw() {
    // 重新绘制画布
    this.draw(); // Redraw the canvas
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

    // this.canvas.addEventListener('touchstart', start);
    // this.canvas.addEventListener('touchmove', move);
    // this.canvas.addEventListener('touchend', end);

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

  /**
   * Retrieves the mouse or touch position relative to the canvas.
   * 检索相对于画布的鼠标或触摸位置。
   * 鼠标或触摸事件。
   * @param {Event} event - The mouse or touch event.
   * [x, y]坐标。
   * @returns {Array} - The [x, y] coordinates.
   */
  getMousePos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return [clientX - rect.left, clientY - rect.top];
  }

  /**
   * Starts drawing a line.
   * 开始画一条线。
   * 鼠标或触摸事件。
   * @param {Event} event - The mouse or touch event.
   */
  startLine(event) {
    event.preventDefault();

    this.isDrawing = true;
    const [x, y] = this.getMousePos(event);
    this.lineInProgress = {
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      color: this.getLineColorForMode(this.currentMode),
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

  /**
   * Gets the line color based on the current mode.
   * @param {String} mode - The current mode.
   * @returns {String} - The line color.
   */
  getLineColorForMode(mode) {
    switch (mode) {
      case 'draw':
      case 'toggle':
        return 'black';
      case 'erase':
        return 'red';
      case 'silent':
        return 'darkgray'; // Color for Silent lines
      case 'burner':
        return 'darkred';  // Color for Burner lines
      case 'splitter':
        return 'magenta';
      default:
        return 'black';
    }
  }


  /**
   * Draws the line in progress as the user moves the mouse or finger.
   * @param {Event} event - The mouse or touch event.
   */
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

    this.redraw();
  }

  /**
   * Ends the line drawing.
   * @param {Event} event - The mouse or touch event.
   */
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
      color: this.getLineColorForMode(this.currentMode),
      mode: this.currentMode,
      isActive: true, // For toggle lines
    };

    if (this.currentMode === 'erase') {
      // Erase lines that intersect with the red line, including the predrawn line
      this.eraseLines(newLine);
    } else {
      this.lines.push(newLine);
    }

    this.lineInProgress = null;
  }

  /**
   * Erases lines that intersect with the given eraser line.
   * @param {Object} eraserLine - The line used for erasing.
   */
  eraseLines(eraserLine) {
    // Include the predrawn line in the lines array if it exists
    const allLines = this.predrawnLine ? [...this.lines, this.predrawnLine] : [...this.lines];

    // Remove lines that intersect with the eraser line
    const remainingLines = allLines.filter((line) => !this.linesIntersect(line, eraserLine));

    // Check if the predrawn line was erased
    const predrawnLineErased = this.predrawnLine && !remainingLines.includes(this.predrawnLine);

    // Update the lines array
    this.lines = remainingLines.filter((line) => line !== this.predrawnLine);

    // If the predrawn line was erased, set it to null
    if (predrawnLineErased) {
      this.predrawnLine = null;
    }
  }

  /**
   * Checks if two lines intersect.
   * @param {Object} line1 - First line with x1, y1, x2, y2.
   * @param {Object} line2 - Second line with x1, y1, x2, y2.
   * @returns {Boolean} - True if the lines intersect, false otherwise.
   */
  linesIntersect(line1, line2) {
    // Check if two lines intersect using vector cross products
    const denominator =
      (line1.x1 - line1.x2) * (line2.y1 - line2.y2) -
      (line1.y1 - line1.y2) * (line2.x1 - line2.x2);

    if (denominator === 0) {
      return false; // Lines are parallel
    }

    const t =
      ((line1.x1 - line2.x1) * (line2.y1 - line2.y2) -
        (line1.y1 - line2.y1) * (line2.x1 - line2.x2)) /
      denominator;
    const u =
      -(
        ((line1.x1 - line1.x2) * (line1.y1 - line2.y1) -
          (line1.y1 - line1.y2) * (line1.x1 - line2.x1)) /
        denominator
      );

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }


  /**
   * Spawns a new dot (ball) at the top center of the canvas.
   * @param {String} color - Optional color of the dot
   */
  spawnDot(color) {
    const x = this.width / 2;
    const y = 10;
    const velocity = { x: 0, y: 3.5 };
    const dotColor = color || this.currentBallColor;
    // Assign a musical scale based on the color
    const scale = this.getScaleForColor(dotColor);
    this.dots.push({
      position: [x, y],
      velocity,
      color: dotColor,
      scale,
      gravityModifier: 1, // Initialize gravityModifier
      lastSplit: 0,       // Initialize lastSplit to 0
    });
  }





  /**
   * Retrieves the musical scale associated with the given color.
   * @param {String} color - The color of the ball.
   * @returns {Array} - The musical scale frequencies.
   */
  // In main.js

  getScaleForColor(color) {
    // Map colors to musical scales
    const scales = {
      red: [
        261.63, // C4
        293.66, // D4
        329.63, // E4
        349.23, // F4
        392.00, // G4
        440.00, // A4
        493.88, // B4
        523.25  // C5
      ], // C major scale
      blue: [
        196.00, // G3
        220.00, // A3
        246.94, // B3
        261.63, // C4
        293.66, // D4
        329.63, // E4
        369.99, // F#4
        392.00  // G4
      ], // G major scale
      green: [
        164.81, // E3
        185.00, // F#3
        196.00, // G3
        220.00, // A3
        246.94, // B3
        293.66, // D4
        329.63, // E4
        349.23  // F4
      ], // E minor scale
      black: [
        220.00, // A3
        246.94, // B3
        261.63, // C4
        293.66, // D4
        329.63, // E4
        349.23, // F4
        392.00, // G4
        440.00  // A4
      ] // A minor scale
    };
    return scales[color] || scales['black']; // Default to black scale
  }


  /**
   * Changes the current ball color.
   * @param {String} color - The new color for the balls.
   */
  changeBallColor(color) {
    this.currentBallColor = color;
  }

  /**
   * Animation loop that updates and draws the instrument state.
   */
  animate() {
    const currentTime = performance.now();
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

  /**
   * Updates the positions of the dots and handles collisions.
   */
  /**
   * Updates the positions of the dots and handles collisions.
   */
  update() {
    const currentTime = performance.now(); // Current timestamp
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const dot = this.dots[i];
      // Apply gravity
      dot.velocity.y += this.GRAVITY;
      // Predict next position
      const currentPos = { x: dot.position[0], y: dot.position[1] };
      const nextPos = {
        x: currentPos.x + dot.velocity.x * 0.85,
        y: currentPos.y + dot.velocity.y * 0.85,
      };

      let earliestCollision = null;
      let collisionLine = null;
      let collisionTime = 1; // Initialize with 1 (end of movement)

      // Include the predrawn line in collision detection if it exists
      const allLines = this.predrawnLine ? [...this.lines, this.predrawnLine] : [...this.lines];

      // Check for collisions with all lines
      for (const line of allLines) {
        const collision = this.getCollision(currentPos, nextPos, line);
        if (collision && collision.time < collisionTime) {
          earliestCollision = collision.point;
          collisionLine = line;
          collisionTime = collision.time;
        }
      }

      if (earliestCollision) {
        // Move dot to collision point
        dot.position[0] = earliestCollision.x;
        dot.position[1] = earliestCollision.y;

        // Handle Splitter Line collision
        if (collisionLine.mode === 'splitter') {
          // Check if the cooldown period has elapsed
          if (currentTime - dot.lastSplit >= this.SPLIT_COOLDOWN) {
            // Remove the original dot
            this.dots.splice(i, 1);

            // Calculate line vector and normal
            const lineVec = makeVector([collisionLine.x1, collisionLine.y1], [collisionLine.x2, collisionLine.y2]);
            const normal = unitVector({ x: -lineVec.y, y: lineVec.x });

            // Reflect the dot's velocity over the splitter line's normal
            const dotProd = vectorDotProduct(dot.velocity, normal);
            const reflectedVelocity = {
              x: dot.velocity.x - 2 * dotProd * normal.x,
              y: dot.velocity.y - 2 * dotProd * normal.y,
            };

            const speed = magnitude(reflectedVelocity);

            // Calculate angle of reflected velocity
            const reflectedAngle = Math.atan2(reflectedVelocity.y, reflectedVelocity.x);

            // Define new angles for splitting (+45 and -45 degrees from reflection)
            const angle1 = reflectedAngle + Math.PI / 4; // +45 degrees
            const angle2 = reflectedAngle - Math.PI / 4; // -45 degrees

            // Define velocities for the new dots
            const velocity1 = {
              x: speed * Math.cos(angle1),
              y: speed * Math.sin(angle1),
            };
            const velocity2 = {
              x: speed * Math.cos(angle2),
              y: speed * Math.sin(angle2),
            };

            // Calculate offset positions to prevent immediate re-collision
            const offsetX1 = Math.cos(angle1) * this.SPLIT_OFFSET;
            const offsetY1 = Math.sin(angle1) * this.SPLIT_OFFSET;
            const offsetX2 = Math.cos(angle2) * this.SPLIT_OFFSET;
            const offsetY2 = Math.sin(angle2) * this.SPLIT_OFFSET;

            // Create two new dots with updated positions and velocities
            const newDot1 = {
              position: [earliestCollision.x + offsetX1, earliestCollision.y + offsetY1],
              velocity: velocity1,
              color: dot.color,
              scale: dot.scale,
              gravityModifier: dot.gravityModifier,
              lastSplit: currentTime, // Update lastSplit to current time
            };
            const newDot2 = {
              position: [earliestCollision.x + offsetX2, earliestCollision.y + offsetY2],
              velocity: velocity2,
              color: dot.color,
              scale: dot.scale,
              gravityModifier: dot.gravityModifier,
              lastSplit: currentTime, // Update lastSplit to current time
            };

            // Add the new dots to the dots array
            this.dots.push(newDot1);
            this.dots.push(newDot2);
          }

          // Play collision sound
          this.playCollisionSound(dot, collisionLine);

          continue; // Skip to the next dot to prevent further processing
        }

        // If the line is a toggle line, flip its state
        if (collisionLine.mode === 'toggle') {
          collisionLine.isActive = !collisionLine.isActive;
        }

        // Handle Burner line collision
        if (collisionLine.mode === 'burner') {
          // Remove the dot from the dots array
          this.dots.splice(i, 1);
          continue; // Skip to the next dot
        }

        // Determine if we should reflect the dot
        let shouldReflect = true;
        if (collisionLine.mode === 'toggle' && collisionLine.isActive) {
          // Line is now active after toggling, so we allow pass-through
          shouldReflect = false;
        }

        if (shouldReflect) {
          // Reflect velocity
          this.reflect(dot, collisionLine);
        }

        // Play collision sound
        this.playCollisionSound(dot, collisionLine);

        // Calculate remaining movement after collision
        const remainingTime = 1 - collisionTime;
        dot.position[0] += dot.velocity.x * remainingTime;
        dot.position[1] += dot.velocity.y * remainingTime;
      } else {
        // No collision, move dot normally
        dot.position[0] = nextPos.x;
        dot.position[1] = nextPos.y;
      }

      // Remove dots that are out of bounds (except when they go off the top)
      if (
        dot.position[0] < 0 ||
        dot.position[0] > this.width ||
        dot.position[1] > this.height
      ) {
        this.dots.splice(i, 1);
      }
      // If the dot goes off the top (dot.position[1] < 0), we do not remove it
    }
  }




  /**
   * Draws all elements on the canvas, including lines, dots, and the line in progress.
   */
  // main.js

  draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw lines
    for (const line of this.lines) {
      this.ctx.strokeStyle = line.color;
      this.ctx.lineWidth = this.LINE_WIDTH;

      if (line.mode === 'toggle') {
        // Change appearance based on isActive
        if (line.isActive) {
          this.ctx.setLineDash([]); // Solid line when active
        } else {
          this.ctx.setLineDash([2, 5]); // Dotted line when inactive
        }
      } else if (line.mode === 'silent') {
        this.ctx.setLineDash([]); // Dashed line for Silent lines
      } else if (line.mode === 'burner') {
        this.ctx.setLineDash([]); // Dotted line for Burner lines
      } else {
        this.ctx.setLineDash([]); // Solid for other lines
      }

      this.ctx.beginPath();
      this.ctx.moveTo(line.x1, line.y1);
      this.ctx.lineTo(line.x2, line.y2);
      this.ctx.stroke();
    }

    // Draw the predrawn line at the bottom if it exists
    if (this.predrawnLine) {
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = this.LINE_WIDTH;
      this.ctx.setLineDash([]); // Ensure predrawn line is always solid
      this.ctx.beginPath();
      this.ctx.moveTo(this.predrawnLine.x1, this.predrawnLine.y1);
      this.ctx.lineTo(this.predrawnLine.x2, this.predrawnLine.y2);
      this.ctx.stroke();
    }

    // Draw line in progress
    if (this.lineInProgress) {
      this.ctx.strokeStyle = this.lineInProgress.color;
      this.ctx.lineWidth = this.LINE_WIDTH;
      this.ctx.setLineDash([2, 8]); // Dotted line for in-progress drawing
      this.ctx.beginPath();
      this.ctx.moveTo(this.lineInProgress.x1, this.lineInProgress.y1);
      this.ctx.lineTo(this.lineInProgress.x2, this.lineInProgress.y2);
      this.ctx.stroke();
      this.ctx.setLineDash([]); // Reset line dash after drawing
    }

    // Reset lineDash to solid before drawing dots
    this.ctx.setLineDash([]);

    // Draw dots
    for (const dot of this.dots) {
      this.ctx.fillStyle = dot.color;
      this.ctx.strokeStyle = dot.color;
      this.ctx.beginPath();
      this.ctx.arc(dot.position[0], dot.position[1], this.DOT_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }


  /**
   * Checks for collision between a moving point and a line segment using continuous collision detection.
   * @param {Object} p1 - Starting point {x, y}
   * @param {Object} p2 - Ending point {x, y}
   * @param {Object} line - Line segment {x1, y1, x2, y2}
   * @returns {Object|null} - Returns collision point and time if collision occurs, else null
   */
  getCollision(p1, p2, line) {
    const s1_x = p2.x - p1.x;
    const s1_y = p2.y - p1.y;
    const s2_x = line.x2 - line.x1;
    const s2_y = line.y2 - line.y1;
    const denominator = -s2_x * s1_y + s1_x * s2_y;
    if (denominator === 0) {
      // Lines are parallel
      return null;
    }
    const s = (-s1_y * (p1.x - line.x1) + s1_x * (p1.y - line.y1)) / denominator;
    const t =
      (s2_x * (p1.y - line.y1) - s2_y * (p1.x - line.x1)) / denominator;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      // Collision detected
      const collisionX = p1.x + t * s1_x;
      const collisionY = p1.y + t * s1_y;
      return { point: { x: collisionX, y: collisionY }, time: t };
    }
    return null; // No collision
  }

  /**
   * Reflects the dot's velocity upon collision with a line.
   * @param {Object} dot - The dot object with position and velocity.
   * @param {Object} line - The line object the dot collided with.
   */
  reflect(dot, line) {
    // Calculate the line vector
    const lineVec = makeVector([line.x1, line.y1], [line.x2, line.y2]);
    const lineMagnitude = magnitude(lineVec);
    if (lineMagnitude === 0) {
      return;
    }
    // Calculate the normal vector (perpendicular to the line)
    const normal = unitVector({ x: -lineVec.y, y: lineVec.x }); // Perpendicular to the line
    // Calculate dot product of velocity and normal
    const dotProd = vectorDotProduct(dot.velocity, normal);
    // Reflect the velocity
    dot.velocity.x -= 2 * dotProd * normal.x;
    dot.velocity.y -= 2 * dotProd * normal.y;

    dot.velocity.y *= this.BOUNCE_REDUCTION_FACTOR;
    // Optional: Limit the velocity to prevent excessive speeds
    const speed = magnitude(dot.velocity);
    const maxSpeed = 5;
    if (speed > maxSpeed) {
      dot.velocity.x = (dot.velocity.x / speed) * maxSpeed;
      dot.velocity.y = (dot.velocity.y / speed) * maxSpeed;
    }
  }

  /**
   * Plays a sound upon collision, based on the dot's scale and the line's properties.
   * @param {Object} dot - The dot that collided.
   * @param {Object} line - The line the dot collided with.
   */
  playCollisionSound(dot, line) {
    if (!this.audioContext || !this.isSoundOn) return;

    // Skip playing sound if the line is a toggle line and it's inactive
    if (line.mode === 'toggle' && line.isActive) {
      return;
    }

    // Skip playing sound if the line is a Silent line or Burner line
    if (line.mode === 'silent' || line.mode === 'burner') {
      return;
    }

    // Calculate the angle and length of the line
    const lineVec = makeVector([line.x1, line.y1], [line.x2, line.y2]);
    const lineLength = magnitude(lineVec);

    // Calculate frequency based on line length and angle
    const angle = Math.atan2(lineVec.y, lineVec.x);
    const normalizedAngle = (angle + Math.PI) / (2 * Math.PI); // Normalize between 0 and 1
    const frequency = this.calculateFrequency(dot, lineLength, normalizedAngle);

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 1);
  }

  /**
   * Calculates the frequency for the collision sound.
   * @param {Object} dot - The dot that collided.
   * @param {Number} lineLength - The length of the line.
   * @param {Number} normalizedAngle - The normalized angle of the line.
   * @returns {Number} - The calculated frequency.
   */
  calculateFrequency(dot, lineLength, normalizedAngle) {
    // Use the dot's assigned scale
    const scale = dot.scale;
    // Map line length and angle to a note in the scale
    const index = Math.floor(normalizedAngle * scale.length);
    const frequency = scale[index % scale.length];

    // Adjust frequency based on line length (longer lines produce lower pitches)
    const lengthFactor = clamp(200 / lineLength, 0.5, 2); // Adjust between 0.5x and 2x
    return frequency * lengthFactor;
  }

  /**
   * Toggles the sound on or off.
   */
  async toggleSound() {
    if (this.isSoundOn) {
      await this.disableSound();
    } else {
      await this.enableSound();
    }
  }

  /**
   * Enables the sound by resuming the audio context.
   */
  async enableSound() {
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('AudioContext resumed.');
        this.isSoundOn = true;
        this.updateSoundIcon();
        this.playSilentSound();
      } catch (error) {
        console.error('Failed to resume AudioContext:', error);
        this.isSoundOn = false;
        this.updateSoundIcon();
      }
    } else if (this.audioContext.state === 'running') {
      this.isSoundOn = true;
      this.updateSoundIcon();
    } else {
      console.warn(`AudioContext is in unexpected state: ${this.audioContext.state}`);
      this.isSoundOn = false;
      this.updateSoundIcon();
    }
  }

  /**
   * Disables the sound by suspending the audio context.
   */
  async disableSound() {
    if (this.audioContext.state === 'running') {
      try {
        await this.audioContext.suspend();
        console.log('AudioContext suspended.');
        this.isSoundOn = false;
        this.updateSoundIcon();
      } catch (error) {
        console.error('Failed to suspend AudioContext:', error);
        this.isSoundOn = true;
        this.updateSoundIcon();
      }
    } else if (this.audioContext.state === 'suspended') {
      this.isSoundOn = false;
      this.updateSoundIcon();
    } else {
      console.warn(`AudioContext is in unexpected state: ${this.audioContext.state}`);
      this.isSoundOn = true;
      this.updateSoundIcon();
    }
  }

  /**
   * Plays a silent sound to activate the audio context on certain browsers.
   */
  playSilentSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
    console.log('Played silent sound to activate AudioContext.');
  }

  /**
   * Attempts to resume the audio context if it is suspended.
   */
  async resumeAudioContext() {
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('AudioContext resumed.');
      } catch (error) {
        console.error('Failed to resume AudioContext:', error);
      }
    }
  }


  /**
   * Displays the play overlay with a play button and explanatory text.
   */
  showPlayOverlay() {
    // Create overlay
    this.playOverlay = document.createElement('div');
    this.playOverlay.classList.add('play-overlay');
    this.playOverlay.style.display = 'flex';
    this.playOverlay.style.flexDirection = 'column';
    this.playOverlay.style.justifyContent = 'center';
    this.playOverlay.style.alignItems = 'center';
    this.playOverlay.style.position = 'fixed';
    this.playOverlay.style.top = '0';
    this.playOverlay.style.left = '0';
    this.playOverlay.style.width = '100%';
    this.playOverlay.style.height = '100%';
    this.playOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    this.playOverlay.style.zIndex = '1000';

    // Headline
    const headline = document.createElement('h1');
    headline.textContent = 'Franzelio';
    headline.style.marginBottom = '20px';
    headline.style.fontSize = '32px';
    headline.style.color = '#333333';
    this.playOverlay.appendChild(headline);

    // Explanatory Lines
    const explanations = ['Draw Lines', 'Make Music', 'Share your Instrument'];
    explanations.forEach((text) => {
      const line = document.createElement('h2');
      line.textContent = text;
      line.style.margin = '5px 0';
      line.style.fontSize = '18px';
      line.style.color = '#555555';
      this.playOverlay.appendChild(line);
    });

    // Divider
    const divider = document.createElement('hr');
    divider.style.width = '80%';
    divider.style.border = '1px solid #ccc';
    divider.style.margin = '20px 0';
    this.playOverlay.appendChild(divider);

    // Play button
    const playButton = document.createElement('div');
    playButton.classList.add('play-button');
    playButton.textContent = '▶️';
    playButton.style.cursor = 'pointer';
    playButton.style.fontSize = '60px';
    playButton.addEventListener('click', async () => {
      // Enable sound and resume audio context
      await this.enableSound();
      this.isSoundOn = true;
      this.updateSoundIcon();

      // Start the instrument
      this.spawnDot();
      this.animate();

      // Set up the ball spawning interval based on slider
      this.updateBallDropRate();

      // Remove the overlay
      this.container.removeChild(this.playOverlay);
    });
    this.playOverlay.appendChild(playButton);

    // Create a small footer with author link

    const footer = document.createElement('div');
    footer.style.marginTop = '20px';
    footer.style.fontSize = '14px';
    footer.style.color = '#666';
    const textNode = document.createTextNode('Created by ');
    const authorLink = document.createElement('a');
    authorLink.href = 'mailto:fe@f19n.cm';
    authorLink.textContent = 'Franz Enzenhofer';
    const yearNode = document.createTextNode(' - 2024');
    footer.appendChild(textNode);
    footer.appendChild(authorLink);
    footer.appendChild(yearNode);
    this.playOverlay.appendChild(footer);

    this.container.appendChild(this.playOverlay);
  }


  /**
   * Copies the provided text to the clipboard.
   * @param {String} text - The text to copy.
   */
  copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log('Copied to clipboard');
      })
      .catch((error) => {
        console.error('Failed to copy to clipboard:', error);
      });
  }

  // In main.js

  // The getState() function captures the current state of the instrument,
  // normalizing coordinates between 0 and 1 based on the canvas dimensions.
  // This ensures that when the state is shared and loaded on devices with different screen sizes,
  // the lines and dots will appear proportionally the same.

  getState() {
    return {
      // Map and normalize each line
      lines: this.lines.map((line) => ({
        x1: line.x1 / this.width,       // Normalize x1 coordinate
        y1: line.y1 / this.height,      // Normalize y1 coordinate
        x2: line.x2 / this.width,       // Normalize x2 coordinate
        y2: line.y2 / this.height,      // Normalize y2 coordinate
        color: line.color,              // Keep the line color
        mode: line.mode,                // Keep the line mode ('draw', 'erase', 'toggle')
        isActive: line.isActive,        // Keep the active state for toggle lines
      })),
      currentBallColor: this.currentBallColor,   // Save the current ball color
      dropRateValue: parseFloat(this.dropRateSlider.value),  // Save the drop rate
      // Map and normalize each dot (ball)
      dots: this.dots.map((dot) => ({
        position: [
          dot.position[0] / this.width,    // Normalize x position
          dot.position[1] / this.height,   // Normalize y position
        ],
        // Normalize velocities by dividing by a standard value (e.g., canvas width/height)
        // to make them relative and consistent across different screen sizes
        velocity: {
          x: dot.velocity.x / this.width,
          y: dot.velocity.y / this.height,
        },
        color: dot.color,                  // Keep the dot color
      })),
      // Normalize the predrawnLine if it exists
      predrawnLine: this.predrawnLine
        ? {
          x1: this.predrawnLine.x1 / this.width,   // Normalize x1
          y1: this.predrawnLine.y1 / this.height,  // Normalize y1
          x2: this.predrawnLine.x2 / this.width,   // Normalize x2
          y2: this.predrawnLine.y2 / this.height,  // Normalize y2
          color: this.predrawnLine.color,          // Keep the color
        }
        : null,
      currentMode: this.currentMode,       // Save the current drawing mode
      isSoundOn: this.isSoundOn,           // Save the sound state
    };
  }

  // The applyState() function takes the normalized state and applies it to the instrument.
  // It denormalizes the coordinates by multiplying them with the canvas dimensions,
  // ensuring that the lines and dots are correctly scaled and positioned on any device.

  applyState(state) {
    // Restore lines by denormalizing their coordinates
    if (state.lines) {
      this.lines = state.lines.map((line) => ({
        x1: line.x1 * this.width,       // Denormalize x1 coordinate
        y1: line.y1 * this.height,      // Denormalize y1 coordinate
        x2: line.x2 * this.width,       // Denormalize x2 coordinate
        y2: line.y2 * this.height,      // Denormalize y2 coordinate
        color: line.color,              // Restore line color
        mode: line.mode,                // Restore line mode
        isActive: line.isActive,        // Restore active state
      }));
    }

    // Restore the current ball color
    if (state.currentBallColor) {
      this.currentBallColor = state.currentBallColor;
    }

    // Restore the drop rate value
    if (state.dropRateValue !== undefined) {
      this.dropRateSlider.value = state.dropRateValue;
      this.dropRateDropdown.value = state.dropRateValue;
      this.updateBallDropRate();
    }

    // Restore dots by denormalizing positions and velocities
    if (state.dots && Array.isArray(state.dots)) {
      this.dots = state.dots.map((dot) => ({
        position: [
          dot.position[0] * this.width,    // Denormalize x position
          dot.position[1] * this.height,   // Denormalize y position
        ],
        velocity: {
          x: dot.velocity.x * this.width,  // Denormalize x velocity
          y: dot.velocity.y * this.height, // Denormalize y velocity
        },
        color: dot.color,                  // Restore dot color
        scale: this.getScaleForColor(dot.color),  // Restore musical scale
        lastSplit: 0, // Initialize lastSplit to 0 for existing dots
      }));
    }

    // Restore the predrawnLine if it exists
    if (state.predrawnLine) {
      this.predrawnLine = {
        x1: state.predrawnLine.x1 * this.width,   // Denormalize x1
        y1: state.predrawnLine.y1 * this.height,  // Denormalize y1
        x2: state.predrawnLine.x2 * this.width,   // Denormalize x2
        y2: state.predrawnLine.y2 * this.height,  // Denormalize y2
        color: state.predrawnLine.color,          // Restore color
      };
    } else {
      this.predrawnLine = null;
    }

    // Restore the current drawing mode
    if (state.currentMode) {
      this.currentMode = state.currentMode;
      this.modeSelect.value = state.currentMode;
    }

    // Restore the sound state and update the audio context accordingly
    if (state.isSoundOn !== undefined) {
      this.isSoundOn = state.isSoundOn;
      this.updateSoundIcon();
      if (this.isSoundOn && this.audioContext.state === 'suspended') {
        this.resumeAudioContext();
      } else if (!this.isSoundOn && this.audioContext.state === 'running') {
        this.audioContext.suspend();
      }
    }

    // Redraw the canvas to reflect the restored state
    this.redraw();
  }

  /**
   * Displays the share overlay with a call to action and sharing options.
   */
  showShareOverlay() {
    // Create overlay background
    const overlay = document.createElement('div');
    overlay.classList.add('share-overlay');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '30';

    // Create content container
    const content = document.createElement('div');
    content.style.backgroundColor = '#ffffff';
    content.style.padding = '20px 30px';
    content.style.borderRadius = '8px';
    content.style.textAlign = 'center';
    content.style.maxWidth = '80%';
    content.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

    // Headline
    const headline = document.createElement('h2');
    headline.textContent = 'Share Your Franzelio Creation!';
    headline.style.marginBottom = '20px';
    headline.style.color = '#333333';
    content.appendChild(headline);

    // Description
    const description = document.createElement('p');
    description.textContent =
      'Share the unique musical instrument you created with others.';
    description.style.marginBottom = '30px';
    description.style.color = '#555555';
    content.appendChild(description);

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexDirection = 'column'; // Stack buttons vertically
    buttonsContainer.style.gap = '20px';

    // Copy URL Button
    const copyButton = document.createElement('button');
    copyButton.textContent = '📋 Copy URL';
    copyButton.style.padding = '10px 20px';
    copyButton.style.fontSize = '16px';
    copyButton.style.cursor = 'pointer';
    copyButton.style.border = 'none';
    copyButton.style.borderRadius = '4px';
    copyButton.style.backgroundColor = '#007aff';
    copyButton.style.color = '#ffffff';
    copyButton.addEventListener('click', () => {
      this.copyToClipboard(getShareableURL(this.getState()));
      alert('Link copied to clipboard!');
      this.container.removeChild(overlay);
    });
    buttonsContainer.appendChild(copyButton);

    // Share via API Button
    const shareAPIButton = document.createElement('button');
    shareAPIButton.textContent = '🔗 Share';
    shareAPIButton.style.padding = '10px 20px';
    shareAPIButton.style.fontSize = '16px';
    shareAPIButton.style.cursor = 'pointer';
    shareAPIButton.style.border = 'none';
    shareAPIButton.style.borderRadius = '4px';
    shareAPIButton.style.backgroundColor = '#34C759';
    shareAPIButton.style.color = '#ffffff';
    shareAPIButton.addEventListener('click', () => {
      const shareableURL = getShareableURL(this.getState());
      if (navigator.share) {
        navigator
          .share({
            title: 'Franzelio - My Musical Instrument',
            text: 'Check out the musical instrument I created!',
            url: shareableURL,
          })
          .then(() => {
            console.log('Shared successfully');
          })
          .catch((error) => {
            console.error('Error sharing:', error);
          });
      } else {
        alert('Share API not supported on this device. Please copy the URL instead.');
      }
      this.container.removeChild(overlay);
    });
    buttonsContainer.appendChild(shareAPIButton);

    content.appendChild(buttonsContainer);
    overlay.appendChild(content);
    this.container.appendChild(overlay);
  }




}

window.onload = () => {
  new Instrument();
};
