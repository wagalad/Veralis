// Full-screen app loader, shown while the auth session resolves on boot.
// Styles + keyframes live in index.css (.vl-loading*); an identical pre-mount
// version is inlined in index.html (#vl-boot) so there's no jump when React
// takes over. Kept intentionally understated — a breathing mark over a slim
// accent bar — and reduced-motion-aware.
export default function LoadingScreen() {
  return (
    <div className="vl-loading" role="status" aria-label="Loading Veralis">
      <img
        className="vl-loading__mark"
        src="/logo-mark.png"
        alt=""
        width="64"
        height="48"
        decoding="async"
      />
      <div className="vl-loading__track">
        <div className="vl-loading__bar" />
      </div>
    </div>
  )
}
