import { useState, useEffect } from "react";
import { Box, Container, TextField, Button, Typography, Stack, InputAdornment } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { keyframes } from "@emotion/react";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { getUser, saveUser, isDevBypass } from "../services/auth";
import { apiFetch } from "../services/api";

// Guide.jsx에서 가져온 등장 애니메이션
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const NicknamePage = () => {
  const [nickname, setNickname] = useState("");
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (!user?.oauthId && !isDevBypass()) {
      navigate("/");
    }
  }, [user?.oauthId, navigate]);

  const handleSubmit = async () => {
    if (!user?.oauthId) {
      if (isDevBypass()) {
        alert("로컬 개발: 닉네임 저장은 구글 로그인 후 가능합니다.");
      }
      return;
    }
    // 닉네임 입력 안 했을 때 방어 로직 추가
    if (!nickname.trim()) {
      alert("사용하실 별명을 입력해주세요.");
      return;
    }

    try {
      const response = await apiFetch("/auth/nickname", {
        method: "PUT",
        body: JSON.stringify({
        oauthId: user.oauthId,
        nickname: nickname.trim() // 앞뒤 공백 제거
        }),
      });
      // 서버 기준 사용자 정보로 로컬 저장 동기화
      const updatedUser = response?.user || { ...user, nickname: nickname.trim() };
      saveUser(updatedUser);
      // 성공하면 지도 페이지로 이동
      navigate("/map");
    } catch (e) {
      alert("이미 사용 중인 별명이거나 에러가 발생했습니다.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#030403", // Guide.jsx 배경색
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 배경 은은한 그리드 효과 (RootPage의 감성 살짝 추가) */}
      <Box sx={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: "40px 40px", opacity: 0.3, pointerEvents: "none" }} />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <Stack
          spacing={5}
          alignItems="center"
          sx={{ animation: `${fadeInUp} 0.8s ease-out` }} // 애니메이션 적용
        >
          {/* 상단 아이콘 박스 (Guide.jsx 스타일) */}
          <Box
            sx={{
              width: 90,
              height: 90,
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7CFF72", // 네온 그린 포인트
              background: "rgba(57,255,20,0.06)", // 은은한 녹색 배경
              border: "1px solid rgba(57,255,20,0.15)", // 테두리
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <AccountCircleRoundedIcon sx={{ fontSize: 48 }} />
          </Box>

          {/* 텍스트 영역 */}
          <Stack spacing={1.5}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                letterSpacing: "-0.03em",
                textShadow: "0 0 15px rgba(57,255,20,0.15)",
              }}
            >
              GREENEYE 첫걸음
            </Typography>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "1.1rem",
                lineHeight: 1.7,
                maxWidth: 420,
              }}
            >
              환영합니다! 별명을 설정해주세요.
            </Typography>
          </Stack>

          {/* 세련된 스타일의 입력창 */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="별명 입력 (예: 나는그린아이)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            // 엔터키 쳐도 제출되게 추가
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircleRoundedIcon sx={{ color: "rgba(255,255,255,0.3)" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              maxWidth: 400,
              '& .MuiOutlinedInput-root': {
                color: "#fff",
                backgroundColor: "rgba(255,255,255,0.03)", // 살짝 투명한 배경
                fontSize: "1.1rem",
                fontWeight: 600,
                '& fieldset': {
                  borderColor: "rgba(255,255,255,0.12)",
                  borderRadius: 3, // 둥근 테두리
                  transition: "all 0.2s ease",
                },
                '&:hover fieldset': {
                  borderColor: "rgba(255,255,255,0.3)",
                },
                '&.Mui-focused fieldset': {
                  borderColor: "#7CFF72", // 포커스시 네온 그린
                  borderWidth: "1.5px",
                  boxShadow: "0 0 12px rgba(57,255,20,0.15)",
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: "rgba(255,255,255,0.3)",
                opacity: 1,
              },
            }}
          />

          {/* 시작하기 버튼 (Guide.jsx 돌아가기 버튼의 스타일을 CTA 버튼으로 어레인지) */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSubmit}
            endIcon={<ArrowForwardRoundedIcon />} // 오른쪽에 화살표 추가
            sx={{
              maxWidth: 320,
              height: 60,
              borderRadius: 999, // 완전 둥글게
              fontSize: "1.2rem",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#000",
              backgroundColor: "#7CFF72", // 네온 그린 꽉 찬 버튼
              boxShadow: "0 10px 25px rgba(57,255,20,0.15)",
              transition: "all 0.3s ease",
              textTransform: "none", // 대문자 강제 해제
              "&:hover": {
                backgroundColor: "#fff", // 호버시 흰색으로 변경
                boxShadow: "0 10px 30px rgba(255,255,255,0.2)",
                transform: "translateY(-2px)",
              },
            }}
          >
             GREENEYE 시작하기
          </Button>

        </Stack>
      </Container>
    </Box>
  );
};

export default NicknamePage;