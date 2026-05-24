let ioInstance = null;

module.exports = {
  init: (io) => {
    ioInstance = io;
    console.log('[Socket Service] Initialized global Socket.IO instance helper.');
  },
  getIO: () => ioInstance,
  emitToGuild: (guildId, eventName, data) => {
    if (ioInstance && guildId) {
      ioInstance.to(guildId).emit(eventName, data);
      console.log(`[Socket Service] Broadcasted event '${eventName}' to guild ${guildId}`);
    }
  }
};
