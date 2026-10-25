// The payload console's gimbal camera, drawn from the state the demo feed puts in Cockpit's data lake.
// SERVER is the demo server feeding Cockpit: use http://localhost:8765 when running it locally.
// The block keeps these names local, so the widget can run again without the script mode set to scoped.
{
  const SERVER = 'https://apdc2026.rlehmk.dev'
  const host = (typeof root === 'undefined' ? document : root).querySelector('.apdc-gimbal')
  const variable = (name) => `external/camera/${name}`
  const attitude = { roll: 0, pitch: 0, yaw: 0 }
  let photos = Number(cockpit.getDataLakeVariableData(variable('photos')) ?? 0)

  // The HTTP | MAVLink switch: the camera's buttons and joystick actions read this variable to pick how they send.
  const PROTOCOL = 'apdc-camera-protocol'
  const showProtocol = (value) => {
    const on = value === 'mavlink' ? 'mavlink' : 'http'
    host.querySelectorAll('[data-protocol]').forEach((b) => b.classList.toggle('on', b.dataset.protocol === on))
  }
  showProtocol(cockpit.getDataLakeVariableData(PROTOCOL))
  cockpit.listenDataLakeVariable(PROTOCOL, showProtocol)
  host.querySelectorAll('[data-protocol]').forEach((b) =>
    b.addEventListener('click', () => cockpit.setDataLakeVariableData(PROTOCOL, b.dataset.protocol))
  )

  // Stretched over the whole screen, the widget sits under Cockpit's top and bottom bars, so the REC badge and the
  // readouts move in by however much of the widget each bar covers.
  const clearBars = () => {
    const box = host.getBoundingClientRect()
    let top = 0
    let bottom = 0
    for (const bar of document.querySelectorAll('.bar')) {
      const edge = bar.getBoundingClientRect()
      const covered = Math.min(edge.bottom, box.bottom) - Math.max(edge.top, box.top)
      if (covered <= 0 || edge.right <= box.left || edge.left >= box.right) continue
      // Compared by centre, since the bar's edge and the widget's can differ by a fraction of a pixel.
      if (edge.top + edge.bottom < box.top + box.bottom) top = Math.max(top, edge.bottom - box.top)
      else bottom = Math.max(bottom, box.bottom - edge.top)
    }
    host.style.setProperty('--bar-top', `${top}px`)
    host.style.setProperty('--bar-bottom', `${bottom}px`)
  }
  clearBars()
  ;(typeof root === 'undefined' ? window.setInterval : cockpit.setInterval)(clearBars, 500)

  // A fresh URL each run, so a redeployed drawing is not served from an old cached copy.
  import(`${SERVER}/gimbal-view.js?t=${Date.now()}`).then(({ createGimbalView }) => {
    const gimbal = createGimbalView(host.querySelector('.view'), {
      onMove: (now) => host.querySelectorAll('[data-axis]').forEach((el) => (el.textContent = `${now[el.dataset.axis].toFixed(1)}°`)),
    })
    cockpit.onCleanup?.(() => gimbal.destroy())

    const setAxis = (axis, value) => {
      if (!Number.isFinite(Number(value))) return
      attitude[axis] = Number(value)
      gimbal.setTarget(attitude)
    }
    const setRecording = (value) => {
      const on = value === true || value === 'true'
      gimbal.setRecording(on)
      host.querySelector('.rec').hidden = !on
    }
    const onPhotos = (value) => {
      if (Number(value) > photos) {
        const shutter = host.querySelector('.shutter')
        shutter.classList.remove('go')
        void shutter.offsetWidth
        shutter.classList.add('go')
        gimbal.shutter()
      }
      photos = Number(value)
    }

    // Listeners only hear changes, so the current state is read once first.
    for (const axis of ['roll', 'pitch', 'yaw']) {
      setAxis(axis, cockpit.getDataLakeVariableData(variable(axis)))
      cockpit.listenDataLakeVariable(variable(axis), (value) => setAxis(axis, value))
    }
    setRecording(cockpit.getDataLakeVariableData(variable('recording')))
    cockpit.listenDataLakeVariable(variable('recording'), setRecording)
    cockpit.listenDataLakeVariable(variable('photos'), onPhotos)
  })
}
