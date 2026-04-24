const shimmerStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '4px'
};

const style = document.createElement('style');
style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
if (!document.querySelector('[data-skeleton-style]')) {
  style.setAttribute('data-skeleton-style', '');
  document.head.appendChild(style);
}

export const TableSkeleton = ({ rows = 5, cols = 6 }) => (
  <table className="table">
    <thead>
      <tr>
        {Array.from({ length: cols }).map((_, i) => (
          <th key={i}><div style={{ ...shimmerStyle, height: '16px', width: '80%' }} /></th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><div style={{ ...shimmerStyle, height: '14px', width: `${60 + Math.random() * 30}%` }} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export const CardSkeleton = ({ count = 4 }) => (
  <div className="grid-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card" style={{ padding: '24px' }}>
        <div style={{ ...shimmerStyle, height: '14px', width: '60%', marginBottom: '12px' }} />
        <div style={{ ...shimmerStyle, height: '32px', width: '40%', marginBottom: '8px' }} />
        <div style={{ ...shimmerStyle, height: '12px', width: '50%' }} />
      </div>
    ))}
  </div>
);

export default TableSkeleton;
