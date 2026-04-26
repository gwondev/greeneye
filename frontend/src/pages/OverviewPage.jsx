import React, { useState } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import TeamIntro from "./TeamIntro";
import ProjectIntro from "./ProjectIntro";
import RecyclingGuide from "./RecyclingGuide";

const tabItems = [
  { key: "project", label: "프로젝트 소개" },
  { key: "team", label: "팀 소개" },
  { key: "guide", label: "분리수거 안내" },
];

export default function OverviewPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("project");

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#000", color: "#fff", py: { xs: 2.2, sm: 3 } }}>
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.35rem" } }}>서비스개요</Typography>
            <Button size="small" onClick={() => navigate("/map")} sx={{ color: "#7CFF72", textTransform: "none" }}>
              Map으로
            </Button>
          </Stack>

          <Stack direction="row" spacing={1.2}>
            {tabItems.map((item) => {
              const active = item.key === tab;
              return (
                <Button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  variant={active ? "contained" : "outlined"}
                  sx={{
                    flex: 1,
                    minHeight: { xs: 48, sm: 56 },
                    borderRadius: 999,
                    fontSize: { xs: "0.92rem", sm: "1.02rem" },
                    fontWeight: 900,
                    textTransform: "none",
                    letterSpacing: "-0.01em",
                    ...(active
                      ? {
                          color: "#e8ffe1",
                          border: "1px solid rgba(124,255,114,0.75)",
                          bgcolor: "rgba(20,28,20,0.92)",
                          boxShadow: "0 10px 24px rgba(124,255,114,0.22)",
                          "&:hover": { bgcolor: "rgba(26,34,26,0.96)" },
                        }
                      : {
                          color: "rgba(216,255,208,0.9)",
                          borderColor: "rgba(124,255,114,0.42)",
                          bgcolor: "rgba(12,12,12,0.9)",
                          "&:hover": {
                            borderColor: "rgba(124,255,114,0.7)",
                            bgcolor: "rgba(20,20,20,0.95)",
                          },
                        }),
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Stack>
      </Container>

      <Box sx={{ mt: 1.8 }}>
        {tab === "team" && <TeamIntro />}
        {tab === "project" && <ProjectIntro />}
        {tab === "guide" && <RecyclingGuide />}
      </Box>
    </Box>
  );
}
