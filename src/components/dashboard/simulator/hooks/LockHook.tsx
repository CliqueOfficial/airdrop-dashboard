export default function LockHook() {
  return (
    <article class="bg-white rounded-lg border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow p-5">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <svg
            class="w-6 h-6 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Lock Hook</h3>
          <p class="text-xs text-gray-500">Token locking mechanism</p>
        </div>
      </div>

      <div class="bg-purple-50 rounded-lg p-4 border border-purple-100">
        <p class="text-sm text-gray-600 text-center">Configuration options coming soon</p>
      </div>
    </article>
  );
}
