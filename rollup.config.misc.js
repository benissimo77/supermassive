import terser from "@rollup/plugin-terser";
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const isProduction = process.env.NODE_ENV === 'production';

export default [

    // Host modules
    // {
    //     input: "src/quiz/quiz.js", // replace with path to your main JS file
    //     output: [
    //         {
    //             file: "host/quiz/quiz.min.js", // replace with desired output file path
    //             format: "iife",
    //             sourcemap: true,
    //             globals: {
    //                 io: 'io'
    //             }
    //         }
    //     ],
    //     plugins: [
    //         replace({
    //             'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    //             preventAssignment: true,
    //         }),
    //         resolve(),
    //         isProduction && terser()
    //     ]
    // },
    // {
    //     input: "src/werewolves/werewolves.js", // replace with path to your main JS file
    //     output: [
    //         {
    //             file: "host/werewolves/werewolves.min.js", // replace with desired output file path
    //             format: "iife",
    //             sourcemap: true,
    //             globals: {
    //                 io: 'io'
    //             }
    //         }
    //     ],
    //     plugins: [terser(), resolve()]
    // },
    // {
    //     input: "src/lobby/gsap.lobby.js", // replace with path to your main JS file
    //     output: [
    //         {
    //             file: "host/lobby/gsap.lobby.min.js", // replace with desired output file path
    //             format: "iife",
    //             sourcemap: true,
    //             globals: {
    //                 io: 'io'
    //             }
    //         }
    //     ],
    //     plugins: [terser(), resolve()]
    // },

    {
        input: "src/host/dashboard-quiz.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/dashboard-quiz.min.js", // replace with desired output file path
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
        input: "src/host/dashboard-quizedit.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/dashboard-quizedit.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }
        ],
        plugins: [terser(), resolve()]
    },

    // LOGIN screen
    {
        input: "src/scripts/login.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/login.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
            }
        ],
        plugins: [terser(), resolve()]
    },

    // Home page LANDING screen
    {
        input: "src/scripts/landing.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/landing.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
            }
        ],
        plugins: [terser(), resolve()]    },

    // PLAY entry screen
    {
        input: "src/scripts/play-entry.js",
        output: [
            {
                file: "public/modules/play-entry.min.js",
                format: "esm",
                sourcemap: true,
            }
        ],
        plugins: [terser(), resolve()]    },
];
