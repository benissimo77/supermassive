import terser from "@rollup/plugin-terser";
import resolve from '@rollup/plugin-node-resolve';

export default [

    // Host modules
    {
        input: "src/quiz/quiz.js", // replace with path to your main JS file
        output: [
            {
                file: "host/quiz.min.js", // replace with desired output file path
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [terser(), resolve()]
    },
    {
        input: "src/werewolves/werewolves.js", // replace with path to your main JS file
        output: [
            {
                file: "host/werewolves.min.js", // replace with desired output file path
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [terser(), resolve()]
    },
    {
        input: "src/lobby/lobby.js", // replace with path to your main JS file
        output: [
            {
                file: "host/lobby.min.js", // replace with desired output file path
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [terser(), resolve()]
    },

    // Player modules
    {
        input: "src/lobby/play.lobby.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/play.lobby.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [terser(), resolve()]
    },
    {
        input: "src/quiz/play.quiz.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/play.quiz.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [terser(), resolve()]
    },
    {
        input: "src/werewolves/play.werewolves.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/play.werewolves.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [terser(), resolve()]
    }


];
