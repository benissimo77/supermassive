// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

// Unified TypeScript configuration
const typescriptOptionsBase = {
    tsconfig: './tsconfig.json',
    sourceMap: true,
    inlineSources: true,
    module: "esnext",
    noEmitOnError: false,
    // Remove filterRoot from here - it's causing the issue
};

// Host-specific config (protected area)
const hostTypescriptOptions = {
    ...typescriptOptionsBase,
    outDir: 'public/modules'
};

// Play-specific config (public area)
const playTypescriptOptions = {
    ...typescriptOptionsBase,
    outDir: 'public/modules'
};

export default [
    {
        input: 'src/AppHost.ts',
        treeshake: true,
        output: {
            // Change the output file path here
            file: 'public/modules/phaser.host.lobby.min.js',
            format: 'iife',
            sourcemap: true,
            globals: {
                phaser: 'Phaser',
                io: 'io'
            }
        },
        external: ['phaser', 'io'],
        plugins: [
            replace({
                preventAssignment: true,
                '__DEV__': 'true'
            }),
            typescript({
                ...hostTypescriptOptions,
                // Use include/exclude pattern instead of filterRoot
                include: ['src/**/*.ts'],
                exclude: [
                    'src/ui/SoundSettingsPanel-orig.ts',
                    'src/vector/VectorGameScene.ts'
                ]
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            commonjs()
        ]
    },

    {
        input: "src/AppPlay.ts",
        treeshake: true,
        output: [
            {
                // Keep the same output path for AppPlay
                file: "public/modules/phaser.play.lobby.min.js",
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
                ...playTypescriptOptions,
                // Use include/exclude pattern instead of filterRoot
                include: ['src/**/*.ts'],
                exclude: [
                    'src/ui/SoundSettingsPanel-orig.ts',
                    'src/vector/VectorGameScene.ts'
                ]
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            commonjs(),
            replace({
                preventAssignment: true,
                '__DEV__': 'true'
            }),
        ],
        external: ['io', 'phaser']
    }
]