# Linwoodwood's blog

A static Markdeep blog for **https://linwoodwood.com/**. Node.js renders posts and
MathJax equations locally; published pages contain HTML, CSS, and SVG, with no
runtime JavaScript, external fonts, or rendering CDN requests.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:4321. Rebuild and refresh after edits.
`dist/` and `node_modules/` are ignored by Git. Commit package-lock.json.

## Add a post

Create a stable lowercase, hyphenated folder under `content/posts/`:

```text
content/posts/my-post/
  index.md.html
  post.json
  images/
    example.png
```

Use your normal standalone Markdeep 2 document with its `<plaintext>` marker.
The builder reads everything after that marker as literal source. Plain source
without the wrapper and legacy Markdeep script-footer files are also supported.
The first `# Heading` becomes the site's separately rendered title; the title in
`post.json` controls the displayed title and indexes. No source file is modified.

```json
{
  "title": "My post",
  "description": "A short introduction for the front page and feed.",
  "published": "2026-11-11",
  "updated": "2026-11-12",
  "tags": ["Graphics", "Notes"],
  "draft": false
}
```

`updated` is optional; dates are explicit calendar dates, unaffected by the build
machine's time zone. Set `draft` to true to omit a post and its assets from all
published output. Future dates are not a scheduling mechanism: use drafts until
you are ready to publish. Folder names determine permanent URLs:
`/posts/my-post/`. Tags are grouped case-insensitively.

Use `![Caption](images/example.png)` for images. Relative paths are preserved.
Common image, font, video, and PDF assets are copied recursively. Source files,
metadata, hidden files, and editing formats such as XCF are not published.
The original root-level Vulkan files have been preserved; edit the copies under
`content/posts/vulkan-coordinates/` for future changes to the website.

The static build supports Markdeep's core formatting, diagrams, code highlighting,
and TeX math through local MathJax SVG output. Browser-dependent scripts, custom
interactive widgets, and Markdeep's dynamic `(insert ...)` requests are not a
supported authoring path; keep content and references within each post. Static
builds reject script tags rather than silently shipping runtime JavaScript.

## Site settings

Edit `site.json` for the title, description, author, and canonical URL.
`assets/site.css` controls the appearance; `templates/page.html` controls the shell.
Markdeep is vendored at a fixed version; MathJax is a build-only dependency.
`npm run build` recreates `dist/`, including posts, tags, RSS, sitemap, and robots.txt.

## Publish with GitHub Pages

1. Push this project to your GitHub repository's `main` branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Under **Custom domain**, enter **linwoodwood.com** (no protocol or path) and Save.
4. Configure the DNS records below at your domain provider.
5. Once GitHub finishes its DNS check and certificate provisioning, enable
   **Enforce HTTPS**. Availability can take up to 24 hours.

The workflow in `.github/workflows/pages.yml` installs locked dependencies,
tests and builds on pushes and pull requests, then deploys `dist/` on pushes to
`main` or a manual run. Generated files are uploaded as a Pages artifact; they
are never committed. If your default branch differs, update the workflow trigger.

Set the domain in GitHub Pages settings **before** pointing its DNS at GitHub.
You can also verify domain ownership in your account's Pages settings using the
TXT record GitHub provides. No CNAME file is needed for an Actions deployment.

### DNS for linwoodwood.com

Use these four A records for the apex domain. `@` means `linwoodwood.com`:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

Optional `www` support: add a CNAME record named `www` pointing to
`YOUR-GITHUB-USERNAME.github.io` (replace the username, without a repository
path). With `linwoodwood.com` selected as the Pages custom domain, GitHub
redirects the configured `www` variant to it.

Replace conflicting website records for these hostnames; preserve unrelated
records such as mail/MX and TXT records. DNS propagation can take up to 24 hours.
The builder's canonical links, RSS URLs, and sitemap already use your domain.
Repository settings and DNS changes must still be completed in your accounts.

References:
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
