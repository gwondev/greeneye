import { lazy, Suspense, useEffect, useState, useMemo, useRef } from "react";
import { moduleTypeMatchesHeld } from "../constants/wasteLabels";
import { Typography, Box, Paper, Stack, Button, Alert, Snackbar } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser } from "../services/auth";
import { apiFetch } from "../services/api";
import { keyframes } from "@emotion/react";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";

const MapView = lazy(() => import("./MapView.jsx"));

const HELD_KEY = "greeneye.finalWasteType";
const PENDING_REWARD_KEY = "greeneye.pendingReward";
const HELD_TYPE_LABELS = {
  CAN: "캔",
  PET: "페트병",
  GENERAL: "일반쓰레기",
  HAZARD: "유해폐기물",
};
const ctaPulse = keyframes`
  0%, 100% { transform: translateY(0); box-shadow: 0 10px 34px rgba(124,255,114,0.34), 0 0 0 1px rgba(124,255,114,0.42); }
  50% { transform: translateY(-2px); box-shadow: 0 16px 48px rgba(124,255,114,0.48), 0 0 0 1px rgba(124,255,114,0.55); }
`;
const ctaShine = keyframes`
  0% { transform: translateX(-120%); opacity: 0; }
  20% { opacity: 0.35; }
  100% { transform: translateX(220%); opacity: 0; }
`;
/** 리워드 전면 네온 */
const neonVeil = keyframes`
  0% { opacity: 0; }
  10% { opacity: 1; }
  100% { opacity: 0; }
`;
const neonRing = keyframes`
  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.55; }
  100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
`;
const neonTitle = keyframes`
  0% { opacity: 0; transform: scale(0.88); filter: blur(8px); }
  18% { opacity: 1; transform: scale(1); filter: blur(0); }
  72% { opacity: 1; transform: scale(1); filter: blur(0); }
  100% { opacity: 0; transform: scale(1.04); filter: blur(4px); }
`;
const neonAmount = keyframes`
  0% { opacity: 0; transform: scale(0.75); }
  14% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.08); }
`;

