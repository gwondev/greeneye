import { Box, Container, Stack, Typography, Button } from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const MEMBERS = [
  {
    name: "이성권",
    role: "PL · IOT · INFRA",
    avatar: "이",
    color: "#7CFF72",
    bg: "rgba(124,255,114,0.08)",
    border: "rgba(124,255,114,0.28)",
    sections: [
      { label: "Project Lead", items: ["프로젝트 총괄", "일정 조율", "기술 방향 설정"] },
      { label: "Full-stack Scaffolding", items: ["전체 프로젝트 초기 구조 설계", "개발환경 세팅"] },
      { label: "Architecture Design", items: ["웹·서버·IoT 시스템 아키텍처 설계"] },
      { label: "Infra & DevOps", items: ["Docker", "Docker Compose", "CI/CD", "Server Build", "Cloudflare Tunnel"] },
      { label: "IoT & HW", items: ["센서 회로 설계", "Arduino", "MQTT", "하드웨어"] },
    ],
  },
  {
    name: "주혜림",
    role: "Security",
    avatar: "주",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.28)",
    sections: [
      { label: "Security Design", items: ["서비스 전반의 보안 구조 설계"] },
      { label: "Authentication / Authorization", items: ["사용자 인증 구조 설계", "접근 권한 제어"] },
      { label: "Spring Security", items: ["Spring Security 기반 보안 로직", "요청 검증", "보안 필터 처리"] },
      { label: "Secure Configuration", items: ["API Key 은닉", "환경 변수 관리", "비밀 정보 관리 정책"] },
    ],
  },
  {
    name: "임정은",
    role: "FN",
    avatar: "임",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.28)",
    sections: [
      { label: "Web Frontend", items: ["React.js 기반 웹 프론트엔드 개발", "UI 인터랙션 구현"] },
      { label: "API Communication", items: ["프론트엔드-백엔드 간 데이터 통신", "기관 인증 연동"] },
      { label: "Monitoring / Realtime", items: ["DB Monitoring Page", "WebSocket 실시간 통신"] },
      { label: "Client-side Logic", items: ["상태 관리", "예외 처리"] },
    ],
  },
  {
    name: "김수민",
    role: "DB · BN",
    avatar: "김",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.08)",
    border: "rgba(251,146,60,0.28)",
    sections: [
      { label: "Backend Development", items: ["Spring Boot 기반 백엔드 구현", "API 설계", "비즈니스 로직 개발"] },
      { label: "Data Modeling", items: ["ERD 작성", "DB 정규화", "테이블 관계 정의"] },
      { label: "Database Management", items: ["MySQL 기반 데이터 구조 구현", "쿼리 최적화"] },
      { label: "Backend Support", items: ["Lombok 적용", "API 정보 보호", "서버 로직 최적화"] },
    ],
  },
  {
    name: "김예은",
    role: "UI · UX",
    avatar: "김",
    color: "#f472b6",
    bg: "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.28)",
    sections: [
      { label: "UI / UX Design", items: ["Figma 기반 화면 및 인터페이스 설계", "와이어프레임", "프로토타입"] },
      { label: "User Flow Design", items: ["사용자 이용 흐름 설계", "화면 전환 구조 기획"] },
      { label: "Documentation", items: ["Use Case Diagram", "요구사항 명세서", "PPT", "Notion"] },
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function TeamIntro() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", color: "text.primary", py: { xs: 5, sm: 7 }, overflowX: "hidden" }}>
      <Container maxWidth="md">
        <Stack spacing={6} alignItems="center">
          <Stack component={motion.div} initial="hidden" animate="show" variants={fadeUp} custom={0} spacing={2} alignItems="center" textAlign="center">
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.75, py: 0.55, borderRadius: "100px", border: "1px solid rgba(124,255,114,0.35)", bgcolor: "rgba(124,255,114,0.07)" }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "#7CFF72",
                  animation: "blink 2s ease-in-out infinite",
                  "@keyframes blink": { "0%,100%": { opacity: 1, transform: "scale(1)" }, "50%": { opacity: 0.3, transform: "scale(0.6)" } },
                }}
              />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", color: "#7CFF72", textTransform: "uppercase" }}>
                Team Introduction
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "-0.04em", fontSize: { xs: "1.9rem", sm: "2.6rem" }, lineHeight: 1.1 }}>
              팀 소개
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.92rem", lineHeight: 1.7, maxWidth: 420 }}>
              AI · IoT · 보안 · 웹 · 디자인을 연결해
              <br />
              환경을 바꾸는 다섯 명의 팀입니다.
            </Typography>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, width: "100%" }}>
            {MEMBERS.map((m, i) => (
              <Box
                key={m.name}
                component={motion.div}
                initial="hidden"
                animate="show"
                variants={fadeUp}
                custom={i + 1}
                sx={{
                  gridColumn: i === 0 ? { sm: "1 / -1" } : "auto",
                  bgcolor: m.bg,
                  border: `1px solid ${m.border}`,
                  borderRadius: 3,
                  p: { xs: 2, sm: 2.5 },
                  transition: "transform 0.2s, border-color 0.2s",
                  "&:hover": { transform: "translateY(-3px)", borderColor: m.color },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                  <Box sx={{ width: 46, height: 46, borderRadius: "50%", bgcolor: m.bg, border: `1.5px solid ${m.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: m.color }}>{m.avatar}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>{m.name}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: m.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.role}</Typography>
                  </Box>
                </Stack>
                <Stack spacing={1.2}>
                  {m.sections.map((sec) => (
                    <Box key={sec.label}>
                      <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", mb: 0.6 }}>
                        {sec.label}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6 }}>
                        {sec.items.map((tag) => (
                          <Box
                            key={tag}
                            sx={{
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              px: 1.1,
                              py: 0.35,
                              borderRadius: "100px",
                              bgcolor: "rgba(255,255,255,0.06)",
                              border: "0.5px solid rgba(255,255,255,0.14)",
                              color: "rgba(255,255,255,0.75)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tag}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          <Stack direction="row" spacing={1.2}>
            <Button size="small" onClick={() => navigate("/map")} sx={{ textTransform: "none", color: "rgba(255,255,255,0.85)" }}>
              Map으로
            </Button>
            <Button size="small" onClick={() => navigate("/intro/project")} sx={{ textTransform: "none", color: "#7CFF72" }}>
              프로젝트 소개
            </Button>
          </Stack>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            제작: GreenEye Team · 2026
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
