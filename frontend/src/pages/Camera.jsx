import { useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
  Chip,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { getEffectiveOauthId, isDevBypass } from "../services/auth";
import { apiFetchMultipart } from "../services/api";

const HELD_KEY = "greeneye.finalWasteType";

const TYPE_LABELS = {
  CAN: "캔",
  GENERAL: "일반(일쓰)",
  PET: "플라스틱(페트)",
  HAZARD: "위험물",
};

const Camera = () => {
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [override, setOverride] = useState(null);

  const oauthId = getEffectiveOauthId();

  const onFileChosen = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setOverride(null);
    setResult(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const analyze = async () => {
    if (!oauthId) {
      if (!isDevBypass()) {
        alert("로그인이 필요합니다.");
        navigate("/");
      } else {
        alert(
          "로컬 개발: 백엔드에 GREENEYE_DEV_USER_ENABLED=true 로 띄우면 dev 유저가 생성되어 분석이 동작합니다."
        );
      }
      return;
    }
    if (!file) {
      alert("사진을 선택하거나 촬영해 주세요.");
      return;
    }

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("image", file);
      fd.append("oauthId", oauthId);
      if (override) {
        fd.append("userSelectedType", override);
      }
      const data = await apiFetchMultipart("/ai/analyze", fd);
      setResult(data);
    } catch (e) {
      alert(e.message || "분석 실패");
    } finally {
      setLoading(false);
    }
  };

  const finalType = override || result?.finalType || result?.predictedType;
  const confirmAndGoMap = () => {
    if (finalType) {
      sessionStorage.setItem(HELD_KEY, finalType);
    }
    navigate("/map");
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#030403", color: "#fff", py: 4 }}>
      <Container maxWidth="sm">
        <Stack spacing={2.5} alignItems="stretch">
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
            쓰레기 촬영 · 분류
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>
            모바일은 카메라, PC는 파일 선택. Gemini 1.5 Flash로 분류하고, 아래에서 직접 고를 수도 있습니다.
          </Typography>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={onFileChosen}
          />
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChosen} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<PhotoCameraRoundedIcon />}
              onClick={() => cameraInputRef.current?.click()}
              sx={{ bgcolor: "#7CFF72", color: "#000", fontWeight: 800, py: 1.2 }}
            >
              카메라 / 촬영
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ImageRoundedIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.45)", fontWeight: 700 }}
            >
              파일에서 선택
            </Button>
          </Stack>

          {preview && (
            <Paper
              sx={{
                overflow: "hidden",
                borderRadius: 2,
                border: "1px solid rgba(124,255,114,0.25)",
                bgcolor: "rgba(0,0,0,0.35)",
              }}
            >
              <Box
                component="img"
                src={preview}
                alt="preview"
                sx={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block" }}
              />
            </Paper>
          )}

          <Button
            disabled={loading || !file}
            variant="contained"
            onClick={analyze}
            sx={{ bgcolor: "#1a2e1a", color: "#7CFF72", border: "1px solid rgba(124,255,114,0.4)", fontWeight: 800 }}
          >
            {loading ? "Gemini 분석 중…" : "Gemini로 분석"}
          </Button>

          {result && (
            <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,255,114,0.2)" }}>
              <Typography sx={{ color: "#7CFF72", fontWeight: 800, mb: 1 }}>
                AI 예측: {TYPE_LABELS[result.predictedType] ?? result.predictedType}
              </Typography>
              {result.rawSnippet && (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap" }}>
                  {result.rawSnippet}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", display: "block", mt: 1 }}>
                오늘 남은 분석: {result.remainingToday ?? "-"}회
              </Typography>
            </Paper>
          )}

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1, color: "rgba(255,255,255,0.9)" }}>
              직접 선택 (부가 확인)
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  onClick={() => setOverride(key)}
                  sx={{
                    borderColor: override === key ? "#7CFF72" : "rgba(255,255,255,0.2)",
                    color: override === key ? "#000" : "#fff",
                    bgcolor: override === key ? "#7CFF72" : "rgba(255,255,255,0.06)",
                    fontWeight: 700,
                    "&:hover": { bgcolor: override === key ? "#8fff85" : "rgba(124,255,114,0.12)" },
                  }}
                  variant={override === key ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.45)", mt: 1, display: "block" }}>
              선택 후 「지도로」하면 Map에서 READY 시 전달됩니다.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              disabled={!finalType}
              onClick={confirmAndGoMap}
              sx={{ bgcolor: "#7CFF72", color: "#000", fontWeight: 900, flex: 1 }}
            >
              분류 확정 후 지도로
            </Button>
            <Button variant="outlined" sx={{ color: "#7CFF72", borderColor: "rgba(124,255,114,0.35)" }} onClick={() => navigate("/map")}>
              지도로 (저장 안 함)
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Camera;
