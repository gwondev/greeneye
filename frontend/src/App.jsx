import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import Root from "./pages/Root";
import Manage from "./pages/Manage";
import DB from "./pages/DB";
import Nickname from "./pages/Nickname";
import Map from "./pages/Map";
import MapGuide from "./pages/MapGuide";
import RecyclingGuide from "./pages/RecyclingGuide";
import OverviewPage from "./pages/OverviewPage";
import Camera from "./pages/Camera";
import Input from "./pages/Input";
import SmartDisposal from "./pages/features/SmartDisposal";
import IotIntegration from "./pages/features/IotIntegration";
import Reward from "./pages/features/Reward";
import OperationsHub from "./pages/features/OperationsHub";
import Mosquitto from "./pages/Mosquitto";
import RewardMarket from "./pages/RewardMarket";
import Test from "./pages/Test";
import TeamIntro from "./pages/TeamIntro";
import ProjectIntro from "./pages/ProjectIntro";
import { isAuthenticated, ensureSession } from "./services/auth";

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#030403",
      paper: "rgba(255,255,255,0.06)",
    },
    primary: { main: "#7CFF72" },
    text: { primary: "#fff", secondary: "rgba(255,255,255,0.7)" },
  },
});

function ProtectedRoute({ children, adminOnly = false }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isAuthenticated()) {
        if (!cancelled) navigate("/", { replace: true });
        return;
      }

      const result = await ensureSession();
      if (cancelled) return;

      if (result.status === "unauthenticated" || result.status === "deleted") {
        navigate("/", { replace: true });
        return;
      }
      if (result.status === "needs_nickname") {
        navigate("/nickname", { replace: true });
        return;
      }
      if (adminOnly && result.user?.role !== "ADMIN") {
        navigate("/map", { replace: true });
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, adminOnly]);

  if (!ready) return null;
  return children;
}

function App() {

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <BrowserRouter>
        <Routes>
          {/* 시작 및 계정 설정 */}
          <Route path="/" element={<Root />} />
          <Route path="/nickname" element={<Nickname />} />
          <Route path="/test" element={<Test />} />
          <Route path="/intro/team" element={<ProtectedRoute><TeamIntro /></ProtectedRoute>} />
          <Route path="/intro/project" element={<ProtectedRoute><ProjectIntro /></ProtectedRoute>} />

          {/* 메인 서비스 (지도) */}
          <Route path="/map" element={<ProtectedRoute><Map /></ProtectedRoute>} />
          <Route path="/map/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/map/guide" element={<ProtectedRoute><MapGuide /></ProtectedRoute>} />
          <Route path="/map/recycling-guide" element={<ProtectedRoute><RecyclingGuide /></ProtectedRoute>} />
          <Route path="/camera" element={<ProtectedRoute><Camera /></ProtectedRoute>} />
          <Route path="/input" element={<ProtectedRoute><Input /></ProtectedRoute>} />
          <Route path="/reward_market" element={<ProtectedRoute><RewardMarket /></ProtectedRoute>} />

          {/* 관리자 전용 페이지 */}
          <Route path="/db" element={<ProtectedRoute adminOnly><DB /></ProtectedRoute>} />
          <Route path="/manage" element={<ProtectedRoute adminOnly><Manage /></ProtectedRoute>} />
          <Route path="/mosquitto" element={<ProtectedRoute adminOnly><Mosquitto /></ProtectedRoute>} />

          {/* 개별 기능 페이지 */}
          <Route path="/features/smart-disposal" element={<ProtectedRoute><SmartDisposal /></ProtectedRoute>} />
          <Route path="/features/iot" element={<ProtectedRoute><IotIntegration /></ProtectedRoute>} />
          <Route path="/features/reward" element={<ProtectedRoute><Reward /></ProtectedRoute>} />
          <Route path="/features/operations" element={<ProtectedRoute><OperationsHub /></ProtectedRoute>} />
          <Route path="/features/recognition" element={<Navigate to="/features/smart-disposal" replace />} />
          <Route path="/features/guide" element={<Navigate to="/features/smart-disposal" replace />} />
          <Route path="/features/control" element={<Navigate to="/features/operations" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;