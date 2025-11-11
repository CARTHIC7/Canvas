<<<<<<< HEAD
# canvas
=======
# Real-Time Collaborative Canvas

This is a multi-user, real-time drawing application built with Node.js, Express, Socket.io, and vanilla HTML5 Canvas. It allows multiple users to draw on the same canvas simultaneously and see each other's actions and cursors in real-time.

This project was built to demonstrate raw JavaScript skills, real-time architecture, and complex state management (like global undo/redo) without the use of frontend frameworks or canvas libraries.



## 📋 Core Features

* **Real-Time Drawing:** Strokes appear on all connected clients instantly.
* **Multi-User Cursors:** See where other users are pointing on the canvas.
* **User List:** See who is currently online, with their assigned color.
* **Drawing Tools:** Brush and Eraser.
* **Tool-Sync:** Adjust color and stroke width.
* **Global Undo/Redo:** A server-authoritative undo/redo stack that works for all users.
* **State Persistence:** New users joining see the complete drawing history, not a blank canvas.

## 🔧 Technical Stack

* **Frontend:** Vanilla JavaScript (ES6+), HTML5 Canvas, CSS3
* **Backend:** Node.js, Express.js
* **Real-Time Layer:** Socket.io

## 🚀 Getting Started

### Prerequisites

* Node.js (v14 or higher)
* npm

### Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone [YOUR_REPO_URL]
    cd collaborative-canvas
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the server:**
    ```bash
    npm start
    ```

4.  **Open the application:**
    Open your browser and navigate to `http://localhost:3000`.

### How to Test (Multiple Users)

To see the real-time collaboration in action, open `http://localhost:3000` in two or more separate browser windows (or tabs).

* Draw in one window and watch it appear in the other.
* Move your mouse in one window and see your cursor move in the other.
* Click "Undo" in one window and watch the last stroke disappear from *all* windows.

## ⚠️ Known Limitations & Future Improvements

* **Resize Redraw:** Resizing the browser clears the canvas and redraws from the server's history. This is efficient but can cause a quick flash.
* **Eraser:** The eraser is implemented using `destination-out`. A more robust implementation might use a separate layer or modify the data model.
* **Conflict Resolution:** The current model is "last-write-wins" for strokes. A true global undo/redo can be undone by someone else's new stroke (as designed). There is no complex merging or CRDT implementation.
* **Scalability:** This solution works well for a small group. For 1000+ users, the "redraw" event would be inefficient. A better approach would be to send "undo" commands referencing stroke IDs or use a different data structure.

## ⏱️ Time Spent

* **Estimated Time:** 3-5 days
* **Actual Time Spent:** [ADD YOUR TIME HERE, e.g., "Approximately 12 hours over 3 days"]
>>>>>>> 8f6da80 (first commit)
