import { Navigate, Route, Routes } from 'react-router-dom'
import { ModuleTransitionLayer } from '@/components/ModuleTransitionLayer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RouteTracker } from '@/components/RouteTracker'
import { StudentLayout } from '@/components/StudentLayout'
import AssignMission from '@/pages/AssignMission'
import Feedback from '@/pages/Feedback'
import GroupCreate from '@/pages/GroupCreate'
import GroupDetail from '@/pages/GroupDetail'
import JoinGroup from '@/pages/JoinGroup'
import Login from '@/pages/Login'
import MissionPage from '@/pages/MissionPage'
import Missions from '@/pages/Missions'
import Profile from '@/pages/Profile'
import Ranking from '@/pages/Ranking'
import Season from '@/pages/Season'
import Store from '@/pages/Store'
import SessionSummary from '@/pages/SessionSummary'
import Signup from '@/pages/Signup'
import Words from '@/pages/Words'
import StudentGroups from '@/pages/StudentGroups'
import TeacherDashboardPage from '@/pages/TeacherDashboardPage'

/**
 * Tabla de rutas del SPA.
 *
 * Sustituye a `middleware.ts`: las páginas dejan de redirigirse en el servidor
 * y la protección pasa a `<ProtectedRoute>`, que espera a resolver la sesión
 * antes de decidir. La API sigue protegida en el backend.
 */
export function App() {
  return (
    <>
      <RouteTracker />

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<StudentLayout />}>
            <Route path="/missions" element={<Missions />} />
            <Route path="/mission/:id" element={<MissionPage />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/session-summary" element={<SessionSummary />} />
            <Route path="/join-group" element={<JoinGroup />} />
            <Route path="/groups" element={<StudentGroups />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/words" element={<Words />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/season" element={<Season />} />
            <Route path="/store" element={<Store />} />
          </Route>

          <Route element={<ProtectedRoute teacherOnly />}>
            <Route path="/dashboard" element={<TeacherDashboardPage />} />
            <Route path="/group/create" element={<GroupCreate />} />
            <Route path="/group/:id" element={<GroupDetail />} />
            <Route path="/group/:id/assign-mission" element={<AssignMission />} />
          </Route>
        </Route>

        {/*
          Ruta desconocida -> /missions, no /login. Mandarla a /login creaba un
          bucle: RouteTracker guardaba la ruta muerta como "última ruta", y el
          login devolvía al usuario allí una y otra vez (pantalla en blanco).
        */}
        <Route path="*" element={<Navigate to="/missions" replace />} />
      </Routes>

      <ModuleTransitionLayer />
    </>
  )
}
