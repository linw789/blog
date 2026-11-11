const fs = require('node:fs/promises');
const path = require('node:path');
const markdeep = require('../vendor/markdeep2.min.cjs');
const {parse, serialize} = require('parse5');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tagSlug = tag => encodeURIComponent(tag.normalize('NFC').toLowerCase());
const dateLabel = date => new Intl.DateTimeFormat('en', {year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));

function validate(meta, slug) {
  const fail = message => { throw new Error(`${slug}: ${message}`); };
  for (const key of ['title', 'description']) if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`${key} must be a nonempty string`);
  for (const key of ['published', 'updated']) {
    if (key === 'updated' && meta[key] === undefined) continue;
    const value = meta[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(`${key} must be a valid YYYY-MM-DD date`);
  }
  if (meta.updated && meta.updated < meta.published) fail('updated cannot precede published');
  if (!Array.isArray(meta.tags) || meta.tags.some(t => typeof t !== 'string' || !t.trim() || /[\/\\]/.test(t) || ['.', '..'].includes(t.trim()))) fail('tags must be nonempty names without slashes');
  if (meta.draft !== undefined && typeof meta.draft !== 'boolean') fail('draft must be a boolean');
  return {...meta, slug, tags: [...new Set(meta.tags.map(t => t.trim().normalize('NFC')))]};
}

