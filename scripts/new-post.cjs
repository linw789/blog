const fs = require('node:fs/promises');
const path = require('node:path');

async function createPost(slug, title, root = path.resolve(__dirname, '..')) {
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Use a lowercase, hyphenated slug. Example: npm run new-post -- my-new-post "My New Post"');
  }
  title = title || slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  if (!title.trim() || /[\r\n]/.test(title)) throw new Error('The title must be a nonempty, single line.');
  const site = JSON.parse(await fs.readFile(path.join(root, 'site.json'), 'utf8'));
  const published = new Intl.DateTimeFormat('en-CA', {
    timeZone: site.timezone || 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const parent = path.join(root, 'content/posts');
  const directory = path.join(parent, slug);
  await fs.mkdir(parent, {recursive: true});
  try {
    await fs.mkdir(directory);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Post already exists: content/posts/${slug}. No files were changed.`);
    throw error;
  }
  try {
    await fs.writeFile(path.join(directory, 'post.json'), JSON.stringify({
      title,
      description: 'Add a short description of this post.',
      published,
      tags: [],
      draft: true
    }, null, 2) + '\n', {flag: 'wx'});
    await fs.writeFile(path.join(directory, 'index.md.html'),
      '<meta charset="utf-8"><script src="https://morgan3d.github.io/markdeep/2/latest/markdeep2.min.js" markdeep="2"></script><plaintext>\n\n' +
      `# ${title}\n\nWrite your post here.\n\n` +
      '<!-- Put images alongside this file and reference them with ![Caption](example.png). -->\n', {flag: 'wx'});
  } catch (error) {
    await fs.rm(directory, {recursive: true, force: true});
    throw error;
  }
  return directory;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: npm run new-post -- <slug> ["Post Title"]\nExample: npm run new-post -- learning-vulkan "Learning Vulkan"');
  } else if (args.length > 2) {
    console.error('Put the title in quotes: npm run new-post -- my-post "My Post Title"');
    process.exitCode = 1;
  } else {
    createPost(args[0], args[1]).then(directory => {
      console.log(`Created ${directory}\nEdit index.md.html and post.json. Add images alongside index.md.html.\nThe post starts as a draft. Set draft to false when ready, then build and push.`);
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = {createPost};
