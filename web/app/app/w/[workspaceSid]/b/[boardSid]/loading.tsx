export default function BoardLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Board name + toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>
      </div>

      {/* View tab strip */}
      <div className="flex gap-1 px-6 py-2 border-b border-gray-100">
        <div className="h-7 w-20 bg-gray-200 rounded" />
        <div className="h-7 w-24 bg-gray-200 rounded" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden px-0">
        {/* Header row */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 py-2 gap-4">
          <div className="h-4 w-16 bg-gray-300 rounded" />
          <div className="h-4 w-40 bg-gray-300 rounded flex-1" />
          <div className="h-4 w-28 bg-gray-300 rounded" />
          <div className="h-4 w-24 bg-gray-300 rounded" />
          <div className="h-4 w-28 bg-gray-300 rounded" />
        </div>

        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-gray-100 px-4 py-3 gap-4"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
