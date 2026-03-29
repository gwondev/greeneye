import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import { Typography, Box, Paper, Stack, Button, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getEffectiveUser, getEffectiveNickname } from "../services/auth";
import { apiFetch } from "../services/api";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";

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

    if (!navigator.geolocation) {
      setGeoMessage("이 브라우저는 위치 정보를 지원하지 않습니다. 지도는 데모 좌표 기준으로 표시됩니다.");
      return;
    }

    // 내 위치를 실시간에 가깝게 계속 갱신
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoMessage("");
      },
      () => {
        setGeoMessage("위치 권한이 필요합니다. 브라우저 설정에서 위치를 허용한 뒤 새로고침 해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
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
    const h = (heldType || sessionStorage.getItem(HELD_KEY) || "").trim().toUpperCase();
    const mod = modules.find((x) => x.serialNumber === serialNumber);
    if (h && mod && (mod.type || "GENERAL").toUpperCase() !== h) {
      alert(`Camera에서 선택한 분류(${h})와 같은 유형의 쓰레기통만 사용할 수 있습니다.`);
      return;
    }
    const selected = sessionStorage.getItem(HELD_KEY) || "CAN";
    const target = modules.find((x) => x.serialNumber === serialNumber);
    if (target && String(target.status || "").toUpperCase() === "FULL") {
      alert("해당 모듈은 FULL 상태라 선택할 수 없습니다.");
      return;
    }
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

  const modulesForMap = useMemo(() => {
    const h = (heldType || "").trim().toUpperCase();
    if (!h) return modules;
    return modules.filter((m) => (m.type || "GENERAL").toUpperCase() === h);
  }, [modules, heldType]);

  return (
    <Box
      sx={{
        height: "100dvh",
        minHeight: "100vh",
        color: "#fff",
        bgcolor: "#030403",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        p: { xs: 1.25, sm: 2, md: 2.5 },
        pb: { xs: 1, sm: 1.25 },
        boxSizing: "border-box",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        spacing={2}
        sx={{ flexShrink: 0, mb: 1.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ gap: 1.5 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "1.15rem", sm: "1.5rem" },
                lineHeight: 1.25,
                wordBreak: "keep-all",
              }}
            >
              반가워요,{" "}
              <Box component="span" sx={{ color: "#7CFF72" }}>
                {displayName}
              </Box>
              님
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MenuBookRoundedIcon sx={{ fontSize: 18 }} />}
              onClick={() => navigate("/map/guide")}
              sx={{
                color: "#7CFF72",
                borderColor: "rgba(124,255,114,0.45)",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 999,
                py: { xs: 0.75, sm: 0.6 },
                minHeight: { xs: 40, sm: 34 },
                fontSize: { xs: "0.8rem", sm: "0.875rem" },
              }}
            >
              사이트 이용방법
            </Button>
          </Stack>
          <Typography
            variant="body2"
            component="div"
            sx={{ color: "rgba(255,255,255,0.68)", mt: 1, fontSize: { xs: "0.78rem", sm: "0.875rem" }, lineHeight: 1.5 }}
          >
            내 위치{" "}
            <Box component="span" aria-label="파란 원" sx={{ display: "inline-block" }}>
              🔵
            </Box>{" "}
             모듈{" "}
            <Box component="span" aria-label="초록 원" sx={{ display: "inline-block" }}>
              🟢
            </Box>
          </Typography>
          {heldType && (
            <Typography sx={{ color: "#7CFF72", mt: 0.75, fontWeight: 700, fontSize: { xs: "0.75rem", sm: "0.875rem" }, lineHeight: 1.4 }}>
              인식·선택 분류: {heldType} (Camera에서 확정 시 저장)
            </Typography>
          )}
        </Box>
        {showAdminNav && (
          <Button
            size="small"
            fullWidth
            startIcon={<AdminPanelSettingsRoundedIcon />}
            onClick={() => navigate("/manage")}
            sx={{
              color: "#7CFF72",
              border: "1px solid rgba(124,255,114,0.4)",
              flexShrink: 0,
              alignSelf: { xs: "stretch", md: "flex-start" },
              minHeight: 42,
              maxWidth: { md: 200 },
              fontWeight: 800,
              textTransform: "none",
            }}
          >
            MANAGE
          </Button>
        )}
      </Stack>

      {heldType && modules.length > modulesForMap.length && (
        <Alert
          severity="info"
          sx={{
            mb: 1.5,
            flexShrink: 0,
            py: { xs: 0.5, sm: 1 },
            bgcolor: "rgba(124,255,114,0.1)",
            color: "#e8ffe8",
            border: "1px solid rgba(124,255,114,0.28)",
            fontSize: { xs: "0.75rem", sm: "0.875rem" },
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          선택 분류({heldType})에 맞는 통만 표시 중입니다.
        </Alert>
      )}

      {geoMessage && (
        <Alert
          severity="warning"
          sx={{
            mb: 1.5,
            flexShrink: 0,
            bgcolor: "rgba(255,193,7,0.12)",
            color: "#fff",
            border: "1px solid rgba(255,193,7,0.35)",
          }}
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
          minHeight: 0,
          position: "relative",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(124,255,114,0.25)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          bgcolor: "#0a0f0a",
        }}
      >
        <Suspense
          fallback={
            <Box sx={{ height: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", minHeight: 280 }}>
              지도 로딩…
            </Box>
          }
        >
          <MapView userPos={userPos} modules={modulesForMap} onReady={handleReady} />
        </Suspense>
      </Paper>

      <Box
        sx={{
          flexShrink: 0,
          pt: 2,
          pb: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          size="large"
          startIcon={<PhotoCameraRoundedIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />}
          onClick={() => navigate("/camera")}
          sx={{
            px: { xs: 3, sm: 6 },
            py: { xs: 1.5, sm: 1.75 },
            width: { xs: "100%", sm: "auto" },
            maxWidth: { xs: 400, sm: "none" },
            minWidth: { xs: "unset", sm: 300 },
            borderRadius: 999,
            fontSize: { xs: "0.95rem", sm: "1.05rem" },
            fontWeight: 900,
            minHeight: { xs: 48, sm: 56 },
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

      {showAdminNav && !loading && modules.length > 0 && (
        <Box
          sx={{
            flexShrink: 0,
            mt: 1,
            maxHeight: { xs: "18vh", sm: "22vh" },
            overflow: "auto",
            display: "grid",
            gap: { xs: 0.75, sm: 1 },
            maxWidth: 900,
            alignSelf: "stretch",
            mx: "auto",
            width: "100%",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {modules.map((m) => (
            <Paper key={m.id} sx={{ p: { xs: 1, sm: 1.5 }, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,255,114,0.2)" }}>
              {/** FULL 모듈은 선택 불가 */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography sx={{ color: "#fff", fontSize: { xs: "0.72rem", sm: "0.875rem" }, wordBreak: "break-all" }}>
                  {m.serialNumber} · {m.type} · {m.status} · ({m.lat?.toFixed?.(5) ?? "-"}, {m.lon?.toFixed?.(5) ?? "-"})
                </Typography>
                <Button
                  size="small"
                  disabled={String(m.status || "").toUpperCase() === "FULL"}
                  onClick={() => handleReady(m.serialNumber)}
                  sx={{ color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)", minWidth: 72, minHeight: 36 }}
                >
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
