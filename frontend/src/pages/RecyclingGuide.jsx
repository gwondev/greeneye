import React from "react";
import { Box, Container, Stack, Typography, Avatar } from "@mui/material";
import { motion } from "framer-motion";
import * as Icons from "@mui/icons-material";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08 },
  }),
};

export default function Test() {

  const guides = [
    {
      title: "종이류",
      subtitle: "골판지 · 기타 종이 구분 배출",
      color: "#4CAF50",
      icon: <Icons.Description />,
      desc: "골판지와 기타 종이는 구분하여 배출해야 하며, 물에 젖지 않도록 하고 끈으로 묶어 배출합니다. 골판지는 테이프, 철핀, 알루미늄박 등은 반드시 제거해야 합니다. 기타 종이류는 비닐, 플라스틱, 코팅된 전단지, 노트·달력 스프링 등 제거합니다. 종이컵은 압착하여 봉투에 넣거나 묶어서 기타종이로 배출합니다. 양면이 코팅되어 분리가 어려운 경우 일반종량제폐기물로 배출합니다.",
    },
    {
      title: "종이팩",
      subtitle: "헹굼 후 펼쳐서 배출",
      color: "#2196F3",
      icon: <Icons.LocalDrink />,
      desc: "내용물과 빨대를 제거한 후 물로 헹구고 펼쳐서 배출합니다. 일반팩과 멸균팩은 구분 없이 배출합니다. 종이팩 수거함이 없는 경우 다른 종이와 구분하여 묶어 배출합니다.",
    },
    {
      title: "무색 페트병",
      subtitle: "라벨 제거 및 압착 배출",
      color: "#FF9800",
      icon: <Icons.WaterDrop />,
      desc: "라벨과 내용물을 제거하고 세척 후 압착하여 뚜껑을 닫아 배출합니다. 유색 페트병은 플라스틱류로 배출해야 합니다.",
    },
    {
      title: "플라스틱류",
      subtitle: "이물질 제거 후 배출",
      color: "#9C27B0",
      icon: <Icons.Recycling />,
      desc: "내용물과 부속품을 제거하고 세척 후 배출합니다. 재질 구분 없이 배출 가능하며 치약 용기와 같이 물로 헹굴수 없는 경우 내용물만 비우고 배출합니다.",
    },
    {
      title: "비닐류",
      subtitle: "깨끗하게 모아서 배출",
      color: "#E91E63",
      icon: <Icons.ShoppingBag />,
      desc: "이물질을 제거한 후 재질 구분 없이 투명 비닐봉투에 모아서 배출합니다. 양파 등 농산물을 담는 그물망은 비닐로 함께 배출합니다. 오염된 비닐은 일반쓰레기로 처리해야 합니다.",
    },
    {
      title: "발포합성수지",
      subtitle: "스티로폼 · 포장재 분리 배출",
      color: "#8BC34A",
      icon: <Icons.AllInbox />,
      desc: "부착상표, 테이프 등 스티로폼과 다른 재질은 제거한 후 재질과 색상 구분 없이 배출합니다. 단, 유색 제품은 지자체에 따라 수거하지 않을 수 있습니다. TV, 컴퓨터 등 전자제품 구입 시 발생한 스티로폼은 가급적 구입처로 반납합니다.",
    },
    {
      title: "유리병",
      subtitle: "깨지지 않게 분리 배출",
      color: "#00BCD4",
      icon: <Icons.WineBar />,
      desc: "유리병은 수거함에 3색 구분 없이 배출하며 깨진 경우 별도로 처리해야 합니다. 빈병은 반환하여 보증금을 환급받을 수 있습니다.",
    },
    {
      title: "금속류",
      subtitle: "캔 · 고철 구분 배출",
      color: "#FFC107",
      icon: <Icons.Construction />,
      desc: "음료, 주류캔, 식료품캔, 기타 캔류는 금속캔 수거함에 배출하고 공기구, 철사, 생활철 등 고철은 고철 수거함에 배출합니다. 금속캔은 내용물을 비우고 물로 헹군 후 배출합니다. 기타 캔류는 폭발, 화재 예방을 위해 노즐을 눌러 가스를 제거한 후 배출합니다. 고철은 가위, 칼 송곳 등 날카로운 금속은 종이와 테이프를 이용하여 안전하게 감싼 후 일반종량제 폐기물로 배출합니다.",
    }
  ];

  const getCardStyle = (color) => ({
    p: 3,
    bgcolor: "#121212",
    borderRadius: "16px",
    border: `1px solid ${color}33`,
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "translateY(-4px)",
      borderColor: color,
      boxShadow: `0 8px 24px ${color}22`,
    },
  });

  return (
    <Box
      sx={{
        bgcolor: "#000",
        color: "#fff",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        py: 8,
      }}
    >
      <Container maxWidth="md">

        <Stack spacing={6} alignItems="center">

          {/* ✅ GreenEye 헤더 유지 */}
          <Stack spacing={2} alignItems="center">
            <Box sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 0.5,
              borderRadius: "100px",
              border: "1px solid rgba(124,255,114,0.35)",
            }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "#7CFF72",
                animation: "blink 2s infinite",
                "@keyframes blink": {
                  "0%,100%": { opacity: 1 },
                  "50%": { opacity: 0.3 },
                },
              }} />
              <Typography sx={{ color: "#7CFF72", fontSize: "0.75rem", fontWeight: 700 }}>
                Recycling Guide
              </Typography>
            </Box>

            <Typography variant="h3" sx={{ fontWeight: 900 }}>
              분리수거 지침 안내
            </Typography>
          </Stack>

          {/* 🔥 카드 UI */}
          <Stack spacing={3} sx={{ width: "100%" }}>
            {guides.map((g, i) => (
              <Box
                key={g.title}
                component={motion.div}
                initial="hidden"
                animate="show"
                variants={fadeUp}
                custom={i}
                sx={getCardStyle(g.color)}
              >
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: `${g.color}22`, color: g.color }}>
                    {g.icon}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {g.title}
                    </Typography>
                    <Typography sx={{ color: g.color, fontSize: "0.8rem", fontWeight: 700 }}>
                      {g.subtitle}
                    </Typography>
                  </Box>
                </Stack>

                <Typography sx={{ color: "#aaa", lineHeight: 1.7 }}>
                  {g.desc}
                </Typography>
              </Box>
            ))}
          </Stack>

          {/* 📌 공식 출처 (추가된 부분) */}
          <Box
            sx={{
              width: "100%",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 3,
              p: 3,
              bgcolor: "#111",
            }}
          >
            <Typography sx={{ color: "#7CFF72", fontWeight: 700, mb: 1 }}>
              공식 출처
            </Typography>

            <Typography sx={{ color: "#aaa", fontSize: "0.85rem", lineHeight: 1.6 }}>
              본 분리수거 지침은 기후에너지환경부 및 한국폐기물협회의
              공식 분리배출 기준을 기반으로 작성되었습니다.
            </Typography>

            <Box sx={{ mt: 1 }}>
              <Typography
                component="a"
                href="https://xn--oy2b29bd3a601b.kr/front/dischargeMethod/typeItem.do?searchCnd=11"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "#7CFF72",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": {
                    textDecoration: "underline",
                  },
                }}
              >
                분리의 정석 (환경부 공식 분리배출 안내 사이트 바로가기)
              </Typography>
            </Box>
          </Box>

