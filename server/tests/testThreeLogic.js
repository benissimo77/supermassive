import ThreeGame from '../games/server.three.js';

// --- MOCKS ---
class MockRoom {
    constructor() {
        this.id = 'test_room';
        this.players = [];
    }
    emitToHosts(event, data) { }
    emitToPlayers(teams, event, data) { }
    registerHostKeypressHandler() { }
    registerClientResponseHandler() { }
    getPlayerBySessionID(sid) { return { sessionID: sid }; }
    getConnectedPlayers() { return this.players; }
}

// --- SCENARIOS ---
const scenarios = [
    {
        name: "TileDirector: Early Game (Fresh Board)",
        description: "Tests the TileDirector logic securely allocating a tile on a clean slate",
        testType: "TILE_DIRECTOR_DECIDE",

        setup: {
            // Pos 0, Player 1 active, battle between p1 and p2, no tiles collected, empty board.
            pos: 0,
            activeSID: 'p1',
            grid: {},
            playerHands: {},
            battleContext: {
                teams: ['p1', 'p2'],
                tiles: []
            }
        },
        expect: {
            directorResultType: 'string' // Expect it to return an icon cleanly
        }
    },
    {
        name: "TileDirector: Tension (Opponent has vulnerable tile)",
        description: "Checks how TileDirector behaves when opponent already claimed tile 10 in this battle",
        testType: "TILE_DIRECTOR_DECIDE",

        setup: {
            pos: 5,
            activeSID: 'p1',
            grid: { 10: 'icon_1' },
            playerHands: { 'p2': [10] },
            battleContext: {
                teams: ['p1', 'p2'],
                tiles: [10]
            }
        },
        expect: {
            directorResultType: 'string'
        }
    },
    {
        name: "TileDirector: Joker Generate (Nobody has tiles)",
        description: "Checks how TileDirector assigns Joker when nobody has tiles (steal should be stripped out) ",
        testType: "TILE_DIRECTOR_JOKER",

        setup: {
            activeSID: 'p1',
            grid: {},
            playerHands: {},
            battleContext: {
                teams: ['p1', 'p2'],
                tiles: []
            }
        },
        expect: {
            directorResultType: 'string'
        }
    },
    {
        name: "Collect then Steal of a Vaulted Tile",
        description: "Team A has tile 0 vaulted in their hand. Team B collects it as a new tile. Team A steals it - steal successful but Team A does NOT gain the tile",
        testType: "TURN_EVALUATE",

        setup: {
            grid: { 0: 'icon_1', 1: 'icon_2' }, // partial hardcoded grid
            playerHands: {
                'Team_A': [0, 1],   // Team A got tile 0 via Joker earlier. It is vaulted.
                'Team_B': [],
                'Team_C': []
            },
            battleContext: {
                teams: ['Team_B', 'Team_A'],
                tiles: [1],         // Tile 1 is vulnerable. Tile 0 is NOT (it's vaulted).
                activeTurn: {
                    scores: {},
                    selections: {
                        'Team_B': { tiles: [0] },  // B successfully collects tile 0
                        'Team_A': { tiles: [0] } // A steals but already owns
                    }
                }
            }
        },

        expect: {
            playerHands: {
                'Team_A': [0, 1], // A still has 0, 1. No duplicates.
                'Team_B': [],     // B gets nothing.
                'Team_C': []
            },
            battleContext: {
                // We don't even need to test tiles array here if we don't care about it!
                activeTurn: {
                    reveals: [
                        { playerSID: 'Team_B', pos: 0, result: 'collect' },
                        { playerSID: 'Team_A', pos: 0, result: 'steal' }
                        // Notice we omitted icon: 'icon_1', etc! The partial match ignores what we omitted!
                    ]
                }
            }
        }
    },
    {
        name: "Successful Joker steal from a player NOT in the battle",
        description: "Team A and Team B are battling. Team A gets a joker steal, steals a tile from Team C. Team C should lose it, Team A should gain it, it should remain vaulted",
        testType: "JOKER_EVALUATE",

        setup: {
            grid: { 0: 'icon_1', 1: 'icon_2' }, // partial hardcoded grid
            playerHands: {
                'Team_A': [],   // Team A got tile 0 via Joker earlier. It is vaulted.
                'Team_B': [],
                'Team_C': [0]
            },
            battleContext: {
                teams: ['Team_B', 'Team_A'],
                tiles: [1],         // Tile 1 is vulnerable. Tile 0 is NOT (it's vaulted).
                activeTurn: {
                    joker: {
                        jokerType: 'steal',
                        playerSID: 'Team_A',
                        response: {
                            answer: {
                                teams: ['Team_C'],
                                tiles: [0]
                            }
                        }
                    }

                }
            }
        },

        expect: {
            playerHands: {
                'Team_A': [0], // A still has 0, 1. No duplicates.
                'Team_C': [],     // C gets nothing.
            },
            battleContext: {
                // We don't even need to test tiles array here if we don't care about it!
                // Although for this test we do...
                tiles: [1],
                activeTurn: {
                    joker: {
                        playerSID: 'Team_A',
                        result: 'steal',
                        fromSID: 'Team_C',
                        pos: 0,
                        tileType: 'icon_1',
                        newTileCount: 1
                    }
                }
            }
        }
    },
    {
        name: "Unsuccessful Joker steal from a player NOT in the battle",
        description: "Team A and Team B are battling. Team A gets a joker steal, attempts to steal a tile from Team C, but the steal fails. Team C should retain the tile, Team A should not gain it. Team C's tile should remain vaulted.",
        testType: "JOKER_EVALUATE",

        setup: {
            grid: { 0: 'icon_1', 1: 'icon_2' }, // partial hardcoded grid
            playerHands: {
                'Team_A': [],   // Team A got tile 0 via Joker earlier. It is vaulted.
                'Team_B': [],
                'Team_C': [0]
            },
            battleContext: {
                teams: ['Team_A', 'Team_B'],
                tiles: [1],         // Tile 1 is vulnerable. Tile 0 is NOT (it's vaulted).
                activeTurn: {
                    joker: {
                        jokerType: 'steal',
                        playerSID: 'Team_A',
                        response: {
                            answer: {
                                teams: ['Team_C'],
                                tiles: [1]
                            }
                        }
                    }

                }
            }
        },

        expect: {
            playerHands: {
                // Team A steal fails, gets nothing. Team C retains tile 0
                'Team_A': [],
                'Team_C': [0],
            },
            battleContext: {
                // We don't even need to test tiles array here if we don't care about it!
                // Although for this test we do...
                tiles: [1],
                activeTurn: {
                    joker: {
                        playerSID: 'Team_A',
                        result: 'no-op',
                        fromSID: 'Team_C',
                        pos: 1,
                        tileType: 'icon_2',
                        newTileCount: 0
                    }
                }
            }
        }
    },
    {
        name: "Unsuccessful Joker steal from a player IN the battle",
        description: "Team A and Team B are battling. Team A gets a joker steal, attempts to steal a tile from Team B, but the steal fails. Team B should not change, Team A should gain nothing. Tiles don't change",
        testType: "JOKER_EVALUATE",

        setup: {
            grid: { 0: 'icon_1', 1: 'icon_2', 2: 'icon_3' }, // partial hardcoded grid
            playerHands: {
                'Team_A': [],
                'Team_B': [0, 1],
                'Team_C': [0]
            },
            battleContext: {
                teams: ['Team_A', 'Team_B'],
                tiles: [0, 1],
                activeTurn: {
                    joker: {
                        jokerType: 'steal',
                        playerSID: 'Team_A',
                        response: {
                            answer: {
                                teams: ['Team_B'],
                                tiles: [2]
                            }
                        }
                    }

                }
            }
        },

        expect: {
            playerHands: {
                // Team A steal fails, gets nothing. Team B retains tiles 0 and 1
                'Team_A': [],
                'Team_B': [0, 1],
            },
            battleContext: {
                // We don't even need to test tiles array here if we don't care about it!
                // Although for this test we do...
                tiles: [0, 1],
                activeTurn: {
                    joker: {
                        playerSID: 'Team_A',
                        result: 'no-op',
                        fromSID: 'Team_B',
                        pos: 2,
                        tileType: 'icon_3',
                        newTileCount: 0
                    }
                }
            }
        }
    },

    {
        name: "Unsuccessful Joker steal from a player IN the battle",
        description: "Team A and Team B are battling. Team A gets a joker steal, attempts to steal a tile from Team B, but the steal fails. Team B should not change, Team A should gain nothing. Tiles don't change",
        testType: "JOKER_EVALUATE",

        setup: {
            grid: { 0: 'icon_1', 1: 'icon_2', 2: 'icon_3' }, // partial hardcoded grid
            playerHands: {
                'Team_A': [],
                'Team_B': [0, 1],
                'Team_C': [0]
            },
            battleContext: {
                teams: ['Team_A', 'Team_B'],
                tiles: [0, 1],
                activeTurn: {
                    joker: {
                        jokerType: 'steal',
                        playerSID: 'Team_A',
                        response: {
                            answer: {
                                teams: ['Team_B'],
                                tiles: [2]
                            }
                        }
                    }

                }
            }
        },

        expect: {
            playerHands: {
                // Team A steal fails, gets nothing. Team B retains tiles 0 and 1
                'Team_A': [],
                'Team_B': [0, 1],
            },
            battleContext: {
                // We don't even need to test tiles array here if we don't care about it!
                // Although for this test we do...
                tiles: [0, 1],
                activeTurn: {
                    joker: {
                        playerSID: 'Team_A',
                        result: 'no-op',
                        fromSID: 'Team_B',
                        pos: 2,
                        tileType: 'icon_3',
                        newTileCount: 0
                    }
                }
            }
        }
    }

];

