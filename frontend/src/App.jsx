import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import Root from "./pages/Root";
import Manage from "./pages/Manage";
import DB from "./pages/DB";
import Nickname from "./pages/Nickname";
import Map from "./pages/Map";
import MapGuide from "./pages/MapGuide";
import Camera from "./pages/Camera";
import Input from "./pages/Input";
import SmartDisposal from "./pages/features/SmartDisposal";
import IotIntegration from "./pages/features/IotIntegration";
import Reward from "./pages/features/Reward";
import OperationsHub from "./pages/features/OperationsHub";
import Mosquitto from "./pages/Mosquitto";

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <BrowserRouter>
        <Routes>
          {/* 시작 및 계정 설정 */}
          <Route path="/" element={<Root />} />
          <Route path="/nickname" element={<Nickname />} />

          {/* 메인 서비스 (지도) */}
          <Route path="/map" element={<Map />} />
          <Route path="/map/guide" element={<MapGuide />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/input" element={<Input />} />

          {/* 관리자 전용 페이지 */}
          <Route path="/db" element={<DB />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/mosquitto" element={<Mosquitto />} />

          {/* 개별 기능 페이지 */}
          <Route path="/features/smart-disposal" element={<SmartDisposal />} />
          <Route path="/features/iot" element={<IotIntegration />} />
          <Route path="/features/reward" element={<Reward />} />
          <Route path="/features/operations" element={<OperationsHub />} />
          <Route path="/features/recognition" element={<Navigate to="/features/smart-disposal" replace />} />
          <Route path="/features/guide" element={<Navigate to="/features/smart-disposal" replace />} />
          <Route path="/features/control" element={<Navigate to="/features/operations" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;