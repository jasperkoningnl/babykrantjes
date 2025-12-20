// components/VersionFooter.tsx
import { APP_VERSION, APP_VERSION_FULL } from '@/lib/version'

export default function VersionFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 py-2 text-center">
      <p className="text-xs text-gray-400" title={APP_VERSION_FULL}>
        {APP_VERSION}
      </p>
    </footer>
  )
}
