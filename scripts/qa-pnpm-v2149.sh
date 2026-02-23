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

# JS candidate under pnpm global root with 2.1.49-like patterns.
JS_TARGET="$PNPM_ROOT/@anthropic-ai/claude-code/cli.mjs"
cat > "$PNPM_ROOT/@anthropic-ai/claude-code/package.json" <<'JSON'
{"name":"@anthropic-ai/claude-code","version":"2.1.49"}
JSON

cat > "$JS_TARGET" <<'EOF'
var U76,aX5,fS;var bA8=E(()=>{U76=["acceptEdits","bypassPermissions","default","dontAsk","plan"],aX5=[...U76],fS=aX5});
function TS(A){return fS.includes(A)?A:"default"}
var h57,I57,zq1;var V0=E(()=>{D4();bA8();h57=m4.enum(fS),I57=m4.enum(U76),zq1={default:{title:"Default",shortTitle:"Default",symbol:"",color:"text",external:"default"},plan:{title:"Plan Mode",shortTitle:"Plan",symbol:"⏸",color:"planMode",external:"plan"},acceptEdits:{title:"Accept edits",shortTitle:"Accept",symbol:"⏵⏵",color:"autoAccept",external:"acceptEdits"},bypassPermissions:{title:"Bypass Permissions",shortTitle:"Bypass",symbol:"⏵⏵",color:"error",external:"bypassPermissions"},dontAsk:{title:"Don't Ask",shortTitle:"DontAsk",symbol:"⏵⏵",color:"error",external:"dontAsk"}}});
function eT6(A,q){switch(A.mode){case"default":return"acceptEdits";case"acceptEdits":return"plan";case"plan":if(A.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"bypassPermissions":return"default";case"dontAsk":return"default"}}
async function*Pf(){let K={mode:"default"},a6=0,W1=0,O1=0,p6=0,F=0,dA=0,U=0,PX={suggestions:[]},X6=0,n6=0,z6=0,i6=0,V=0,p7=0,L6={getState:()=>({toolPermissionContext:{mode:"default"}})},e6="",E6=0,K5=()=>{},bH=()=>{},f6=async()=>{};await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7]),let j6={mode:"default"},Z6=[],w1=!1,u=0;yield{type:"result",subtype:"success",is_error:w1,duration_ms:Date.now()-u}}
VERSION:"2.1.49"
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

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js --yes >/tmp/qa-v2149-install.out 2>/tmp/qa-v2149-install.err

grep -Fq 'U76=["acceptEdits","bypassPermissions","default","dontAsk","neverStop","plan"]' "$JS_TARGET"
grep -Fq 'case"bypassPermissions":return"neverStop";case"neverStop":return"default"' "$JS_TARGET"
grep -Fq 'neverStop:{title:"BYPASS PERMISSION NEVER STOP",shortTitle:"BYPASS PERMISSION NEVER STOP",symbol:"⟪∞⟫",color:"warning",external:"neverStop"}' "$JS_TARGET"
grep -Fq 'while(K.mode==="neverStop"||L6.getState().toolPermissionContext.mode==="neverStop"){await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})}' "$JS_TARGET"
grep -Fq ',p7,K]),' "$JS_TARGET"

if grep -q 'neverStop' "$LOCAL_BIN"; then
  echo "[qa] local binary changed unexpectedly"
  exit 2
fi

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js uninstall >/tmp/qa-v2149-uninstall.out 2>/tmp/qa-v2149-uninstall.err

if grep -q 'neverStop' "$JS_TARGET"; then
  echo "[qa] js target still patched after uninstall"
  exit 3
fi

popd >/dev/null

echo "[qa] pnpm 2.1.49 mixed-target scenario: PASS"
echo "[qa] workspace: $QA_ROOT"
