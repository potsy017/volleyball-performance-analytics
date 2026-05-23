export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{children}</div>}
    </div>
  )
}
