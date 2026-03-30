import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import LocalMallRoundedIcon from "@mui/icons-material/LocalMallRounded";
import { useNavigate } from "react-router-dom";
import { getEffectiveNickname, getEffectiveUser, saveUser } from "../services/auth";
import { apiFetch } from "../services/api";

const ITEMS = [
  { id: 1, need: 10, value: "온누리 1,000원권" },
  { id: 2, need: 50, value: "온누리 5,000원권" },
  { id: 3, need: 100, value: "온누리 10,000원권" },
];

const RewardMarket = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getEffectiveUser());
  const [nowRewards, setNowRewards] = useState(() => Number(getEffectiveUser()?.nowRewards ?? 0));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const nickname = getEffectiveNickname();

  useEffect(() => {
    const loadNowRewards = async () => {
      try {
        const users = await apiFetch("/users");
        if (!Array.isArray(users)) return;
        const me = users.find((u) => (u?.nickname || "") === (nickname || ""));
        if (!me) return;
        const next = Number(me.nowRewards ?? 0);
        setNowRewards(next);
        const merged = { ...(currentUser || {}), ...me };
        saveUser(merged);
        setCurrentUser(merged);
      } catch {
        // ignore
      }
    };
    loadNowRewards();
  }, [nickname]);

  const requestExchange = async (item) => {
    if (nowRewards < item.need) {
      setToast(`리워드가 부족합니다. (${item.need} 필요)`);
      return;
    }
    if (!currentUser?.id) {
      setToast("로그인 정보가 올바르지 않습니다.");
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetch(`/users/${currentUser.id}/exchange`, {
        method: "POST",
        body: JSON.stringify({
          cost: item.need,
          item: item.value,
        }),
      });
      const next = Number(res?.nowRewards ?? nowRewards - item.need);
      setNowRewards(next);
      const merged = { ...currentUser, nowRewards: next };
      saveUser(merged);
      setCurrentUser(merged);
      setToast(`교환 신청 완료: ${item.value}. 등록된 이메일로 전송됩니다.`);
    } catch (e) {
      setToast(e?.message || "교환 처리 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", py: { xs: 2, sm: 3 } }}>
      <Container maxWidth="sm">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.2rem", sm: "1.45rem" } }}>
            리워드마켓
          </Typography>
          <Button
            startIcon={<ArrowBackIosNewRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate("/map")}
            variant="outlined"
            sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.45)", textTransform: "none", fontWeight: 700 }}
          >
            Map
          </Button>
        </Stack>

        <Paper sx={{ p: 1.4, mb: 1.6, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,255,114,0.2)" }}>
          <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: { xs: "0.84rem", sm: "0.92rem" } }}>
            현재 리워드: <Box component="span" sx={{ color: "#7CFF72", fontWeight: 900 }}>{nowRewards}</Box>
          </Typography>
          <Typography sx={{ mt: 0.5, color: "rgba(255,255,255,0.65)", fontSize: { xs: "0.74rem", sm: "0.84rem" } }}>
            교환권은 등록된 이메일로 발송됩니다.
          </Typography>
        </Paper>

        <Stack spacing={1.2}>
          {ITEMS.map((item) => (
            <Paper
              key={item.id}
              sx={{
                p: { xs: 1.35, sm: 1.6 },
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(124,255,114,0.22)",
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: "#e8ffe1", fontSize: { xs: "0.9rem", sm: "1rem" } }}>
                    {item.need} 리워드 = {item.value}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<LocalMallRoundedIcon />}
                  onClick={() => requestExchange(item)}
                  disabled={loading}
                  sx={{
                    textTransform: "none",
                    bgcolor: "#7CFF72",
                    color: "#0a0f0a",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    "&:hover": { bgcolor: "#9dff92" },
                  }}
                >
                  {loading ? "처리중" : "교환"}
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2200}
        onClose={() => setToast("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setToast("")} severity="success" sx={{ width: "100%" }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RewardMarket;
