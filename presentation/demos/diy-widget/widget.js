// The payload console's gimbal camera, drawn from the state the demo feed puts in Cockpit's data lake.
// SERVER is the demo server feeding Cockpit: use http://localhost:8765 when running it locally.
// The block keeps these names local, so the widget can run again without the script mode set to scoped.
{
  const SERVER = 'https://apdc2026.rlehmk.dev'
  const host = (typeof root === 'undefined' ? document : root).querySelector('.apdc-gimbal')
  const variable = (name) => `external/camera/${name}`
  const attitude = { roll: 0, pitch: 0, yaw: 0 }
  let photos = Number(cockpit.getDataLakeVariableData(variable('photos')) ?? 0)

  import(`${SERVER}/gimbal-view.js`).then(({ createGimbalView }) => {
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
