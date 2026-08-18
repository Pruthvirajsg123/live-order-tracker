let io;

const initializeSocket = (socketServer) => {
  io = socketServer;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized");
  }

  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};
