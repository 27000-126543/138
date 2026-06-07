import http from 'http';
import app from './app.js';
import { initSocket } from './lib/socket.js';
import { config } from './config/index.js';
import { getDb } from './db/index.js';

const PORT = config.port;

const server = http.createServer(app);

initSocket(server, {
  cors: {
    origin: config.nodeEnv === 'production'
      ? ['https://yourdomain.com']
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const io = initSocket(server);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('task:subscribe', (taskId: string) => {
    socket.join(`task:${taskId}`);
    console.log(`Socket ${socket.id} subscribed to task ${taskId}`);
  });

  socket.on('task:unsubscribe', (taskId: string) => {
    socket.leave(`task:${taskId}`);
    console.log(`Socket ${socket.id} unsubscribed from task ${taskId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

getDb();
console.log('Database initialized');

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
