import { Box, Typography, Container, Stack, Button } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(124,255,114,0.35); }
  50% { box-shadow: 0 0 28px 6px rgba(124,255,114,0.15); }
`;

const bullets = [
  "촬영한 폐기물을 AI가 종류까지 판별합니다.",
  "결과에 맞는 가까운 수거함과 배출 팁을 보여 줍니다.",
];

const SmartDisposal = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#030403",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "-20%",
          right: "-15%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(57,255,20,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1, py: 4 }}>
        <Stack
          spacing={3.5}
          alignItems="center"
          textAlign="center"
          component={motion.div}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Box
              sx={{
                width: 88,
                height: 88,
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7CFF72",
                background: "linear-gradient(145deg, rgba(57,255,20,0.12), rgba(57,255,20,0.04))",
                border: "1px solid rgba(57,255,20,0.22)",
                animation: `${glow} 3s ease-in-out infinite`,
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 44 }} />
            </Box>
          </motion.div>

          <Stack spacing={0.75}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
              AI 촬영 · 분리배출 안내
            </Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600, fontSize: "0.95rem" }}>
              Gemini · 지도 연동
            </Typography>
          </Stack>

          <Typography
            sx={{
              color: "rgba(255,255,255,0.72)",
              lineHeight: 1.75,
              wordBreak: "keep-all",
              maxWidth: 400,
            }}
          >
            한 흐름으로 촬영, 분석, 올바른 배출까지 이어 줍니다.
          </Typography>

          <Stack spacing={1.2} sx={{ width: "100%", maxWidth: 420, textAlign: "left" }}>
            {bullets.map((text, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.25,
                    alignItems: "flex-start",
                    pl: 1,
                    borderLeft: "3px solid rgba(124,255,114,0.45)",
                    py: 0.25,
                  }}
                >
                  <Typography sx={{ color: "rgba(255,255,255,0.78)", fontSize: "0.92rem", lineHeight: 1.65 }}>
                    {text}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Stack>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate("/")}
              sx={{
                mt: 1,
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 999,
                px: 4,
                py: 1.2,
                "&:hover": { borderColor: "#7CFF72", color: "#7CFF72" },
              }}
            >
              돌아가기
            </Button>
          </motion.div>
        </Stack>
      </Container>
    </Box>
  );
};

export default SmartDisposal;
