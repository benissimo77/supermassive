// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';


// NOTE that even though this is for production build we still push the host module to public area
// Not worth considering security at the moment - do this later

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
        output: {
            file: 'public/modules/phaser.host.min.js',
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
                '__DEV__': 'false'
            }),
            typescript({
                ...hostTypescriptOptions,
                tsconfig: './tsconfig.json'
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            commonjs(),
            terser({
                compress: {
                    passes: 2,
                    // UPDATE: while still developing just leave console logs... no-one is going to look
                    // drop_console: true
                }
            })
        ]
    },

    {
        input: "src/AppPlay.ts",
        treeshake: true,
        output: [
            {
                // Keep the same output path for AppPlay
                file: "public/modules/phaser.play.min.js",
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
                '__DEV__': 'false'
            }),
            terser({
                compress: {
                    passes: 2,
                    drop_console: true
                }
            })
        ],
        external: ['io', 'phaser']
    },
    {
        input: 'src/AppAdmin.ts',
        treeshake: true,
        output: {
            file: 'public/modules/phaser.admin.min.js',
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
                '__DEV__': 'false'
            }),
            typescript({
                ...hostTypescriptOptions,
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
            terser({
                compress: {
                    passes: 2,
                    drop_console: true
                }
            })
        ]
    }
];
