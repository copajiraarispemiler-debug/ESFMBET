import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import { useAuth } from "./hooks/useAuthHook"; // Import useAuth from the new file
import Dashboard from "./Dashboard";
import BetsWall from "./BetsWall";
import Profile from "./Profile";
import ChallengeView from "./ChallengeView";
import AdminPanel from "./AdminPanel";
import RulesView from "./RulesView";
import TermsView from "./TermsView";
import Notifications from "./Notifications";
import Loading from "./Loading";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router basename="/ESFMBET">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/apuestas" element={<ProtectedRoute><BetsWall /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notificaciones" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/reglas" element={<ProtectedRoute><RulesView /></ProtectedRoute>} />
        <Route path="/terminos" element={<TermsView />} />
        <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
        <Route path="/challenge/:betId" element={<ChallengeView />} />
      </Routes>
    </Router>
  );
}
export default App;
