import { lazy, Suspense, useEffect, useState } from "react";
import { Typography, Box, Paper, Stack, Chip, Button, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getEffectiveUser, getEffectiveNickname } from "../services/auth";
import { apiFetch } from "../services/api";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";

const MapView = lazy(() => import("./MapView.jsx"));

const HELD_KEY = "greeneye.finalWasteType";

const Map = () => {
  const navigate = useNavigate();
  const user = getEffectiveUser();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userPos, setUserPos] = useState(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [heldType, setHeldType] = useState(() => sessionStorage.getItem(HELD_KEY) || "");

  useEffect(() => {
    if (!user?.oauthId) {
      navigate("/");
      return;
    }

    let cancelled = false;
    if (!navigator.geolocation) {
      setGeoMessage("이 브라우저는 위치 정보를 지원하지 않습니다. 지도는 데모 좌표 기준으로 표시됩니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoMessage("");
      },
      () => {
        if (cancelled) return;
        setGeoMessage("위치 권한이 필요합니다. 브라우저 설정에서 위치를 허용한 뒤 새로고침 해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    return () => {
      cancelled = true;
    };
  }, [navigate, user?.oauthId]);

  useEffect(() => {
    const sync = () => setHeldType(sessionStorage.getItem(HELD_KEY) || "");
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    if (!user?.oauthId) return;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        try {
          await apiFetch("/modules/seed", { method: "POST", body: "{}" });
        } catch {
          /* 이미 시드됨 */
        }
        const data = await apiFetch("/modules");
        setModules(Array.isArray(data) ? data : []);
      } catch (e) {
        setError("모듈 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.oauthId]);

  const requestGeoAgain = () => {
    setGeoMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoMessage("");
      },
      () => setGeoMessage("위치를 가져오지 못했습니다. 권한을 허용했는지 확인해 주세요."),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const handleReady = async (serialNumber) => {
    const selected = sessionStorage.getItem(HELD_KEY) || "CAN";
    try {
      await apiFetch(`/modules/${serialNumber}/ready`, {
        method: "POST",
        body: JSON.stringify({
          userId: getEffectiveNickname() || user?.nickname || "gwon",
          selectedType: selected,
          predictedType: selected,
        }),
      });
      alert("READY 전송 완료");
      const data = await apiFetch("/modules");
      setModules(Array.isArray(data) ? data : []);
      navigate("/input");
    } catch (e) {
      alert("READY 전송 실패 (로컬은 백엔드·DB·닉네임 필요)");
    }
  };

  if (!user?.oauthId) return null;

  const showAdminNav = user?.role === "ADMIN";
  const displayName = user?.nickname || getEffectiveNickname() || "사용자";

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        color: "#fff",
        bgcolor: "#030403",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            반가워요,{" "}
            <Box component="span" sx={{ color: "#7CFF72" }}>
              {displayName}
            </Box>
            님
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.72)", mt: 0.7 }}>
            위치 권한을 허용하면 내 위치(파란 점)와 모듈(초록 점)이 지도에 표시됩니다.
          </Typography>
          {heldType && (
            <Typography sx={{ color: "#7CFF72", mt: 1, fontWeight: 700 }}>
              인식·선택 분류: {heldType} (Camera에서 확정 시 저장)
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<SensorsRoundedIcon />}
            label="실시간 모듈"
            sx={{
              color: "#7CFF72",
              border: "1px solid rgba(124,255,114,0.28)",
              backgroundColor: "rgba(124,255,114,0.08)",
            }}
          />
          {showAdminNav && (
            <>
              <Button
                size="small"
                startIcon={<AdminPanelSettingsRoundedIcon />}
                onClick={() => navigate("/manage")}
                sx={{ color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)" }}
              >
                Manage
              </Button>
              <Button
                size="small"
                startIcon={<StorageRoundedIcon />}
                onClick={() => navigate("/db")}
                sx={{ color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)" }}
              >
                DB
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {geoMessage && (
        <Alert
          severity="warning"
          sx={{ mb: 2, bgcolor: "rgba(255,193,7,0.12)", color: "#fff", border: "1px solid rgba(255,193,7,0.35)" }}
          action={
            <Button color="inherit" size="small" onClick={requestGeoAgain}>
              다시 요청
            </Button>
          }
        >
          {geoMessage}
        </Alert>
      )}

      <Paper
        sx={{
          flex: 1,
          minHeight: { xs: 320, md: 380 },
          height: { xs: "48vh", md: "52vh" },
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(124,255,114,0.25)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          bgcolor: "#0a0f0a",
        }}
      >
        <Suspense
          fallback={
            <Box sx={{ height: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
              지도 로딩…
            </Box>
          }
        >
          <MapView userPos={userPos} modules={modules} onReady={handleReady} />
        </Suspense>
      </Paper>

      <Box
        sx={{
          mt: "auto",
          pt: 3,
          pb: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Button
          variant="contained"
          size="large"
          startIcon={<PhotoCameraRoundedIcon sx={{ fontSize: 28 }} />}
          onClick={() => navigate("/camera")}
          sx={{
            px: { xs: 4, sm: 6 },
            py: 2,
            minWidth: { xs: 280, sm: 320 },
            borderRadius: 999,
            fontSize: "1.15rem",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: "#0a0f0a",
            bgcolor: "#7CFF72",
            boxShadow: "0 10px 40px rgba(124,255,114,0.35), 0 0 0 1px rgba(124,255,114,0.45)",
            textTransform: "none",
            "&:hover": {
              bgcolor: "#9dff92",
              boxShadow: "0 14px 48px rgba(124,255,114,0.45)",
            },
          }}
        >
          쓰레기 촬영
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => window.location.reload()}
          sx={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}
        >
          위치·모듈 새로고침
        </Button>
        {loading && (
          <Typography sx={{ color: "rgba(255,255,255,0.65)" }} variant="body2">
            불러오는 중…
          </Typography>
        )}
        {error && (
          <Typography sx={{ color: "#ff8a8a" }} variant="body2">
            {error}
          </Typography>
        )}
      </Box>

      {!loading && modules.length > 0 && (
        <Box sx={{ mt: 2, display: "grid", gap: 1, maxWidth: 900 }}>
          {modules.map((m) => (
            <Paper key={m.id} sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,255,114,0.2)" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography sx={{ color: "#fff" }}>
                  {m.serialNumber} · {m.type} · {m.status} · ({m.lat?.toFixed?.(5) ?? "-"}, {m.lon?.toFixed?.(5) ?? "-"})
                </Typography>
                <Button size="small" onClick={() => handleReady(m.serialNumber)} sx={{ color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)" }}>
                  READY
                </Button>
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default Map;
