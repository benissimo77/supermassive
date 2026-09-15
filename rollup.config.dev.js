// rollup.config.js
import esbuildTransform from 'rollup-plugin-esbuild';
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import path from 'path';

// Transpile-only (no type-checking) TypeScript handling. Type errors are caught separately
// via `tsc --noEmit`, which the build has never gated on anyway (noEmitOnError: false in
// tsconfig.json). This avoids each of the 4 bundles below building its own full type-checked
// ts.Program (each of which has to load Phaser's ~144k-line .d.ts into memory) concurrently
// in a single long-running watch process, which was causing JS heap OOM crashes.
const esbuildOptionsBase = {
    target: 'es2020',
    sourceMap: true,
    // Match @rollup/plugin-typescript's old scope exactly - .ts files only. Without this,
    // esbuild's default include (.js/.jsx/.ts/.tsx) also re-parses plain .js files, including
    // vendored/pre-minified ones like src/utils/rexuiplugin.min.js, surfacing warnings for
    // quirks already baked into that vendor file rather than anything in our own code.
    include: /\.tsx?$/,
    exclude: [
        'src/ui/SoundSettingsPanel-orig.ts',
        'src/vector/VectorGameScene.ts'
    ]
};

// rollup-plugin-esbuild also ships its own resolveId hook, meant to resolve our own
// extensionless relative imports (e.g. "./BaseScene" -> "./BaseScene.ts"). That job is
// already handled by nodeResolve's `extensions` option below, so this hook is redundant -
// and it's actively harmful: it resolves ANY relative import purely via a filesystem
// existence check, including ones deep inside node_modules, which bypasses package.json's
// "browser" field remapping. engine.io-client relies on that field to swap its Node-only
// XHR polyfill (which pulls in fs/http/child_process) for a browser-safe one; with esbuild's
// resolveId in the mix that remap is skipped, the Node-only code ends up in the browser
// bundle, and it throws "require$$0 is not defined" at runtime. Confirmed via an isolated
// minimal repro that stripping just this hook (keeping the transform hook that does the
// actual type-stripping) removes the bug - plugin ordering alone does not, since
// @rollup/plugin-commonjs resolves its internal requires through the full plugin chain
// regardless of where esbuild sits in the array.
const esbuild = (options) => {
    const plugin = esbuildTransform(options);
    delete plugin.resolveId;
    return plugin;
};

// esbuild (used as a Rollup transform plugin, not a bundler) only resolves relative imports.
// @rollup/plugin-typescript used to silently resolve bare "src/..." imports via tsconfig's
// baseUrl/paths - this alias plugin replaces that behavior explicitly.
const srcAlias = () => alias({
    entries: [
        { find: /^src\//, replacement: path.resolve(process.cwd(), 'src') + '/' }
    ]
});

export default [
    {
        input: 'src/AppQuizHost.ts',
        treeshake: true,
        output: {
            file: 'public/modules/quiz-host.min.js',
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
            srcAlias(),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            esbuild({ ...esbuildOptionsBase }),
            commonjs()
        ]
    },

    {
        input: 'src/AppThreeHost.ts',
        treeshake: true,
        output: {
            file: 'public/modules/three-host.min.js',
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
            srcAlias(),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            esbuild({ ...esbuildOptionsBase }),
            commonjs()
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
            srcAlias(),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            esbuild({ ...esbuildOptionsBase }),
            commonjs(),
            replace({
                preventAssignment: true,
                '__DEV__': 'true'
            }),
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
                '__DEV__': 'true'
            }),
            srcAlias(),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.js', '.ts']
            }),
            esbuild({ ...esbuildOptionsBase }),
            commonjs()
        ]
    }
]
