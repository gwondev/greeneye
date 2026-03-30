import { Box, Typography, Container, Stack, Button } from "@mui/material";
import DeviceHubRoundedIcon from "@mui/icons-material/DeviceHubRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";

const ping = keyframes`
  0% { transform: scale(1); opacity: 0.5; }
  70% { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1.15); opacity: 0; }
`;

const bullets = [
  "투입구·센서가 실제 배출 여부를 감지합니다.",
  "MQTT로 서버·앱과 실시간으로 상태를 맞춥니다.",
];

const IotIntegration = () => {
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
          bottom: "-25%",
          left: "-10%",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,255,140,0.1) 0%, transparent 70%)",
          filter: "blur(36px)",
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
          <Box sx={{ position: "relative", width: 96, height: 96 }}>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                borderRadius: "24px",
                border: "2px solid rgba(124,255,114,0.35)",
                animation: `${ping} 2.4s cubic-bezier(0,0,0.2,1) infinite`,
              }}
            />
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(145deg, rgba(57,255,20,0.12), rgba(57,255,20,0.03))",
                border: "1px solid rgba(57,255,20,0.22)",
              }}
            >
              <DeviceHubRoundedIcon sx={{ fontSize: 48, color: "#7CFF72" }} />
            </motion.div>
          </Box>

          <Stack spacing={0.75}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
              IoT 모듈 연동
            </Typography>
            <Typography sx={{ color: "#7CFF72", fontWeight: 600, fontSize: "0.95rem" }}>
              센서 · MQTT · 엣지 기기
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
            현장 하드웨어와 백엔드를 안정적으로 이어 줍니다.
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

export default IotIntegration;
