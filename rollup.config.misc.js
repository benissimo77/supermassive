import terser from "@rollup/plugin-terser";
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const isProduction = process.env.NODE_ENV === 'production';

const terserOptions = {
    compress: {
        drop_console: isProduction
    }
};

export default [

    // Werewolves game
    // {
    //     input: "src/werewolves/werewolves.js",
    //     output: [
    //         {
    //             file: "public/modules/werewolves.min.js",
    //             format: "iife",
    //             sourcemap: true,
    //             globals: {
    //                 io: 'io',
    //                 gsap: 'gsap'
    //             }
    //         }
    //     ],
    //     external: ['io', 'gsap'],
    //     plugins: [terser(), resolve()]
    // },

    {
        input: "websrc/host/dashboard-quiz.js", // replace with path to your main JS file
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
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    {
        input: "websrc/host/dashboard-quizedit-v2.js",
        output: [
            {
                file: "public/modules/dashboard-quizedit-v2.min.js",
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    {
        input: "websrc/host/dashboard.js",
        output: [
            {
                file: "public/modules/dashboard.min.js",
                format: "esm",
                sourcemap: true
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    // SEASONS management screen
        {
        input: "websrc/host/dashboard-seasons.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/dashboard-seasons.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    // SEASON EDITOR
        {
        input: "websrc/host/dashboard-seasonedit.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/dashboard-seasonedit.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    // LEAGUES - management screen
        {
        input: "websrc/host/dashboard-leagues.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/dashboard-leagues.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
                globals: {
                    io: 'io'
                }
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    // LOGIN screen
    {
        input: "websrc/login/login.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/login.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    // Home page LANDING screen
    {
        input: "websrc/landing/landing.js", // replace with path to your main JS file
        output: [
            {
                file: "public/modules/landing.min.js", // replace with desired output file path
                format: "esm",
                sourcemap: true,
            }
        ],
        plugins: [
            terser(terserOptions), 
            resolve()
        ]
    },

    // PLAY entry screen
    {
        input: "websrc/play-entry.js",
        output: [
            {
                file: "public/modules/play-entry.min.js",
                format: "esm",
                sourcemap: true,
            }
        ],
        plugins: [
            terser(), 
            resolve()
        ]
    },

    // // DOM Host (Legacy/Shared)
    // {
    //     input: "src/domhost.js",
    //     output: [
    //         {
    //             file: "public/modules/domhost.min.js",
    //             format: "esm",
    //             sourcemap: true,
    //         }
    //     ],
    //     plugins: [terser(), resolve()]
    // },

    // // DOM Play (Legacy/Shared)
    // {
    //     input: "src/play/domplay.ts",
    //     output: [
    //         {
    //             file: "public/modules/domplay.min.js",
    //             format: "esm",
    //             sourcemap: true,
    //         }
    //     ],
    //     plugins: [
    //         typescript({
    //             tsconfig: './tsconfig.json',
    //             declaration: false,
    //             sourceMap: true
    //         }),
    //         terser(), 
    //         resolve()
    //     ]
    // },

    // // GSAP Scratch/Experiments
    // {
    //     input: "src/gsap.js",
    //     output: [
    //         {
    //             file: "public/modules/gsap.min.js",
    //             format: "esm",
    //             sourcemap: true,
    //         }
    //     ],
    //     plugins: [terser(), resolve()]
    // },

    // // Timelines Experiments
    // {
    //     input: "src/utils/timelines.js",
    //     output: [
    //         {
    //             file: "public/modules/timelines.min.js",
    //             format: "esm",
    //             sourcemap: true,
    //         }
    //     ],
    //     plugins: [terser(), resolve()]
    // },
];
