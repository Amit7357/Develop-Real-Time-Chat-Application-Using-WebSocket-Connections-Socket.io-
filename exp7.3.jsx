
{
  "name": "realtime-chat-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // for dev. Put your domain(s) in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // join shared room if you want future room features
  socket.join('main-room');

  // notify others that a user connected (optional)
  socket.on('join', (username) => {
    socket.data.username = username;
    socket.to('main-room').emit('system', {
      text: `${username} joined the chat`,
      time: new Date().toISOString()
    });
  });

  // receive a chat message from a client
  socket.on('message', (payload) => {
    // payload = { username, text, time }
    // broadcast to everyone in the room including sender
    io.in('main-room').emit('message', payload);
  });

  socket.on('disconnect', (reason) => {
    const username = socket.data.username || 'Someone';
    socket.to('main-room').emit('system', {
      text: `${username} left the chat`,
      time: new Date().toISOString()
    });
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

// basic health check
app.get('/', (req, res) => res.send({ status: 'ok' }));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

{
  "name": "realtime-chat-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0"
  }
}

<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Real-Time Chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(<App />)

import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]); // { type: 'chat'|'system', username?, text, time }
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket'] });
    setSocket(s);

    s.on('connect', () => {
      console.log('connected to server', s.id);
    });

    s.on('message', (payload) => {
      setMessages(prev => [...prev, { type: 'chat', ...payload }]);
    });

    s.on('system', (payload) => {
      setMessages(prev => [...prev, { type: 'system', ...payload }]);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    // auto scroll to bottom when messages update
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  function chooseName(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setNameSet(true);
    socket?.emit('join', username.trim());
  }

  function sendMessage(e) {
    e && e.preventDefault();
    if (!messageText.trim()) return;
    const payload = {
      username: username,
      text: messageText.trim(),
      time: new Date().toISOString()
    };
    socket.emit('message', payload);
    setMessageText('');
  }

  return (
    <div className="page">
      <h1>Real-Time Chat</h1>

      {!nameSet ? (
        <form onSubmit={chooseName} className="nameForm">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name (e.g., Alice)"
            className="nameInput"
          />
          <button type="submit" className="btn">Start</button>
        </form>
      ) : (
        <div className="chatContainer">
          <div className="headerRow">
            <div><strong>{username}</strong></div>
            <div className="status">Status: {socket?.connected ? 'Connected' : 'Disconnected'}</div>
          </div>

          <div className="messages" role="log" aria-live="polite">
            {messages.map((m, idx) => (
              <div key={idx} className={`messageRow ${m.type === 'system' ? 'systemMsg' : ''}`}>
                {m.type === 'system' ? (
                  <em>{m.text} <span className="time">[{formatTime(m.time)}]</span></em>
                ) : (
                  <>
                    <strong>{m.username}</strong> <span className="time">[{formatTime(m.time)}]</span>: {m.text}
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="sendRow">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="msgInput"
            />
            <button type="submit" className="btn">Send</button>
          </form>
        </div>
      )}

      <footer className="footer">
        Open the page in multiple windows to test real-time updates.
      </footer>
    </div>
  );
}

:root {
  --container-w: 740px;
  --accent: #2b6cf6;
  --bg: #fafafa;
}
* { box-sizing: border-box; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
body { margin: 0; background: var(--bg); display: flex; justify-content: center; padding: 24px; }
.page { width: var(--container-w); background: white; border: 2px solid #222; padding: 18px; border-radius: 4px; }
h1 { text-align: center; margin-top: 0; font-family: Georgia, "Times New Roman", serif; }
.nameForm { display:flex; gap:10px; margin-bottom: 12px; }
.nameInput { flex:1; padding: 12px; border:1px solid #ddd; border-radius:6px; }
.btn { background: var(--accent); color:white; border:none; padding:10px 18px; border-radius:6px; cursor:pointer; }
.chatContainer { display:flex; flex-direction:column; gap:12px; }
.headerRow { display:flex; justify-content:space-between; align-items:center; }
.messages { height: 420px; border:1px solid #ddd; padding: 12px; overflow:auto; background:white; border-radius:6px; }
.messageRow { margin-bottom:10px; }
.systemMsg { color: #666; font-style: italic; }
.time { color:#888; margin-left:6px; font-size: 0.9em; }
.sendRow { display:flex; gap:10px; align-items:center; }
.msgInput { flex:1; padding:12px; border:1px solid #ddd; border-radius:6px; }
.footer { margin-top:10px; font-size:0.85em; color:#666; text-align:center; }
