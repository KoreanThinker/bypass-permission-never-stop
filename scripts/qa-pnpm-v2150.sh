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

# JS candidate under pnpm global root with 2.1.50-like patterns.
JS_TARGET="$PNPM_ROOT/@anthropic-ai/claude-code/cli.js"
cat > "$PNPM_ROOT/@anthropic-ai/claude-code/package.json" <<'JSON'
{"name":"@anthropic-ai/claude-code","version":"2.1.50"}
JSON

cat > "$JS_TARGET" <<'EOF'
var o76,b05,yS;var N78=E(()=>{o76=["acceptEdits","bypassPermissions","default","dontAsk","plan"],b05=[...o76],yS=b05});
var R97,C97,Rq1;var V0=E(()=>{H4();N78();R97=b4.enum(yS),C97=b4.enum(o76),Rq1={default:{title:"Default",shortTitle:"Default",symbol:"",color:"text",external:"default"},plan:{title:"Plan Mode",shortTitle:"Plan",symbol:"⏸",color:"planMode",external:"plan"},acceptEdits:{title:"Accept edits",shortTitle:"Accept",symbol:"⏵⏵",color:"autoAccept",external:"acceptEdits"},bypassPermissions:{title:"Bypass Permissions",shortTitle:"Bypass",symbol:"⏵⏵",color:"error",external:"bypassPermissions"},dontAsk:{title:"Don't Ask",shortTitle:"DontAsk",symbol:"⏵⏵",color:"error",external:"dontAsk"}}});
function XV6(A,q){switch(A.mode){case"default":return"acceptEdits";case"acceptEdits":return"plan";case"plan":if(A.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"bypassPermissions":return"default";case"dontAsk":return"default"}}
async function*Pf(){let x1="",Y6=0,y3=()=>{},U5=()=>{},o6=0,O1=0,g6=0,C6={mode:"default"},v6={getState:()=>({toolPermissionContext:{mode:"default"}})},x=0,m8=0,rY={suggestions:[]},n=async()=>{},z6=0,H7=0,k6=0,d8=0,N=0,g8=0;await n(x1,{setCursorOffset:Y6,clearBuffer:y3,resetHistory:U5})},[o6,O1,g6,C6,v6,x,m8,rY.suggestions,n,z6,y3,U5,H7,k6,d8,N,g8]),let j6={mode:"default"},Z6=[],w1=!1,u=0;yield{type:"result",subtype:"success",is_error:w1,duration_ms:Date.now()-u}}
VERSION:"2.1.50"
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

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js --yes >/tmp/qa-v2150-install.out 2>/tmp/qa-v2150-install.err

grep -Fq 'o76=["acceptEdits","bypassPermissions","default","dontAsk","neverStop","plan"]' "$JS_TARGET"
grep -Fq 'case"bypassPermissions":return"neverStop";case"neverStop":return"default"' "$JS_TARGET"
grep -Fq 'neverStop:{title:"BYPASS PERMISSION NEVER STOP",shortTitle:"NEVER STOP",symbol:"∞",color:"error",external:"neverStop"}' "$JS_TARGET"
grep -Fq 'while(v6.getState().toolPermissionContext.mode==="neverStop"){await n(x1,{setCursorOffset:Y6,clearBuffer:y3,resetHistory:U5})}' "$JS_TARGET"

if grep -q 'neverStop' "$LOCAL_BIN"; then
  echo "[qa] local binary changed unexpectedly"
  exit 2
fi

HOME="$HOME_DIR" PATH="$BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin" node dist/cli.js uninstall >/tmp/qa-v2150-uninstall.out 2>/tmp/qa-v2150-uninstall.err

if grep -q 'neverStop' "$JS_TARGET"; then
  echo "[qa] js target still patched after uninstall"
  exit 3
fi

popd >/dev/null

echo "[qa] pnpm 2.1.50 mixed-target scenario: PASS"
echo "[qa] workspace: $QA_ROOT"
