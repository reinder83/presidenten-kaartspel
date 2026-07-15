import { io, Socket } from 'socket.io-client';

const token = localStorage.getItem('presidenten-token') ?? '';

export const socket: Socket = io({
  auth: { token },
});

socket.on('token', (t: string) => {
  localStorage.setItem('presidenten-token', t);
});
