/* eslint-disable */
// Stub for mavlink2rest-wasm. Only reached if an Electron-style (serial/tcp/udp)
// connection is created, which requires window.electronAPI and therefore never
// happens in the browser dev server this stub is meant for.

/** Stub of the wasm-pack ParserEmitter. */
export class ParserEmitter {
  parser(_rawData) {
    console.warn('[mavlink2rest-wasm stub] parser() called — real package not installed')
  }

  emit(_callback) {
    console.warn('[mavlink2rest-wasm stub] emit() called — real package not installed')
  }

  rest2mavlink(_json) {
    console.warn('[mavlink2rest-wasm stub] rest2mavlink() called — real package not installed')
    return new Uint8Array()
  }
}

/** Stub of the wasm-pack init function. */
export default async function init(_wasmUrl) {
  console.warn('[mavlink2rest-wasm stub] init() called — real package not installed')
}
