import { Box, Typography, Container, Stack, Button } from "@mui/material";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";

const scan = keyframes`
  0% { transform: translateX(-100%); opacity: 0; }
  15% { opacity: 0.4; }
  85% { opacity: 0.4; }
  100% { transform: translateX(100%); opacity: 0; }
`;

const bullets = [
  "분산된 스마트 쓰레기통 상태를 한 화면에서 봅니다.",
  "하트비트·통계로 수거·운영 효율을 조정합니다.",
];

const OperationsHub = () => {
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
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
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
          <Box sx={{ position: "relative", width: 92, height: 92, borderRadius: "22px", overflow: "hidden" }}>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(124,255,114,0.12), transparent)",
                animation: `${scan} 3.5s ease-in-out infinite`,
              }}
            />
            <Box
              sx={{
                width: "100%",
                height: "100%",
                borderRadius: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7CFF72",
                background: "linear-gradient(145deg, rgba(57,255,20,0.1), rgba(57,255,20,0.02))",
                border: "1px solid rgba(57,255,20,0.22)",
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <MapRoundedIcon sx={{ fontSize: 46 }} />
              </motion.div>
            </Box>
          </Box>

          <Stack spacing={0.75}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
              쓰레기통 통합 관제
            </Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600, fontSize: "0.95rem" }}>
              대시보드 · 모니터링
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
            현장 전체를 묶어 운영 판단을 빠르게 내릴 수 있습니다.
          </Typography>

          <Stack spacing={1.2} sx={{ width: "100%", maxWidth: 420, textAlign: "left" }}>
            {bullets.map((text, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.1, duration: 0.4 }}
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

export default OperationsHub;
