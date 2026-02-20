import type { PatchEntry } from "../version/compatibility.js";
import { UiPatcher, type MultiPatchResult } from "./ui-patcher.js";

/**
 * HookInjector handles the "never stop" logic injection.
 *
 * The never-stop mechanism works by modifying the success result handler
 * in the agent loop. When mode is "neverStop", instead of yielding the
 * final success result and stopping, the code re-injects the last user
 * message to force another iteration.
 *
 * Due to binary patching constraints, we inject a conditional check
 * before the success yield that detects neverStop mode and continues.
 */
export class HookInjector {
  private patcher = new UiPatcher();

  /**
   * Generate the patch that intercepts the success result to enable never-stop.
   * This modifies the success yield to check for neverStop mode first.
   */
  generateNeverStopPatch(): PatchEntry {
    // The target: the success result yield after the for-await loop
    // Original: yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g
    // We inject a neverStop mode check before it
    const search = 'yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g';

    // Inject logic that replays the last user message in neverStop mode.
    // Includes a compact circuit-breaker gate via global error history.
    const replace = 'if((toolPermissionContext?.mode)==="neverStop"){globalThis.__ns_err=globalThis.__ns_err||[];if(iR){globalThis.__ns_err.push(""+iR);if(globalThis.__ns_err.length>5)globalThis.__ns_err.shift()}else globalThis.__ns_err=[];if(!(globalThis.__ns_err.length===5&&globalThis.__ns_err.every(e=>e===globalThis.__ns_err[0]))){var _nsLast=XT.filter(m=>m.type==="user").pop();if(_nsLast){XT.push(_nsLast);continue}}}yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g';

    return {
      id: "never-stop-hook",
      description:
        "Inject never-stop hook into the agent loop success handler",
      search,
      replace,
    };
  }

  /**
   * Try to inject the never-stop hook into the content buffer.
   */
  injectHook(content: Buffer): { success: boolean; buffer?: Buffer; error?: string } {
    const patch = this.generateNeverStopPatch();
    return this.patcher.applyPatch(content, patch);
  }

  /**
   * Combine UI patches with hook patches into a complete patch set.
   */
  buildAllPatches(uiPatches: PatchEntry[]): PatchEntry[] {
    return [...uiPatches, this.generateNeverStopPatch()];
  }

  /**
   * Get JavaScript code snippet for extracting the last user message.
   * Used in the never-stop re-injection logic.
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
    const allPatches = this.buildAllPatches(uiPatches);
    return this.patcher.patchFile(filePath, allPatches);
  }
}
