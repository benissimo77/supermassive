/**
 * GhostSocket mimics the interface of a Socket.io socket.
 * It allows the server to "connect" bots to a room without a real WebSocket.
 */
export class GhostSocket {
    constructor(id) {
        this.id = id;
        this.handlers = {};
        this.rooms = new Set();
        this.isGhost = true;
    }

    // Mimic socket.join()
    join(roomID) {
        this.rooms.add(roomID);
        // console.log(`GhostSocket ${this.id} joined room ${roomID}`);
    }

    // Mimic socket.on()
    on(event, handler) {
        this.handlers[event] = handler;
    }

    // Mimic socket.emit()
    // When the server emits to a ghost, we might want to react to it
    emit(event, data, callback) {
        // console.log(`GhostSocket ${this.id} received event: ${event}`);
        
        // If the GhostManager is listening for this event, it will handle it
        if (this.onEmit) {
            this.onEmit(event, data, callback);
        }
    }

    // Helper to simulate an event coming FROM the ghost (client -> server)
    receive(event, data) {
        if (this.handlers[event]) {
            this.handlers[event](data);
        }
    }

    disconnect(close) {
        // console.log(`GhostSocket ${this.id} disconnected`);
        if (this.handlers['disconnect']) {
            this.handlers['disconnect']('io server disconnect');
        }
    }
}
