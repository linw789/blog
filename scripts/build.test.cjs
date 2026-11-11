const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validate,sourceText} = require('./build.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const valid = {title:'Title',description:'Description',published:'2026-11-11',tags:['Graphics'],draft:false};
test('rejects invalid calendar dates and backwards updates',() => {
  assert.throws(()=>validate({...valid,published:'2026-02-30'},'example'));
  assert.throws(()=>validate({...valid,updated:'2026-11-10'},'example'));
  assert.equal(validate({...valid,updated:'2026-11-12'},'example').updated,'2026-11-12');
});
test('rejects malformed draft metadata and path-like tags',() => {
  assert.throws(()=>validate({...valid,draft:'false'},'example'));
  for (const tag of ['..','a/b','a\\b']) assert.throws(()=>validate({...valid,tags:[tag]},'example'));
});
test('extracts literal source without changing code inside plaintext documents',() => {
  const text = '# Title\n<script>example()</script>';
  assert.equal(sourceText(`<meta charset="utf-8"><script src="markdeep.js"></script><plaintext>${text}`),text);
});
test('build renders math and diagrams, preserves assets, and excludes drafts',async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(),'blog-build-'));
  const project = path.resolve(__dirname,'..');
  try {
    for (const name of ['scripts','vendor','assets','templates','site.json']) await fs.cp(path.join(project,name),path.join(fixture,name),{recursive:true});
    await fs.symlink(path.join(project,'node_modules'),path.join(fixture,'node_modules'),'dir');
    for (const slug of ['published','draft']) {
      const dir = path.join(fixture,'content/posts',slug);
      await fs.mkdir(dir,{recursive:true});
      await fs.writeFile(path.join(dir,'post.json'),JSON.stringify({...valid,tags:['Graphics','图形'],draft:slug==='draft'}));
      await fs.writeFile(path.join(dir,'index.md.html'),'<meta charset="utf-8"><plaintext>\n# Title\n\nHello “world”.\n\n$x^2$\n\n![Caption](image.svg)\n\n```diagram\nA --> B\n```\n');
      await fs.writeFile(path.join(dir,'image.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    }
    execFileSync(process.execPath,['scripts/build.cjs'],{cwd:fixture,timeout:30000,stdio:'pipe'});
    const html = await fs.readFile(path.join(fixture,'dist/posts/published/index.html'),'utf8');
    assert.match(html,/<mjx-container/);
    assert.match(html,/<path/);
    assert.doesNotMatch(html,/<script\b|data-mjx-error|\\\(x\^2\\\)/);
    assert.match(html,/https:\/\/linwoodwood.com\/posts\/published\//);
    await fs.access(path.join(fixture,'dist/posts/published/image.svg'));
    await assert.rejects(fs.access(path.join(fixture,'dist/posts/draft')));
    await assert.rejects(fs.access(path.join(fixture,'dist/posts/published/post.json')));
    await fs.access(path.join(fixture,'dist/tags/图形/index.html'));
    assert.doesNotMatch(await fs.readFile(path.join(fixture,'dist/sitemap.xml'),'utf8'),/\/draft\//);
  } finally { await fs.rm(fixture,{recursive:true,force:true}); }
});