// --- TEST RUNNER ---
console.log("🚀 Running ThreeGame Logic Tests...\n");
let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
    // 1. Initialize Game & Mock overrides
    const room = new MockRoom();
    const game = new ThreeGame(room);

    // Mock the director so grid defaults aren't randomized 
    const originalDecide = game.director.decideTileAt.bind(game.director);
    game.director.decideTileAt = (pos, context) => {
        if (scenario.setup.grid && scenario.setup.grid[pos]) {
            return scenario.setup.grid[pos];
        }
        return originalDecide(pos, context);
    };

    // 2. Hydrate Game State
    if (scenario.setup.grid) {
        for (const [pos, icon] of Object.entries(scenario.setup.grid)) {
            game.grid[pos] = icon;
        }
    }

    if (scenario.setup.playerHands) {
        for (const [sid, arr] of Object.entries(scenario.setup.playerHands)) {
            game.playerHands.set(sid, new Set(arr));
            room.players.push({ sessionID: sid });
        }
    }

    if (scenario.setup.battleContext) {
        game.battleContext = {
            teams: scenario.setup.battleContext.teams || [],
            tiles: new Set(scenario.setup.battleContext.tiles || []),
            activeTurn: scenario.setup.battleContext.activeTurn || { scores: {}, selections: {}, reveals: [] },
            turns: scenario.setup.battleContext.turns || []
        };
    }

    // --- HIJACK CONSOLE.LOG ---
    // We store the real console.log and capture all outputs for this specific run.
    const originalLog = console.log;
    const originalDir = console.dir;
    const capturedLogs = [];

    console.log = (...args) => {
        // Just format it simply for the cache.
        capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
    };
    console.dir = (obj, options) => {
        capturedLogs.push(JSON.stringify(obj, null, 2));
    };

    let scenarioPassed = true;
    const errors = [];

    // 3. Execute the function under test
    let directorResult = null;
    try {
        if (scenario.testType === 'TURN_EVALUATE') {
            game.doTurnEvaluate();
        } else if (scenario.testType === 'JOKER_EVALUATE') {
            game.doJokerEvaluate();
        } else if (scenario.testType === 'TILE_DIRECTOR_DECIDE') {
            directorResult = game.director.decideTileAt(scenario.setup.pos, {
                grid: game.grid,
                playerHands: game.playerHands,
                battleIndices: game.battleContext.tiles,
                activeSID: scenario.setup.activeSID,
                battleTeams: game.battleContext.teams
            });
            // We just want to log what it returned so we can see it in testing mode
            console.log(`[TILE_DIRECTOR_DECIDE OUTPUT]: Generated icon '${directorResult}'`);
            console.log(`[TILE_DIRECTOR_DECIDE FINAL WEIGHTS]:`, game.director.lastWeights);
        } else if (scenario.testType === 'TILE_DIRECTOR_JOKER') {
            directorResult = game.director.selectJokerType(scenario.setup.activeSID, {
                grid: game.grid,
                playerHands: game.playerHands,
                battleIndices: game.battleContext.tiles,
                activeSID: scenario.setup.activeSID,
                battleTeams: game.battleContext.teams
            });
            console.log(`[TILE_DIRECTOR_JOKER OUTPUT]: Generated joker '${directorResult}'`);
            console.log(`[TILE_DIRECTOR_JOKER FINAL WEIGHTS]:`, game.director.lastWeights);
        } else {
            throw new Error(`Unknown testType: ${scenario.testType}`);
        }
    } catch (e) {
        capturedLogs.push(`CRITICAL EXECUTION ERROR: ${e.message}`);
        scenarioPassed = false;
        errors.push(`Exception: ${e.message}`);
    }

    // --- RESTORE CONSOLE.LOG ---
    console.log = originalLog;
    console.dir = originalDir;

    // 4. Assert Outcomes (Intercepting errors to print them beautifully)

    // Custom deep partial match! If 'expected' is undefined, we skip checking it.
    // We only traverse the keys defined in the 'expected' object.
    const isPartialMatch = (actual, expected) => {
        // Primitive checks or exact array match required at leaf
        if (typeof expected !== 'object' || expected === null || expected === undefined) {
            return actual === expected;
        }

        if (Array.isArray(expected)) {
            if (!Array.isArray(actual) || actual.length !== expected.length) return false;
            for (let i = 0; i < expected.length; i++) {
                if (!isPartialMatch(actual[i], expected[i])) return false;
            }
            return true;
        }

        // If it's an object, check every key the EXPECTED object specifies.
        for (const key of Object.keys(expected)) {
            if (actual === undefined || actual === null) return false;
            if (!isPartialMatch(actual[key], expected[key])) return false;
        }
        return true;
    }

    const checkPartialEqual = (actual, expected, label) => {
        if (!isPartialMatch(actual, expected)) {
            scenarioPassed = false;

            // Format fallback so we don't crash if actual or expected is exactly undefined
            const stringifySafe = (val) => {
                if (val === undefined) return 'undefined';
                if (val === null) return 'null';
                return JSON.stringify(val, null, 2).replace(/\n/g, '\n  ');
            };

            errors.push(`\n  👉 [${label} mismatch]`);
            errors.push(`  Expected to contain: ${stringifySafe(expected)}`);
            errors.push(`  Actual context:      ${stringifySafe(actual)}`);
        }
    };

    if (scenario.expect) {
        if (scenario.expect.playerHands) {
            const actualHands = {};
            for (const [sid, handSet] of game.playerHands.entries()) {
                actualHands[sid] = Array.from(handSet);
            }
            checkPartialEqual(actualHands, scenario.expect.playerHands, 'playerHands');
        }

        if (scenario.expect.battleContext) {
            const actualContext = game.battleContext;
            if (scenario.expect.battleContext.tiles) { // User only needs to specify if they care about it
                checkPartialEqual(Array.from(actualContext.tiles), scenario.expect.battleContext.tiles, 'battleContext.tiles (vulnerable tiles)');
            }
            if (scenario.expect.battleContext.activeTurn) {
                if (scenario.testType === 'TURN_EVALUATE' && scenario.expect.battleContext.activeTurn.reveals) {
                    checkPartialEqual(actualContext.activeTurn.reveals, scenario.expect.battleContext.activeTurn.reveals, 'battleContext.activeTurn.reveals');
                } else if (scenario.testType === 'JOKER_EVALUATE' && scenario.expect.battleContext.activeTurn.joker) {
                    checkPartialEqual(actualContext.activeTurn.joker, scenario.expect.battleContext.activeTurn.joker, 'battleContext.activeTurn.joker');
                }
            }
        }

        if (scenario.expect.directorResultType) {
            const actualType = typeof directorResult;
            if (actualType !== scenario.expect.directorResultType || directorResult === null) {
                scenarioPassed = false;
                errors.push(`\n  👉 [Director Result Type mismatch]`);
                errors.push(`  Expected: ${scenario.expect.directorResultType}`);
                errors.push(`  Actual context: ${directorResult === null ? 'null' : actualType}`);
            }
        }
    }

    if (scenarioPassed) {
        if (scenario.testType === 'TILE_DIRECTOR_DECIDE' || scenario.testType === 'TILE_DIRECTOR_JOKER') {
            console.groupCollapsed(`✅ PASS: ${scenario.name} | Weights: ${JSON.stringify(game.director.lastWeights)}`);
        } else {
            console.groupCollapsed(`✅ PASS: ${scenario.name}`);
        }
        // Because of groupCollapsed, this only shows if the dev expands it (in supported tools)
        // In standard terminal it prints indented.
        console.groupEnd();
        passed++;
    } else {
        console.log(`\n❌ FAIL: ${scenario.name}`);
        console.log(`\n  --- Engine Logs during execution ---`);
        capturedLogs.forEach(log => console.log(`  | ${log}`));
        console.log(`  ------------------------------------\n`);

        console.log(errors.join('\n'));
        console.log('\n========================================\n');
        failed++;
    }
}

console.log(`🏁 Tests completed: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