function sourceText(source) {
  // Markdeep 2's standalone files place the literal source after <plaintext>.
  const plaintext = source.match(/<plaintext\b[^>]*>/i);
  if (plaintext) return source.slice(plaintext.index + plaintext[0].length);
  // Support older standalone Markdeep files with a script footer, too.
  return source.replace(/^\s*<meta\s+charset=[^>]+>/i, '').replace(/<!--\s*Markdeep:\s*-->[\s\S]*$/i, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

async function write(relative, content) {
  const target = path.join(out, relative);
  await fs.mkdir(path.dirname(target), {recursive:true});
  await fs.writeFile(target, content);
}

async function copyAssets(from, to) {
  for (const entry of await fs.readdir(from, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || ['index.md.html','post.json'].includes(entry.name)) continue;
    const src = path.join(from, entry.name), dest = path.join(to, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Post assets cannot be symlinks: ${src}`);
    if (entry.isDirectory()) { await fs.mkdir(dest, {recursive:true}); await copyAssets(src, dest); }
    else if (/\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|woff2?)$/i.test(entry.name)) await fs.copyFile(src, dest);
  }
}

async function build() {
  const site = JSON.parse(await fs.readFile(path.join(root,'site.json'),'utf8'));
  const base = new URL(site.url);
  if (base.protocol !== 'https:' || base.pathname !== '/') throw new Error('site.url must be an HTTPS origin');
  const template = await fs.readFile(path.join(root,'templates/page.html'),'utf8');
  const posts = [];
  const postsRoot = path.join(root,'content/posts');
  for (const entry of await fs.readdir(postsRoot, {withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) throw new Error(`Use a lowercase hyphenated post folder: ${entry.name}`);
    const dir = path.join(postsRoot,entry.name);
    const post = validate(JSON.parse(await fs.readFile(path.join(dir,'post.json'),'utf8')),entry.name);
    if (!post.draft) posts.push({...post, dir});
  }
  posts.sort((a,b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug));
  const tags = new Map();
  for (const post of posts) for (const tag of post.tags) {
    const key = tag.normalize('NFC').toLowerCase();
    if (!tags.has(key)) tags.set(key, {label:tag, posts:[]});
    tags.get(key).posts.push(post);
  }
  const tagLinks = post => post.tags.map(t => `<a class="tag" href="/tags/${tagSlug(t)}/">${esc(t)}</a>`).join('');
  const dates = post => `<time datetime="${post.published}">${dateLabel(post.published)}</time>${post.updated ? ` <span class="updated">· Updated <time datetime="${post.updated}">${dateLabel(post.updated)}</time></span>` : ''}`;
  const list = selected => selected.length ? `<ol class="post-list">${selected.map(p => `<li><div class="post-date">${dates(p)}</div><div><h2><a href="/posts/${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.description)}</p><div class="tags">${tagLinks(p)}</div></div><span class="post-arrow" aria-hidden="true">↗</span></li>`).join('')}</ol>` : '<p class="empty-state">No published posts yet. Check back soon.</p>';
  const page = (title, description, route, body) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => ({title:esc(title),description:esc(description),canonical:esc(new URL(route,base)),siteTitle:esc(site.title),body,author:esc(site.author),year:String(new Date().getUTCFullYear())}[key] ?? ''));

  global.MathJax = {
    loader:{paths:{mathjax:'@mathjax/src/bundle'},load:['adaptors/liteDOM'],require:file => import(file)},
    svg:{fontCache:'none'},
    startup:{typeset:false}
  };
  require('@mathjax/src/bundle/tex-svg.js');
  await MathJax.startup.promise;
  const adaptor = MathJax.startup.adaptor;
  try {
    await fs.rm(out,{recursive:true,force:true});
    await fs.mkdir(path.join(out,'assets'),{recursive:true});
    await fs.cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
    const styles = markdeep.stylesheet();
    await write('assets/markdeep.css', styles.replace(/^\s*<style\b[^>]*>/i,'').replace(/<\/style>\s*$/i,''));
    for (const post of posts) {
      const source = sourceText(await fs.readFile(path.join(post.dir,'index.md.html'),'utf8'));
      // The site supplies its own title, leaving the author's source intact.
      const content = source.replace(/^\s*#\s+[^\n]+\n/, '');
      // Normalize optional/mismatched HTML tags just as a browser would before
      // passing the document to MathJax's intentionally small DOM parser.
      const html = serialize(parse(markdeep.format(content, 'element')));
      // liteDOM loads uncommon HTML entity tables lazily (e.g. Markdeep's
      // typographic quotes). Resolve those retries before selecting a handler.
      const parsed = await MathJax.startup.mathjax.handleRetriesFor(() => adaptor.parse(html));
      const doc = MathJax.startup.getDocument(parsed);
      let rendered;
      try {
        await doc.renderPromise();
        rendered = adaptor.innerHTML(adaptor.body(doc.document));
        if (/data-mjx-error|<merror\b/.test(rendered)) throw new Error(`${post.slug}: MathJax could not render an equation`);
        if (/<script\b/i.test(rendered)) throw new Error(`${post.slug}: runtime scripts are not supported in static posts`);
      } finally { await doc.done(); }
      const body = `<article><header class="article-header"><a class="back-link" href="/">← All writing</a><h1>${esc(post.title)}</h1><div class="post-date">Published ${dates(post)}</div><div class="tags">${tagLinks(post)}</div></header><div class="article-body">${rendered}</div><a class="back-link article-end" href="/">← Back to all writing</a></article>`;
      await write(`posts/${post.slug}/index.html`,page(`${post.title} · ${site.title}`,post.description,`/posts/${post.slug}/`,body));
      await copyAssets(post.dir,path.join(out,'posts',post.slug));
    }
    const mathStyle = adaptor.outerHTML(MathJax.svgStylesheet());
    await write('assets/math.css',mathStyle.replace(/^<style\b[^>]*>/i,'').replace(/<\/style>$/i,''));
    await write('index.html',page(site.title,site.description,'/',`<section class="intro"><p class="eyebrow">A PERSONAL NOTEBOOK</p><h1>Notes along the way<span>.</span></h1><p>${esc(site.description)}</p></section><section aria-labelledby="writing"><div class="section-heading"><h2 id="writing">All writing <span>${String(posts.length).padStart(2,'0')}</span></h2><a href="/tags/">Browse by tag ↗</a></div>${list(posts)}</section>`));
    const tagEntries = [...tags.entries()].sort((a,b) => a[0].localeCompare(b[0]));
    await write('tags/index.html',page(`Tags · ${site.title}`,'Browse writing by topic.','/tags/',`<section class="intro"><p class="eyebrow">THE INDEX</p><h1>Browse by tag<span>.</span></h1><p>Follow a thread through the notebook.</p></section><ul class="tag-index">${tagEntries.map(([key,t]) => `<li><a href="/tags/${tagSlug(key)}/">${esc(t.label)}<span>${t.posts.length} ${t.posts.length === 1 ? 'post' : 'posts'} ↗</span></a></li>`).join('')}</ul>`));
    for (const [key,t] of tagEntries) await write(`tags/${key}/index.html`,page(`${t.label} · ${site.title}`,`Posts tagged ${t.label}.`,`/tags/${tagSlug(key)}/`,`<section class="intro"><a class="back-link" href="/tags/">← All tags</a><h1>${esc(t.label)}<span>.</span></h1><p>${t.posts.length} ${t.posts.length === 1 ? 'post' : 'posts'} in this thread.</p></section>${list(t.posts)}`));
    await write('404.html',page(`Page not found · ${site.title}`,'This page could not be found.','/404.html','<section class="intro"><p class="eyebrow">404</p><h1>A loose end.</h1><p>This page could not be found.</p><a href="/">← Back to all writing</a></section>'));
    const routes = ['/', '/tags/', ...posts.map(p => `/posts/${p.slug}/`), ...tagEntries.map(([key]) => `/tags/${tagSlug(key)}/`)];
    await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${esc(new URL(route,base))}</loc></url>`).join('')}</urlset>`);
    await write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml',base)}\n`);
    await write('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.title)}</title><link>${esc(base)}</link><description>${esc(site.description)}</description>${posts.map(p => `<item><title>${esc(p.title)}</title><link>${esc(new URL(`/posts/${p.slug}/`,base))}</link><guid>${esc(new URL(`/posts/${p.slug}/`,base))}</guid><pubDate>${new Date(`${p.published}T00:00:00Z`).toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('')}</channel></rss>`);
    await write('.nojekyll','');
    console.log(`Built ${posts.length} posts and ${tags.size} tags for ${base}`);
  } finally { await MathJax.done(); }
}

if (require.main === module) build().catch(error => {console.error(error);process.exitCode=1;});
module.exports = {validate, sourceText};
