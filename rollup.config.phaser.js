import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
    // {
    //     input: "src/moneytree/MoneyTreeScene.ts",
    //     output: [
    //         {
    //             name: 'MoneyTree',
    //             file: path.join(SUPERMASSIVE_OUTPUT, "moneytree.min.js"),
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
    //             preferBuiltins: false
    //         }),
    //         commonjs(),
    //         typescript({
    //             tsconfig: './tsconfig.json',
    //             sourceMap: true,
    //             inlineSources: true,
    //             module: "esnext",
    //             // Override outDir to match your output file location - required to prevent errors during compile
    //             outDir: '../supermassive/public/modules',
    //             // Important: don't emit files from TypeScript directly
    //             emitDeclarationOnly: false,
    //             declaration: false

    //         }),
    //         terser()
    //     ],
    //     external: ['io', 'phaser']
    // },

    {
        input: "src/AppHost.ts",
        treeshake: true,
        output: [
            {
                file: "host/modules/phaser.host.lobby.min.js",
                // file: "public/modules/phaser.host.lobby.min.js",
                format: "iife",
                sourcemap: true,
                globals: {
                    io: 'io',
                    phaser: 'Phaser'
                }
            }
        ],
        plugins: [
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']  // Explicitly handle TypeScript extensions
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                sourceMap: true,
                inlineSources: true,
                module: "esnext",
            }),
            terser({
                compress: {
                    passes: 2  // Additional optimization passes
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
                file: "host/modules/phaser.play.lobby.min.js",
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
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']  // Explicitly handle TypeScript extensions
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                sourceMap: true,
                inlineSources: true,
                module: "esnext"
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
