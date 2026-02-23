#!/usr/bin/env bash
set -euo pipefail

NODE_BIN_DIR="$(dirname "$(which node)")"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

QA_ROOT="$(mktemp -d)"
HOME_DIR="$QA_ROOT/home"
BIN_DIR="$QA_ROOT/bin"
NPM_ROOT="$QA_ROOT/npm-global"
PKG_ROOT="$NPM_ROOT/@anthropic-ai/claude-code"
TARGET="$PKG_ROOT/cli.mjs"

mkdir -p "$BIN_DIR" "$PKG_ROOT" "$HOME_DIR"

cat > "$PKG_ROOT/package.json" <<'JSON'
{"name":"@anthropic-ai/claude-code","version":"2.1.49"}
JSON

cat > "$TARGET" <<'EOF'
var U76,aX5,fS;var bA8=E(()=>{U76=["acceptEdits","bypassPermissions","default","dontAsk","plan"],aX5=[...U76],fS=aX5});
function TS(A){return fS.includes(A)?A:"default"}
var h57,I57,zq1;var V0=E(()=>{D4();bA8();h57=m4.enum(fS),I57=m4.enum(U76),zq1={default:{title:"Default",shortTitle:"Default",symbol:"",color:"text",external:"default"},plan:{title:"Plan Mode",shortTitle:"Plan",symbol:"⏸",color:"planMode",external:"plan"},acceptEdits:{title:"Accept edits",shortTitle:"Accept",symbol:"⏵⏵",color:"autoAccept",external:"acceptEdits"},bypassPermissions:{title:"Bypass Permissions",shortTitle:"Bypass",symbol:"⏵⏵",color:"error",external:"bypassPermissions"},dontAsk:{title:"Don't Ask",shortTitle:"DontAsk",symbol:"⏵⏵",color:"error",external:"dontAsk"}}});
function eT6(A,q){switch(A.mode){case"default":return"acceptEdits";case"acceptEdits":return"plan";case"plan":if(A.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"bypassPermissions":return"default";case"dontAsk":return"default"}}
async function*Pf(){let K={mode:"default"},a6=0,W1=0,O1=0,p6=0,F=0,dA=0,U=0,PX={suggestions:[]},X6=0,n6=0,z6=0,i6=0,V=0,p7=0,L6={getState:()=>({toolPermissionContext:{mode:"default"}})},e6="",E6=0,K5=()=>{},bH=()=>{},f6=async()=>{};await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7]),let j6={mode:"default"},Z6=[],w1=!1,u=0;yield{type:"result",subtype:"success",is_error:w1,duration_ms:Date.now()-u}}
VERSION:"2.1.49"
EOF

cat > "$BIN_DIR/which" <<EOF
#!/bin/sh
if [ "\$1" = "claude" ]; then
  echo "$TARGET"
  exit 0
fi
exit 1
EOF

cat > "$BIN_DIR/npm" <<EOF
#!/bin/sh
if [ "\$1" = "root" ] && [ "\$2" = "-g" ]; then
  echo "$NPM_ROOT"
  exit 0
fi
exit 1
EOF

cat > "$BIN_DIR/pnpm" <<'EOF'
#!/bin/sh
exit 1
EOF

cat > "$BIN_DIR/yarn" <<'EOF'
#!/bin/sh
exit 1
EOF

chmod +x "$BIN_DIR/which" "$BIN_DIR/npm" "$BIN_DIR/pnpm" "$BIN_DIR/yarn"

pushd "$REPO_ROOT" >/dev/null
npm run build >/dev/null

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js doctor >/tmp/qa-doctor.out 2>/tmp/qa-doctor.err

grep -Fq 'doctor summary:' /tmp/qa-doctor.out
grep -Fq 'FAIL 0' /tmp/qa-doctor.out

popd >/dev/null

echo "[qa] doctor command scenario: PASS"
echo "[qa] workspace: $QA_ROOT"
