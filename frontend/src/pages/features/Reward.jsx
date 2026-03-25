import { Box, Typography, Container, Stack, Button } from "@mui/material";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Reward = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center", textAlign: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center" sx={{ animation: `${fadeInUp} 0.8s ease-out` }}>
          <Box sx={{ width: 80, height: 80, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#7CFF72", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}>
            <SensorsRoundedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>IoT 검증 시스템</Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600 }}>Real-time Reward</Typography>
          </Stack>
          <Typography sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.8, wordBreak: "keep-all" }}>
            물리적인 배출 여부를 확실하게 검증합니다. 
            여러 센서가 투입구의 변화를 감지하면 MQTT를 통해 서버로 신호를 전송하며, 
            검증이 완료된 사용자에게는 실시간으로 리워드 포인트를 지급합니다.
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

export default Reward;