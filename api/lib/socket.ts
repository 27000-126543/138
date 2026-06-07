import type { Server as HttpServer } from 'http'
import { Server, type ServerOptions, type Socket } from 'socket.io'

let io: Server | null = null

export const initSocket = (
  httpServer: HttpServer,
  options?: Partial<ServerOptions>,
): Server => {
  if (io) {
    return io
  }

  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    ...options,
  })

  io.on('connection', (socket: Socket) => {
    console.log('Socket connected:', socket.id)

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id)
    })
  })

  return io
}

export const getSocket = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket first.')
  }
  return io
}
