export default function OptionGroup({ options, value, onChange }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      gap: '8px',
    }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? null : opt.value)}
            style={{
              minHeight: '52px',
              padding: '10px 6px',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '10px',
              background: active ? 'rgba(204,0,0,0.13)' : 'var(--surface-2)',
              color: active ? 'var(--accent)' : 'var(--text)',
              fontSize: '14px',
              fontWeight: active ? '700' : '400',
              lineHeight: '1.2',
              cursor: 'pointer',
              transition: 'border-color 0.1s, background 0.1s, color 0.1s',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
