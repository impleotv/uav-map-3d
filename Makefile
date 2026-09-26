VERSION ?=

.PHONY: release release-preview

# Validate, commit, tag, push and publish a GitHub release.
release:
	npm run release -- "$(VERSION)"

# Print the next changelog entry without changing files or publishing.
release-preview:
	npm run release -- "$(VERSION)" --preview
