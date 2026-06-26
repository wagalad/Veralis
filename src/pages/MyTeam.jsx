export default function MyTeam() {
  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 4px' }}>
          MY TEAM
        </p>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', lineHeight: 1.2 }}>
          Team Pool
        </h1>
      </div>

      {/* Placeholder: not signed in */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '32px 20px',
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 16px', fontSize: '15px' }}>
          Sign in to join your team's scouting pool
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
          width: '100%',
          marginBottom: '12px',
        }}>
          Sign In
        </button>
        <button style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 24px',
          fontSize: '15px',
          fontWeight: '500',
          cursor: 'pointer',
          minHeight: '48px',
          width: '100%',
        }}>
          Create Account
        </button>
      </div>
    </div>
  )
}
