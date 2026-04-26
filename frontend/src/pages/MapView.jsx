import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { moduleTypeLabel } from "../constants/wasteLabels";

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_API || "";
const KAKAO_SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;

/**
 * @param {[[number,number]|null]} props.userPos
 * @param {Array} props.modules
 * @param {(serial: string) => void} props.onReady
 * @param {boolean} props.hasHeldWaste
 */
export default function MapView({ userPos, modules, onReady, hasHeldWaste = false }) {
  const fallback = [35.1462, 126.9229];
  const center = userPos && userPos[0] != null && userPos[1] != null ? userPos : fallback;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const overlaysRef = useRef([]);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!KAKAO_APP_KEY) return;
    if (window.kakao?.maps) return;

    const existing = document.querySelector("script[data-kakao-map='true']");
    if (existing) return;

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.dataset.kakaoMap = "true";
    document.head.appendChild(script);

    return () => {
      // script 제거는 하지 않고 재사용한다.
    };
  }, []);

  useEffect(() => {
    if (!KAKAO_APP_KEY || !containerRef.current || !window.kakao?.maps) return;

    window.kakao.maps.load(() => {
      if (mapRef.current) return;

      const map = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(center[0], center[1]),
        level: 3,
      });
      mapRef.current = map;
      infoRef.current = new window.kakao.maps.InfoWindow({ zIndex: 3 });
    });
  }, [center]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    mapRef.current.panTo(new window.kakao.maps.LatLng(center[0], center[1]));
  }, [center]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    const map = mapRef.current;
    const infoWindow = infoRef.current;

    if (userPos && userPos[0] != null && userPos[1] != null) {
      const userMarker = new window.kakao.maps.Marker({
        map,
        position: new window.kakao.maps.LatLng(userPos[0], userPos[1]),
        title: "내 위치",
      });
      markersRef.current.push(userMarker);
    }

    modules.forEach((m) => {
      if (m.lat == null || m.lon == null) return;

      const serial = (m.serialNumber && String(m.serialNumber).trim()) || "—";
      const isFull = String(m.status || "").toUpperCase() === "FULL";
      const typeTitle = moduleTypeLabel(m.type);
      const position = new window.kakao.maps.LatLng(m.lat, m.lon);

      const marker = new window.kakao.maps.Marker({
        map,
        position,
        title: `${typeTitle} (${serial})`,
      });
      markersRef.current.push(marker);

      const badge = document.createElement("div");
      badge.style.padding = "2px 6px";
      badge.style.borderRadius = "999px";
      badge.style.border = "1px solid rgba(124,255,114,0.45)";
      badge.style.background = "rgba(0,0,0,0.8)";
      badge.style.color = "#7CFF72";
      badge.style.fontWeight = "800";
      badge.style.fontSize = "11px";
      badge.style.whiteSpace = "nowrap";
      badge.textContent = typeTitle;

      const labelOverlay = new window.kakao.maps.CustomOverlay({
        position,
        content: badge,
        yAnchor: 2.6,
      });
      labelOverlay.setMap(map);
      overlaysRef.current.push(labelOverlay);

      window.kakao.maps.event.addListener(marker, "click", () => {
        const info = document.createElement("div");
        info.style.minWidth = "180px";
        info.style.maxWidth = "240px";
        info.style.padding = "8px 10px";
        info.style.background = "#0e150e";
        info.style.border = "1px solid rgba(124,255,114,0.35)";
        info.style.borderRadius = "10px";
        info.style.color = "#e8ffe8";
        info.style.fontSize = "12px";
        info.style.lineHeight = "1.45";
        info.innerHTML = `
          <div style="font-weight:800;color:#7CFF72;margin-bottom:4px;">${typeTitle}</div>
          <div style="opacity:0.88;">${serial} · 상태 ${m.status || "—"}</div>
          ${m.totalDisposalCount != null ? `<div style="opacity:0.72;">누적 배출 ${m.totalDisposalCount}회</div>` : ""}
          <div style="margin-top:6px;opacity:0.88;">클릭 시 버리기 동작</div>
        `;
        infoWindow.setContent(info);
        infoWindow.open(map, marker);

        if (isFull) {
          alert("해당 모듈은 FULL 상태라 선택할 수 없습니다.");
          return;
        }
        if (!hasHeldWaste) {
          alert("먼저 쓰레기를 촬영해 주세요.");
          return;
        }
        onReady(m.serialNumber);
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      overlaysRef.current.forEach((o) => o.setMap(null));
      markersRef.current = [];
      overlaysRef.current = [];
    };
  }, [modules, userPos, hasHeldWaste, onReady]);

  if (!KAKAO_APP_KEY) {
    return (
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          minHeight: 280,
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,0.75)",
          bgcolor: "#0a0f0a",
          px: 2,
          textAlign: "center",
        }}
      >
        KAKAO_API 키가 없습니다. 프론트 환경변수에 설정해 주세요.
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        minHeight: 280,
      }}
    >
      <Box ref={containerRef} sx={{ height: "100%", width: "100%", bgcolor: "#0a0f0a" }} />
    </Box>
  );
}
