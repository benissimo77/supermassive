import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';


export default [
    // {
    //     input: "src/moneytree/MoneyTreeScene.ts",
    //     treeshake: true,
    //     output: [
    //         {
    //             file: "public/modules/moneytree.min.js",
    //             format: "iife",
    //             sourcemap: true,
    //             globals: {
    //                 io: 'io',
    //                 phaser: 'Phaser'
    //             }
    //         }
    //     ],
    //     plugins: [
    //         nodeResolve({
    //             browser: true,
    //             preferBuiltins: false,
    //             extensions: ['.js', '.ts']  // Explicitly handle TypeScript extensions
    //         }),
    //         commonjs(),
    //         typescript({
    //             tsconfig: './tsconfig.json',
    //             outDir: './public/modules',
    //             noEmit: false,
    //             sourceMap: true,
    //             inlineSources: true,
    //             module: "esnext",
    //         }),
    //         terser({
    //             compress: {
    //                 passes: 2  // Additional optimization passes
    //             }
    //         })
    //     ],
    //     external: ['io', 'phaser']
    // },

    // {
    //     input: "src/moneytree/MoneyTreeNLScene.ts",
    //     treeshake: true,
    //     output: [
    //         {
    //             file: "public/modules/moneytreenl.min.js",
    //             format: "iife",
    //             sourcemap: true,
    //             globals: {
    //                 io: 'io',
    //                 phaser: 'Phaser'
    //             }
    //         }
    //     ],
    //     plugins: [
    //         nodeResolve({
    //             browser: true,
    //             preferBuiltins: false,
    //             extensions: ['.js', '.ts']  // Explicitly handle TypeScript extensions
    //         }),
    //         commonjs(),
    //         typescript({
    //             tsconfig: './tsconfig.json',
    //             outDir: './public/modules',
    //             noEmit: false,
    //             sourceMap: true,
    //             inlineSources: true,
    //             module: "esnext",
    //         }),
    //         terser({
    //             compress: {
    //                 passes: 2  // Additional optimization passes
    //             }
    //         })
    //     ],
    //     external: ['io', 'phaser']
    // },



    // This should be loaded from the host directory, but for now just use public folder for simplicity
    {
        input: "src/AppHost.ts",
        treeshake: true,
        output: [
            {
                // file: "host/modules/phaser.host.lobby.min.js",
                file: "public/modules/phaser.host.lobby.min.js",
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io',
                    phaser: 'Phaser'
                }
            }
        ],
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
                outDir: './public/modules',
                noEmit: false,
                sourceMap: true,
                inlineSources: true,
                module: "esnext",
                noEmitOnError: false
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            commonjs(),
            replace({
                preventAssignment: true,
                '__DEBUG__': process.env.DEBUG === 'true'
            }),
            terser({
                compress: {
                    passes: 2
                }
            })
        ],
        external: ['io', 'phaser']
    },

    {
        input: "src/AppPlay.ts",
        treeshake: true,
        output: [
            {
                file: "public/modules/phaser.play.lobby.min.js",
                // file: "public/modules/phaser.play.lobby.min.js",
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io',
                    phaser: 'Phaser'
                }
            }
        ],
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
                outDir: 'public/modules',
                noEmit: false,
                sourceMap: true,
                inlineSources: true,
                module: "esnext",
                noEmitOnError: false
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']  // Explicitly handle TypeScript extensions
            }),
            commonjs(),
            replace({
                preventAssignment: true,
                '__DEBUG__': process.env.DEBUG === 'true'
            }),

            terser({
                compress: {
                    passes: 2  // Additional optimization passes
                }
            })
        ],
        external: ['io', 'phaser']
    }

];
