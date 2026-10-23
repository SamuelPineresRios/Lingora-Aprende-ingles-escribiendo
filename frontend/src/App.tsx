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
import Friends from '@/pages/Friends'
import Album from '@/pages/Album'
import Paths from '@/pages/Paths'
import Mistakes from '@/pages/Mistakes'
import Season from '@/pages/Season'
import Store from '@/pages/Store'
import Avatar from '@/pages/Avatar'
import SessionSummary from '@/pages/SessionSummary'
import Signup from '@/pages/Signup'
import Words from '@/pages/Words'
import StudentGroups from '@/pages/StudentGroups'
import TeacherDashboardPage from '@/pages/TeacherDashboardPage'


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
            <Route path="/album" element={<Album />} />
            <Route path="/paths" element={<Paths />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/season" element={<Season />} />
            <Route path="/store" element={<Store />} />
          <Route path="/avatar" element={<Avatar />} />
          </Route>

          <Route element={<ProtectedRoute teacherOnly />}>
            <Route path="/dashboard" element={<TeacherDashboardPage />} />
            <Route path="/group/create" element={<GroupCreate />} />
            <Route path="/group/:id" element={<GroupDetail />} />
            <Route path="/group/:id/assign-mission" element={<AssignMission />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/missions" replace />} />
      </Routes>

      <ModuleTransitionLayer />
    </>
  )
}
