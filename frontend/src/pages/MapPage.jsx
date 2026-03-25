import { Typography, Box, Paper } from "@mui/material";
import { getUser } from "../services/auth";

const Map = () => {
  const user = getUser();

  return (
    <Box sx={{ p: 4, color: "#fff", bgcolor: "#030403", minHeight: "100vh" }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
        반가워요, <span style={{ color: "#7CFF72" }}>{user?.nickname}</span>님! 🌿
      </Typography>
      <Paper sx={{ height: "70vh", bgcolor: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #7CFF72" }}>
        <Typography color="#7CFF72">여기에 지도가 표시될 예정입니다.</Typography>
      </Paper>
    </Box>
  );
};

export default Map;