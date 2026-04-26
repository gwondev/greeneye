import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

const Input = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 800 }}>투입 안내</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
            모듈 READY 신호 전송 완료. 쓰레기통 LED(노랑) 근처에 배출해주세요.
          </Typography>
          <Button variant="outlined" sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }} onClick={() => navigate("/map", { state: { focusMyLocation: true } })}>
            Map으로 이동
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};

export default Input;
