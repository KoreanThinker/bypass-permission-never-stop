#!/usr/bin/env bash
set -euo pipefail

NODE_BIN_DIR="$(dirname "$(which node)")"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

QA_ROOT="$(mktemp -d)"
HOME_DIR="$QA_ROOT/home"
BIN_DIR="$QA_ROOT/bin"
PNPM_ROOT="$QA_ROOT/pnpm-global"
VERSIONS_DIR="$HOME_DIR/.local/share/claude/versions"

mkdir -p "$BIN_DIR" "$PNPM_ROOT/@anthropic-ai/claude-code" "$VERSIONS_DIR"

# Local native binary candidate (Mach-O magic).
LOCAL_BIN="$VERSIONS_DIR/2.1.39"
printf '\xFE\xED\xFA\xCFbinary-placeholder' > "$LOCAL_BIN"
chmod +x "$LOCAL_BIN"

# JS candidate under pnpm global root.
JS_TARGET="$PNPM_ROOT/@anthropic-ai/claude-code/cli.mjs"
cat > "$PNPM_ROOT/@anthropic-ai/claude-code/package.json" <<'JSON'
{"name":"@anthropic-ai/claude-code","version":"9.9.9"}
JSON

cat > "$JS_TARGET" <<'EOF'
var GAT,cr0,nk;var diR=X(()=>{GAT=["acceptEdits","bypassPermissions","default","delegate","dontAsk","plan"],cr0=[...GAT],nk=cr0});
function CAT(T){switch(T){case"acceptEdits":case"bypassPermissions":case"default":case"delegate":case"dontAsk":case"plan":return T}}
function Bw(T){switch(T){case"bypassPermissions":return"bypassPermissions";case"acceptEdits":return"acceptEdits";case"plan":return"plan";case"delegate":return"delegate";case"dontAsk":return"dontAsk";case"default":return"default";default:return"default"}}
function Qu(T){switch(T){case"default":return"Default";case"plan":return"Plan Mode";case"delegate":return"Delegate Mode";case"acceptEdits":return"Accept edits";case"bypassPermissions":return"Bypass Permissions";case"dontAsk":return"Don't Ask"}}
function VNT(T,R){let A=n9()&&R&&IQ(R);switch(T.mode){case"default":return"acceptEdits";case"acceptEdits":return"plan";case"plan":if(A)return"delegate";if(T.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"delegate":if(T.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"bypassPermissions":return"default";case"dontAsk":return"default"}}
async function*Pf(){yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g}
VERSION:"2.1.39"
EOF

# Fake command shims.
cat > "$BIN_DIR/which" <<EOF
#!/bin/sh
if [ "\$1" = "claude" ]; then
  echo "$LOCAL_BIN"
  exit 0
fi
exit 1
EOF

cat > "$BIN_DIR/npm" <<'EOF'
#!/bin/sh
exit 1
EOF

cat > "$BIN_DIR/pnpm" <<EOF
#!/bin/sh
if [ "\$1" = "root" ] && [ "\$2" = "-g" ]; then
  echo "$PNPM_ROOT"
  exit 0
fi
exit 1
EOF

cat > "$BIN_DIR/yarn" <<'EOF'
#!/bin/sh
exit 1
EOF

chmod +x "$BIN_DIR/which" "$BIN_DIR/npm" "$BIN_DIR/pnpm" "$BIN_DIR/yarn"

pushd "$REPO_ROOT" >/dev/null
npm run build >/dev/null

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js --yes >/tmp/qa-mixed-install.out 2>/tmp/qa-mixed-install.err

grep -q 'neverStop' "$JS_TARGET"
grep -q 'XT.filter(m=>m.type==="user")' "$JS_TARGET"

if grep -q 'neverStop' "$LOCAL_BIN"; then
  echo "[qa] local binary changed unexpectedly"
  exit 2
fi

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js uninstall >/tmp/qa-mixed-uninstall.out 2>/tmp/qa-mixed-uninstall.err

if grep -q 'neverStop' "$JS_TARGET"; then
  echo "[qa] js target still patched after uninstall"
  exit 3
fi

popd >/dev/null

echo "[qa] mixed pnpm+binary target scenario: PASS"
echo "[qa] workspace: $QA_ROOT"
