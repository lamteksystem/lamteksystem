import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { markPackageLabelScannedByCode } from '@/lib/packageLabels'

export default function AdminPickListScan() {
  const { pickListId } = useParams<{ pickListId: string }>()
  const [manualCode, setManualCode] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  const submitCode = useCallback(
    async (raw: string) => {
      const code = raw.trim()
      if (!code || busy) return
      setBusy(true)
      setMessage(null)
      try {
        const res = await markPackageLabelScannedByCode(code)
        setMessage({ tone: 'ok', text: `Scanned ${res.package_code}` })
        setManualCode('')
      } catch (e) {
        setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Scan failed.' })
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

  useEffect(() => {
    if (!cameraOn) return
    let cancelled = false
    void (async () => {
      setCameraError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const Detector = typeof window !== 'undefined' ? window.BarcodeDetector : undefined
        if (!Detector || !videoRef.current) {
          setCameraError('Camera on — type or paste codes below (barcode API not supported in this browser).')
          return
        }
        const detector = new Detector({ formats: ['code_128', 'ean_13', 'qr_code'] })
        const tick = async () => {
          if (!videoRef.current || cancelled) return
          try {
            const codes = await detector.detect(videoRef.current)
            const value = codes[0]?.rawValue
            if (value) await submitCode(value)
          } catch {
            /* ignore frame errors */
          }
          scanLoopRef.current = window.requestAnimationFrame(() => void tick())
        }
        scanLoopRef.current = window.requestAnimationFrame(() => void tick())
      } catch (e) {
        setCameraError(e instanceof Error ? e.message : 'Could not open camera.')
        setCameraOn(false)
      }
    })()
    return () => {
      cancelled = true
      if (scanLoopRef.current != null) window.cancelAnimationFrame(scanLoopRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [cameraOn, submitCode])

  return (
    <div className="admin-page admin-pick-scan-page">
      <header className="admin-page-header">
        <h1>Warehouse scan</h1>
        <p className="admin-muted page-intro">
          Scan package labels to confirm dispatch. Works with camera on supported browsers, or enter codes manually.
        </p>
        {pickListId && (
          <Link to={`/admin/pick-lists/${pickListId}`} className="btn btn-outline btn-small">
            ← Pick list detail
          </Link>
        )}
      </header>

      <section className="card admin-card admin-pick-scan-panel">
        <div className="admin-pick-scan-camera-wrap">
          {cameraOn ? (
            <video ref={videoRef} className="admin-pick-scan-video" playsInline muted />
          ) : (
            <p className="admin-muted admin-pick-scan-placeholder">Camera off</p>
          )}
        </div>
        {cameraError && <p className="admin-muted">{cameraError}</p>}
        <div className="admin-pick-scan-actions">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setCameraOn((v) => !v)}
          >
            {cameraOn ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
        <form
          className="admin-pick-scan-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submitCode(manualCode)
          }}
        >
          <label>
            Package code
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="LAM-… or scan"
              autoComplete="off"
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn btn-outline" disabled={busy || !manualCode.trim()}>
            {busy ? 'Checking…' : 'Confirm scan'}
          </button>
        </form>
        {message && (
          <p className={message.tone === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
            {message.text}
          </p>
        )}
      </section>
    </div>
  )
}
