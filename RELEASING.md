# Releasing @replyze/vue

A tag `vX.Y.Z` runs [`.github/workflows/release.yml`](.github/workflows/release.yml) in two jobs:

1. **release** checks that the tag matches `package.json` and that `CHANGELOG.md` has a dated section for that version, runs the type check, the unit tests and the tests against the real `widget.js`, builds, runs publint and Are the Types Wrong, and packs the tarball. In the packed copy of the README, `utm_source=github` becomes `utm_source=npm` (npmjs.com shows that README); the file in the repository does not change. Then it creates the GitHub release with the CHANGELOG section as notes and the tarball attached, and prints the tarball's sha256.
2. **publish** publishes that same tarball to npm with provenance, using npm trusted publishing: GitHub's OIDC token proves which repository, workflow and environment the run is, so no npm token is stored anywhere. Only this job gets `id-token: write`, and it runs in the GitHub environment `npm`. It runs only when the repository variable `NPM_PUBLISH` is `true`; otherwise the run shows a notice and the GitHub release is still created.

CI's `Package` job packs the same way on every push and prints the links in the packed README, so a pull request shows what npm will get.

## One-time setup (the owner)

npm only lets you add a trusted publisher to a package that already exists, so the first version is published once without it. Steps 3a and 3b are the two least-privilege ways to do that; pick one.

1. **The npm org.** Create the organization `replyze` on [npmjs.com](https://www.npmjs.com/org/create) (free for public packages) so the `@replyze` scope exists. Turn on two-factor authentication for every member, with a security key or an authenticator app.
2. **The GitHub environment `npm`.** Settings → Environments → New environment → `npm`. Under **Deployment branches and tags**, choose **Selected branches and tags** and add the tag rule `v*`. Optionally add yourself under **Required reviewers**, so every publish waits for your approval. The environment needs no secrets.
3. **The first version (once).** Tag it as in [Each release](#each-release).
   - **3a. By hand, with your 2FA (recommended: no token exists at any point).** Leave `NPM_PUBLISH` unset: the run tests, packs and creates the GitHub release with the tarball, and skips the publish job. Then, logged in to npm on your computer (`npm login`):
     ```sh
     gh release download v0.1.0 -R Replyze/vue-live-chat -p "*.tgz" -D release-v0.1.0
     sha256sum release-v0.1.0/replyze-vue-0.1.0.tgz
     gh release view v0.1.0 -R Replyze/vue-live-chat --json assets -q ".assets[].digest"
     tar -tzf release-v0.1.0/replyze-vue-0.1.0.tgz
     npm publish release-v0.1.0/replyze-vue-0.1.0.tgz --access public
     ```
     The sha256 must equal the asset digest and the `sha256sum` line in the run's **Pack** step. npm asks for your 2FA code. This first version has no provenance (only a CI publish gets one); every later version does.
   - **3b. From the workflow, with a one-day token (gives the first version provenance).** On npmjs.com → Access Tokens → Generate New Token (granular): permissions **Read and write**, packages and scopes limited to **`@replyze`**, no organization access, expiration **1 day**, and **Bypass two-factor authentication** ticked (the run cannot type a code). Save it as the secret `NPM_TOKEN` of the **`npm` environment** (Settings → Environments → `npm` → Environment secrets), never as a repository secret. Add the repository variable `NPM_PUBLISH` = `true` and push the tag. Right after the run: delete the environment secret and delete the token on npmjs.com. The run warns while the secret exists.
4. **Trusted publishing.** Add it when the next version is ready to tag: npm drops a new trusted publisher that has not published within 2 days. npmjs.com → `@replyze/vue` → Settings → **Trusted Publisher** → GitHub Actions:
   - Organization or user: `Replyze`
   - Repository: `vue-live-chat`
   - Workflow filename: `release.yml`
   - Environment name: `npm`
   - Allowed actions: `npm publish`. Leave `npm dist-tag` off.

   The same from a terminal (npm 11.15.0 or newer, 2FA on): `npm trust github @replyze/vue --file release.yml --repo Replyze/vue-live-chat --env npm --allow-publish`.
5. **Lock it down.** In `@replyze/vue` → Settings → Publishing access, choose **Require two-factor authentication and disallow tokens** (trusted publishing keeps working). Set the repository variable `NPM_PUBLISH` = `true` (Settings → Secrets and variables → Actions → Variables) if 3a left it unset. `gh secret list -R Replyze/vue-live-chat --env npm` must print nothing.

The publish job installs npm 11.21.1 (trusted publishing needs 11.5.1 or newer) and skips a version that is already on npm, so re-running a release is safe. If a run fails with `E404` or `ENEEDAUTH` at publish, the trusted publisher does not match the repository, `release.yml` or the environment `npm` letter for letter, or it expired: delete it and add it again, then re-run only the failed `publish` job (it publishes the tarball the `release` job built).

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

## The README of the first npm release

npmjs.com shows the README packed into each version, so switch it in the pull request of the first npm version, not after: make `npm install @replyze/vue` the install command in the Quickstart and under Installation, drop "is not on the npm registry yet", and keep `npm install github:Replyze/vue-live-chat` as the way to try unreleased changes. Between the merge and the publish, the GitHub README is a few minutes ahead of npm.
