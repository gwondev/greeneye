import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { getUser, isDevBypass } from "../services/auth";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";

const cellHead = {
  color: "#7CFF72",
  fontWeight: 800,
  borderColor: "rgba(124,255,114,0.2)",
  bgcolor: "rgba(124,255,114,0.08)",
};

const cellBody = {
  color: "rgba(255,255,255,0.92)",
  borderColor: "rgba(255,255,255,0.08)",
};

const DB = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const currentUser = getUser();

  useEffect(() => {
    if (currentUser?.role !== "ADMIN" && !isDevBypass()) {
      alert("관리자 전용 페이지입니다.");
      navigate("/map");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const data = await apiFetch("/users");
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setErr("유저 목록을 불러오지 못했습니다. 백엔드·프록시를 확인하세요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, navigate]);

  if (currentUser?.role !== "ADMIN" && !isDevBypass()) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", py: 4 }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <div>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
              유저 DB 조회
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.65)", mt: 0.5 }}>
              GET /api/users — 관리·로컬 dev에서 동일하게 표시
            </Typography>
          </div>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<ArrowBackIosNewRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate("/map")}
              sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.4)" }}
              variant="outlined"
            >
              Map
            </Button>
            <Button onClick={() => navigate("/manage")} sx={{ color: "#000", bgcolor: "#7CFF72", fontWeight: 800 }}>
              Manage
            </Button>
          </Stack>
        </Stack>

        {loading && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress sx={{ color: "#7CFF72" }} />
          </Stack>
        )}
        {err && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: "rgba(211,47,47,0.15)", color: "#ffc9c9" }}>
            {err}
          </Alert>
        )}

        {!loading && !err && (
          <Paper
            sx={{
              bgcolor: "rgba(255,255,255,0.04)",
              borderRadius: 3,
              overflow: "hidden",
              border: "1px solid rgba(124,255,114,0.22)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}
          >
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={cellHead}>ID</TableCell>
                  <TableCell sx={cellHead}>oauth (앞)</TableCell>
                  <TableCell sx={cellHead}>별명</TableCell>
                  <TableCell sx={cellHead}>역할</TableCell>
                  <TableCell sx={cellHead}>누적 리워드</TableCell>
                  <TableCell sx={cellHead}>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow
                    key={u.id}
                    sx={{
                      "&:nth-of-type(odd)": { bgcolor: "rgba(255,255,255,0.02)" },
                      "&:last-child td": { border: 0 },
                    }}
                  >
                    <TableCell sx={cellBody}>{u.id}</TableCell>
                    <TableCell sx={{ ...cellBody, fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {(u.oauthId || "").slice(0, 12)}…
                    </TableCell>
                    <TableCell sx={cellBody}>{u.nickname || "—"}</TableCell>
                    <TableCell sx={cellBody}>{u.role}</TableCell>
                    <TableCell sx={cellBody}>{u.totalRewards ?? 0}</TableCell>
                    <TableCell sx={cellBody}>{u.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default DB;
