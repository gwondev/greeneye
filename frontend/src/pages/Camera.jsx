import { useState } from "react";
import { Box, Button, Container, Stack, Typography, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getUser, isDevBypass } from "../services/auth";
import { apiFetch } from "../services/api";

const Camera = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!user?.oauthId) {
      if (!isDevBypass()) {
        alert("로그인 정보가 없습니다.");
        navigate("/");
      } else {
        alert("로컬 개발: 구글 로그인 후에만 분석 API를 호출할 수 있습니다.");
      }
      return;
    }

    try {
      setLoading(true);
      const data = await apiFetch("/ai/analyze", {
        method: "POST",
        body: JSON.stringify({
          oauthId: user.oauthId,
          hint,
        }),
      });
      setResult(data);
    } catch (e) {
      alert(e.message || "촬영 분석 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Camera</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
            Gemini 분석 API 테스트 화면입니다. 하루 10회 제한, 1분 간격 제한이 서버에서 적용됩니다.
          </Typography>
          <TextField
            fullWidth
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="예: 찌그러진 콜라캔"
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              },
            }}
          />
          <Button disabled={loading} variant="contained" sx={{ bgcolor: "#7CFF72", color: "#000" }} onClick={handleAnalyze}>
            {loading ? "분석 중..." : "분석하기"}
          </Button>
          {result && (
            <Typography sx={{ color: "#7CFF72", textAlign: "center" }}>
              예측: {result.predictedType} / 오늘 남은 촬영: {result.remainingToday}회
            </Typography>
          )}
          <Button variant="outlined" sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }} onClick={() => navigate("/map")}>
            지도로 돌아가기
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};

export default Camera;
