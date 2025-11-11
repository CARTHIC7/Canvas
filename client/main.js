// client/main.js

window.addEventListener('load', () => {
    // --- 1. Connect & Get DOM Elements ---
    const socket = io();
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    
    const toolbar = document.querySelector('.toolbar');
    const userListUI = document.getElementById('users');
    const cursorsContainer = document.getElementById('cursors-container');
    const colorPicker = document.getElementById('color');
    const strokeWidthPicker = document.getElementById('strokeWidth');
    const eraserBtn = document.getElementById('eraser');
    const brushBtn = document.getElementById('brush');
    const undoBtn = document.getElementById('undo'); // NEW
    const redoBtn = document.getElementById('redo'); // NEW
    const toolButtons = document.querySelectorAll('.tool-btn'); // <-- ADD THIS

    // --- 2. State Variables ---
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'brush';
    
    let users = {}; 
    let cursors = {};
    let localDrawingHistory = []; // NEW: Client's copy of history

    // NEW: Helper function to manage active state
    function setActiveTool(selectedButton) {
        // Remove 'active-tool' from all tool buttons
        toolButtons.forEach(btn => {
            btn.classList.remove('active-tool');
        });

        // Add 'active-tool' to the one that was clicked
        selectedButton.classList.add('active-tool');
}
    
    // --- 3. Canvas & Cursors Sizing ---
    function resizeCanvas() {
        // Save state? No, server will give it back
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - toolbar.offsetHeight;
        
        cursorsContainer.style.width = `${canvas.width}px`;
        cursorsContainer.style.height = `${canvas.height}px`;
        cursorsContainer.style.top = `${canvas.offsetTop}px`;
        cursorsContainer.style.left = `${canvas.offsetLeft}px`;
        
        // NEW: Redraw everything on resize
        redrawCanvas(localDrawingHistory);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Call on load

    // --- 4. Core Drawing Function (REFACTORED) ---
    // This single function now handles all drawing
    function drawSegment(segment, strokeProps) {
        ctx.beginPath();
        ctx.moveTo(segment.startX, segment.startY);
        ctx.lineTo(segment.endX, segment.endY);

        if (strokeProps.tool === 'brush') {
            ctx.strokeStyle = strokeProps.color;
            ctx.lineWidth = strokeProps.width;
            ctx.lineCap = 'round';
            ctx.globalCompositeOperation = 'source-over';
        } else if (strokeProps.tool === 'eraser') {
            ctx.strokeStyle = '#FFFFFF'; // Background color
            ctx.lineWidth = strokeProps.width * 2;
            ctx.lineCap = 'round';
            ctx.globalCompositeOperation = 'destination-out';
        }
        
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; // Reset
    }

    // --- 5. NEW: Canvas Redraw Function ---
    // This function clears and redraws the *entire* canvas from history
    function redrawCanvas(history) {
        localDrawingHistory = history; // Update our local copy
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        
        history.forEach(stroke => {
            stroke.segments.forEach(segment => {
                drawSegment(segment, stroke);
            });
        });
    }

    // --- 6. Event Listeners (REFACTORED) ---
    
    // Tool selection
    eraserBtn.addEventListener('click', () => {
    currentTool = 'eraser';
    setActiveTool(eraserBtn); // <-- UPDATE THIS
});
    brushBtn.addEventListener('click', () => {
    currentTool = 'brush';
    setActiveTool(brushBtn); // <-- UPDATE THIS
});

    // NEW: Undo/Redo buttons
    undoBtn.addEventListener('click', () => socket.emit('undo'));
    redoBtn.addEventListener('click', () => socket.emit('redo'));

    // Mouse drawing events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];

        // NEW: Emit the start of a stroke
        const strokeProps = {
            color: colorPicker.value,
            width: strokeWidthPicker.value,
            tool: currentTool
        };
        socket.emit('startStroke', strokeProps);
    }

    function handleMouseMove(e) {
        // Always emit cursor position
        socket.emit('cursorMove', { x: e.offsetX, y: e.offsetY });

        if (!isDrawing) return;

        const currentX = e.offsetX;
        const currentY = e.offsetY;

        // Create the segment and properties for local drawing
        const segment = {
            startX: lastX,
            startY: lastY,
            endX: currentX,
            endY: currentY
        };
        const strokeProps = {
            color: colorPicker.value,
            width: strokeWidthPicker.value,
            tool: currentTool
        };

        // 1. Draw locally immediately
        drawSegment(segment, strokeProps);
        
        // 2. NEW: Emit just the segment data
        socket.emit('drawSegment', segment);

        [lastX, lastY] = [currentX, currentY];
    }

    function stopDrawing() {
        if (!isDrawing) return; // Prevent multiple 'end' events
        isDrawing = false;
        
        // NEW: Emit the end of the stroke
        socket.emit('endStroke');
        
        ctx.globalCompositeOperation = 'source-over';
    }

    // --- 7. Socket Listeners (REFACTORED) ---

    // A. On initial connection
    socket.on('init', (data) => {
        users = data.allUsers;
        updateUserList();
        
        // Create cursors for all *other* users
        for (const id in users) {
            if (id !== socket.id) createCursor(users[id]);
        }

        // NEW: Redraw the full history
        redrawCanvas(data.currentHistory);
    });

    // B. When a new user joins
    socket.on('userJoined', (user) => {
        users[user.id] = user;
        updateUserList();
        createCursor(user);
    });

    // C. When a user leaves
    socket.on('userLeft', (id) => {
        delete users[id];
        updateUserList();
        removeCursor(id);
    });

    // D. When another user draws (real-time segment)
    socket.on('drawing', (data) => {
        // This is the real-time broadcast
        drawSegment(data.segment, data.strokeProps);
    });

    // E. NEW: When an undo/redo happens
    socket.on('redraw', (history) => {
        redrawCanvas(history);
    });

    // F. When another user moves their cursor
    socket.on('cursorMove', (data) => {
        updateCursor(data);
    });

    // --- 8. DOM Helper Functions (Unchanged) ---
    // (These are the same as in Phase 4)
    
    function updateUserList() {
        userListUI.innerHTML = ''; 
        for (const id in users) {
            const user = users[id];
            const li = document.createElement('li');
            li.id = `user-${user.id}`;
            li.innerHTML = `
                <span class="user-color-box" style="background-color: ${user.color}"></span>
                ${user.id.substring(0, 6)}... ${id === socket.id ? '(You)' : ''}
            `;
            userListUI.appendChild(li);
        }
    }

    function createCursor(user) {
        if (cursors[user.id]) return;
        const cursorEl = document.createElement('div');
        cursorEl.className = 'cursor';
        cursorEl.style.backgroundColor = user.color;
        cursorEl.setAttribute('data-name', user.id.substring(0, 6));
        cursorsContainer.appendChild(cursorEl);
        cursors[user.id] = cursorEl;
    }

    function removeCursor(id) {
        if (cursors[id]) {
            cursors[id].remove();
            delete cursors[id];
        }
    }

    function updateCursor(data) {
        const cursorEl = cursors[data.id];
        if (cursorEl) {
            cursorEl.style.transform = `translate(${data.x}px, ${data.y}px)`;
        }
    }
});