// Builds a single standalone HTML page: the real app screens running on an in-browser sample-data server.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { compile } from 'tailwindcss';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = path.join(root, 'src');
function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }

const compiler = await compile(fs.readFileSync(path.join(src, 'styles.css'), 'utf8'), {
  base: root, onDependency: () => {},
  loadStylesheet: async (id, base) => {
    const file = id.startsWith('.') ? path.resolve(base, id) : require.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});
const cands = new Set();
for (const f of walk(src)) if (/\.tsx?$/.test(f)) for (const t of fs.readFileSync(f, 'utf8').split(/[\s"'`{}<>;,]+/)) if (t) cands.add(t);
const css = compiler.build([...cands]);

const js = (await esbuild.build({
  entryPoints: [path.join(src, 'preview/main.tsx')], bundle: true, minify: true, format: 'iife', loader: { '.png': 'dataurl' }, target: ['es2020', 'safari15', 'chrome90'],
  write: false, outdir: 'out', jsx: 'automatic', legalComments: 'none', charset: 'ascii', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
})).outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');

const shell = fs.readFileSync(path.join(root, 'preview-shell.html'), 'utf8');
const out = shell.replace('/*APP_CSS*/', () => css).replace('/*APP_JS*/', () => js);
const dest = process.argv[2] || path.join(root, 'preview.html');
fs.writeFileSync(dest, out);
console.log(`wrote ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
