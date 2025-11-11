# Architecture Documentation

This document details the architecture, data flow, and design decisions for the Real-Time Collaborative Canvas.

## 1. 📊 Data Flow Diagram

The flow of a single drawing action is as follows:

```
[User A: mousedown]
    |
    V
[Client A] -> socket.emit('startStroke', {color, width, tool}) -> [Server]
    |
    |
[User A: mousemove]
    |
    V
[Client A] -> drawSegment() (local)
           -> socket.emit('drawSegment', {startX, ...})       -> [Server] -> socket.broadcast.emit('drawing', {segment, ...}) -> [Client B] -> drawSegment()
                                                                      |                                                       |
                                                                      V                                                       V
                                                               [Server] (stores segment)                                    [Client C] -> drawSegment()
    |
    |
[User A: mouseup]
    |
    V
[Client A] -> socket.emit('endStroke')                          -> [Server] -> (Saves stroke to history)
                                                                      |
                                                                      V
                                                               (Clears redo stack)
```

## 2. 🔌 WebSocket Protocol (Socket.io Events)

We use a "stroke-based" protocol. Instead of sending every single mouse coordinate as a separate event, we batch them into strokes for cleaner history management.

### Client-to-Server (C2S)

* `startStroke (props)`: Fired on `mousedown`. `props` = `{ color, width, tool }`. Tells the server to prepare a new stroke object.
* `drawSegment (segment)`: Fired on `mousemove`. `segment` = `{ startX, startY, endX, endY }`. The server broadcasts this for real-time drawing.
* `endStroke ()`: Fired on `mouseup`. Tells the server to commit the completed stroke to the `drawingHistory`.
* `cursorMove (coords)`: Fired on `mousemove` (always). `coords` = `{ x, y }`.
* `undo ()`: User requests a global undo.
* `redo ()`: User requests a global redo.

### Server-to-Client (S2C)

* `init (data)`: Sent to a single client on connection. `data` = `{ self, allUsers, currentHistory }`. This instantly syncs them with the current canvas.
* `userJoined (user)`: Broadcast when a new user connects.
* `userLeft (id)`: Broadcast when a user disconnects.
* `drawing (data)`: Broadcast to all *other* clients when a `drawSegment` is received. `data` = `{ segment, strokeProps }`. This is the core real-time event.
* `cursorMove (data)`: Broadcast to all *other* clients. `data` = `{ id, x, y }`.
* `redraw (history)`: Broadcast to *all* clients after an undo/redo. The client is responsible for clearing its canvas and redrawing this new history.

## 3. ↩️ Undo/Redo Strategy

This was the most complex requirement. A simple client-side undo is not possible, as it would be out-of-sync with other users.

**The solution is a Server-Authoritative Global History.**

1.  **Source of Truth:** The server maintains two arrays:
    * `drawingHistory = []`: A stack of *complete stroke objects*. A stroke object looks like: `{ color, width, tool, segments: [...] }`.
    * `redoStack = []`: A stack to hold strokes that have been "undone".

2.  **How "Undo" Works:**
    * A client emits `undo`.
    * The server receives it. It **pops** the last stroke from `drawingHistory`.
    * It **pushes** that popped stroke onto the `redoStack`.
    * The server then **broadcasts** the *entire*, *new* `drawingHistory` to **all clients** via the `redraw` event.
    * All clients (including the one who clicked undo) receive this event, clear their canvas, and redraw the new, shorter history.

3.  **How "Redo" Works:**
    * A client emits `redo`.
    * The server receives it. It **pops** the last stroke from `redoStack`.
    * It **pushes** that stroke *back* onto the `drawingHistory`.
    * The server broadcasts the `redraw` event with the (now longer) history.

4.  **Invalidation:** If a user draws a *new* stroke (after an undo), the `redoStack` is **cleared**. This is standard behavior (e.g., in Photoshop or Google Docs).

**Why this approach?**
* It guarantees all clients are **100% consistent** with the server's state.
* It solves the "new user" problem, as they just receive the `drawingHistory` on `init`.
* It solves the "resize" problem, as the client can just request/use the `drawingHistory` to redraw.

## 4. ⚡ Performance & Optimization Decisions

* **Event Batching:** We don't send individual `(x, y)` points. We send *line segments* (`startX, startY, endX, endY`). This is a 50% reduction in event-firing overhead.
* **Stroke vs. Segment:** The real-time event is `drawing` (a segment), which is lightweight. The heavy state-management event is `redraw` (all strokes), which only happens on undo/redo, so it's less frequent.
* **HTML Cursors:** Other users' cursors are **not** drawn on the canvas. They are separate `<div>` elements in an overlay. This avoids a complex "clear and redraw" cycle on the canvas for every mouse movement, which would kill performance.
* **Local Drawing:** When you draw, the line appears instantly because `drawSegment()` is called *locally* first, *then* the event is emitted. This is a form of client-side prediction, making the app feel responsive even with high latency.

## 5. ⚠️ Conflict Resolution

**The short answer: "Last Write Wins."**

This architecture does not use complex CRDTs (Conflict-free Replicated Data Types). It relies on a centralized server as the single source of truth.

* **Simultaneous Drawing:** If two users draw in the same spot, the server just processes the `drawSegment` events as they arrive. The final image is a simple overlay of both. This is acceptable for a drawing app.
* **Undo "Conflict":** The "conflict" is social. User A can undo User B's action. This is a *feature*, not a bug, per the "global undo" requirement. The `redraw` event ensures that everyone's canvas reflects this change, resolving any state conflict.