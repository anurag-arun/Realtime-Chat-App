require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database('chat.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    user TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
const findUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const getAllUsers = db.prepare('SELECT id, username FROM users');
const insertMessage = db.prepare('INSERT INTO messages (room, user, text, timestamp) VALUES (?, ?, ?, ?)');
const getRoomHistory = db.prepare('SELECT user, text, room, timestamp FROM messages WHERE room = ? ORDER BY id ASC LIMIT 50');

// Track online socket connections: Map<socketId, username>
const onlineUsers = new Map();

function broadcastOnlineUsers() {
  const usersList = Array.from(new Set(onlineUsers.values()));
  io.emit('users:online', usersList);
}

// REST Endpoints
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const existing = findUserByUsername.get(username.trim());
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const result = insertUser.run(username.trim(), passwordHash);

    const token = jwt.sign({ id: result.lastInsertRowid, username: username.trim() }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: username.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = findUserByUsername.get(username?.trim());
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// Endpoint to list users available for DM
app.get('/api/users', (req, res) => {
  res.json(getAllUsers.all());
});

// Socket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth token missing'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = decoded;
    next();
  });
});

// Real-Time Messaging & Direct Messaging
io.on('connection', (socket) => {
  onlineUsers.set(socket.id, socket.user.username);
  broadcastOnlineUsers();

  let currentRoom = 'general';
  socket.join(currentRoom);

  // Send history for default channel
  socket.emit('chat:history', getRoomHistory.all(currentRoom));

  // Switch Channel or Private DM Room
  socket.on('room:join', (newRoom) => {
    socket.to(currentRoom).emit('typing:stop', { id: socket.id });
    socket.leave(currentRoom);

    currentRoom = newRoom;
    socket.join(currentRoom);

    // Only broadcast join/leave system alerts for public channels
    if (!currentRoom.startsWith('dm:')) {
      socket.to(currentRoom).emit('system:notification', `${socket.user.username} joined #${currentRoom}`);
    }

    const history = getRoomHistory.all(currentRoom);
    socket.emit('chat:history', history);
  });

  socket.on('chat:message', (data) => {
    socket.to(data.room).emit('typing:stop', { id: socket.id });

    const user = socket.user.username;
    const text = data.text;
    const room = data.room;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    insertMessage.run(room, user, text, timestamp);
    io.to(room).emit('chat:message', { user, text, room, timestamp });
  });

  socket.on('typing:start', (data) => {
    socket.to(data.room).emit('typing:start', { id: socket.id, user: socket.user.username });
  });

  socket.on('typing:stop', (data) => {
    socket.to(data.room).emit('typing:stop', { id: socket.id });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    broadcastOnlineUsers();
    socket.to(currentRoom).emit('typing:stop', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});