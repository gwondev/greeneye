import { Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser } from "../services/auth";
import { apiFetch } from "../services/api";

/** Map.jsx 과 동일 — 맵 복귀 시 +10 네온 효과 */
const PENDING_REWARD_KEY = "greeneye.pendingReward";

const POLL_MS = 2000;
/** IoT READY 10s + 네트워크 여유 후 DEFAULT 이면 실패로 본다 */
const FAIL_AFTER_MS = 14000;

/**
 * 버리기(ready) 후: 쓰레기를 버려주세요 → CHECK(+10) 반영 시 성공 / 타임아웃·실패 시 실패 문구.
 */
const Input = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const serialNumber = location.state?.serialNumber;
  const baselineFromMap = Number(location.state?.rewardsBaseline);
  const user = getUser();
  const [phase, setPhase] = useState("waiting"); // waiting | success | failure
  const startedAtRef = useRef(Date.now());
  const baselineRef = useRef(Number.isFinite(baselineFromMap) ? baselineFromMap : -1);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!serialNumber || !user?.nickname) return undefined;
    if (phase !== "waiting") return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || settledRef.current) return;
      try {
        const [modules, users] = await Promise.all([apiFetch("/modules"), apiFetch("/users")]);
        if (cancelled || settledRef.current) return;
        const mod = Array.isArray(modules) ? modules.find((m) => m?.serialNumber === serialNumber) : null;
        const me = Array.isArray(users) ? users.find((u) => u?.nickname === user.nickname) : null;
        const nowRw = Number(me?.nowRewards ?? 0);
        if (baselineRef.current < 0) {
          baselineRef.current = nowRw;
        }
        const elapsed = Date.now() - startedAtRef.current;

        if (nowRw >= baselineRef.current + 10) {
          settledRef.current = true;
          setPhase("success");
          return;
        }

        const st = String(mod?.status ?? "").toUpperCase();
        if (elapsed >= FAIL_AFTER_MS && st === "DEFAULT" && nowRw < baselineRef.current + 10) {
          settledRef.current = true;
          setPhase("failure");
        }
      } catch {
        /* 다음 폴링에서 재시도 */
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [serialNumber, user?.nickname, phase]);

  const goMapWithReward10 = () => {
    sessionStorage.setItem(PENDING_REWARD_KEY, "10");
    navigate("/map", { state: { focusMyLocation: true } });
  };

  const goMapNoReward = () => {
    navigate("/map", { state: { focusMyLocation: true } });
  };

  if (!serialNumber || !user?.nickname) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center" }}>
        <Container maxWidth="sm">
          <Stack spacing={2} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              맵에서 다시 시도해 주세요
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
              투입 안내는 지도에서 쓰레기통을 선택한 뒤에만 이어집니다.
            </Typography>
            <Button variant="outlined" sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }} onClick={() => navigate("/map")}>
              Map으로 이동
            </Button>
          </Stack>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={2} alignItems="center">
          {phase === "waiting" && (
            <>
              <Typography variant="h4" sx={{ fontWeight: 800, textAlign: "center" }}>
                쓰레기를 버려주세요
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
                쓰레기통 LED가 노란색이면 투입 가능 상태입니다. 안내에 맞게 배출해 주세요.
              </Typography>
              <CircularProgress size={36} sx={{ color: "#7CFF72", my: 1 }} />
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
                배출이 확인되면 자동으로 성공 화면으로 바뀝니다.
              </Typography>
            </>
          )}

          {phase === "success" && (
            <>
              <Typography variant="h4" sx={{ fontWeight: 800, textAlign: "center", color: "#7CFF72" }}>
                분리배출 성공!
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
                리워드 +10이 반영되었습니다. 지도로 돌아가면 효과와 함께 표시됩니다.
              </Typography>
              <Button variant="contained" sx={{ mt: 1, bgcolor: "#2e7d32", "&:hover": { bgcolor: "#1b5e20" } }} onClick={goMapWithReward10}>
                Map으로 이동
              </Button>
            </>
          )}

          {phase === "failure" && (
            <>
              <Typography variant="h4" sx={{ fontWeight: 800, textAlign: "center", color: "#ff8a80" }}>
                분리배출 실패
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
                제한 시간 안에 배출이 확인되지 않았습니다. 다시 지도에서 투입을 시작해 주세요.
              </Typography>
              <Button variant="outlined" sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }} onClick={goMapNoReward}>
                Map으로 이동
              </Button>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default Input;
