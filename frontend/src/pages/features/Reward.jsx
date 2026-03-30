import { Box, Typography, Container, Stack, Button } from "@mui/material";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";

const shine = keyframes`
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
`;

const bullets = [
  "IoT로 배출이 확인되면 포인트를 적립합니다.",
  "정책에 맞게 지급·정산 흐름을 유지합니다.",
  "리워드는 다른 혜택으로 교환 가능합니다.",
];

const Reward = () => {
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
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,80,0.06) 0%, transparent 65%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1, py: 4 }}>
        <Stack
          spacing={3.5}
          alignItems="center"
          textAlign="center"
          component={motion.div}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={{ rotateY: [0, 12, -12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            style={{ perspective: 400 }}
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
                background: "linear-gradient(135deg, rgba(57,255,20,0.14), rgba(57,255,20,0.06))",
                border: "1px solid rgba(124,255,114,0.3)",
                backgroundSize: "200% 100%",
                animation: `${shine} 4s linear infinite`,
              }}
            >
              <WorkspacePremiumRoundedIcon sx={{ fontSize: 44 }} />
            </Box>
          </motion.div>

          <Stack spacing={0.75}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
              리워드
            </Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600, fontSize: "0.95rem" }}>
              검증 후 포인트 지급
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
            분리배출 실천이 곧 보상으로 이어지도록 설계했습니다.
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

export default Reward;
