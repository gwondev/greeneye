import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import Root from "./pages/Root";
import Manage from "./pages/Manage";
import Nickname from "./pages/Nickname";
import Map from "./pages/Map";
import Camera from "./pages/Camera";
import Input from "./pages/Input";
import Recognition from "./pages/features/Recognition";
import Reward from "./pages/features/Reward";
import Control from "./pages/features/Control";
import Guide from "./pages/features/Guide";

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
          <Route path="/camera" element={<Camera />} />
          <Route path="/input" element={<Input />} />

          {/* 관리자 전용 페이지 */}
          <Route path="/db" element={<Manage />} />
          <Route path="/manage" element={<Manage />} />

          {/* 개별 기능 페이지 */}
          <Route path="/features/recognition" element={<Recognition />} />
          <Route path="/features/guide" element={<Guide />} />
          <Route path="/features/reward" element={<Reward />} />
          <Route path="/features/control" element={<Control />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;