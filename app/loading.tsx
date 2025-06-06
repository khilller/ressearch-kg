// app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading Knowledge Graph Builder...</h2>
          <p className="text-gray-500 mt-2">Initializing application</p>
        </div>
      </div>
    </div>
  )
}