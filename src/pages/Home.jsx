export default function Home() {
  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 4px' }}>
          VRC ORBIT
        </p>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', lineHeight: 1.2 }}>
          Next Matches
        </h1>
      </div>

      {/* Placeholder: no event selected */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '32px 20px',
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 16px', fontSize: '15px' }}>
          No event selected
        </p>
        <button style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          minHeight: '48px',
        }}>
          Select Event
        </button>
      </div>
    </div>
  )
}
