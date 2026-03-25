import { Box, Typography, Container, Stack, Button } from "@mui/material";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Recognition = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center", textAlign: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center" sx={{ animation: `${fadeInUp} 0.8s ease-out` }}>
          <Box sx={{ width: 80, height: 80, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#7CFF72", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}>
            <CameraAltRoundedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>AI 쓰레기 인식</Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600 }}>Gemini 1.5 Flash API</Typography>
          </Stack>
          <Typography sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.8, wordBreak: "keep-all" }}>
            사용자가 촬영한 이미지를 실시간으로 분석합니다. 
            대규모 경량화 모델인 "Gemini Flash"를 통해 대한민국 분리배출 지침에 따라 
            폐기물의 종류(일쓰, 캔, 플라스틱)를 정확하게 판별합니다.
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

export default Recognition;