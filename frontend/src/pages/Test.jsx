import { Box, Typography } from "@mui/material";

/** 팀 구현용 플레이스홀더 — /test */
export default function Test() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: "1.2rem", sm: "1.45rem" },
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "text.secondary",
          textShadow: "0 0 24px rgba(124, 255, 114, 0.12)",
        }}
      >
        구현예정.
      </Typography>
    </Box>
  );
}
