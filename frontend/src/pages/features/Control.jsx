import { Box, Typography, Container, Stack, Button } from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Control = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center", textAlign: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center" sx={{ animation: `${fadeInUp} 0.8s ease-out` }}>
          <Box sx={{ width: 80, height: 80, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#7CFF72", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}>
            <DashboardRoundedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>통합 관제 센터</Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600 }}>Admin Monitoring Hub</Typography>
          </Stack>
          <Typography sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.8, wordBreak: "keep-all" }}>
            분산된 스마트 쓰레기통을 한눈에 관리합니다. 
            각 기기의 실시간 하트비트와 운영 상태를 모니터링하며, 집중배치할 구역을 정할 수 있습니다.
            웹 대시보드를 통해 기기 설정 변경 및 배출 통계 데이터를 분석하여 수거 효율을 최적화합니다.
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

export default Control;