/* eslint-disable */
// Stub for @kmamal/sdl. Only require()d by the Electron main process
// (src/electron/services/joystick.ts), which does not run in browser dev mode.
module.exports = {
  joystick: {
    devices: [],
    on: () => {},
    openDevice: () => {
      throw new Error('[@kmamal/sdl stub] SDL is not available in this environment')
    },
  },
}
