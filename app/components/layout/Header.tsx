export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60">
      <div className="container mx-auto px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-purple-600 to-indigo-600 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AWKT-LD Database AI</h1>
            <p className="text-sm text-gray-600">Universal Database Analysis Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm">
            <span className="px-3 py-1 bg-linear-to-r from-green-100 to-emerald-100 text-green-800 rounded-full text-xs font-medium border border-green-200">
              Database Connected
            </span>
            <div className="w-8 h-8 bg-linear-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center border">
              <span className="text-purple-700 font-bold text-sm">AW</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}