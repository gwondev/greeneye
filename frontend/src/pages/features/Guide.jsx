import { Box, Typography, Container, Stack, Button } from "@mui/material";
import RecyclingRoundedIcon from "@mui/icons-material/RecyclingRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Guide = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center", textAlign: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center" sx={{ animation: `${fadeInUp} 0.8s ease-out` }}>
          <Box sx={{ width: 80, height: 80, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#7CFF72", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}>
            <RecyclingRoundedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>분리배출 가이드</Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600 }}>Smart Location Mapping</Typography>
          </Stack>
          <Typography sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.8, wordBreak: "keep-all" }}>
            단순한 정보 제공을 넘어 실천을 돕습니다. 
            AI 분석 결과에 따라 인근 5M 이내의 적합한 쓰레기통 위치를 지도에 표시하며, 
            배출 전 주의사항을 직관적인 UI로 전달하여 올바른 분리배출을 유도합니다.
          </Typography>
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/")}
            sx={{ color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, px: 4, py: 1.2, "&:hover": { borderColor: "#7CFF72", color: "#7CFF72" } }}>
            돌아가기
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};

export default Guide;