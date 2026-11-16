import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {
  Feature as GeoJsonFeature,
  FeatureCollection as GeoJsonFeatureCollection,
  Geometry as GeoJsonGeometry,
  Position,
} from 'geojson'
import type { FeatureCollection, Geometry, MapProps, ParcelResponse } from '../../api/types'
import { getImageryMap, type ImageryMapParams } from '../../api/gis'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

interface InteractiveGisMapProps {
  projectData: FeatureCollection<MapProps> | null
  parcelData: FeatureCollection<MapProps> | null
  projectName: string | null
  villageName: string | null
  parcelSearch: string
  imageryEnabled: boolean
  imageryProvider: string | null
  parcelCandidates: ParcelResponse[]
  canPersistGeometry: boolean
  onPersistGeometry: (kind: 'PARCEL' | 'ALIGNMENT', geometry: Geometry, parcelId?: string) => Promise<void>
}

const INDIA_VIEW: L.LatLngExpression = [19.7515, 75.7139]

export function InteractiveGisMap({
  projectData,
  parcelData,
  projectName,
  villageName,
  parcelSearch,
  imageryEnabled,
  imageryProvider,
  parcelCandidates,
  canPersistGeometry,
  onPersistGeometry,
}: InteractiveGisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const projectLayerRef = useRef<L.GeoJSON | null>(null)
  const parcelLayerRef = useRef<L.GeoJSON | null>(null)
  const importedLayerRef = useRef<L.GeoJSON | null>(null)
  const imageryLayerRef = useRef<L.ImageOverlay | null>(null)
  const imageryUrlRef = useRef<string | null>(null)
  const drawLayerRef = useRef<L.Polygon | null>(null)
  const drawPointsRef = useRef<L.LatLng[]>([])
  const drawingRef = useRef(false)
  const [showProjects, setShowProjects] = useState(true)
  const [showParcels, setShowParcels] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [areaSqM, setAreaSqM] = useState<number | null>(null)
  const [showImagery, setShowImagery] = useState(false)
  const [imageryState, setImageryState] = useState('BHUVAN UNAVAILABLE - OSM FALLBACK ACTIVE')
  const [mapError, setMapError] = useState<string | null>(null)
  const [importedFeatures, setImportedFeatures] = useState<
    GeoJsonFeature<GeoJsonGeometry, Record<string, unknown>>[]
  >([])
  const [drawnFeature, setDrawnFeature] = useState<
    GeoJsonFeature<GeoJsonGeometry, Record<string, unknown>> | null
  >(null)
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0)
  const [selectedParcelId, setSelectedParcelId] = useState('')
  const [savingGeometry, setSavingGeometry] = useState(false)
  const hasDemoLayers = Boolean(
    projectData?.features.length ||
      parcelData?.features.length ||
      importedFeatures.length ||
      drawnFeature,
  )
  const uploadFeatures = drawnFeature ? [drawnFeature] : importedFeatures
  const selectedFeature = uploadFeatures[selectedFeatureIndex] ?? null
  const selectedGeometry = selectedFeature ? toApiGeometry(selectedFeature.geometry) : null
  const selectedGeometryKind =
    selectedGeometry?.type === 'Polygon' || selectedGeometry?.type === 'MultiPolygon'
      ? 'PARCEL'
      : selectedGeometry?.type === 'LineString' || selectedGeometry?.type === 'MultiLineString'
        ? 'ALIGNMENT'
        : null

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      center: INDIA_VIEW,
      zoom: 6,
      minZoom: 4,
      maxZoom: 19,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)

    function onClick(event: L.LeafletMouseEvent) {
      if (!drawingRef.current) {
        return
      }
      drawPointsRef.current = [...drawPointsRef.current, event.latlng]
      if (drawPointsRef.current.length >= 3) {
        const points = drawPointsRef.current
        drawLayerRef.current?.remove()
        const polygon = L.polygon(points, {
          color: '#b45309',
          fillColor: '#f59e0b',
          fillOpacity: 0.18,
          weight: 2,
        }).addTo(map)
        drawLayerRef.current = polygon
        const area = sphericalArea(points)
        setAreaSqM(area)
        setDrawnFeature({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[...points.map((point) => [point.lng, point.lat]), [
              points[0].lng,
              points[0].lat,
            ]]],
          },
          properties: { kind: 'DEMO_MEASUREMENT', areaSqM: Math.round(area) },
        })
      }
    }

    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      imageryUrlRef.current && URL.revokeObjectURL(imageryUrlRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    projectLayerRef.current?.remove()
    parcelLayerRef.current?.remove()

    const projectFeatures = normalizeCollection(projectData)
    if (projectFeatures && projectFeatures.features.length > 0) {
      projectLayerRef.current = L.geoJSON(projectFeatures, {
        style: (feature) => styleFor(feature?.properties?.kind, true),
        onEachFeature: (feature, layer) => addPopup(feature.properties, layer),
      })
      if (showProjects) {
        projectLayerRef.current.addTo(map)
      }
    }

    const search = parcelSearch.trim().toLocaleLowerCase()
    const visibleParcelData = parcelData
      ? {
          ...parcelData,
          features: parcelData.features.filter((feature) => {
            if (!search || feature.properties.kind !== 'PARCEL') {
              return true
            }
            return [feature.properties.gatNumber, feature.properties.surveyNumber]
              .filter(Boolean)
              .some((value) => value?.toLocaleLowerCase().includes(search))
          }),
        }
      : null
    const parcelFeatures = normalizeCollection(visibleParcelData)
    if (parcelFeatures && parcelFeatures.features.length > 0) {
      parcelLayerRef.current = L.geoJSON(parcelFeatures, {
        style: (feature) => styleFor(feature?.properties?.kind, false),
        onEachFeature: (feature, layer) => addPopup(feature.properties, layer),
      })
      if (showParcels) {
        parcelLayerRef.current.addTo(map)
      }
    }

    const fitLayers = [
      showProjects ? projectLayerRef.current : null,
      showParcels ? parcelLayerRef.current : null,
    ].filter((layer): layer is L.GeoJSON => layer !== null)
    const bounds = L.featureGroup(fitLayers).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    } else if (!projectFeatures?.features.length && !parcelFeatures?.features.length) {
      map.setView(INDIA_VIEW, 6)
    }
  }, [projectData, parcelData, parcelSearch, showProjects, showParcels])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    importedLayerRef.current?.remove()
    if (importedFeatures.length > 0) {
      const importedLayer = L.geoJSON(undefined, {
        style: { color: '#7c3aed', weight: 2, fillOpacity: 0.12 },
      })
      importedFeatures.forEach((feature) => importedLayer.addData(feature))
      importedLayerRef.current = importedLayer.addTo(map)
      const bounds = importedLayerRef.current.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
      }
    }
  }, [importedFeatures])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const activeMap = map
    const serviceName = imageryProvider?.toLocaleUpperCase().includes('BHUVAN')
      ? 'BHUVAN'
      : 'IMAGERY'
    setImageryState(
      imageryEnabled
        ? `${serviceName} NOT VERIFIED - OSM FALLBACK ACTIVE`
        : `${serviceName} UNAVAILABLE - OSM FALLBACK ACTIVE`,
    )
    if (!showImagery || !imageryEnabled) {
      imageryLayerRef.current?.remove()
      imageryLayerRef.current = null
      if (imageryUrlRef.current) {
        URL.revokeObjectURL(imageryUrlRef.current)
        imageryUrlRef.current = null
      }
      return
    }

    let active = true
    let timer: number | undefined
    async function fetchImagery() {
      const bounds = activeMap.getBounds()
      const west = bounds.getWest()
      const south = bounds.getSouth()
      const east = bounds.getEast()
      const north = bounds.getNorth()
      if (east - west > 5 || north - south > 5) {
        setImageryState('ZOOM CLOSER FOR BHUVAN - OSM ACTIVE')
        return
      }
      const params: ImageryMapParams = {
        minLon: west,
        minLat: south,
        maxLon: east,
        maxLat: north,
        width: 1024,
        height: 768,
      }
      try {
        const blob = await getImageryMap(params)
        if (!active) {
          return
        }
        const url = URL.createObjectURL(blob)
        imageryLayerRef.current?.remove()
        if (imageryUrlRef.current) {
          URL.revokeObjectURL(imageryUrlRef.current)
        }
        imageryUrlRef.current = url
        imageryLayerRef.current = L.imageOverlay(url, [
          [south, west],
          [north, east],
        ], { opacity: 0.7 }).addTo(activeMap)
        setImageryState(`${serviceName} CONNECTED`)
      } catch (error) {
        if (active) {
          imageryLayerRef.current?.remove()
          imageryLayerRef.current = null
          const connectionState = readConnectionState(error)
          setImageryState(connectionState === 'AUTHENTICATION_FAILED'
            ? `${serviceName} AUTHENTICATION FAILED - OSM FALLBACK ACTIVE`
            : `${serviceName} UNAVAILABLE - OSM FALLBACK ACTIVE`)
        }
      }
    }
    function scheduleFetch() {
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
      timer = window.setTimeout(() => void fetchImagery(), 250)
    }
    scheduleFetch()
    activeMap.on('moveend', scheduleFetch)
    return () => {
      active = false
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
      activeMap.off('moveend', scheduleFetch)
    }
  }, [showImagery, imageryEnabled, imageryProvider])

  function toggleDrawing() {
    const next = !drawing
    drawingRef.current = next
    setDrawing(next)
    drawPointsRef.current = []
    setAreaSqM(null)
    setDrawnFeature(null)
    drawLayerRef.current?.remove()
    drawLayerRef.current = null
    setMapError(null)
  }

  async function importGeoJson(file: File | undefined) {
    if (!file) {
      return
    }
    setMapError(null)
    if (file.size > 5 * 1024 * 1024) {
      setMapError('GeoJSON file must be 5 MB or smaller.')
      return
    }
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const features = readImportedFeatures(parsed)
      if (features.length === 0) {
        throw new Error('The file has no supported GeoJSON features.')
      }
      setImportedFeatures(features)
      setSelectedFeatureIndex(0)
      setDrawnFeature(null)
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'The GeoJSON file is invalid.')
    }
  }

  async function saveSelectedGeometry() {
    if (!selectedGeometry || !selectedGeometryKind || savingGeometry) {
      return
    }
    if (selectedGeometryKind === 'PARCEL' && !selectedParcelId) {
      setMapError('Select a parcel from the selected village before saving this polygon.')
      return
    }
    setSavingGeometry(true)
    setMapError(null)
    try {
      await onPersistGeometry(
        selectedGeometryKind,
        selectedGeometry,
        selectedGeometryKind === 'PARCEL' ? selectedParcelId : undefined,
      )
      setMapError('Geometry saved to PostGIS and recorded in the audit history.')
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Geometry could not be saved.')
    } finally {
      setSavingGeometry(false)
    }
  }

  function exportGeoJson() {
    const features = [
      ...(normalizeCollection(projectData)?.features ?? []),
      ...(normalizeCollection(parcelData)?.features ?? []),
      ...importedFeatures,
      ...(drawnFeature ? [drawnFeature] : []),
    ]
    const blob = new Blob(
      [JSON.stringify({ type: 'FeatureCollection', features }, null, 2)],
      { type: 'application/geo+json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'nlams-map-data.geojson'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-3" aria-label="Interactive GIS map">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={imageryState === 'BHUVAN CONNECTED' ? 'success' : 'warning'}>
            {imageryState}
          </Badge>
          <Badge variant="neutral">OSM BASEMAP ACTIVE</Badge>
          <Badge variant={hasDemoLayers ? 'info' : 'neutral'}>
            {hasDemoLayers ? 'GIS DATA LAYERS ACTIVE' : 'NO GIS GEOMETRY LOADED'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {imageryEnabled ? (
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={showImagery}
                onChange={(event) => setShowImagery(event.target.checked)}
              />
              Bhuvan imagery overlay
            </label>
          ) : null}
          <Button size="sm" variant={drawing ? 'secondary' : 'outline'} onClick={toggleDrawing}>
            {drawing ? 'Finish polygon' : 'Draw / measure'}
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Upload GeoJSON
            <input
              type="file"
              accept=".json,.geojson,application/geo+json,application/json"
              className="sr-only"
              onChange={(event) => {
                void importGeoJson(event.target.files?.[0])
                event.currentTarget.value = ''
              }}
            />
          </label>
          <Button size="sm" variant="outline" onClick={exportGeoJson}>
            Export GeoJSON
          </Button>
        </div>
      </div>

      {uploadFeatures.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {uploadFeatures.length > 1 ? (
            <label className="text-sm font-medium text-slate-700">
              Geometry to save
              <select
                value={selectedFeatureIndex}
                onChange={(event) => setSelectedFeatureIndex(Number(event.target.value))}
                className="mt-1 block h-10 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {uploadFeatures.map((feature, index) => (
                  <option key={index} value={index}>
                    {`${feature.geometry.type} ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedGeometryKind === 'PARCEL' ? (
            <label className="text-sm font-medium text-slate-700">
              Parcel boundary target
              <select
                value={selectedParcelId}
                onChange={(event) => setSelectedParcelId(event.target.value)}
                disabled={!canPersistGeometry || parcelCandidates.length === 0}
                className="mt-1 block h-10 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Select a parcel</option>
                {parcelCandidates
                  .filter((parcel) => parcel.status === 'ACTIVE')
                  .map((parcel) => (
                    <option key={parcel.id} value={parcel.id}>
                      {parcel.gatNumber ?? parcel.surveyNumber ?? parcel.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            onClick={() => void saveSelectedGeometry()}
            disabled={
              !canPersistGeometry ||
              !selectedGeometryKind ||
              (selectedGeometryKind === 'PARCEL' && !selectedParcelId)
            }
            isLoading={savingGeometry}
          >
            Save selected geometry to PostGIS
          </Button>
          {!canPersistGeometry ? (
            <span className="text-xs text-slate-500">GIS write permission is required.</span>
          ) : selectedGeometryKind === 'ALIGNMENT' ? (
            <span className="text-xs text-slate-500">
              Saves the alignment for the selected project with a 100 m demo corridor.
            </span>
          ) : parcelCandidates.length === 0 ? (
            <span className="text-xs text-slate-500">
              Select a village with readable parcel records to choose a target.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showParcels}
            onChange={(event) => setShowParcels(event.target.checked)}
          />
          Land parcels
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showProjects}
            onChange={(event) => setShowProjects(event.target.checked)}
          />
          Project alignment and conflicts
        </label>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />Parcels</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-orange-600" />Alignment</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-700" />Conflict corridor</span>
        {areaSqM !== null ? (
          <Badge variant="info">Drawn area: {(areaSqM / 10_000).toFixed(4)} ha</Badge>
        ) : null}
      </div>

      {drawing ? (
        <Alert variant="info" title="Polygon measurement">
          Click at least three points on the map, then select Finish polygon. The measured area is
          approximate and is for demonstration only.
        </Alert>
      ) : null}
      {mapError ? (
        <Alert
          variant={mapError.startsWith('Geometry saved') ? 'success' : 'error'}
          title={mapError.startsWith('Geometry saved') ? 'PostGIS geometry saved' : 'Map operation was not completed'}
        >
          {mapError}
        </Alert>
      ) : null}
      {showImagery && imageryEnabled && imageryState.startsWith('ZOOM CLOSER') ? (
        <Alert variant="info">{imageryState}</Alert>
      ) : null}
      {!projectData?.features.length && !parcelData?.features.length && !importedFeatures.length ? (
        <Alert variant="info" title="OpenStreetMap fallback is active">
          {villageName || projectName
            ? 'The selected area has no stored GeoJSON geometry yet. The interactive OpenStreetMap remains available.'
            : 'Select a project or village with recorded geometry, or upload GeoJSON. Synthetic map geometry is never invented.'}
        </Alert>
      ) : null}
      <div
        ref={containerRef}
        className="h-[min(68vh,680px)] min-h-[420px] w-full rounded-xl border border-slate-300 bg-slate-100"
        role="application"
        aria-label="OpenStreetMap with NLAMS spatial layers"
      />
      <p className="text-xs text-slate-500">
        Base map: © OpenStreetMap contributors. Stored project/parcel features are subject to
        backend geographic scope.         Unsaved imported/drawn features remain local to this browser; saved features use scoped PostGIS APIs.
      </p>
    </section>
  )
}

function toApiGeometry(geometry: GeoJsonGeometry): Geometry | null {
  switch (geometry.type) {
    case 'Polygon':
    case 'MultiPolygon':
    case 'LineString':
    case 'MultiLineString':
      return { type: geometry.type, coordinates: geometry.coordinates }
    default:
      return null
  }
}

function normalizeCollection<P extends object>(
  collection: FeatureCollection<P> | null,
): GeoJsonFeatureCollection<GeoJsonGeometry, P> | null {
  if (!collection) {
    return null
  }
  const features: GeoJsonFeature<GeoJsonGeometry, P>[] = []
  for (const feature of collection.features) {
    const geometry = normalizeGeometry(feature.geometry)
    if (geometry) {
      features.push({ type: 'Feature', geometry, properties: feature.properties })
    }
  }
  return { type: 'FeatureCollection', features }
}

function normalizeGeometry(geometry: {
  type: string
  coordinates: unknown
}): GeoJsonGeometry | null {
  switch (geometry.type) {
    case 'Polygon': {
      const coordinates = parseRings(geometry.coordinates)
      return coordinates ? { type: 'Polygon', coordinates } : null
    }
    case 'MultiPolygon': {
      const coordinates = parsePolygons(geometry.coordinates)
      return coordinates ? { type: 'MultiPolygon', coordinates } : null
    }
    case 'LineString': {
      const coordinates = parsePositions(geometry.coordinates)
      return coordinates ? { type: 'LineString', coordinates } : null
    }
    case 'MultiLineString': {
      const coordinates = parseRings(geometry.coordinates)
      return coordinates ? { type: 'MultiLineString', coordinates } : null
    }
    default:
      return null
  }
}

function parsePositions(value: unknown): Position[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const positions: Position[] = []
  for (const coordinate of value) {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      typeof coordinate[0] !== 'number' ||
      typeof coordinate[1] !== 'number'
    ) {
      return null
    }
    positions.push([coordinate[0], coordinate[1]])
  }
  return positions.length > 0 ? positions : null
}

function parseRings(value: unknown): Position[][] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const rings: Position[][] = []
  for (const ring of value) {
    const positions = parsePositions(ring)
    if (!positions) {
      return null
    }
    rings.push(positions)
  }
  return rings.length > 0 ? rings : null
}

function parsePolygons(value: unknown): Position[][][] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const polygons: Position[][][] = []
  for (const polygon of value) {
    const rings = parseRings(polygon)
    if (!rings) {
      return null
    }
    polygons.push(rings)
  }
  return polygons.length > 0 ? polygons : null
}

function readImportedFeatures(
  value: unknown,
): GeoJsonFeature<GeoJsonGeometry, Record<string, unknown>>[] {
  const record = asRecord(value)
  const candidates =
    record?.type === 'FeatureCollection' && Array.isArray(record.features)
      ? record.features
      : record?.type === 'Feature'
        ? [record]
        : [value]
  const features: GeoJsonFeature<GeoJsonGeometry, Record<string, unknown>>[] = []
  for (const candidate of candidates) {
    const featureRecord = asRecord(candidate)
    const geometryRecord =
      featureRecord?.type === 'Feature'
        ? asRecord(featureRecord.geometry)
        : featureRecord
    if (!geometryRecord || typeof geometryRecord.type !== 'string') {
      continue
    }
    const geometry = normalizeGeometry({
      type: geometryRecord.type,
      coordinates: geometryRecord.coordinates,
    })
    if (geometry) {
      features.push({
        type: 'Feature',
        geometry,
        properties: asRecord(featureRecord?.properties) ?? {},
      })
    }
  }
  return features
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readConnectionState(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null
  }
  const body: unknown = error.response?.data
  if (typeof body !== 'object' || body === null || !('connectionState' in body)) {
    return null
  }
  return typeof body.connectionState === 'string' ? body.connectionState : null
}

function styleFor(kind: string | undefined, projectLayer: boolean): L.PathOptions {
  if (kind === 'CORRIDOR') {
    return { color: '#b91c1c', weight: 2, fillOpacity: 0.18 }
  }
  if (kind === 'ALIGNMENT') {
    return { color: '#ea580c', weight: 4, fillOpacity: 0.8 }
  }
  return projectLayer
    ? { color: '#7c2d12', weight: 2, fillColor: '#fb923c', fillOpacity: 0.18 }
    : { color: '#047857', weight: 2, fillColor: '#34d399', fillOpacity: 0.3 }
}

function addPopup(properties: MapProps | null, layer: L.Layer) {
  if (!properties || !('bindPopup' in layer)) {
    return
  }
  const content = document.createElement('div')
  if (properties.kind === 'PARCEL') {
    content.textContent = [
      `Survey: ${properties.surveyNumber ?? properties.gatNumber ?? 'Not recorded'}`,
      `Area: ${properties.areaHa} ha`,
      properties.inCase ? 'Acquisition case parcel' : 'Land parcel',
    ].join('\n')
  } else if (properties.kind === 'ALIGNMENT') {
    content.textContent = `Project alignment · ${properties.lengthKm} km`
  } else {
    content.textContent = `Acquisition corridor · ${properties.corridorWidthM ?? '—'} m`
  }
  layer.bindPopup(content)
}

function sphericalArea(points: L.LatLng[]): number {
  const radius = 6_371_008.8
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const currentLat = (current.lat * Math.PI) / 180
    const nextLat = (next.lat * Math.PI) / 180
    const deltaLongitude = ((next.lng - current.lng) * Math.PI) / 180
    total += deltaLongitude * (2 + Math.sin(currentLat) + Math.sin(nextLat))
  }
  return Math.abs((total * radius * radius) / 2)
}
