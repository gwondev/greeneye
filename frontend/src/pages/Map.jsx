import { useEffect, useState } from "react";
import { Typography, Box, Paper, Stack, Chip, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getUser } from "../services/auth";
import { apiFetch } from "../services/api";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";

const Map = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.oauthId) {
      navigate("/");
      return;
    }

    loadModules();
  }, [navigate, user?.oauthId]);

  const loadModules = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiFetch("/modules");
      setModules(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("모듈 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleReady = async (serialNumber) => {
    try {
      await apiFetch(`/modules/${serialNumber}/ready`, {
        method: "POST",
        body: JSON.stringify({
          userId: user.nickname,
          selectedType: "CAN",
        }),
      });
      alert("READY 전송 완료");
      loadModules();
      navigate("/input");
    } catch (e) {
      alert("READY 전송 실패");
    }
  };

  if (!user?.oauthId) return null;

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 }, color: "#fff", bgcolor: "#030403", minHeight: "100vh" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            반가워요, <span style={{ color: "#7CFF72" }}>{user?.nickname || "사용자"}</span>님
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.72)", mt: 0.7 }}>
            주변 GREENEYE 모듈 상태를 확인하고 배출할 모듈을 선택하세요.
          </Typography>
        </Box>
        <Chip
          icon={<SensorsRoundedIcon />}
          label="상태 실시간 모니터링"
          sx={{
            color: "#7CFF72",
            border: "1px solid rgba(124,255,114,0.28)",
            backgroundColor: "rgba(124,255,114,0.08)",
          }}
        />
        {user?.role === "ADMIN" && (
          <Button
            size="small"
            onClick={() => navigate("/manage")}
            sx={{ color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)" }}
          >
            Manage
          </Button>
        )}
      </Stack>

      <Paper
        sx={{
          minHeight: "68vh",
          bgcolor: "rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #7CFF72",
          borderRadius: 3,
          gap: 1.5,
        }}
      >
        <PlaceRoundedIcon sx={{ fontSize: 38, color: "#7CFF72" }} />
        <Typography color="#7CFF72" sx={{ fontWeight: 700 }}>
          여기에 지도와 모듈 마커가 표시됩니다.
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.68)", mb: 1 }}>
          현재 등록된 모듈: {modules.length}개
        </Typography>
        <Button variant="outlined" onClick={loadModules} sx={{ mt: 0.5, color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }}>
          모듈 목록 새로고침
        </Button>
        <Button variant="contained" onClick={() => navigate("/camera")} sx={{ mt: 1, bgcolor: "#7CFF72", color: "#000" }}>
          쓰레기 촬영하기
        </Button>

        {loading && <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.7)" }}>불러오는 중...</Typography>}
        {error && <Typography sx={{ mt: 2, color: "#ff8a8a" }}>{error}</Typography>}

        {!loading && modules.length > 0 && (
          <Box sx={{ mt: 2, width: "100%", maxWidth: 720, px: 2, display: "grid", gap: 1 }}>
            {modules.map((m) => (
              <Paper key={m.id} sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,255,114,0.2)" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ color: "#fff" }}>
                    {m.serialNumber} / {m.type} / {m.status}
                  </Typography>
                  <Button size="small" onClick={() => handleReady(m.serialNumber)} sx={{ color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)" }}>
                    버리기(READY)
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Map;
