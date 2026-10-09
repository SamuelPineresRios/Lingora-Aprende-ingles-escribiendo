import { Outlet } from 'react-router-dom'
import { StudentSidebar } from '@/components/StudentSidebar'

/** Layout de las páginas de alumno (antes `app/(student)/layout.tsx`). */
export function StudentLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-full lg:w-64 fixed top-0 z-30">
        <StudentSidebar />
      </div>
      <main className="flex-1 lg:ml-64 mt-16 lg:mt-0 relative z-10 w-full overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