{/* ✅ Tech Stack 유지 */}
<Box
  component={motion.div}
  initial="hidden"
  animate="show"
  variants={fadeUp}
  custom={7}
  sx={{
    width: "100%",
    border: "1px solid rgba(124,255,114,0.18)",
    borderRadius: 3,
    p: { xs: 2.5, sm: 3 },
    textAlign: "center",
    bgcolor: "rgba(124,255,114,0.04)",
  }}
>
  <Typography
    sx={{
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "rgba(124,255,114,0.6)",
      mb: 1.5,
    }}
  >
    Tech Stack
  </Typography>

  <Box
    sx={{
      display: "flex",
      flexWrap: "wrap",
      gap: 0.8,
      justifyContent: "center",
    }}
  >
    {[
      "React.js", "Spring Boot", "MySQL", "Docker", "Docker Compose",
      "CI/CD", "Cloudflare Tunnel", "MQTT", "Arduino",
      "Spring Security", "WebSocket", "Figma", "Notion",
    ].map((t) => (
      <Box
        key={t}
        sx={{
          fontSize: "0.75rem",
          fontWeight: 500,
          px: 1.3,
          py: 0.4,
          borderRadius: "100px",
          bgcolor: "rgba(255,255,255,0.06)",
          border: "0.5px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.65)",
          transition: "all 0.2s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            borderColor: "rgba(124,255,114,0.4)",
            color: "#7CFF72",
          },
        }}
      >
        {t}
      </Box>
    ))}
  </Box>
</Box>
        </Stack>
      </Container>
    </Box>
  );
}
