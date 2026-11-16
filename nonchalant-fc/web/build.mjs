// Production build: esbuild (JS) + Tailwind v4 compiler API (CSS) -> dist/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { compile } from 'tailwindcss';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function buildCss() {
  const input = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
  const compiler = await compile(input, {
    base: root,
    onDependency: () => {},
    loadStylesheet: async (id, base) => {
      const file = id.startsWith('.') ? path.resolve(base, id)
        : require.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  // Collect class-name candidates from all source files; Tailwind ignores anything that is not a utility.
  const candidates = new Set();
  for (const f of [...walk(src), path.join(root, 'index.html')]) {
    if (!/\.(tsx?|html)$/.test(f)) continue;
    for (const t of fs.readFileSync(f, 'utf8').split(/[\s"'`{}<>;,]+/)) if (t) candidates.add(t);
  }
  return compiler.build([...candidates]);
}

async function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  const js = await esbuild.build({
    entryPoints: [path.join(src, 'main.tsx')],
    bundle: true, minify: !watch, sourcemap: watch, format: 'esm', loader: { '.png': 'dataurl' }, target: ['es2020', 'safari15', 'chrome90'],
    write: false, outdir: 'out', jsx: 'automatic', legalComments: 'none',
    define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
    logLevel: 'warning',
  });
  const code = js.outputFiles.find((f) => f.path.endsWith('.js')).text;
  const css = await buildCss();
  const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
  const jsName = `app-${hash(code)}.js`;
  const cssName = `app-${hash(css)}.css`;
  fs.writeFileSync(path.join(dist, 'assets', jsName), code);
  fs.writeFileSync(path.join(dist, 'assets', cssName), css);
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace('%CSS%', `/assets/${cssName}`).replace('%JS%', `/assets/${jsName}`);
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  if (fs.existsSync(path.join(root, 'public'))) fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
  console.log(`[web] built ${jsName} (${(code.length / 1024).toFixed(0)} KB) + ${cssName} (${(css.length / 1024).toFixed(0)} KB)`);
}

await build();
if (watch) {
  let t;
  fs.watch(src, { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => build().catch(console.error), 150); });
  console.log('[web] watching for changes… (serve dist/ with the server: npm run dev:server)');
}
