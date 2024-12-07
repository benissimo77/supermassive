import terser from "@rollup/plugin-terser";
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

const isProduction = process.env.NODE_ENV === 'production';

export default [

    // Host modules
    {
        input: "src/quiz/quiz.js", // replace with path to your main JS file
        output: [
            {
                file: "host/quiz/quiz.min.js", // replace with desired output file path
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }        
        ],
        plugins: [
            replace({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
                preventAssignment: true,
              }),
            resolve(),
            isProduction && terser()
        ]
    },
    {
        input: "src/werewolves/werewolves.js", // replace with path to your main JS file
        output: [
            {
                file: "host/werewolves/werewolves.min.js", // replace with desired output file path
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
                file: "host/lobby/lobby.min.js", // replace with desired output file path
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
        input: "src/quiz/quizbuilder.js", // replace with path to your main JS file
        output: [
            {
                file: "host/dashboard/quizbuilder.min.js", // replace with desired output file path
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
        input: "src/login.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/login.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
            }        
        ],
        plugins: [terser(), resolve()]
    },

    {
        input: "src/scripts/landing.js", // replace with path to your main JS file
        output: [
            {
                file: "public/landing.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
            }        
        ],
        plugins: [terser(), resolve()]
    },
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
    },
    {
        input: "src/play.common.js",
        output: [
            {
                file: "public/play.common.min.js", // replace with desired output file path
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
