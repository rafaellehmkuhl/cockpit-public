/* eslint-disable jsdoc/require-jsdoc */
// Leaflet camera / path / WPs live here. Vue must not read this object on rAF.
import L from 'leaflet'

export type BmmPos = {
  lat: number
  lng: number
  hdg?: number
}

export type BmmOptions = {
  follow: boolean
  showWps: boolean
  showWpNums: boolean
  showPath: boolean
  pathLen: number
  tiles: 'osm' | 'esri'
}

export const BMM_DEFAULTS: BmmOptions = {
  follow: true,
  showWps: true,
  showWpNums: true,
  showPath: true,
  pathLen: 1000,
  tiles: 'esri',
}

const TILES: Record<BmmOptions['tiles'], [string, L.TileLayerOptions]> = {
  osm: [
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxNativeZoom: 19, maxZoom: 22, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2 },
  ],
  esri: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxNativeZoom: 19, maxZoom: 22, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2 },
  ],
}

type LeafletHack = L.Map & {
  _animatingZoom?: boolean
  _stop: () => void
  _limitZoom: (z: number) => number
  scrollWheelZoom: L.Handler & {
    _performZoom: () => void
    _delta: number
    _startTime: number | null
    _lastMousePos: L.Point
  }
  doubleClickZoom: L.Handler & {
    _onDoubleClick: (e: L.LeafletMouseEvent) => void
  }
}

export type BareMinimumMapHandle = {
  setOptions: (opts: Partial<BmmOptions>) => void
  setWps: (coords: number[]) => void
  zoomBy: (delta: number) => void
  wpCount: () => number
  invalidate: () => void
  destroy: () => void
}

