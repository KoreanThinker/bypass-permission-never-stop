#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-bypass-permission-never-stop}"
PACKAGE_VERSION="${PACKAGE_VERSION:-$(npm view "$PACKAGE_NAME" version)}"
PACKAGE_REF="${PACKAGE_NAME}@${PACKAGE_VERSION}"

echo "[smoke] package: $PACKAGE_REF"

# Install published package in isolated workspace
WORK_DIR="$(mktemp -d)"
pushd "$WORK_DIR" >/dev/null
npm init -y >/dev/null
npm i "$PACKAGE_REF" >/dev/null
BIN="./node_modules/.bin/bypass-permission-never-stop"

# Basic command health
"$BIN" --help >/dev/null
echo "[smoke] help: ok"

TMP_HOME="$(mktemp -d)"
VERSIONS_DIR="$TMP_HOME/.local/share/claude/versions"
TARGET="$VERSIONS_DIR/2.1.39"
mkdir -p "$VERSIONS_DIR"

cat > "$TARGET" <<'EOF'
var GAT,cr0,nk;var diR=X(()=>{GAT=["acceptEdits","bypassPermissions","default","delegate","dontAsk","plan"],cr0=[...GAT],nk=cr0});
function CAT(T){switch(T){case"acceptEdits":case"bypassPermissions":case"default":case"delegate":case"dontAsk":case"plan":return T}}
function Bw(T){switch(T){case"bypassPermissions":return"bypassPermissions";case"acceptEdits":return"acceptEdits";case"plan":return"plan";case"delegate":return"delegate";case"dontAsk":return"dontAsk";case"default":return"default";default:return"default"}}
function Qu(T){switch(T){case"default":return"Default";case"plan":return"Plan Mode";case"delegate":return"Delegate Mode";case"acceptEdits":return"Accept edits";case"bypassPermissions":return"Bypass Permissions";case"dontAsk":return"Don't Ask"}}
function VNT(T,R){let A=n9()&&R&&IQ(R);switch(T.mode){case"default":return"acceptEdits";case"acceptEdits":return"plan";case"plan":if(A)return"delegate";if(T.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"delegate":if(T.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"bypassPermissions":return"default";case"dontAsk":return"default"}}
async function*Pf(){yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g}
VERSION:"2.1.39"
EOF

# Install patch
HOME="$TMP_HOME" "$BIN" >/dev/null
echo "[smoke] install: ok"

# Validate key modifications landed
grep -q 'case"neverStop":return"default"' "$TARGET"
grep -q '__ns_err\|XT.filter(m=>m.type==="user")' "$TARGET"
echo "[smoke] patch markers: ok"

# Uninstall and verify restoration
HOME="$TMP_HOME" "$BIN" uninstall >/dev/null
echo "[smoke] uninstall: ok"

if grep -q 'neverStop' "$TARGET"; then
  echo "[smoke] restore check failed: neverStop still present"
  exit 1
fi

echo "[smoke] restore check: ok"
echo "[smoke] all checks passed"
popd >/dev/null
