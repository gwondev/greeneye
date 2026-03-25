import { Box, Typography, Container, Stack, Button } from "@mui/material";
import { keyframes } from "@emotion/react";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import RecyclingRoundedIcon from "@mui/icons-material/RecyclingRounded";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { loginWithGoogleCredential, saveAuth, getUser } from "../services/auth";
import { GoogleLogin } from "@react-oauth/google";

const floatSlow = keyframes`
  0% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -8px, 0); }
  100% { transform: translate3d(0, 0, 0); }
`;

const glowPulse = keyframes`
  0% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.08); }
  100% { opacity: 0.45; transform: scale(1); }
`;

const shine = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const featureItems = [
  {
    title: "쓰레기 인식",
    icon: <CameraAltRoundedIcon sx={{ fontSize: 26 }} />,
    path: "/features/recognition",
  },
  {
    title: "분리배출 안내",
    icon: <RecyclingRoundedIcon sx={{ fontSize: 26 }} />,
    path: "/features/guide",
  },
  {
    title: "리워드 검증 및 지급",
    icon: <SensorsRoundedIcon sx={{ fontSize: 26 }} />,
    path: "/features/reward",
  },
  {
    title: "관제 기능",
    icon: <DashboardRoundedIcon sx={{ fontSize: 26 }} />,
    path: "/features/control",
  },
];

const Root = () => {
  const navigate = useNavigate();
  const user = getUser();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const credential = credentialResponse?.credential;
      if (!credential) throw new Error("Google credential is missing");

      const loginResponse = await loginWithGoogleCredential(credential);
      console.log("google loginResponse:", loginResponse);

      const user = loginResponse?.user;
      const oauthId = user?.oauthId ?? user?.oauth_id;
      if (!oauthId) throw new Error("로그인 응답의 oauthId가 없습니다.");

      // 백엔드 직렬화/필드명에 따라 oauthId 키가 달라질 수 있어 정규화
      const normalizedLoginResponse = {
        ...loginResponse,
        user: {
          ...user,
          oauthId,
        },
      };

      saveAuth(normalizedLoginResponse);
      if (loginResponse?.isNewUser) {
        navigateRef.current("/nickname");
      } else {
        navigateRef.current("/map");
      }
    } catch (error) {
      console.error(error);
      alert("로그인 처리 중 오류가 발생했습니다.");
    }
  };

  const handleGoogleError = () => {
    alert("구글 로그인에 실패했습니다.");
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#030403",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "-8%",
          left: "-10%",
          width: { xs: 220, md: 420 },
          height: { xs: 220, md: 420 },
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(57,255,20,0.16) 0%, rgba(57,255,20,0.06) 35%, rgba(57,255,20,0) 72%)",
          filter: "blur(24px)",
          animation: `${glowPulse} 6s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          right: "-12%",
          bottom: "-10%",
          width: { xs: 260, md: 460 },
          height: { xs: 260, md: 460 },
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,255,140,0.14) 0%, rgba(0,255,140,0.05) 34%, rgba(0,255,140,0) 72%)",
          filter: "blur(30px)",
          animation: `${glowPulse} 7.5s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: { xs: "28px 28px", md: "40px 40px" },
          maskImage:
            "radial-gradient(circle at center, rgba(0,0,0,1) 45%, rgba(0,0,0,0.45) 75%, rgba(0,0,0,0.1) 100%)",
          opacity: 0.12,
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Stack
          spacing={{ xs: 4, md: 5 }}
          alignItems="center"
          textAlign="center"
          sx={{ py: { xs: 6, md: 8 } }}
        >
          <Stack spacing={2} alignItems="center">
            <Typography
              sx={{
                fontSize: { xs: "2.7rem", sm: "4.3rem", md: "6rem" },
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "0.14em",
                color: "#ffffff",
                textTransform: "uppercase",
                textShadow:
                  "0 0 10px rgba(57,255,20,0.10), 0 0 30px rgba(57,255,20,0.10)",
                animation: `${floatSlow} 6s ease-in-out infinite`,
              }}
            >
              GREENEYE
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: "0.98rem", sm: "1.15rem", md: "1.3rem" },
                color: "rgba(255,255,255,0.74)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                maxWidth: 820,
                lineHeight: 1.7,
              }}
            >
              AIoT 기반 리워드형 분리배출 안내 시스템
            </Typography>
          </Stack>

          <Box
            sx={{
              width: "100%",
              maxWidth: 620,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: { xs: 1.2, sm: 1.6 },
            }}
          >
            {featureItems.map((item) => (
              <Button
                key={item.title}
                fullWidth
                onClick={() => navigate(item.path)}
                sx={{
                  minHeight: { xs: 92, sm: 102, md: 110 },
                  px: { xs: 1.2, sm: 1.8 },
                  py: 1.8,
                  borderRadius: 3,
                  color: "#fff",
                  justifyContent: "flex-start",
                  textTransform: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                  backdropFilter: "blur(8px)",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    borderColor: "rgba(57,255,20,0.36)",
                    boxShadow: "0 0 24px rgba(57,255,20,0.12)",
                    transform: "translateY(-4px)",
                    background:
                      "linear-gradient(135deg, rgba(57,255,20,0.08), rgba(255,255,255,0.03))",
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={{ xs: 1, sm: 1.4 }}
                  alignItems="center"
                  sx={{ textAlign: "left" }}
                >
                  <Box
                    sx={{
                      width: { xs: 38, sm: 44 },
                      height: { xs: 38, sm: 44 },
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#7CFF72",
                      background: "rgba(57,255,20,0.08)",
                      border: "1px solid rgba(57,255,20,0.14)",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>

                  <Typography
                    sx={{
                      fontSize: { xs: "0.76rem", sm: "0.95rem", md: "1rem" },
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1.3,
                      wordBreak: "keep-all",
                    }}
                  >
                    {item.title}
                  </Typography>
                </Stack>
              </Button>
            ))}
          </Box>

          {!user ? (
            <Box sx={{ mt: 1 }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                use_fedcm_for_prompt
                use_fedcm_for_button
                theme="filled_black"
                size="large"
                shape="pill"
                text="signin_with"
                ux_mode="popup"
                width={260}
              />
            </Box>
          ) : (
            <Button
              onClick={() => navigate("/map")}
              sx={{
                mt: 1,
                minWidth: { xs: 220, sm: 250 },
                height: 54,
                px: 3.5,
                borderRadius: 999,
                color: "#fff",
                textTransform: "none",
                fontWeight: 800,
                fontSize: "1rem",
                border: "1px solid rgba(57,255,20,0.26)",
                background:
                  "linear-gradient(90deg, rgba(9,20,9,0.96), rgba(10,16,10,0.98), rgba(9,20,9,0.96))",
                "&:hover": {
                  boxShadow: "0 0 24px rgba(57,255,20,0.16)",
                  background:
                    "linear-gradient(90deg, rgba(10,28,10,1), rgba(10,18,10,1), rgba(10,28,10,1))",
                },
              }}
            >
              서비스 시작
            </Button>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default Root;
