import { Navigate, Route, Routes } from 'react-router-dom'
import { ModuleTransitionLayer } from '@/components/layout/ModuleTransitionLayer'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RouteTracker } from '@/components/layout/RouteTracker'
import { StudentLayout } from '@/components/layout/StudentLayout'
import AssignMission from '@/pages/teacher/AssignMission'
import Feedback from '@/pages/missions/Feedback'
import GroupCreate from '@/pages/teacher/GroupCreate'
import GroupDetail from '@/pages/teacher/GroupDetail'
import JoinGroup from '@/pages/social/JoinGroup'
import Login from '@/pages/auth/Login'
import MissionPage from '@/pages/missions/MissionPage'
import Missions from '@/pages/missions/Missions'
import Profile from '@/pages/profile/Profile'
import Ranking from '@/pages/social/Ranking'
import Friends from '@/pages/social/Friends'
import Album from '@/pages/learning/Album'
import Paths from '@/pages/learning/Paths'
import Mistakes from '@/pages/learning/Mistakes'
import Season from '@/pages/profile/Season'
import Store from '@/pages/profile/Store'
import Avatar from '@/pages/profile/Avatar'
import SessionSummary from '@/pages/missions/SessionSummary'
import Signup from '@/pages/auth/Signup'
import Words from '@/pages/learning/Words'
import StudentGroups from '@/pages/social/StudentGroups'
import TeacherDashboardPage from '@/pages/teacher/TeacherDashboardPage'


export function App() {
  return (
    <>
      <RouteTracker />

      <Routes>
        <Route path="/" element={<Navigate to="/missions" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<StudentLayout />}>
            <Route element={<ProtectedRoute accountOnly />}>
              <Route path="/join-group" element={<JoinGroup />} />
              <Route path="/groups" element={<StudentGroups />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/friends" element={<Friends />} />
            </Route>
            <Route path="/missions" element={<Missions />} />
            <Route path="/mission/:id" element={<MissionPage />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/session-summary" element={<SessionSummary />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/words" element={<Words />} />
            <Route path="/album" element={<Album />} />
            <Route path="/paths" element={<Paths />} />
            <Route path="/mistakes" element={<Mistakes />} />
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
