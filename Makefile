VERSION ?=

.PHONY: release release-preview publish

# Validate, publish to GitHub Packages, commit, tag, push and publish a GitHub release.
release:
	npm run release -- "$(VERSION)"

# Print the next changelog entry without changing files or publishing.
release-preview:
	npm run release -- "$(VERSION)" --preview

# Publish the current package version without creating a commit, tag or GitHub release.
publish:
	npm publish --registry=https://npm.pkg.github.com
