// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// --- Server-side State ---
const users = {}; 
let drawingHistory = []; // Stores *all* completed strokes
let redoStack = [];      // Stores strokes that have been "undone"

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// --- Handle Socket.io Connections ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Create a new user entry
    users[socket.id] = { id: socket.id, color: getRandomColor() };

    // 2. Send initial data to the new user
    socket.emit('init', {
        self: users[socket.id],
        allUsers: users,
        currentHistory: drawingHistory // <-- SEND THE HISTORY
    });

    // 3. Tell all *other* users that this user has joined
    socket.broadcast.emit('userJoined', users[socket.id]);

    // --- Drawing Event Listeners (NEW) ---

    // 4. Listen for the start of a stroke
    socket.on('startStroke', (strokeProps) => {
        // Store the stroke-in-progress on the socket itself
        socket.currentStroke = { ...strokeProps, segments: [] };
    });

    // 5. Listen for a single segment of the stroke
    socket.on('drawSegment', (segment) => {
        // Broadcast this segment for real-time drawing
        socket.broadcast.emit('drawing', {
            segment: segment,
            strokeProps: socket.currentStroke // Send props like color/width
        });
        
        // Add this segment to the socket's in-progress stroke
        if (socket.currentStroke) {
            socket.currentStroke.segments.push(segment);
        }
    });

    // 6. Listen for the end of a stroke
    socket.on('endStroke', () => {
        if (socket.currentStroke && socket.currentStroke.segments.length > 0) {
            // Add the completed stroke to the global history
            drawingHistory.push(socket.currentStroke);
            
            // Clear the redo stack, as a new action invalidates it
            redoStack = [];
        }
        socket.currentStroke = null; // Clear the in-progress stroke
    });

    // --- Undo/Redo Listeners (NEW) ---

    // 7. Listen for a global undo
    socket.on('undo', () => {
        if (drawingHistory.length > 0) {
            // Move the last stroke from history to redo stack
            const undoneStroke = drawingHistory.pop();
            redoStack.push(undoneStroke);

            // Tell ALL clients to redraw the canvas with the new history
            io.emit('redraw', drawingHistory);
        }
    });

    // 8. Listen for a global redo
    socket.on('redo', () => {
        if (redoStack.length > 0) {
            // Move the last undone stroke back to the history
            const redoneStroke = redoStack.pop();
            drawingHistory.push(redoneStroke);

            // Tell ALL clients to redraw the canvas with the new history
            io.emit('redraw', drawingHistory);
        }
    });


    // --- Other Listeners (Unchanged) ---
    
    // 9. Listen for cursor movement
    socket.on('cursorMove', (data) => {
        socket.broadcast.emit('cursorMove', { id: socket.id, x: data.x, y: data.y });
    });

    // 10. Handle disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        delete users[socket.id];
        // Make sure to clear any in-progress stroke if user disconnects mid-draw
        socket.currentStroke = null; 
        socket.broadcast.emit('userLeft', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});