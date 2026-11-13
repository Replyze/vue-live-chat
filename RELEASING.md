# Releasing @replyze/vue

A tag `vX.Y.Z` runs [`.github/workflows/release.yml`](.github/workflows/release.yml). It checks that the tag matches `package.json` and that `CHANGELOG.md` has a dated section for that version, runs the type check, the unit tests and the tests against the real `widget.js`, builds, runs publint and Are the Types Wrong, packs the tarball, publishes it to npm with provenance, and creates the GitHub release with the CHANGELOG section as notes and the tarball attached.

Until npm is set up, the publish step is skipped (the run shows a notice) and the GitHub release is still created.

## One-time setup (the owner)

1. **Make the repository public** before the first release. npm refuses provenance for a package built in a private repository, and `npm install github:Replyze/vue-live-chat` only works for people who can see it.
2. **The npm org.** Create the `replyze` organization on [npmjs.com](https://www.npmjs.com/org/create) (public packages are free) so the `@replyze` scope exists. Turn on two-factor authentication for every member.
3. **The first publish.** npm only lets you add a trusted publisher to a package that already exists, so the first version needs a token (or a manual publish):
   - **With the workflow (gives provenance):** on npmjs.com create a granular access token with read and write access to the `@replyze` scope (allow it to bypass 2FA, or the workflow cannot publish). Save it as the repository secret `NPM_TOKEN` (Settings → Secrets and variables → Actions → Secrets). Then tag the release (below).
   - **By hand (no provenance):** from a clean checkout of the tagged commit, `npm ci && npm publish --access public`.
4. **Trusted publishing**, after the first version is on npm: npmjs.com → `@replyze/vue` → Settings → Trusted publishing → GitHub Actions, with organization `Replyze`, repository `vue-live-chat`, workflow `release.yml`, no environment. Then add the repository variable `NPM_TRUSTED_PUBLISHING` = `true` (Settings → Secrets and variables → Actions → Variables), delete the `NPM_TOKEN` secret and revoke the token on npm. npm limits how long tokens with write access live; trusted publishing needs no token at all. Optionally set the package's publishing access to "require two-factor authentication and disallow tokens".

The publish step runs when `NPM_TOKEN` is set or `NPM_TRUSTED_PUBLISHING` is `true`. It installs npm 11 (trusted publishing needs npm 11.5.1 or newer) and skips a version that is already on npm, so re-running a release is safe.

## Each release

1. On a branch, set the version (updates `package.json` and `package-lock.json`):
   ```sh
   npm version 0.2.0 --no-git-tag-version
   ```
2. In `CHANGELOG.md`, put the changes under `## [0.2.0] - YYYY-MM-DD` (today's date) and add the link at the bottom: `[0.2.0]: https://github.com/Replyze/vue-live-chat/releases/tag/v0.2.0`. Check it: `node scripts/changelog-notes.mjs 0.2.0 --release`.
3. Open a pull request, wait for CI, merge to `main`.
4. Tag the merge commit on `main` as Replyze, never with a personal name or email:
   ```sh
   git checkout main && git pull
   git -c user.name="Replyze" -c user.email="dev@replyze.chat" tag -a v0.2.0 -m "v0.2.0"
   git push origin v0.2.0
   ```
5. Watch the run: `gh run list -R Replyze/vue-live-chat --workflow release.yml`. Then check `npm view @replyze/vue version` and the [releases page](https://github.com/Replyze/vue-live-chat/releases).

A version with a hyphen (`0.2.0-beta.1`) is published under the npm dist-tag `next` and marked as a pre-release on GitHub.

If the run fails before publishing, fix the problem on `main`, delete the tag (`git push origin :refs/tags/v0.2.0` and `git tag -d v0.2.0`) and tag again. If it fails after publishing, do not reuse the version: npm never accepts the same version twice. Release the fix as the next patch version.

## After the first npm release

In `README.md`, make `npm install @replyze/vue` the install command and keep `npm install github:Replyze/vue-live-chat` as the way to try unreleased changes.
