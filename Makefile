# compressor — Claude Code plugin. Run `make` or `make help` for targets.

SHELL       := /bin/sh
NODE        ?= node
NPM         ?= npm
CLAUDE      ?= claude
NAME        := compressor
VERSION     := $(shell $(NODE) -p "require('./.claude-plugin/plugin.json').version")
DIST        := dist
PACKAGE     := $(DIST)/$(NAME)-$(VERSION).zip
JS_FILES    := $(shell find src hooks scripts test -type f -name '*.js')
BENCH_REPOS ?= .
MAIN_REF    ?= origin/main
PROMPT      ?= Run git status and ls -la, then summarise the output in one line.

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: check-deps
check-deps: ## Check that node, git and rtk are installed
	@$(NODE) --version >/dev/null 2>&1 || { echo "node is required"; exit 1; }
	@git --version >/dev/null 2>&1 || { echo "git is required"; exit 1; }
	@rtk --version >/dev/null 2>&1 || echo "warning: rtk not found on PATH (plugin will do nothing)"
	@echo "node $$($(NODE) --version), $$(git --version), $$(rtk --version 2>/dev/null || echo 'rtk missing')"

.PHONY: lint
lint: ## Syntax-check all JS and JSON files
	@for f in $(JS_FILES) hooks/dispatch.js; do $(NODE) --check "$$f" || exit 1; done
	@for f in $$(git ls-files '*.json'); do $(NODE) -e "JSON.parse(require('fs').readFileSync('$$f','utf8'))" || { echo "invalid JSON: $$f"; exit 1; }; done
	@echo "lint ok"

.PHONY: test
test: ## Run all tests (unit + integration with real rtk if installed)
	$(NPM) test --silent

.PHONY: test-unit
test-unit: ## Run unit tests only (no real rtk)
	$(NPM) run --silent test:unit

.PHONY: validate
validate: ## Validate plugin and marketplace manifests with claude
	@config_dir=$$(mktemp -d) || exit 1; trap 'rm -rf "$$config_dir"' 0; \
		CLAUDE_CONFIG_DIR="$$config_dir" $(CLAUDE) plugin validate .claude-plugin/plugin.json && \
		CLAUDE_CONFIG_DIR="$$config_dir" $(CLAUDE) plugin validate .claude-plugin/marketplace.json

.PHONY: check
check: lint test validate ## Lint, test and validate

.PHONY: bench
bench: ## Measure output savings; BENCH_REPOS="dir1 dir2" to choose repos
	$(NPM) run --silent bench -- $(BENCH_REPOS)

.PHONY: bench-md
bench-md: ## Same as bench, Markdown tables
	$(NPM) run --silent bench -- --md $(BENCH_REPOS)

.PHONY: build
build: check package ## Check, then package the plugin into dist/

.PHONY: package
package: $(PACKAGE) ## Zip the plugin from HEAD into dist/ with a sha256 file (no checks)

$(PACKAGE): $(shell git ls-files 2>/dev/null)
	@mkdir -p $(DIST)
	git archive --format=zip --prefix=$(NAME)/ -o $@ HEAD -- .claude-plugin hooks src config package.json README.md LICENSE
	cd $(DIST) && sha256sum $(notdir $@) > $(notdir $@).sha256
	@echo "built $@ (from HEAD; commit changes first)"

.PHONY: bump
bump: ## Set the version in every manifest and README: V=0.1.1 or V=patch|minor|major
	$(NODE) scripts/bump-version.js $(V)

.PHONY: release-check
release-check: ## Check a release tag: TAG=vX.Y.Z (format, on main, versions match)
	scripts/release-check.sh $(TAG) $(MAIN_REF)

.PHONY: changelog
changelog: ## Release notes from PRs merged into main: TAG=vX.Y.Z [PREV=vA.B.C]
	$(NODE) scripts/changelog.js $(TAG) $(PREV)

.PHONY: run
run: ## Start Claude Code with the plugin loaded from this checkout
	COMPRESSOR_LOG=$(CURDIR)/compressor.log $(CLAUDE) --plugin-dir $(CURDIR)

.PHONY: run-print
run-print: ## One headless run with the plugin; PROMPT="..." to change the prompt
	COMPRESSOR_LOG=$(CURDIR)/compressor.log $(CLAUDE) -p --plugin-dir $(CURDIR) "$(PROMPT)"
	@echo "--- hook log:"; tail -n 20 compressor.log 2>/dev/null || true

.PHONY: hook-test
export CMD
hook-test: ## Pipe a sample payload through the hook; CMD="git status"
	@$(NODE) scripts/hook-test.js \
		| COMPRESSOR_DEBUG=1 $(NODE) hooks/dispatch.js; echo

MARKETPLACE := redacid
PLUGIN_ID   := $(NAME)@$(MARKETPLACE)

.PHONY: install
install: ## Add this checkout as a local marketplace and install the plugin (user scope)
	$(CLAUDE) plugin marketplace add $(CURDIR)
	$(CLAUDE) plugin install $(PLUGIN_ID)

.PHONY: update
update: ## Re-read the local marketplace and update the installed plugin
	$(CLAUDE) plugin marketplace update $(MARKETPLACE)
	$(CLAUDE) plugin update $(PLUGIN_ID)

.PHONY: uninstall
uninstall: ## Uninstall the plugin and remove the local marketplace
	-$(CLAUDE) plugin uninstall $(PLUGIN_ID)
	-$(CLAUDE) plugin marketplace remove $(MARKETPLACE)

.PHONY: clean
clean: ## Remove build output and logs
	rm -rf $(DIST) coverage compressor.log
