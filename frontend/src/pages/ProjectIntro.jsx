import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Container, Paper, Stack, Button, Avatar } from "@mui/material";
import * as Icons from "@mui/icons-material";

export default function ProjectIntro() {
  const navigate = useNavigate();

  const motivation = [
    { title: "재활용 지침의 복잡성", subtitle: "분리배출 방법 미숙지 해결", color: "#4CAF50", desc: "복잡한 분리배출 기준을 AI가 대신 판단해 오분리 배출을 줄이는 것을 목표로 합니다.", icon: <Icons.SearchOff /> },
    { title: "참여 동기 부여 부재", subtitle: "리워드형 보상 시스템", color: "#2196F3", desc: "배출 직후 리워드를 제공해 사용자의 지속 참여를 유도합니다.", icon: <Icons.CardGiftcard /> },
    { title: "AI 기술의 실생활 접목", subtitle: "Gemini API 기반", color: "#FF9800", desc: "고성능 AI 모델을 실생활 분리배출 문제에 접목해 실효성을 검증합니다.", icon: <Icons.AutoAwesome /> },
  ];

  const usageSteps = [
    { label: "서비스 접속", desc: "greeneye.gwon.run 접속 및 로그인", icon: <Icons.Login /> },
    { label: "폐기물 촬영", desc: "AI 카메라로 쓰레기 인식", icon: <Icons.CameraAlt /> },
    { label: "수거함 이동", desc: "지도에서 가까운 IoT 수거함 확인", icon: <Icons.Map /> },
    { label: "배출 및 적립", desc: "배출 완료 후 리워드 획득", icon: <Icons.AddCard /> },
  ];

  const getCardStyle = (borderColor) => ({
    p: 3,
    height: "100%",
    bgcolor: "#121212",
    borderRadius: "16px",
    border: `1px solid ${borderColor}33`,
    transition: "all 0.3s ease",
    "&:hover": { transform: "translateY(-8px)", borderColor, boxShadow: `0 8px 24px ${borderColor}22` },
  });

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#000", color: "#fff", pb: 8 }}>
      <Box sx={{ pt: 10, pb: 8, textAlign: "center" }}>
        <Container>
          <Stack spacing={1.3} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.75, py: 0.55, borderRadius: "100px", border: "1px solid rgba(124,255,114,0.35)", bgcolor: "rgba(124,255,114,0.07)" }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "#7CFF72",
                  animation: "blink 2s ease-in-out infinite",
                  "@keyframes blink": { "0%,100%": { opacity: 1, transform: "scale(1)" }, "50%": { opacity: 0.3, transform: "scale(0.6)" } },
                }}
              />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", color: "#7CFF72", textTransform: "uppercase" }}>
                Project Introduction
              </Typography>
            </Box>
          </Stack>
          <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: "2.2rem", md: "4rem" }, mb: 1.5 }}>
            GREEN<span style={{ color: "#4CAF50" }}>EYE</span>
          </Typography>
          <Typography variant="h6" sx={{ color: "#888", mb: 3 }}>
            AIoT 기반 리워드형 분리배출 안내 시스템
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md">
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, pl: 2, borderLeft: "4px solid #4CAF50" }}>
          프로젝트 배경
        </Typography>
        <Stack spacing={2} sx={{ mb: 8 }}>
          {motivation.map((item) => (
            <Paper key={item.title} sx={{ ...getCardStyle(item.color), width: "100%" }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.8 }}>
                <Avatar sx={{ bgcolor: `${item.color}22`, color: item.color }}>{item.icon}</Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                  <Typography variant="caption" sx={{ color: item.color, fontWeight: 700 }}>
                    {item.subtitle}
                  </Typography>
                </Box>
              </Stack>
              <Typography sx={{ color: "#999", lineHeight: 1.7 }}>{item.desc}</Typography>
            </Paper>
          ))}
        </Stack>

        <Typography variant="h5" sx={{ fontWeight: 800, mb: 4, pl: 2, borderLeft: "4px solid #4CAF50" }}>
          이용 방법
        </Typography>
        <Box sx={{ mb: 7, p: { xs: 2.5, sm: 4 }, bgcolor: "#0a0a0a", borderRadius: "20px", border: "1px solid #222" }}>
          <Stack spacing={2}>
            {usageSteps.map((step) => (
              <Paper
                key={step.label}
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 1.8 },
                  borderRadius: 2.2,
                  border: "1px solid rgba(124,255,114,0.18)",
                  bgcolor: "rgba(255,255,255,0.02)",
                }}
              >
                <Stack direction="row" spacing={1.4} alignItems="center">
                  <Avatar sx={{ bgcolor: "rgba(124,255,114,0.12)", color: "#7CFF72", border: "1px solid rgba(124,255,114,0.38)" }}>{step.icon}</Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 800, mb: 0.2 }}>{step.label}</Typography>
                    <Typography sx={{ color: "#7f8a7f", fontSize: "0.85rem" }}>{step.desc}</Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.2} justifyContent="center">
          <Button size="small" onClick={() => navigate("/map")} sx={{ textTransform: "none", color: "rgba(255,255,255,0.85)" }}>
            Map으로
          </Button>
          <Button size="small" onClick={() => navigate("/intro/team")} sx={{ textTransform: "none", color: "#7CFF72" }}>
            팀 소개
          </Button>
        </Stack>
        <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textAlign: "center", mt: 1 }}>
          제작: GreenEye Team · 2026
        </Typography>
      </Container>
    </Box>
  );
}
