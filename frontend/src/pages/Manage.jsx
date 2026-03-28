import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getUser, isDevBypass } from "../services/auth";
import { apiFetch } from "../services/api";

const Manage = () => {
  const navigate = useNavigate();
  const currentUser = getUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overview, setOverview] = useState({
    users: [],
    modules: [],
    disposalRecords: [],
    rewardHistories: [],
  });

  const [form, setForm] = useState({
    serialNumber: "",
    organization: "CHOSUN_IT",
    lat: "35.1469",
    lon: "126.9228",
    type: "GENERAL",
  });

  useEffect(() => {
    if (currentUser?.role !== "ADMIN" && !isDevBypass()) {
      alert("관리자 전용 페이지입니다.");
      navigate("/map");
      return;
    }
    loadOverview();
  }, [currentUser?.role, navigate]);

  const moduleCount = useMemo(() => overview.modules.length, [overview.modules.length]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiFetch("/admin/overview");
      setOverview({
        users: data?.users || [],
        modules: data?.modules || [],
        disposalRecords: data?.disposalRecords || [],
        rewardHistories: data?.rewardHistories || [],
      });
    } catch (e) {
      setError(e.message || "관리 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateModule = async () => {
    if (!form.serialNumber.trim()) {
      alert("serialNumber는 필수입니다.");
      return;
    }
    try {
      setError("");
      setSuccess("");
      await apiFetch("/modules", {
        method: "POST",
        body: JSON.stringify({
          serialNumber: form.serialNumber.trim(),
          organization: form.organization.trim(),
          lat: Number(form.lat),
          lon: Number(form.lon),
          type: form.type.trim().toUpperCase(),
        }),
      });
      setSuccess("모듈이 추가되었습니다.");
      setForm((prev) => ({ ...prev, serialNumber: "" }));
      loadOverview();
    } catch (e) {
      setError(e.message || "모듈 추가 실패");
    }
  };

  if (currentUser?.role !== "ADMIN" && !isDevBypass()) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", py: 4 }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Manage (ADMIN)
          </Typography>
          <Button variant="outlined" sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }} onClick={() => navigate("/map")}>
            Map으로
          </Button>
        </Stack>

        <Stack spacing={1.2} sx={{ mb: 2 }}>
          {loading && <Alert severity="info">로딩 중...</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>

        <Paper sx={{ p: 2, mb: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,255,114,0.25)" }}>
          <Typography sx={{ fontWeight: 800, mb: 1, color: "#7CFF72" }}>모듈 수동 추가</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField label="serialNumber*" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} fullWidth />
            <TextField label="organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} fullWidth />
            <TextField label="lat" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} fullWidth />
            <TextField label="lon" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} fullWidth />
            <TextField label="type(PET/CAN/GENERAL)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} fullWidth />
            <Button onClick={handleCreateModule} variant="contained" sx={{ bgcolor: "#7CFF72", color: "#000", minWidth: 130 }}>
              추가
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, mb: 2, bgcolor: "rgba(255,255,255,0.04)" }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ color: "#7CFF72", fontWeight: 800 }}>요약</Typography>
            <Button size="small" onClick={loadOverview} sx={{ color: "#7CFF72" }}>
              새로고침
            </Button>
          </Stack>
          <Typography sx={{ mt: 1 }}>Users: {overview.users.length}</Typography>
          <Typography>Modules: {moduleCount}</Typography>
          <Typography>Disposal Records: {overview.disposalRecords.length}</Typography>
          <Typography>Reward Histories: {overview.rewardHistories.length}</Typography>
        </Paper>

        <Paper sx={{ p: 2, mb: 2, bgcolor: "rgba(255,255,255,0.04)", overflowX: "auto" }}>
          <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1 }}>유저 목록</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>닉네임</TableCell><TableCell>ROLE</TableCell><TableCell>상태</TableCell><TableCell>NOW</TableCell><TableCell>TOTAL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overview.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.id}</TableCell><TableCell>{u.nickname || "-"}</TableCell><TableCell>{u.role}</TableCell><TableCell>{u.status}</TableCell><TableCell>{u.nowRewards ?? 0}</TableCell><TableCell>{u.totalRewards ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper sx={{ p: 2, mb: 2, bgcolor: "rgba(255,255,255,0.04)", overflowX: "auto" }}>
          <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1 }}>모듈 목록</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>SERIAL</TableCell><TableCell>ORG</TableCell><TableCell>TYPE</TableCell><TableCell>STATUS</TableCell><TableCell>LAT</TableCell><TableCell>LON</TableCell><TableCell>COUNT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overview.modules.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.id}</TableCell><TableCell>{m.serialNumber}</TableCell><TableCell>{m.organization}</TableCell><TableCell>{m.type}</TableCell><TableCell>{m.status}</TableCell><TableCell>{m.lat}</TableCell><TableCell>{m.lon}</TableCell><TableCell>{m.totalDisposalCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", my: 2 }} />

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,0.04)", flex: 1, maxHeight: 320, overflow: "auto" }}>
            <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1 }}>배출 기록(최근)</Typography>
            {overview.disposalRecords.slice(-20).reverse().map((r) => (
              <Typography key={r.id} sx={{ fontSize: 13, mb: 0.5 }}>
                #{r.id} user:{r.userId} module:{r.moduleId} {r.status} +{r.rewardAmount}
              </Typography>
            ))}
          </Paper>
          <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,0.04)", flex: 1, maxHeight: 320, overflow: "auto" }}>
            <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1 }}>리워드 내역(최근)</Typography>
            {overview.rewardHistories.slice(-20).reverse().map((h) => (
              <Typography key={h.id} sx={{ fontSize: 13, mb: 0.5 }}>
                #{h.id} user:{h.userId} record:{h.disposalRecordId} points:{h.points} ({h.reason})
              </Typography>
            ))}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};

export default Manage;
