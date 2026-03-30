import { Box, Button, Container, Stack, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

const steps = [
  {
    n: 1,
    title: "찍기",
    icon: <PhotoCameraRoundedIcon sx={{ fontSize: 32, color: "#7CFF72" }} />,
    body: "지도 아래 「쓰레기 촬영」에서 사진을 올립니다.",
  },
  {
    n: 2,
    title: "분류 확인",
    icon: <CategoryRoundedIcon sx={{ fontSize: 32, color: "#7CFF72" }} />,
    body: "화면에서 종류가 맞는지 확인·고릅니다.",
  },
  {
    n: 3,
    title: "통 누르기",
    icon: <TouchAppRoundedIcon sx={{ fontSize: 32, color: "#7CFF72" }} />,
    body: "지도로 돌아가 마커(쓰레기통)를 누릅니다.",
  },
  {
    n: 4,
    title: "버리기",
    icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 32, color: "#7CFF72" }} />,
    body: "「버리기」를 누르고 안내대로 버립니다.",
  },
];

const MapGuide = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", py: { xs: 2.5, md: 4 } }}>
      <Container maxWidth="sm" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2.5 }} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
              이용 방법
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.6)", mt: 0.75, fontSize: "0.9rem" }}>
              촬영 → 분류 → 통 선택 → 배출 순입니다.
            </Typography>
          </Box>
          <Button
            startIcon={<ArrowBackIosNewRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate("/map")}
            variant="outlined"
            sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.45)", fontWeight: 700, flexShrink: 0 }}
          >
            Map으로
          </Button>
        </Stack>

        <Stack spacing={1.75}>
          {steps.map((s) => (
            <Paper
              key={s.n}
              elevation={0}
              sx={{
                p: { xs: 1.75, sm: 2.25 },
                borderRadius: 2.5,
                border: "1px solid rgba(124,255,114,0.2)",
                bgcolor: "rgba(255,255,255,0.03)",
                display: "flex",
                gap: 1.5,
                alignItems: "flex-start",
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  bgcolor: "rgba(124,255,114,0.08)",
                  border: "1px solid rgba(124,255,114,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontWeight: 900,
                  color: "#7CFF72",
                  fontSize: "1rem",
                }}
              >
                {s.n}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }} flexWrap="wrap">
                  {s.icon}
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>{s.title}</Typography>
                </Stack>
                <Typography sx={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55, fontSize: "0.88rem", wordBreak: "keep-all" }}>
                  {s.body}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Stack>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/map")}
            sx={{
              px: 3.5,
              py: 1.25,
              borderRadius: 999,
              fontWeight: 800,
              bgcolor: "#7CFF72",
              color: "#0a0f0a",
              textTransform: "none",
              "&:hover": { bgcolor: "#9dff92" },
            }}
          >
            지도로
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default MapGuide;
