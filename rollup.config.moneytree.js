import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';


export default [
    {
        input: "src/moneytree/MoneyTreeScene.ts",
        treeshake: true,
        output: [
            {
                file: "public/modules/moneytree.min.js",
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
                outDir: './public/modules',
                noEmit: false,
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




];
