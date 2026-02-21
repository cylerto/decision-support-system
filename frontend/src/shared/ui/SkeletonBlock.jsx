export default function SkeletonBlock({ rows = 4 }) {
  return (
    <div className="skeleton">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="skeleton-line" />
      ))}
    </div>
  )
}
