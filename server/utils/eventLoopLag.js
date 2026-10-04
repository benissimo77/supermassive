import eventLoopLag from 'event-loop-lag';

// Single, server-wide event loop lag monitor - there's only one event loop for the whole
// process, so this must be a singleton shared across every room, not created per-room.
// Sampled internally every 1s; call getEventLoopLag() to read the current value in ms.
const lag = eventLoopLag(1000);

export function getEventLoopLag() {
    return lag();
}
