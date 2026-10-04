import GameSession from '../models/mongo.gameSession.js';

const telemetryController = {
    /**
     * Single endpoint returning everything the telemetry dashboard needs in one request -
     * the session list plus every client's latency/disconnects/staleResponses/device data,
     * flattened out of the per-session telemetry.clients map and tagged with common filterable
     * dimensions (sessionId, gameType, OS, browser, transport) so the frontend can slice the
     * whole dataset without any further requests. Data volume is small (see plan notes), so
     * this is deliberately a plain loop over lean() documents, not a MongoDB aggregation
     * pipeline - telemetry.clients is Mixed-typed and keyed by dynamic session IDs, which is
     * awkward for $objectToArray/$unwind compared to Object.values() in Node.
     */
    async getAllTelemetry(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 200;

            const rawSessions = await GameSession.find({ 'telemetry.clients': { $exists: true } })
                .select('gameType roomCode startTime duration telemetry')
                .sort({ startTime: -1 })
                .limit(limit)
                .lean();

            const sessions = [];
            const clients = [];
            const latencySamples = [];
            const disconnects = [];
            const staleResponses = [];
            const devices = [];
            const eventLoopLag = [];

            for (const session of rawSessions) {
                const sessionId = String(session._id);

                // Server-wide, not per-client - one row per ping tick for this session.
                (session.telemetry?.eventLoopLag || []).forEach((l) => eventLoopLag.push({
                    sessionId,
                    startTime: session.startTime,
                    gameType: session.gameType,
                    timestamp: l.timestamp,
                    lag: l.lag
                }));
                // telemetry.clients is keyed by the CLIENT's own session ID (a browser/guest
                // session identity) - distinct from `sessionId` above, which is this GameSession
                // document's _id. Called `clientId` throughout the payload to keep the two apart.
                const sessionClients = (session.telemetry && session.telemetry.clients) || {};
                const clientEntries = Object.entries(sessionClients);

                sessions.push({
                    sessionId,
                    gameType: session.gameType,
                    roomCode: session.roomCode,
                    startTime: session.startTime,
                    duration: session.duration,
                    totalPlayers: session.telemetry?.totalPlayers ?? clientEntries.filter(([, c]) => !c.host).length,
                    totalHosts: session.telemetry?.totalHosts ?? clientEntries.filter(([, c]) => c.host).length
                });

                clientEntries.forEach(([clientId, client]) => {
                    // Dimensions shared by every record derived from this client, so a single
                    // applyFilters() on the frontend can filter any of these arrays consistently,
                    // and clientId lets per-client views (badges, grouped charts) pick them apart.
                    const common = {
                        sessionId,
                        clientId,
                        name: client.name,
                        startTime: session.startTime,
                        gameType: session.gameType,
                        transport: client.transport,
                        host: !!client.host,
                        OS: client.device?.OS,
                        browser: client.device?.browser
                    };

                    // One row per client regardless of whether they have any latency/disconnect/
                    // etc. data - this is the authoritative list badges and the client threshold
                    // guard-rail are built from.
                    clients.push({ ...common });

                    (client.latency || []).forEach((l) => latencySamples.push({
                        ...common,
                        timestamp: l.timestamp,
                        latency: l.latency
                    }));

                    (client.disconnects || []).forEach((d) => disconnects.push({
                        ...common,
                        timestamp: d.timestamp,
                        reason: d.reason
                    }));

                    (client.staleResponses || []).forEach((s) => staleResponses.push({
                        ...common,
                        timestamp: s.timestamp,
                        receivedQuestionNumber: s.receivedQuestionNumber,
                        currentQuestionNumber: s.currentQuestionNumber,
                        gap: (s.currentQuestionNumber ?? 0) - (s.receivedQuestionNumber ?? 0),
                        answer: s.answer
                    }));

                    if (client.device) {
                        devices.push({
                            ...common,
                            viewportWidth: client.device.viewportWidth,
                            viewportHeight: client.device.viewportHeight
                        });
                    }
                });
            }

            res.status(200).json({ sessions, clients, latencySamples, disconnects, staleResponses, devices, eventLoopLag });
        } catch (err) {
            console.error('Telemetry error:', err);
            res.status(500).json({ error: 'Failed to retrieve telemetry' });
        }
    }
};

export default telemetryController;
