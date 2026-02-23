import type { PatchEntry } from "../version/compatibility.js";
import { UiPatcher, type MultiPatchResult } from "./ui-patcher.js";
import { readFileSync } from "node:fs";

const LEGACY_NEVER_STOP_HOOK_PATCH: PatchEntry = {
  id: "bypass-permission-never-stop-hook-legacy",
  description:
    "Inject bypass permission never stop hook into legacy agent loop success handler",
  search:
    'yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g',
  replace:
    'if((toolPermissionContext?.mode)==="neverStop"){globalThis.__ns_err=globalThis.__ns_err||[];if(iR){globalThis.__ns_err.push(""+iR);if(globalThis.__ns_err.length>5)globalThis.__ns_err.shift()}else globalThis.__ns_err=[];if(!(globalThis.__ns_err.length===5&&globalThis.__ns_err.every(e=>e===globalThis.__ns_err[0]))){var _nsLast=XT.filter(m=>m.type==="user").pop();if(_nsLast){XT.push(_nsLast);continue}}}yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g',
};

const V2149_NEVER_STOP_HOOK_PATCH: PatchEntry = {
  id: "bypass-permission-never-stop-hook-v2149",
  description:
    "Inject bypass permission never stop loop into 2.1.49 interactive chat submit handler",
  search:
    "await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7]),",
  replace:
    'await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH});while(K.mode==="neverStop"||L6.getState().toolPermissionContext.mode==="neverStop"){await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})}},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7,K]),',
};

const V2150_NEVER_STOP_HOOK_PATCH: PatchEntry = {
  id: "bypass-permission-never-stop-hook-v2150",
  description:
    "Inject bypass permission never stop loop into 2.1.50 interactive chat submit handler",
  search:
    "await n(x1,{setCursorOffset:Y6,clearBuffer:y3,resetHistory:U5})},[o6,O1,g6,C6,v6,x,m8,rY.suggestions,n,z6,y3,U5,H7,k6,d8,N,g8]),",
  replace:
    'await n(x1,{setCursorOffset:Y6,clearBuffer:y3,resetHistory:U5});while(v6.getState().toolPermissionContext.mode==="neverStop"){await n(x1,{setCursorOffset:Y6,clearBuffer:y3,resetHistory:U5})}},[o6,O1,g6,C6,v6,x,m8,rY.suggestions,n,z6,y3,U5,H7,k6,d8,N,g8]),',
};

/**
 * HookInjector handles the "bypass permission never stop" logic injection.
 *
 * The bypass permission never stop mechanism works by modifying the success result handler
 * in the agent loop. When mode is "neverStop", instead of yielding the
 * final success result and stopping, the code re-injects the last user
 * message to force another iteration.
 *
 * Due to binary patching constraints, we inject a conditional check
 * before the success yield that detects neverStop mode and continues.
 */
export class HookInjector {
  private patcher = new UiPatcher();
  private hookPatches: PatchEntry[] = [
    LEGACY_NEVER_STOP_HOOK_PATCH,
    V2149_NEVER_STOP_HOOK_PATCH,
    V2150_NEVER_STOP_HOOK_PATCH,
  ];

  /**
   * Generate the default (legacy) patch for backward compatibility in tests.
   */
  generateNeverStopPatch(): PatchEntry {
    return this.hookPatches[0];
  }

  /**
   * Return all known bypass permission never stop hook patches.
   */
  getNeverStopPatches(): PatchEntry[] {
    return [...this.hookPatches];
  }

  /**
   * Find the first hook patch that matches the provided content.
   */
  findCompatibleHookPatch(content: Buffer): PatchEntry | null {
    const text = content.toString("utf-8");
    for (const patch of this.hookPatches) {
      if (text.includes(patch.search)) {
        return patch;
      }
    }
    return null;
  }

  /**
   * Try to inject the bypass permission never stop hook into the content buffer.
   */
  injectHook(content: Buffer): { success: boolean; buffer?: Buffer; error?: string } {
    const patch = this.findCompatibleHookPatch(content);
    if (!patch) {
      return {
        success: false,
        error: "No compatible bypass permission never stop hook pattern found in target",
      };
    }
    return this.patcher.applyPatch(content, patch);
  }

  /**
   * Combine UI patches with hook patches into a complete patch set.
   */
  buildAllPatches(uiPatches: PatchEntry[], content?: Buffer): PatchEntry[] {
    if (!content) {
      return [...uiPatches, this.generateNeverStopPatch()];
    }

    const hookPatch = this.findCompatibleHookPatch(content);
    if (!hookPatch) {
      return [...uiPatches];
    }

    return [...uiPatches, hookPatch];
  }

  /**
   * Get JavaScript code snippet for extracting the last user message.
   * Used in the bypass permission never stop re-injection logic.
   */
  getLastUserMessageExtractor(): string {
    return 'XT.filter(m=>m.type==="user").pop()';
  }

  /**
   * Get JavaScript code snippet for circuit breaker logic.
   * Prevents infinite loops when the same error repeats.
   */
  getCircuitBreakerCode(): string {
    return '(function(){var _ns_err=[],_ns_th=5;return function(e,mode){if(mode!=="neverStop")return false;_ns_err.push(e);if(_ns_err.length>_ns_th)_ns_err.shift();if(_ns_err.length<_ns_th)return false;return _ns_err.every(function(x){return x===_ns_err[0]});}})()';
  }

  /**
   * Apply all patches (UI + hook) to a file.
   */
  patchFile(filePath: string, uiPatches: PatchEntry[]): MultiPatchResult {
    const content = readFileSync(filePath);
    const allPatches = this.buildAllPatches(uiPatches, content);
    return this.patcher.patchFile(filePath, allPatches);
  }
}
