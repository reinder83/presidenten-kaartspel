import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { Room } from './room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve the built client (populated in the Docker image / production build).
const clientDir = path.resolve(__dirname, '../public');
app.use(express.static(clientDir));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const rooms = new Map<string, Room>();

function newRoomCode(): string {
  let code: string;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

function cleanName(name: unknown): string {
  return String(name ?? '').trim().slice(0, 20) || 'Speler';
}

io.on('connection', (socket: Socket) => {
  let room: Room | null = null;
  let token: string = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
  if (!token) token = randomBytes(16).toString('hex');
  socket.emit('token', token);

  const mySeatIdx = () => (room ? room.seatByToken(token) : -1);

  const fail = (key: string, params?: Record<string, string | number>) =>
    socket.emit('errorMsg', { key, params });

  socket.on('createRoom', ({ name, bots }: { name: string; bots?: number }) => {
    const code = newRoomCode();
    room = new Room(code, io);
    rooms.set(code, room);
    room.addHuman(cleanName(name), token, socket.id);
    const botCount = Math.min(Math.max(Number(bots) || 0, 0), 5);
    for (let i = 0; i < botCount; i++) room.addBot();
    socket.join(code);
    room.broadcast();
  });

  socket.on('joinRoom', ({ code, name }: { code: string; name: string }) => {
    const target = rooms.get(String(code));
    if (!target) {
      socket.emit('roomGone');
      return fail('errRoomNotFound');
    }
    room = target;
    const existing = room.seatByToken(token);
    if (existing >= 0) {
      // Reconnect to an existing seat.
      room.seats[existing].socketId = socket.id;
      if (room.game) room.notice('noticeReturned', { name: room.seats[existing].name });
    } else {
      if (room.game) return fail('errGameStarted');
      if (room.seats.length >= 6) return fail('errRoomFull');
      room.addHuman(cleanName(name), token, socket.id);
    }
    socket.join(room.code);
    room.broadcast();
    room.scheduleBots();
  });

  socket.on('addBot', () => {
    if (!room || room.game) return;
    if (room.hostToken !== token) return fail('errHostOnly');
    if (!room.addBot()) return fail('errRoomFull');
    room.broadcast();
  });

  socket.on('removeBot', () => {
    if (!room || room.game) return;
    if (room.hostToken !== token) return fail('errHostOnly');
    for (let i = room.seats.length - 1; i >= 0; i--) {
      if (room.seats[i].isBot) {
        room.removeSeat(i);
        break;
      }
    }
    room.broadcast();
  });

  socket.on('startGame', () => {
    if (!room) return;
    if (room.hostToken !== token) return fail('errHostOnly');
    if (room.game) return;
    const err = room.startGame();
    if (err) fail(err);
  });

  socket.on('playCards', ({ cards }: { cards: string[] }) => {
    if (!room?.game) return;
    const idx = mySeatIdx();
    if (idx < 0) return;
    const result = room.game.play(idx, Array.isArray(cards) ? cards.map(String) : []);
    if (!result.ok) return fail(result.error!, result.params);
    room.broadcast();
    room.scheduleBots();
  });

  socket.on('pass', () => {
    if (!room?.game) return;
    const idx = mySeatIdx();
    if (idx < 0) return;
    const result = room.game.pass(idx);
    if (!result.ok) return fail(result.error!, result.params);
    room.broadcast();
    room.scheduleBots();
  });

  socket.on('returnCards', ({ cards }: { cards: string[] }) => {
    if (!room?.game) return;
    const idx = mySeatIdx();
    if (idx < 0) return;
    const result = room.game.returnCards(idx, Array.isArray(cards) ? cards.map(String) : []);
    if (!result.ok) return fail(result.error!, result.params);
    room.broadcast();
    room.scheduleBots();
  });

  socket.on('nextRound', () => {
    if (!room?.game) return;
    if (mySeatIdx() < 0) return;
    room.nextRound();
  });

  socket.on('leaveRoom', () => {
    if (!room) return;
    const idx = mySeatIdx();
    if (idx >= 0) {
      if (room.game) {
        room.seats[idx].socketId = null; // keep the seat; a bot plays on
        room.notice('noticeLeft', { name: room.seats[idx].name });
      } else {
        room.removeSeat(idx);
      }
    }
    socket.leave(room.code);
    const r = room;
    room = null;
    if (r.isEmpty) {
      // Drop the room after a grace period so leavers can rejoin via the code.
      setTimeout(() => {
        if (r.isEmpty) rooms.delete(r.code);
      }, 5 * 60 * 1000);
    }
    r.broadcast();
    r.scheduleBots();
  });

  socket.on('disconnect', () => {
    if (!room) return;
    const idx = mySeatIdx();
    if (idx >= 0) {
      room.seats[idx].socketId = null;
      if (!room.game) {
        room.removeSeat(idx);
      } else {
        room.notice('noticeDisconnected', { name: room.seats[idx].name });
      }
    }
    if (room.isEmpty) {
      // Drop fully abandoned rooms after a grace period for reconnects.
      const r = room;
      setTimeout(() => {
        if (r.isEmpty) rooms.delete(r.code);
      }, 5 * 60 * 1000);
    }
    room.broadcast();
    room.scheduleBots();
  });
});

// SPA fallback for any non-API route.
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'), (err) => {
    if (err) res.status(200).send('Presidenten server draait. Client-build ontbreekt (npm run build in client/).');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Presidenten server luistert op http://localhost:${PORT}`);
});
