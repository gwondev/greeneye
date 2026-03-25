import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootPage from "./pages/RootPage";
import DBPage from "./pages/DBPage";
import Recognition from "./pages/features/Recognition";
import Reward from "./pages/features/Reward";
import Control from "./pages/features/Control";
import Guide from "./pages/features/Guide";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/db" element={<DBPage />} />

        <Route path="/features/recognition" element={<Recognition />} />
        <Route path="/features/guide" element={<Guide />} />
        <Route path="/features/reward" element={<Reward />} />
        <Route path="/features/control" element={<Control />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;