const Map = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userPos, setUserPos] = useState(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [heldType, setHeldType] = useState(() => sessionStorage.getItem(HELD_KEY) || "");
  const [myRewards, setMyRewards] = useState(() => Number(user?.nowRewards ?? 0));
  const [rewardBurst, setRewardBurst] = useState(false);
  const [rewardDelta, setRewardDelta] = useState(0);
  const [rewardToast, setRewardToast] = useState("");
  const [centerTrigger, setCenterTrigger] = useState(1);
  const rewardReadyRef = useRef(false);
  const rewardEffectDedupeRef = useRef({ t: 0, delta: 0 });
  const isLocalNoEnv = import.meta.env.DEV && !String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

  const fireRewardEffect = (delta) => {
    const raw = Math.floor(Number(delta || 0));
    const amount = raw === 1 || raw === 10 ? raw : 0;
    if (amount <= 0) return;
    const now = Date.now();
    const d = rewardEffectDedupeRef.current;
    if (d.delta === amount && now - d.t < 3000) return;
    rewardEffectDedupeRef.current = { t: now, delta: amount };
    setRewardDelta(amount);
    setRewardToast(`리워드 +${amount} 획득!`);
    setRewardBurst(true);
    setTimeout(() => setRewardBurst(false), 2600);
  };

  useEffect(() => {
    if (!user?.oauthId) {
      navigate("/");
      return;
    }

    if (!navigator.geolocation) {
      setGeoMessage("이 브라우저는 위치 정보를 지원하지 않습니다. 지도는 데모 좌표 기준으로 표시됩니다.");
      return;
    }

    const pullPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPos([pos.coords.latitude, pos.coords.longitude]);
          setGeoMessage("");
        },
        () => {
          setGeoMessage("위치 권한이 필요합니다. 브라우저 설정에서 위치를 허용한 뒤 새로고침 해 주세요.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    };

    // 첫 진입 시 즉시 1회 + 1초마다 위치 갱신
    pullPosition();
    const ticker = window.setInterval(pullPosition, 1000);

    return () => {
      window.clearInterval(ticker);
    };
  }, [navigate, user?.oauthId]);

  useEffect(() => {
    if (location.state?.focusMyLocation) {
      setCenterTrigger((prev) => prev + 1);
      navigate("/map", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const pending = Number(sessionStorage.getItem(PENDING_REWARD_KEY) || 0);
    if (pending > 0) {
      fireRewardEffect(pending);
      sessionStorage.removeItem(PENDING_REWARD_KEY);
    }
  }, []);

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
        const [data, users] = await Promise.all([apiFetch("/modules"), apiFetch("/users")]);
        setModules(Array.isArray(data) ? data : []);
        if (Array.isArray(users)) {
          const nick = user?.nickname;
          const me = users.find((u) => u?.nickname === nick);
          const nextRewards = Number(me?.nowRewards ?? 0);
          setMyRewards((prev) => {
            const prevN = Number(prev) || 0;
            const nextN = Number(nextRewards) || 0;
            if (!rewardReadyRef.current) {
              rewardReadyRef.current = true;
              if (nextN > prevN) {
                fireRewardEffect(nextN - prevN);
              }
              return nextN;
            }
            if (nextN > prevN) {
              fireRewardEffect(nextN - prevN);
            }
            return nextN;
          });
        }
        try {
          const claim = await apiFetch("/users/claim-map-entry-reward", {
            method: "POST",
            body: JSON.stringify({ oauthId: user?.oauthId }),
          });
          if (claim?.reward === 1) {
            fireRewardEffect(1);
          }
          if (typeof claim?.nowRewards === "number") {
            setMyRewards(Number(claim.nowRewards));
          }
        } catch {
          /* 맵 진입 1회 리워드는 부가 기능 */
        }
      } catch (e) {
        setError("모듈 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    run();

    // IoT 상태(DEFAULT/READY/CHECK/FULL)가 백엔드 DB에 반영되면 맵이 자동 반영되도록 주기 갱신
    const t = setInterval(async () => {
      try {
        const [data, users] = await Promise.all([apiFetch("/modules"), apiFetch("/users")]);
        setModules(Array.isArray(data) ? data : []);
        if (Array.isArray(users)) {
          const nick = user?.nickname;
          const me = users.find((u) => u?.nickname === nick);
          const nextRewards = Number(me?.nowRewards ?? 0);
          setMyRewards((prev) => {
            const prevN = Number(prev) || 0;
            const nextN = Number(nextRewards) || 0;
            if (!rewardReadyRef.current) {
              rewardReadyRef.current = true;
              if (nextN > prevN) {
                fireRewardEffect(nextN - prevN);
              }
              return nextN;
            }
            if (nextN > prevN) {
              fireRewardEffect(nextN - prevN);
            }
            return nextN;
          });
        }
      } catch {
        // polling 에러는 일시적일 수 있어 사용자 알림을 매번 띄우지 않는다
      }
    }, 3000);

    return () => clearInterval(t);
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

  const focusMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setCenterTrigger((prev) => prev + 1);
        setGeoMessage("");
      },
      () => setGeoMessage("현재 위치를 가져오지 못했습니다. 권한을 확인해 주세요."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleReady = async (serialNumber) => {
    const h = (heldType || sessionStorage.getItem(HELD_KEY) || "").trim().toUpperCase();
    if (!h) {
      alert("먼저 쓰레기를 촬영해 주세요.");
      return;
    }
    const mod = modules.find((x) => x.serialNumber === serialNumber);
    if (mod && !moduleTypeMatchesHeld(mod.type, h)) {
      alert(`Camera에서 선택한 분류(${h})와 같은 유형의 쓰레기통만 사용할 수 있습니다.`);
      return;
    }
    const selected = sessionStorage.getItem(HELD_KEY);
    if (!selected || !String(selected).trim()) {
      alert("먼저 쓰레기를 촬영해 주세요.");
      return;
    }
    const target = modules.find((x) => x.serialNumber === serialNumber);
    if (target && String(target.status || "").toUpperCase() === "FULL") {
      alert("해당 모듈은 FULL 상태라 선택할 수 없습니다.");
      return;
    }
    try {
      await apiFetch(`/modules/${serialNumber}/ready`, {
        method: "POST",
        body: JSON.stringify({
          userId: user?.nickname,
          selectedType: selected,
          predictedType: selected,
        }),
      });
      // 모듈 선택 후 들고 있던 쓰레기 분류는 소진된 것으로 간주하고 초기화
      sessionStorage.removeItem(HELD_KEY);
      setHeldType("");
      const data = await apiFetch("/modules");
      setModules(Array.isArray(data) ? data : []);
      navigate("/input", {
        replace: true,
        state: {
          serialNumber,
          rewardsBaseline: Number(myRewards) || 0,
        },
      });
    } catch (e) {
      alert("투입 요청에 실패했습니다. 네트워크·로그인·닉네임을 확인해 주세요.");
    }
  };

  if (!user?.oauthId) return null;

  const showAdminNav = user?.role === "ADMIN";
  const displayName = user?.nickname || "사용자";

  const modulesForMap = useMemo(() => {
    if (isLocalNoEnv) return modules;
    const h = (heldType || "").trim().toUpperCase();
    if (!h) return modules;
    return modules.filter((m) => moduleTypeMatchesHeld(m.type, h));
  }, [modules, heldType, isLocalNoEnv]);

  const heldTypeSummary = useMemo(() => {
    const key = (heldType || "").trim().toUpperCase();
    if (!key) return "";
    const label = HELD_TYPE_LABELS[key] || key;
    return `${label} (${key})`;
  }, [heldType]);

  const hasHeldWaste = Boolean((heldType || sessionStorage.getItem(HELD_KEY) || "").trim());
  return (
    <>
      {rewardBurst && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 20000,
            pointerEvents: "none",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            animation: `${neonVeil} 2.5s ease-out forwards`,
            bgcolor: "rgba(3,4,3,0.55)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(140vw, 140vh)",
              height: "min(140vw, 140vh)",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(124,255,114,0.35) 0%, rgba(124,255,114,0.08) 38%, transparent 62%)",
              filter: "blur(2px)",
              animation: `${neonRing} 2.2s ease-out forwards`,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(110vw, 110vh)",
              height: "min(110vw, 110vh)",
              borderRadius: "50%",
              border: "2px solid rgba(124,255,114,0.55)",
              boxShadow: "0 0 80px rgba(124,255,114,0.35), inset 0 0 60px rgba(124,255,114,0.12)",
              animation: `${neonRing} 1.95s ease-out 0.08s forwards`,
            }}
          />
          <Box
            sx={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              px: 2,
              maxWidth: "96vw",
              animation: `${neonTitle} 2.45s ease-out forwards`,
            }}
          >
            <Typography
              component="div"
              sx={{
                fontWeight: 900,
                fontSize: { xs: "clamp(2.8rem, 14vw, 5.5rem)", sm: "clamp(3.2rem, 11vw, 6.2rem)" },
                letterSpacing: { xs: "0.28em", sm: "0.34em" },
                color: "#7CFF72",
                textTransform: "uppercase",
                lineHeight: 1.05,
                textShadow:
                  "0 0 20px rgba(124,255,114,0.95), 0 0 60px rgba(124,255,114,0.55), 0 0 120px rgba(124,255,114,0.35)",
              }}
            >
              REWARD
            </Typography>
            <Stack
              direction="row"
              justifyContent="center"
              alignItems="baseline"
              spacing={{ xs: 3, sm: 5 }}
              sx={{ mt: { xs: 2.5, sm: 3 }, animation: `${neonAmount} 2.35s ease-out 0.12s forwards` }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "clamp(2.4rem, 12vw, 4.5rem)", sm: "clamp(2.8rem, 9vw, 5rem)" },
                  color: rewardDelta === 1 ? "#e8ffe8" : "rgba(124,255,114,0.28)",
                  textShadow: rewardDelta === 1 ? "0 0 28px rgba(124,255,114,0.9), 0 0 70px rgba(124,255,114,0.45)" : "none",
                  lineHeight: 1,
                }}
              >
                +1
              </Typography>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "clamp(2.4rem, 12vw, 4.5rem)", sm: "clamp(2.8rem, 9vw, 5rem)" },
                  color: rewardDelta === 10 ? "#e8ffe8" : "rgba(124,255,114,0.28)",
                  textShadow: rewardDelta === 10 ? "0 0 32px rgba(124,255,114,1), 0 0 90px rgba(124,255,114,0.5)" : "none",
                  lineHeight: 1,
                }}
              >
                +10
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}
    <Box
      sx={{
        position: "relative",
        height: "100dvh",
        minHeight: "100vh",
        color: "#fff",
        bgcolor: "#030403",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        p: { xs: 1.25, sm: 2, md: 2.5 },
        pb: { xs: 1, sm: 1.25 },
        boxSizing: "border-box",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ flexShrink: 0, mb: 1.1, pr: { xs: 0, sm: 0 }, pt: { xs: 0.75, sm: 0.55 } }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flexWrap: "wrap", pr: { xs: 18, sm: 30 } }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1rem", sm: "1.35rem" },
              lineHeight: 1.25,
              wordBreak: "keep-all",
            }}
          >
            반가워요, <Box component="span" sx={{ color: "#7CFF72" }}>{displayName}</Box>님
          </Typography>
        </Stack>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          position: "absolute",
          right: { xs: 8, sm: 14 },
          top: { xs: 14, sm: 18 },
          zIndex: 1410,
        }}
      >
        <Box
          sx={{
            px: { xs: 1.2, sm: 1.4 },
            py: { xs: 0.45, sm: 0.55 },
            minHeight: { xs: 34, sm: 38 },
            borderRadius: 999,
            border: "1px solid rgba(124,255,114,0.26)",
            background: "rgba(0,0,0,0.86)",
            color: "#7CFF72",
            fontWeight: 900,
            fontSize: { xs: "0.74rem", sm: "0.84rem" },
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          현재 리워드 {myRewards}
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<StorefrontRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate("/reward_market")}
          sx={{
            minHeight: { xs: 34, sm: 38 },
            borderRadius: 999,
            px: { xs: 1.2, sm: 1.35 },
            fontSize: { xs: "0.72rem", sm: "0.78rem" },
            fontWeight: 800,
            textTransform: "none",
            bgcolor: "#7CFF72",
            color: "#0a0f0a",
            "&:hover": { bgcolor: "#9dff92" },
            whiteSpace: "nowrap",
          }}
        >
          리워드마켓
        </Button>
      </Stack>
      {!isLocalNoEnv && heldType && modules.length > modulesForMap.length && (
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
          선택 분류({heldType})에 맞는 통만 표시 중입니다
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
          mt: { xs: 2.1, sm: 1.35 },
          position: "relative",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(124,255,114,0.25)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          bgcolor: "#0a0f0a",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: { xs: 6, sm: 8 },
            bottom: { xs: 6, sm: 8 },
            zIndex: 1200,
            px: { xs: 0.5, sm: 0.65 },
            py: { xs: 0.35, sm: 0.45 },
            borderRadius: 0.75,
            bgcolor: "rgba(0,0,0,0.82)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        >
          <Typography
            component="div"
            sx={{
              color: "rgba(255,255,255,0.82)",
              fontSize: { xs: "0.45rem", sm: "0.5rem" },
              lineHeight: 1.25,
              fontWeight: 600,
            }}
          >
            <Box component="span" aria-label="빨간 원" sx={{ fontSize: "0.85em" }}>
              🔴
            </Box>{" "}
            내 위치 ·{" "}
            <Box component="span" aria-label="초록 원" sx={{ fontSize: "0.85em" }}>
              🟢
            </Box>{" "}
            통
          </Typography>
        </Box>
        {heldTypeSummary && (
          <Stack
            direction="row"
            spacing={{ xs: 0.7, sm: 0.9 }}
            sx={{
              position: "absolute",
              left: { xs: 10, sm: 14 },
              top: { xs: 10, sm: 14 },
              zIndex: 1200,
              maxWidth: { xs: "60%", sm: 320 },
              alignItems: "stretch",
            }}
          >
            <Box
              sx={{
                flex: 1,
                px: { xs: 1.25, sm: 1.5 },
                py: { xs: 0.9, sm: 1.05 },
                borderRadius: 2,
                border: "1px solid rgba(124,255,114,0.36)",
                bgcolor: "rgba(4,11,4,0.76)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                minWidth: 0,
              }}
            >
              <Typography sx={{ color: "rgba(186,255,162,0.9)", fontWeight: 800, fontSize: { xs: "0.64rem", sm: "0.7rem" }, letterSpacing: "0.05em" }}>
                HOLDING
              </Typography>
              <Typography sx={{ color: "#e8ffe1", fontWeight: 900, fontSize: { xs: "0.8rem", sm: "0.9rem" }, lineHeight: 1.35, mt: 0.15 }}>
                들고있는 쓰레기: {heldTypeSummary}
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={() => {
                sessionStorage.removeItem(HELD_KEY);
                setHeldType("");
              }}
              aria-label="holding-reset"
              sx={{
                minWidth: { xs: 64, sm: 72 },
                width: { xs: 64, sm: 72 },
                height: "auto",
                borderRadius: 2,
                border: "1px solid rgba(124,255,114,0.36)",
                bgcolor: "rgba(4,11,4,0.76)",
                color: "#b8ff9e",
                backdropFilter: "blur(6px)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                fontWeight: 900,
                fontSize: { xs: "0.7rem", sm: "0.74rem" },
                lineHeight: 1.1,
                px: { xs: 0.6, sm: 0.75 },
                py: { xs: 0.9, sm: 1.05 },
                textTransform: "none",
                "&:hover": {
                  borderColor: "rgba(124,255,114,0.55)",
                  color: "#e8ffe1",
                  bgcolor: "rgba(8,18,8,0.9)",
                },
              }}
            >
              초기화
            </Button>
          </Stack>
        )}
        <Suspense
          fallback={
            <Box sx={{ height: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", minHeight: 280 }}>
              지도 로딩…
            </Box>
          }
        >
          <MapView userPos={userPos} modules={modulesForMap} onReady={handleReady} hasHeldWaste={hasHeldWaste} centerTrigger={centerTrigger} />
        </Suspense>
        <Stack
          spacing={0.45}
          sx={{
            position: "absolute",
            right: { xs: 6, sm: 8 },
            bottom: { xs: 6, sm: 8 },
            zIndex: 1200,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={focusMyLocation}
            sx={{
              px: { xs: 0.75, sm: 1 },
              py: { xs: 0.2, sm: 0.25 },
              minWidth: 0,
              minHeight: 0,
              borderRadius: 0.75,
              bgcolor: "rgba(0,0,0,0.82)",
              borderColor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.82)",
              fontSize: { xs: "0.45rem", sm: "0.5rem" },
              lineHeight: 1.25,
              fontWeight: 600,
              textTransform: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
              "&:hover": {
                borderColor: "rgba(255,84,84,0.6)",
                color: "#ffb0b0",
                bgcolor: "rgba(0,0,0,0.9)",
              },
            }}
          >
            내위치로 이동
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => window.location.reload()}
            sx={{
              px: { xs: 0.75, sm: 1 },
              py: { xs: 0.2, sm: 0.25 },
              minWidth: 0,
              minHeight: 0,
              borderRadius: 0.75,
              bgcolor: "rgba(0,0,0,0.82)",
              borderColor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.82)",
              fontSize: { xs: "0.45rem", sm: "0.5rem" },
              lineHeight: 1.25,
              fontWeight: 600,
              textTransform: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
              "&:hover": {
                borderColor: "rgba(124,255,114,0.45)",
                color: "#b8ff9e",
                bgcolor: "rgba(0,0,0,0.9)",
              },
            }}
          >
            위치·모듈 새로고침
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          flexShrink: 0,
          pt: { xs: 2.2, sm: 2 },
          pb: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 1.4, sm: 1.2 }}
          alignItems="center"
          sx={{ width: "100%", justifyContent: "center", px: { xs: 0.8, sm: 0.4 }, mt: { xs: 0.4, sm: 0.2 }, mb: { xs: 0.2, sm: 0.1 } }}
        >
          <Button
            variant="outlined"
            size="large"
            startIcon={<InfoRoundedIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />}
            onClick={() => navigate("/map/overview")}
            sx={{
              px: { xs: 2, sm: 3.2 },
              py: { xs: 1.5, sm: 1.75 },
              flex: 1,
              minWidth: 0,
              borderRadius: 999,
              fontSize: "clamp(0.72rem, 1.7vw, 1.02rem)",
              fontWeight: 900,
              minHeight: { xs: 48, sm: 56 },
              letterSpacing: "-0.02em",
              color: "rgba(240,240,240,0.95)",
              borderColor: "rgba(255,255,255,0.2)",
              bgcolor: "rgba(14,14,14,0.88)",
              backdropFilter: "blur(2px)",
              textTransform: "none",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.35)",
                bgcolor: "rgba(24,24,24,0.94)",
              },
            }}
          >
            서비스개요
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<PhotoCameraRoundedIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />}
            onClick={() => navigate("/camera")}
            sx={{
              px: { xs: 2, sm: 3.2 },
              py: { xs: 1.5, sm: 1.75 },
              flex: 1,
              minWidth: 0,
              borderRadius: 999,
              fontSize: "clamp(0.72rem, 1.7vw, 1.02rem)",
              fontWeight: 900,
              minHeight: { xs: 48, sm: 56 },
              letterSpacing: "-0.02em",
              color: "#7CFF72",
              borderColor: "rgba(124,255,114,0.45)",
              backgroundImage: "linear-gradient(120deg, rgba(124,255,114,0.1) 0%, rgba(157,255,146,0.14) 50%, rgba(124,255,114,0.1) 100%)",
              backgroundSize: "180% 100%",
              position: "relative",
              overflow: "hidden",
              animation: `${ctaPulse} 2.1s ease-in-out infinite`,
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "35%",
                background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.26), rgba(255,255,255,0))",
                transform: "translateX(-120%)",
                animation: `${ctaShine} 2.6s ease-in-out infinite`,
              },
              textTransform: "none",
              "&:hover": {
                borderColor: "rgba(124,255,114,0.65)",
                bgcolor: "rgba(124,255,114,0.12)",
                transform: "translateY(-1px) scale(1.02)",
                boxShadow: "0 18px 54px rgba(124,255,114,0.3)",
              },
            }}
          >
            쓰레기촬영
          </Button>
        </Stack>
        <Typography sx={{ fontSize: "clamp(0.58rem, 1.4vw, 0.7rem)", color: "rgba(255,255,255,0.4)", textAlign: "center", mt: 0.2 }}>
          Chousn University · 2026
        </Typography>
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.25, pb: 0.6 }}>
            <Typography sx={{ color: "rgba(124,255,114,0.85)", fontSize: { xs: "0.68rem", sm: "0.78rem" }, fontWeight: 700 }}>
              MANAGE · Smart Control Deck
            </Typography>
            <Button
              size="small"
              onClick={() => navigate("/manage")}
              aria-label="manage"
              sx={{
                color: "#7CFF72",
                border: "1px solid rgba(124,255,114,0.4)",
                minHeight: 34,
                minWidth: 34,
                px: 0.65,
                bgcolor: "rgba(0,0,0,0.25)",
              }}
            >
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18 }} />
            </Button>
          </Stack>
          {modules.map((m) => (
            <Paper key={m.id} sx={{ p: { xs: 1, sm: 1.5 }, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,255,114,0.2)" }}>
              {/** FULL 모듈은 선택 불가 */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography sx={{ color: "#fff", fontSize: { xs: "0.72rem", sm: "0.875rem" }, wordBreak: "break-all" }}>
                  {m.serialNumber} · {m.type} · {m.status} · ({m.lat?.toFixed?.(5) ?? "-"}, {m.lon?.toFixed?.(5) ?? "-"})
                </Typography>
                <Button
                  size="small"
                  disabled={String(m.status || "").toUpperCase() === "FULL" || !hasHeldWaste}
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
      <Snackbar
        open={Boolean(rewardToast)}
        autoHideDuration={2800}
        onClose={() => setRewardToast("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message={rewardToast}
      />
    </>
  );
};

export default Map;