export function mountBareMinimumMap(
  el: HTMLElement,
  getPos: () => BmmPos | null,
  viewEl?: HTMLElement | null,
  fpsEl?: HTMLCanvasElement | null
): BareMinimumMapHandle {
  const opts: BmmOptions = { ...BMM_DEFAULTS }
  const ui = {
    path: [] as [number, number][],
    wps: new Float64Array(0),
    pos: null as BmmPos | null,
  }

  const map = L.map(el, {
    preferCanvas: true,
    attributionControl: false,
    zoomControl: false,
    zoomSnap: 0,
    zoomAnimation: false,
    wheelPxPerZoomLevel: 30,
  }).setView([-27.54838, -48.46024], 16) as LeafletHack
  L.control.scale({ position: 'bottomright', metric: true, imperial: false, maxWidth: 100 }).addTo(map)

  const mapEl = map.getContainer()
  let boxStart: L.Point | null = null
  let boxEl: HTMLElement | null = null
  const boxClear = (): void => {
    boxEl?.remove()
    boxEl = null
    boxStart = null
    mapEl.classList.remove('leaflet-crosshair')
    window.removeEventListener('mousemove', boxMove)
    window.removeEventListener('mouseup', boxUp)
    map.dragging.enable()
  }
  const boxMove = (e: MouseEvent): void => {
    if (!boxStart) return
    const p = map.mouseEventToContainerPoint(e)
    const min = L.point(Math.min(boxStart.x, p.x), Math.min(boxStart.y, p.y))
    const size = L.point(Math.abs(p.x - boxStart.x), Math.abs(p.y - boxStart.y))
    if (!boxEl) {
      boxEl = L.DomUtil.create('div', 'leaflet-zoom-box', mapEl)
      mapEl.classList.add('leaflet-crosshair')
    }
    L.DomUtil.setPosition(boxEl, min)
    boxEl.style.width = size.x + 'px'
    boxEl.style.height = size.y + 'px'
  }
  const boxUp = (e: MouseEvent): void => {
    const a = boxStart
    const b = map.mouseEventToContainerPoint(e)
    const drew = !!boxEl
    boxClear()
    if (!drew || !a || Math.abs(b.x - a.x) < 8 || Math.abs(b.y - a.y) < 8) return
    map.fitBounds(L.latLngBounds(map.containerPointToLatLng(a), map.containerPointToLatLng(b)), { animate: false })
  }
  const boxDown = (e: MouseEvent): void => {
    if (e.button !== 1) return
    e.preventDefault()
    e.stopImmediatePropagation()
    map.dragging.disable()
    boxStart = map.mouseEventToContainerPoint(e)
    window.addEventListener('mousemove', boxMove)
    window.addEventListener('mouseup', boxUp)
  }
  const auxClick = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault()
  }
  mapEl.addEventListener('mousedown', boxDown, true)
  mapEl.addEventListener('auxclick', auxClick)

  let tileLayer = L.tileLayer(...(TILES[opts.tiles] || TILES.esri)).addTo(map)
  const overlay = L.layerGroup().addTo(map)
  let vehicleMarker: L.Marker | null = null
  let pathLine: L.Polyline | null = null
  let wpLayer: L.LayerGroup | null = null
  let wpLabelEl: HTMLCanvasElement | null = null

  const clearLayer = (layer: L.Layer | null): void => {
    if (layer) overlay.removeLayer(layer)
  }

  const drawVehicle = (): void => {
    const p = ui.pos
    if (!p || !Number.isFinite(p.lat)) {
      clearLayer(vehicleMarker)
      vehicleMarker = null
      return
    }
    const hdg = p.hdg != null && p.hdg >= 0 && p.hdg < 360 ? p.hdg : 0
    if (vehicleMarker) {
      vehicleMarker.setLatLng([p.lat, p.lng])
      const img = vehicleMarker.getElement()?.querySelector('svg')
      if (img) img.style.transform = `rotate(${hdg}deg)`
      return
    }
    const svg =
      `<svg viewBox="0 0 22 22" width="22" height="22" style="transform:rotate(${hdg}deg)">` +
      '<polygon points="11,1 21,21 11,16 1,21" fill="#3f6" stroke="#fff" stroke-width="1.2"/>' +
      '</svg>'
    vehicleMarker = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: 'bmm-veh',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: svg,
      }),
      interactive: false,
      keyboard: false,
    })
    overlay.addLayer(vehicleMarker)
  }

  const pushPath = (p: BmmPos): void => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || opts.pathLen < 2) return
    const last = ui.path[ui.path.length - 1]
    if (last && last[0] === p.lat && last[1] === p.lng) return
    ui.path.push([p.lat, p.lng])
    if (ui.path.length > opts.pathLen) ui.path.splice(0, ui.path.length - opts.pathLen)
    if (opts.showPath) drawPath()
  }

  const drawPath = (): void => {
    if (!opts.showPath || opts.pathLen < 2 || ui.path.length < 2) {
      clearLayer(pathLine)
      pathLine = null
      return
    }
    if (pathLine) {
      pathLine.setLatLngs(ui.path)
      return
    }
    pathLine = L.polyline(ui.path, { color: '#ff0', weight: 2, interactive: false })
    overlay.addLayer(pathLine)
  }

  const paintWpLabels = (): void => {
    if (!wpLabelEl) return
    const size = map.getSize()
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(size.x * dpr)
    const h = Math.round(size.y * dpr)
    if (wpLabelEl.width !== w || wpLabelEl.height !== h) {
      wpLabelEl.width = w
      wpLabelEl.height = h
      wpLabelEl.style.width = size.x + 'px'
      wpLabelEl.style.height = size.y + 'px'
    }
    L.DomUtil.setPosition(wpLabelEl, map.containerPointToLayerPoint([0, 0]))
    const ctx = wpLabelEl.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.x, size.y)
    if (!opts.showWps || !opts.showWpNums || ui.wps.length < 2) return
    const lat = map.getCenter().lat
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, map.getZoom())
    const circlePx = 8 / mpp
    if (circlePx < 10) return
    const face = 'Consolas, Menlo, Monaco, monospace'
    const probePx = Math.max(9, Math.round(circlePx))
    ctx.font = `${probePx}px ${face}`
    const probe = ctx.measureText('999')
    const probeH = probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent || probePx * 0.72
    const room = circlePx * 2 * 0.78
    const fontPx = Math.max(9, Math.round(probePx * Math.min(room / probe.width, room / probeH)))
    ctx.font = `${fontPx}px ${face}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.lineWidth = Math.max(1.5, fontPx / 10)
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#fff'
    const w3 = ctx.measureText('999').width
    const gap2 = w3 * w3 * 1.15
    const pad = w3 / 2 + 4
    const placed: L.Point[] = []
    for (let i = 0, n = 0; i < ui.wps.length; i += 2, n++) {
      const p = map.latLngToContainerPoint([ui.wps[i], ui.wps[i + 1]])
      if (p.x < -pad || p.y < -pad || p.x > size.x + pad || p.y > size.y + pad) continue
      let clash = false
      for (const q of placed) {
        const dx = p.x - q.x
        const dy = p.y - q.y
        if (dx * dx + dy * dy < gap2) {
          clash = true
          break
        }
      }
      if (clash) continue
      placed.push(p)
      const t = String(n)
      const m = ctx.measureText(t)
      const y = p.y + ((m.actualBoundingBoxAscent || fontPx * 0.7) - (m.actualBoundingBoxDescent || 0)) / 2
      ctx.strokeText(t, p.x, y)
      ctx.fillText(t, p.x, y)
    }
  }

  const ensureWpLabels = (): void => {
    if (wpLabelEl) return
    wpLabelEl = L.DomUtil.create('canvas', 'bmm-wp-labels', map.getPane('overlayPane'))
    wpLabelEl.style.pointerEvents = 'none'
    wpLabelEl.style.position = 'absolute'
    map.on('move zoom viewreset resize', paintWpLabels)
  }

  const drawWps = (): void => {
    clearLayer(wpLayer)
    wpLayer = null
    if (!opts.showWps || ui.wps.length < 2) {
      paintWpLabels()
      return
    }
    const group = L.layerGroup()
    const line: L.LatLngExpression[] = []
    for (let i = 0; i < ui.wps.length; i += 2) {
      const p: L.LatLngExpression = [ui.wps[i], ui.wps[i + 1]]
      line.push(p)
      group.addLayer(
        L.circle(p, {
          radius: 8,
          color: '#fff',
          weight: 1,
          fillColor: '#39f',
          fillOpacity: 0.9,
          interactive: false,
        })
      )
    }
    if (line.length > 1) group.addLayer(L.polyline(line, { color: '#39f', weight: 1, interactive: false }))
    wpLayer = group
    overlay.addLayer(wpLayer)
    ensureWpLabels()
    paintWpLabels()
  }

  let followGoal: BmmPos | null = null
  let followHoldUntil = 0
  const followPos = (): BmmPos | null => followGoal || ui.pos
  const followSetZoom = (z: number): boolean => {
    const p = followPos()
    if (!p || !Number.isFinite(p.lat)) return false
    followHoldUntil = performance.now() + 120
    map.setView([p.lat, p.lng], z, { animate: false })
    return true
  }
  const centerOnVeh = (snap?: boolean): boolean => {
    const p = ui.pos
    if (!p || !Number.isFinite(p.lat)) return false
    followGoal = p
    if (!opts.follow || snap) map.setView([p.lat, p.lng], map.getZoom(), { animate: false })
    return true
  }
  const easeFollow = (): void => {
    if (!opts.follow || !followGoal || performance.now() < followHoldUntil) return
    if (map._animatingZoom) return
    const p = map.latLngToContainerPoint(L.latLng(followGoal.lat, followGoal.lng))
    const size = map.getSize()
    const dx = p.x - size.x / 2
    const dy = p.y - size.y / 2
    if (dx * dx + dy * dy < 1) return
    if (Math.abs(dx) > 4000 || Math.abs(dy) > 4000) {
      map.setView([followGoal.lat, followGoal.lng], map.getZoom(), { animate: false })
      return
    }
    map.panBy([dx, dy], { animate: false, noMoveStart: true })
  }

  const applyFollowOpts = (): void => {
    map.options.scrollWheelZoom = opts.follow ? 'center' : true
    map.options.doubleClickZoom = opts.follow ? 'center' : true
    if (opts.follow) centerOnVeh(true)
  }

  map.scrollWheelZoom._performZoom = function (this: LeafletHack['scrollWheelZoom']): void {
    const zoom = map.getZoom()
    const snap = map.options.zoomSnap || 0
    map._stop()
    const d2 = this._delta / ((map.options.wheelPxPerZoomLevel || 60) * 4)
    const d3 = (4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2))))) / Math.LN2
    const d4 = snap ? Math.ceil(d3 / snap) * snap : d3
    const delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom
    this._delta = 0
    this._startTime = null
    if (!delta) return
    if (opts.follow) followSetZoom(zoom + delta)
    else map.setZoomAround(this._lastMousePos, zoom + delta, { animate: false })
  }
  map.doubleClickZoom._onDoubleClick = function (e: L.LeafletMouseEvent): void {
    const step = map.options.zoomDelta || 1
    const z = map._limitZoom(map.getZoom() + (e.originalEvent.shiftKey ? -step : step))
    if (opts.follow) followSetZoom(z)
    else map.setZoomAround(e.containerPoint, z, { animate: false })
  }

  const paintView = (): void => {
    if (!viewEl) return
    const c = map.getCenter()
    viewEl.textContent = `center ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)} · z${map.getZoom().toFixed(2)}`
  }
  map.on('move zoom', paintView)
  paintView()

  const FPS_N = 720
  const fpsBuf = new Float64Array(FPS_N)
  let fpsHead = 0
  let fpsCount = 0
  let fpsSkip = 0
  const paintFps = (now: number): void => {
    if (!fpsEl) return
    const ctx = fpsEl.getContext('2d')
    if (!ctx) return
    const W = fpsEl.width
    const H = fpsEl.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgb(0 0 0 / 55%)'
    ctx.fillRect(0, 0, W, H)
    const yFor = (fps: number): number => (1 - (fps + 20) / 100) * H
    ctx.strokeStyle = 'rgb(255 255 255 / 28%)'
    ctx.beginPath()
    for (const line of [0, 30, 60]) {
      const y = yFor(line)
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
    }
    ctx.stroke()
    if (fpsCount < 2) return
    const tCut = now - 10000
    const xs: number[] = []
    const yInst: number[] = []
    const yMa: number[] = []
    const q: number[] = []
    let qSum = 0
    let prev = 0
    let lastInst = 0
    let lastMa = 0
    for (let k = 0; k < fpsCount; k++) {
      const t = fpsBuf[(fpsHead - fpsCount + k + FPS_N) % FPS_N]
      if (t < tCut) continue
      if (prev) {
        const dt = t - prev
        const fps = dt > 0 ? 1000 / dt : 0
        q.push(t, fps)
        qSum += fps
        while (q.length && q[0] < t - 1000) {
          qSum -= q[1]
          q.splice(0, 2)
        }
        const avg = q.length ? qSum / (q.length / 2) : fps
        xs.push(((t - tCut) / 10000) * W)
        yInst.push(yFor(Math.max(-20, Math.min(80, fps))))
        yMa.push(yFor(Math.max(-20, Math.min(80, avg))))
        lastInst = fps
        lastMa = avg
      }
      prev = t
    }
    const stroke = (ys: number[], color: string): void => {
      if (!xs.length) return
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.moveTo(xs[0], ys[0])
      for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i])
      ctx.stroke()
    }
    stroke(yInst, '#fc3')
    stroke(yMa, '#3f6')
    ctx.fillStyle = '#fff'
    ctx.font = '10px ui-monospace, Menlo, monospace'
    ctx.fillText(`${lastInst.toFixed(0)} inst  ${lastMa.toFixed(0)} avg1s`, 28, 12)
    ;(globalThis as unknown as { __BMM_FPS?: { inst: number; avg1s: number } }).__BMM_FPS = {
      inst: lastInst,
      avg1s: lastMa,
    }
  }

  let alive = true
  const tick = (now: number): void => {
    if (!alive) return
    const p = getPos()
    if (p && Number.isFinite(p.lat)) {
      ui.pos = p
      followGoal = p
      pushPath(p)
      drawVehicle()
    }
    easeFollow()
    fpsBuf[fpsHead] = now
    fpsHead = (fpsHead + 1) % FPS_N
    if (fpsCount < FPS_N) fpsCount++
    fpsSkip++
    if (fpsSkip >= 2) {
      fpsSkip = 0
      paintFps(now)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  applyFollowOpts()

  return {
    setOptions(next) {
      const prevTiles = opts.tiles
      const prevFollow = opts.follow
      Object.assign(opts, next)
      if (opts.tiles !== prevTiles) {
        tileLayer.remove()
        tileLayer = L.tileLayer(...(TILES[opts.tiles] || TILES.esri)).addTo(map)
      }
      if (opts.pathLen < 2) ui.path = []
      else if (ui.path.length > opts.pathLen) ui.path.splice(0, ui.path.length - opts.pathLen)
      drawPath()
      drawWps()
      if (opts.follow !== prevFollow) applyFollowOpts()
    },
    setWps(coords) {
      ui.wps = Float64Array.from(coords)
      drawWps()
    },
    zoomBy(delta) {
      const z = map.getZoom() + delta
      if (opts.follow) followSetZoom(z)
      else map.setZoom(z, { animate: false })
    },
    wpCount() {
      return ui.wps.length >> 1
    },
    invalidate() {
      map.invalidateSize({ animate: false })
      paintWpLabels()
    },
    destroy() {
      alive = false
      boxClear()
      mapEl.removeEventListener('mousedown', boxDown, true)
      mapEl.removeEventListener('auxclick', auxClick)
      map.remove()
    },
  }
}
