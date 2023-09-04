/* tslint:disable */
/* eslint-disable */
/**
* @param {string} center_re_str
* @param {string} center_im_str
* @param {number} max_iteration
* @returns {ReferenceOrbit}
*/
export function calc_reference_point(center_re_str: string, center_im_str: string, max_iteration: number): ReferenceOrbit;
/**
*/
export class ReferenceOrbit {
  free(): void;
/**
* @param {number} size
*/
  constructor(size: number);
/**
* @param {number} re
* @param {number} im
*/
  push(re: number, im: number): void;
/**
* @param {number} size
*/
  shrink(size: number): void;
/**
* @returns {number}
*/
  ptr(): number;
/**
* @returns {number}
*/
  len(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_referenceorbit_free: (a: number) => void;
  readonly referenceorbit_new: (a: number) => number;
  readonly referenceorbit_push: (a: number, b: number, c: number) => void;
  readonly referenceorbit_shrink: (a: number, b: number) => void;
  readonly referenceorbit_ptr: (a: number) => number;
  readonly referenceorbit_len: (a: number) => number;
  readonly calc_reference_point: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
