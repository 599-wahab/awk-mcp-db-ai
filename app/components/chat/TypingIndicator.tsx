export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-50 text-gray-900 rounded-2xl rounded-bl-none px-4 py-3 max-w-[80%] border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-linear-to-r from-purple-500 to-indigo-500" />
          <span className="text-xs font-medium">AWKT-LD</span>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}