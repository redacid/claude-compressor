#!/bin/sh
# Refuses a release tag unless it is vX.Y.Z, points at a commit on main and
# matches the version in every manifest.
#
#   scripts/release-check.sh <tag> [main-ref]     (default main-ref: origin/main)
set -eu

tag=${1:?usage: release-check.sh <tag> [main-ref]}
main_ref=${2:-origin/main}

if ! printf '%s\n' "$tag" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "release-check: tag '$tag' is not in the vX.Y.Z format" >&2
  exit 1
fi

commit=$(git rev-parse "$tag^{commit}")
if ! git merge-base --is-ancestor "$commit" "$main_ref"; then
  echo "release-check: tag $tag ($commit) is not on $main_ref; tag only commits on main" >&2
  exit 1
fi

version=${tag#v}
for f in .claude-plugin/plugin.json package.json; do
  v=$(node -p "require('./$f').version")
  [ "$v" = "$version" ] || { echo "release-check: $f has version $v, tag is $tag" >&2; exit 1; }
done
v=$(node -p "require('./.claude-plugin/marketplace.json').plugins[0].version")
[ "$v" = "$version" ] || { echo "release-check: marketplace.json has version $v, tag is $tag" >&2; exit 1; }

echo "release-check: $tag ok ($commit on $main_ref)"
