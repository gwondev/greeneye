import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { moduleTypeLabel } from "../constants/wasteLabels";

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_API || import.meta.env.KAKAO_API || "";
const KAKAO_SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
const TYPE_SYMBOLS = {
  PET: "🧴",
  CAN: "🥫",
  GENERAL: "🗑️",
  HAZARD: "☣️",
};

/**
 * @param {[[number,number]|null]} props.userPos
 * @param {Array} props.modules
 * @param {(serial: string) => void} props.onReady
 * @param {boolean} props.hasHeldWaste
 * @param {number} props.centerTrigger
 */
export default function MapView({ userPos, modules, onReady, hasHeldWaste = false, centerTrigger = 0 }) {
  const fallback = [35.1462, 126.9229];
  const center = userPos && userPos[0] != null && userPos[1] != null ? userPos : fallback;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const overlaysRef = useRef([]);
  const userOverlayRef = useRef(null);
  const infoRef = useRef(null);
  const centeredOnceRef = useRef(false);
  const latestCenterTriggerRef = useRef(centerTrigger);
  const [sdkReady, setSdkReady] = useState(false);
  const [debugMessage, setDebugMessage] = useState("");

  useEffect(() => {
    if (!KAKAO_APP_KEY) return undefined;

    const markReady = () => {
      if (!window.kakao?.maps) return;
      window.kakao.maps.load(() => {
        setSdkReady(true);
        setDebugMessage("");
      });
    };
    const markError = (reason) => {
      setDebugMessage(
        `[KAKAO MAP ERROR] ${reason}\nkeyLoaded=${Boolean(KAKAO_APP_KEY)} host=${window.location.host}\n` +
          "카카오 콘솔 JavaScript SDK 도메인에 현재 host 등록 필요"
      );
    };

    if (window.kakao?.maps) {
      markReady();
      return undefined;
    }

    const existing = document.querySelector("script[data-kakao-map='true']");
    if (existing) {
      existing.addEventListener("load", markReady);
      existing.addEventListener("error", () => markError("sdk script load failed(existing)"));
      return () => existing.removeEventListener("load", markReady);
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.dataset.kakaoMap = "true";
    script.addEventListener("load", markReady);
    script.addEventListener("error", () => markError("sdk script load failed"));
    document.head.appendChild(script);
    const timer = window.setTimeout(() => {
      if (!window.kakao?.maps) markError("sdk load timeout");
    }, 5000);
    return () => {
      script.removeEventListener("load", markReady);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!KAKAO_APP_KEY || !sdkReady || !containerRef.current || !window.kakao?.maps) return;

    if (mapRef.current) return;

    try {
      const map = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(center[0], center[1]),
        level: 3,
      });
      mapRef.current = map;
      infoRef.current = new window.kakao.maps.InfoWindow({ zIndex: 3 });
    } catch (e) {
      setDebugMessage(`[KAKAO MAP ERROR] map init failed: ${e?.message || String(e)}`);
    }
  }, [center, sdkReady]);

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !window.kakao?.maps) return;
    if (!userPos || userPos[0] == null || userPos[1] == null) return;

    const hasNewTrigger = latestCenterTriggerRef.current !== centerTrigger;
    if (!centeredOnceRef.current || hasNewTrigger) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(userPos[0], userPos[1]));
      centeredOnceRef.current = true;
      latestCenterTriggerRef.current = centerTrigger;
    }
  }, [centerTrigger, sdkReady, userPos]);

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !window.kakao?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    const map = mapRef.current;
    const infoWindow = infoRef.current;

    modules.forEach((m) => {
      if (m.lat == null || m.lon == null) return;

      const serial = (m.serialNumber && String(m.serialNumber).trim()) || "—";
      const isFull = String(m.status || "").toUpperCase() === "FULL";
      const typeKey = String(m.type || "GENERAL").toUpperCase();
      const typeTitle = moduleTypeLabel(m.type);
      const typeSymbol = TYPE_SYMBOLS[typeKey] || "🗑️";
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
      badge.textContent = `${typeSymbol} ${typeTitle}`;

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

        const title = document.createElement("div");
        title.style.fontWeight = "800";
        title.style.color = "#7CFF72";
        title.style.marginBottom = "4px";
        title.textContent = `${typeSymbol} ${typeTitle}`;

        const status = document.createElement("div");
        status.style.opacity = "0.88";
        status.textContent = `${serial} · 상태 ${m.status || "—"}`;

        info.appendChild(title);
        info.appendChild(status);

        if (m.totalDisposalCount != null) {
          const total = document.createElement("div");
          total.style.opacity = "0.72";
          total.textContent = `누적 배출 ${m.totalDisposalCount}회`;
          info.appendChild(total);
        }

        if (!hasHeldWaste) {
          const warn = document.createElement("div");
          warn.style.marginTop = "6px";
          warn.style.color = "rgba(255,214,128,0.95)";
          warn.style.fontWeight = "700";
          warn.textContent = "먼저 쓰레기를 촬영해 주세요.";
          info.appendChild(warn);
        }

        const action = document.createElement("button");
        action.type = "button";
        action.style.marginTop = "8px";
        action.style.width = "100%";
        action.style.border = "none";
        action.style.borderRadius = "8px";
        action.style.padding = "8px 10px";
        action.style.fontWeight = "900";
        action.style.cursor = isFull || !hasHeldWaste ? "not-allowed" : "pointer";
        action.style.background = isFull || !hasHeldWaste ? "rgba(255,255,255,0.2)" : "#7CFF72";
        action.style.color = isFull || !hasHeldWaste ? "rgba(255,255,255,0.78)" : "#050805";
        action.disabled = isFull || !hasHeldWaste;
        action.textContent = isFull ? "가득참(FULL)" : !hasHeldWaste ? "촬영 필요" : "버리기";
        action.addEventListener("click", () => {
          onReady(m.serialNumber);
        });
        info.appendChild(action);

        infoWindow.setContent(info);
        infoWindow.open(map, marker);
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      overlaysRef.current.forEach((o) => o.setMap(null));
      markersRef.current = [];
      overlaysRef.current = [];
    };
  }, [modules, hasHeldWaste, onReady]);

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !window.kakao?.maps) return;

    if (userOverlayRef.current) {
      userOverlayRef.current.setMap(null);
      userOverlayRef.current = null;
    }
    if (!userPos || userPos[0] == null || userPos[1] == null) return;

    if (!document.getElementById("greeneye-user-pulse-style")) {
      const style = document.createElement("style");
      style.id = "greeneye-user-pulse-style";
      style.textContent = `
        @keyframes greeneyeUserPulse {
          0% { transform: scale(0.72); opacity: 0.95; }
          70% { transform: scale(1.55); opacity: 0.22; }
          100% { transform: scale(1.85); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const dotWrap = document.createElement("div");
    dotWrap.style.position = "relative";
    dotWrap.style.width = "22px";
    dotWrap.style.height = "22px";
    dotWrap.style.transform = "translate(-11px, -11px)";

    const pulse = document.createElement("div");
    pulse.style.position = "absolute";
    pulse.style.left = "50%";
    pulse.style.top = "50%";
    pulse.style.width = "22px";
    pulse.style.height = "22px";
    pulse.style.borderRadius = "50%";
    pulse.style.background = "rgba(255,64,64,0.45)";
    pulse.style.transform = "translate(-50%, -50%)";
    pulse.style.animation = "greeneyeUserPulse 1.1s ease-out infinite";

    const core = document.createElement("div");
    core.style.position = "absolute";
    core.style.left = "50%";
    core.style.top = "50%";
    core.style.width = "10px";
    core.style.height = "10px";
    core.style.borderRadius = "50%";
    core.style.background = "#ff4a4a";
    core.style.border = "2px solid rgba(255,255,255,0.92)";
    core.style.boxShadow = "0 0 10px rgba(255,74,74,0.85)";
    core.style.transform = "translate(-50%, -50%)";

    dotWrap.appendChild(pulse);
    dotWrap.appendChild(core);

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(userPos[0], userPos[1]),
      content: dotWrap,
      yAnchor: 0.5,
      zIndex: 7,
    });
    overlay.setMap(mapRef.current);
    userOverlayRef.current = overlay;

    return () => {
      if (userOverlayRef.current) {
        userOverlayRef.current.setMap(null);
        userOverlayRef.current = null;
      }
    };
  }, [userPos, sdkReady]);

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
        카카오 지도 키가 없습니다. VITE_KAKAO_API 또는 KAKAO_API를 설정해 주세요.
      </Box>
    );
  }

  if (!sdkReady || debugMessage) {
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
          whiteSpace: "pre-line",
        }}
      >
        {debugMessage || "카카오 지도 로딩 중..."}
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
