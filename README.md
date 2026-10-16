# Orbit Git

Orbit Git is a browser-based, local-first Git workspace hosted on GitHub Pages.

## Features
- Create local projects/repositories and edit files in the browser.
- Save commit snapshots and browse/restore local history.
- Search public GitHub repositories using the GitHub REST API.
- Import/export a JSON backup of local repositories.
- Responsive interface for desktop and mobile.

## Important limitation
This static site does not run the native Git engine and does not push commits to GitHub. Local files and commits are stored in browser localStorage, which is tied to the browser/device. Public repository search uses GitHub's unauthenticated API and can be rate limited. Do not put secrets or access tokens into this site.

For true clone/fetch/push and collaboration, a backend or a secure GitHub App/OAuth integration is needed.

## Original project backup
The original Comp compiler project was preserved on branch `backup/comp-original`.
