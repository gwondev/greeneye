import { useEffect, useState, useCallback } from "react";
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getEffectiveUser, isDevBypass } from "../services/auth";
import { apiFetch } from "../services/api";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
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

const MODULE_STATUS_OPTIONS = ["DEFAULT", "READY", "CHECK", "FULL"];

const Manage = () => {
  const navigate = useNavigate();
  const currentUser = getEffectiveUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overview, setOverview] = useState({
    users: [],
    modules: [],
    disposalRecords: [],
    rewardHistories: [],
  });
  const [mqttLogs, setMqttLogs] = useState([]);

  const [userEditOpen, setUserEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    nickname: "",
    role: "USER",
    status: "ACTIVE",
    totalRewards: 0,
    nowRewards: 0,
  });
  const [userDeleteTarget, setUserDeleteTarget] = useState(null);

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm, setModuleForm] = useState({
    serialNumber: "",
    organization: "CHOSUN_IT",
    lat: "35.1469",
    lon: "126.9228",
    type: "GENERAL",
    status: "DEFAULT",
  });
  const [moduleDeleteTarget, setModuleDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [data, logs] = await Promise.all([
        apiFetch("/admin/overview"),
        apiFetch("/mosquitto/logs?limit=20"),
      ]);
      setOverview({
        users: data?.users || [],
        modules: data?.modules || [],
        disposalRecords: data?.disposalRecords || [],
        rewardHistories: data?.rewardHistories || [],
      });
      setMqttLogs(Array.isArray(logs) ? logs : []);
    } catch (e) {
      setError(e.message || "관리 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role !== "ADMIN" && !isDevBypass()) {
      alert("관리자 전용 페이지입니다.");
      navigate("/map");
      return;
    }
    loadOverview();
  }, [currentUser?.role, navigate, loadOverview]);

  const openModuleDialog = (m = null) => {
    if (m) {
      setEditingModule(m);
      setModuleForm({
        serialNumber: m.serialNumber ?? "",
        organization: m.organization ?? "CHOSUN_IT",
        lat: String(m.lat ?? "35.1469"),
        lon: String(m.lon ?? "126.9228"),
        type: m.type ?? "GENERAL",
        status: m.status ?? "DEFAULT",
      });
    } else {
      setEditingModule(null);
      setModuleForm({
        serialNumber: "",
        organization: "CHOSUN_IT",
        lat: "35.1469",
        lon: "126.9228",
        type: "GENERAL",
        status: "DEFAULT",
      });
    }
    setModuleDialogOpen(true);
  };

  const saveModule = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const body = {
        serialNumber: moduleForm.serialNumber.trim(),
        organization: moduleForm.organization.trim(),
        lat: Number(moduleForm.lat),
        lon: Number(moduleForm.lon),
        type: moduleForm.type.trim().toUpperCase(),
        status: (moduleForm.status || "DEFAULT").trim().toUpperCase(),
      };
      if (editingModule) {
        await apiFetch(`/modules/${editingModule.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setSuccess("모듈이 수정되었습니다.");
      } else {
        await apiFetch("/modules", { method: "POST", body: JSON.stringify(body) });
        setSuccess("모듈이 추가되었습니다.");
      }
      setModuleDialogOpen(false);
      setEditingModule(null);
      loadOverview();
    } catch (e) {
      setError(e.message || "모듈 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteModule = async () => {
    if (!moduleDeleteTarget) return;
    try {
      setSaving(true);
      await apiFetch(`/modules/${moduleDeleteTarget.id}`, { method: "DELETE" });
      setModuleDeleteTarget(null);
      setSuccess("모듈이 삭제되었습니다.");
      loadOverview();
    } catch (e) {
      setError(e.message || "모듈 삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  const openUserEdit = (u) => {
    setEditingUser(u);
    setUserForm({
      nickname: u.nickname ?? "",
      role: u.role === "ADMIN" ? "ADMIN" : "USER",
      status: u.status ?? "ACTIVE",
      totalRewards: u.totalRewards ?? 0,
      nowRewards: u.nowRewards ?? 0,
    });
    setUserEditOpen(true);
  };

  const saveUser = async () => {
    if (!editingUser) return;
    try {
      setSaving(true);
      await apiFetch(`/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nickname: userForm.nickname.trim() || null,
          role: userForm.role,
          status: userForm.status.trim() || "ACTIVE",
          totalRewards: Number(userForm.totalRewards) || 0,
          nowRewards: Number(userForm.nowRewards) || 0,
        }),
      });
      setUserEditOpen(false);
      setEditingUser(null);
      setSuccess("유저 정보가 저장되었습니다.");
      loadOverview();
    } catch (e) {
      alert(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userDeleteTarget) return;
    try {
      setSaving(true);
      await apiFetch(`/users/${userDeleteTarget.id}`, { method: "DELETE" });
      setUserDeleteTarget(null);
      setSuccess("유저가 삭제되었습니다.");
      loadOverview();
    } catch (e) {
      alert(e.message || "삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  if (currentUser?.role !== "ADMIN" && !isDevBypass()) return null;

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      sx={{ minHeight: "100dvh", bgcolor: "#030403", color: "#fff", py: { xs: 2, sm: 3, md: 4 } }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }} sx={{ mb: { xs: 1.5, sm: 2 } }} gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: "1.35rem", sm: "2rem" }, lineHeight: 1.2 }}>
              관리 콘솔
            </Typography>
            <Typography
              sx={{
                mt: { xs: 0.75, sm: 1 },
                fontSize: { xs: "0.62rem", sm: "0.72rem" },
                letterSpacing: { xs: "0.2em", sm: "0.32em" },
                textTransform: "uppercase",
                color: "rgba(124,255,114,0.88)",
                fontWeight: 700,
                fontFamily: '"Segoe UI", "Apple SD Gothic Neo", system-ui, sans-serif',
                lineHeight: 1.4,
              }}
            >
              Admin Management Page
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, flexShrink: 0 }}>
            <Button
              startIcon={<ArrowBackIosNewRoundedIcon sx={{ fontSize: 16 }} />}
              variant="outlined"
              sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)", minHeight: 40, flex: { xs: 1, sm: "none" } }}
              onClick={() => navigate("/map")}
            >
              Map
            </Button>
            <Button onClick={loadOverview} sx={{ color: "#000", bgcolor: "#7CFF72", fontWeight: 800, minHeight: 40, flex: { xs: 1, sm: "none" }, px: { sm: 2 } }}>
              새로고침
            </Button>
          </Stack>
        </Stack>

        <Stack spacing={1.2} sx={{ mb: { xs: 1.5, sm: 2 } }}>
          {loading && <Alert severity="info" sx={{ py: 0.5, fontSize: { xs: "0.8rem", sm: "1rem" } }}>로딩 중...</Alert>}
          {error && <Alert severity="error" sx={{ fontSize: { xs: "0.8rem", sm: "1rem" } }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ fontSize: { xs: "0.8rem", sm: "1rem" } }}>{success}</Alert>}
        </Stack>

        <Paper
          sx={{
            p: { xs: 1, sm: 2 },
            mb: 2,
            bgcolor: "rgba(255,255,255,0.04)",
            overflowX: "auto",
            border: "1px solid rgba(124,255,114,0.18)",
            WebkitOverflowScrolling: "touch",
            "& .MuiTableCell-root": { fontSize: { xs: "0.68rem", sm: "0.8125rem" }, py: { xs: 0.65, sm: 1 } },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
            <Typography sx={{ color: "#7CFF72", fontWeight: 800, fontSize: { xs: "0.9rem", sm: "1rem" } }}>
              유저
              <Box component="span" sx={{ color: "rgba(255,255,255,0.45)", fontWeight: 600, ml: 1, fontSize: { xs: "0.78rem", sm: "0.85rem" } }}>
                · 총 {overview.users.length}명
              </Box>
            </Typography>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={cellHead}>ID</TableCell>
                <TableCell sx={cellHead}>닉네임</TableCell>
                <TableCell sx={cellHead}>ROLE</TableCell>
                <TableCell sx={cellHead}>상태</TableCell>
                <TableCell sx={cellHead}>NOW</TableCell>
                <TableCell sx={cellHead}>TOTAL</TableCell>
                <TableCell sx={cellHead} align="right">
                  작업
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overview.users.map((u) => (
                <TableRow key={u.id} sx={{ "&:nth-of-type(odd)": { bgcolor: "rgba(255,255,255,0.03)" } }}>
                  <TableCell sx={cellBody}>{u.id}</TableCell>
                  <TableCell sx={cellBody}>{u.nickname || "-"}</TableCell>
                  <TableCell sx={cellBody}>{u.role}</TableCell>
                  <TableCell sx={cellBody}>{u.status}</TableCell>
                  <TableCell sx={cellBody}>{u.nowRewards ?? 0}</TableCell>
                  <TableCell sx={cellBody}>{u.totalRewards ?? 0}</TableCell>
                  <TableCell sx={cellBody} align="right">
                    <IconButton size="small" sx={{ color: "#7CFF72" }} onClick={() => openUserEdit(u)}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ color: "#ff8a8a" }}
                      disabled={currentUser?.id != null && u.id === currentUser.id}
                      onClick={() => setUserDeleteTarget(u)}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper
          sx={{
            p: { xs: 1, sm: 2 },
            mb: 2,
            bgcolor: "rgba(255,255,255,0.04)",
            overflowX: "auto",
            border: "1px solid rgba(124,255,114,0.18)",
            WebkitOverflowScrolling: "touch",
            "& .MuiTableCell-root": { fontSize: { xs: "0.68rem", sm: "0.8125rem" }, py: { xs: 0.65, sm: 1 } },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
            <Typography sx={{ color: "#7CFF72", fontWeight: 800, fontSize: { xs: "0.9rem", sm: "1rem" } }}>
              모듈
              <Box component="span" sx={{ color: "rgba(255,255,255,0.45)", fontWeight: 600, ml: 1, fontSize: { xs: "0.78rem", sm: "0.85rem" } }}>
                · 총 {overview.modules.length}개
              </Box>
            </Typography>
            <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => openModuleDialog(null)} sx={{ color: "#000", bgcolor: "#7CFF72", fontWeight: 800 }}>
              모듈 추가
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["ID", "SERIAL", "ORG", "TYPE", "STATUS", "LAT", "LON", "COUNT", "작업"].map((h) => (
                  <TableCell key={h} sx={cellHead} align={h === "작업" ? "right" : "left"}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {overview.modules.map((m) => (
                <TableRow key={m.id} sx={{ "&:nth-of-type(odd)": { bgcolor: "rgba(255,255,255,0.03)" } }}>
                  <TableCell sx={cellBody}>{m.id}</TableCell>
                  <TableCell sx={cellBody}>{m.serialNumber}</TableCell>
                  <TableCell sx={cellBody}>{m.organization}</TableCell>
                  <TableCell sx={cellBody}>{m.type}</TableCell>
                  <TableCell sx={cellBody}>{m.status}</TableCell>
                  <TableCell sx={cellBody}>{m.lat}</TableCell>
                  <TableCell sx={cellBody}>{m.lon}</TableCell>
                  <TableCell sx={cellBody}>{m.totalDisposalCount}</TableCell>
                  <TableCell sx={cellBody} align="right">
                    <IconButton size="small" sx={{ color: "#7CFF72" }} onClick={() => openModuleDialog(m)}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "#ff8a8a" }} onClick={() => setModuleDeleteTarget(m)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper
          sx={{
            p: { xs: 1, sm: 1.25 },
            mb: 2,
            bgcolor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(124,255,114,0.18)",
            maxHeight: { xs: 220, sm: 260 },
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 0.7, fontSize: { xs: "0.84rem", sm: "0.95rem" } }}>
            모스키토 최근 20개
          </Typography>
          <Stack spacing={0.35}>
            {mqttLogs.map((row, idx) => (
              <Typography key={`${row.time}-${idx}`} sx={{ fontSize: { xs: "0.64rem", sm: "0.72rem" }, lineHeight: 1.25, color: "rgba(255,255,255,0.86)", wordBreak: "break-all" }}>
                [{row.direction}] {row.time} · {row.topic} · {row.payload}
              </Typography>
            ))}
            {mqttLogs.length === 0 && (
              <Typography sx={{ fontSize: { xs: "0.7rem", sm: "0.78rem" }, color: "rgba(255,255,255,0.65)" }}>
                로그 없음
              </Typography>
            )}
          </Stack>
        </Paper>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", my: 2 }} />

        <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.5, md: 2 }}>
          <Paper sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: "rgba(255,255,255,0.04)", flex: 1, maxHeight: { xs: 240, sm: 320 }, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
            <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1, fontSize: { xs: "0.85rem", sm: "1rem" } }}>배출 기록(최근)</Typography>
            {overview.disposalRecords
              .slice(-20)
              .reverse()
              .map((r) => (
                <Typography key={r.id} sx={{ fontSize: { xs: 11, sm: 13 }, mb: 0.5, lineHeight: 1.45, wordBreak: "break-all" }}>
                  #{r.id} user:{r.userId} module:{r.moduleId} {r.status} +{r.rewardAmount}
                </Typography>
              ))}
          </Paper>
          <Paper sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: "rgba(255,255,255,0.04)", flex: 1, maxHeight: { xs: 240, sm: 320 }, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
            <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1, fontSize: { xs: "0.85rem", sm: "1rem" } }}>리워드 내역(최근)</Typography>
            {overview.rewardHistories
              .slice(-20)
              .reverse()
              .map((h) => (
                <Typography key={h.id} sx={{ fontSize: { xs: 11, sm: 13 }, mb: 0.5, lineHeight: 1.45, wordBreak: "break-all" }}>
                  #{h.id} user:{h.userId} record:{h.disposalRecordId} points:{h.points} ({h.reason})
                </Typography>
              ))}
          </Paper>
        </Stack>
      </Container>

      <Dialog open={userEditOpen} onClose={() => !saving && setUserEditOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: "#121816", color: "#fff", border: "1px solid rgba(124,255,114,0.25)" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>유저 수정 #{editingUser?.id}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField label="별명" value={userForm.nickname} onChange={(e) => setUserForm((f) => ({ ...f, nickname: e.target.value }))} fullWidth sx={{ input: { color: "#fff" }, label: { color: "rgba(255,255,255,0.7)" } }} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.7)" }}>역할</InputLabel>
            <Select value={userForm.role} label="역할" onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))} sx={{ color: "#fff" }}>
              <MenuItem value="USER">USER</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </Select>
          </FormControl>
          <TextField label="상태" value={userForm.status} onChange={(e) => setUserForm((f) => ({ ...f, status: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
          <Stack direction="row" spacing={2}>
            <TextField label="누적 리워드" type="number" value={userForm.totalRewards} onChange={(e) => setUserForm((f) => ({ ...f, totalRewards: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
            <TextField label="현재 리워드" type="number" value={userForm.nowRewards} onChange={(e) => setUserForm((f) => ({ ...f, nowRewards: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUserEditOpen(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={saveUser} disabled={saving} variant="contained" sx={{ bgcolor: "#7CFF72", color: "#000", fontWeight: 800 }}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!userDeleteTarget} onClose={() => !saving && setUserDeleteTarget(null)} PaperProps={{ sx: { bgcolor: "#121816", color: "#fff" } }}>
        <DialogTitle>유저 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            ID {userDeleteTarget?.id} ({userDeleteTarget?.nickname || userDeleteTarget?.oauthId?.slice(0, 8)}) 삭제할까요?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDeleteTarget(null)} disabled={saving}>
            취소
          </Button>
          <Button onClick={confirmDeleteUser} disabled={saving} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moduleDialogOpen} onClose={() => !saving && setModuleDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: "#121816", color: "#fff", border: "1px solid rgba(124,255,114,0.25)" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingModule ? "모듈 수정" : "모듈 추가"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField label="serialNumber*" value={moduleForm.serialNumber} onChange={(e) => setModuleForm((f) => ({ ...f, serialNumber: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
          <TextField label="organization" value={moduleForm.organization} onChange={(e) => setModuleForm((f) => ({ ...f, organization: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
          <Stack direction="row" spacing={2}>
            <TextField label="lat" value={moduleForm.lat} onChange={(e) => setModuleForm((f) => ({ ...f, lat: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
            <TextField label="lon" value={moduleForm.lon} onChange={(e) => setModuleForm((f) => ({ ...f, lon: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
          </Stack>
          <TextField label="type (PET/CAN/GENERAL/HAZARD)" value={moduleForm.type} onChange={(e) => setModuleForm((f) => ({ ...f, type: e.target.value }))} fullWidth sx={{ input: { color: "#fff" } }} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.7)" }}>모듈 상태</InputLabel>
            <Select
              label="모듈 상태"
              value={MODULE_STATUS_OPTIONS.includes((moduleForm.status || "").toUpperCase()) ? (moduleForm.status || "DEFAULT").toUpperCase() : "DEFAULT"}
              onChange={(e) => setModuleForm((f) => ({ ...f, status: e.target.value }))}
              sx={{ color: "#fff" }}
            >
              {MODULE_STATUS_OPTIONS.map((st) => (
                <MenuItem key={st} value={st}>
                  {st}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModuleDialogOpen(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={saveModule} disabled={saving || !moduleForm.serialNumber.trim()} variant="contained" sx={{ bgcolor: "#7CFF72", color: "#000", fontWeight: 800 }}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!moduleDeleteTarget} onClose={() => !saving && setModuleDeleteTarget(null)} PaperProps={{ sx: { bgcolor: "#121816", color: "#fff" } }}>
        <DialogTitle>모듈 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            {moduleDeleteTarget?.serialNumber} (ID {moduleDeleteTarget?.id}) 삭제할까요? 연결된 배출 기록도 함께 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModuleDeleteTarget(null)} disabled={saving}>
            취소
          </Button>
          <Button onClick={confirmDeleteModule} disabled={saving} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Manage;
