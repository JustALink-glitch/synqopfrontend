import '@/lib/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { AuthProvider } from '@/auth/AuthProvider'
import '@/styles/index.css'
import { ApiError } from '@/lib/api'
import { registerServiceWorker } from '@/lib/push'

registerServiceWorker()

const queryClient = new QueryClient({
  // Offline (X1.04), saves fail straight away with a connection message instead of waiting silently.
  defaultOptions: {
    // Retry once on network or server errors; never on 4xx (a 429 or 403 won't fix itself by retrying).
    queries: { refetchOnWindowFocus: false, retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500) },
    mutations: { networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
