import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { Button, Typography, Box } from "@mui/material";
import "leaflet/dist/leaflet.css";
import "./map-popup.css";
import { moduleTypeLabel } from "../constants/wasteLabels";

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center?.[0] != null && center?.[1] != null) {
      map.flyTo(center, zoom, { duration: 0.6 });
    }
  }, [center, zoom, map]);
  return null;
}

/**
 * @param {[[number,number]|null]} props.userPos
 * @param {Array} props.modules
 * @param {(serial: string) => void} props.onReady
 * @param {boolean} props.hasHeldWaste
 */
export default function MapView({ userPos, modules, onReady, hasHeldWaste = false }) {
  const fallback = [35.1462, 126.9229];
  const center = userPos && userPos[0] != null && userPos[1] != null ? userPos : fallback;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        minHeight: 280,
        "& .leaflet-container": {
          height: "100% !important",
          width: "100% !important",
          background: "#0a0f0a",
        },
      }}
    >
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo center={center} zoom={16} />
        {userPos && userPos[0] != null && userPos[1] != null && (
          <CircleMarker
            center={userPos}
            radius={12}
            pathOptions={{
              color: "#4A9EFF",
              fillColor: "#4A9EFF",
              fillOpacity: 0.45,
              weight: 2,
            }}
          >
            <Popup className="greeneye-popup">
              <Typography variant="body2" fontWeight={700} sx={{ color: "#e8ffe8" }}>
                내 위치
              </Typography>
            </Popup>
          </CircleMarker>
        )}
        {modules.map((m) => {
          if (m.lat == null || m.lon == null) return null;
          const isFull = String(m.status || "").toUpperCase() === "FULL";
          const typeTitle = moduleTypeLabel(m.type);
          const serial = (m.serialNumber && String(m.serialNumber).trim()) || "—";
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lon]}
              radius={11}
              pathOptions={{
                color: isFull ? "#ff6b6b" : "#7CFF72",
                fillColor: isFull ? "#3a1616" : "#1a2e1a",
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent>
                <span style={{ color: "#7CFF72", fontWeight: 800, fontSize: 11, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{typeTitle}</span>
              </Tooltip>
              <Popup className="greeneye-popup">
                <Box sx={{ minWidth: { xs: 200, sm: 220 }, maxWidth: 280 }}>
                  <Typography sx={{ color: "#7CFF72", fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.3, mb: 0.65 }}>
                    {typeTitle}
                  </Typography>
                  <Typography sx={{ color: "rgba(232,255,232,0.72)", fontSize: "0.62rem", mb: 0.45, lineHeight: 1.45 }}>
                    {serial}
                    <Box component="span" sx={{ color: "rgba(232,255,232,0.5)" }}>
                      {" "}
                      · 상태{" "}
                    </Box>
                    <Box component="span" sx={{ color: "rgba(232,255,232,0.78)" }}>{m.status || "—"}</Box>
                    {m.totalDisposalCount != null ? (
                      <>
                        <Box component="span" sx={{ color: "rgba(232,255,232,0.5)" }}> · </Box>
                        누적 배출 {m.totalDisposalCount}회
                      </>
                    ) : null}
                  </Typography>
                  {!hasHeldWaste && (
                    <Typography sx={{ color: "rgba(255,214,128,0.95)", fontSize: "0.72rem", mb: 1, fontWeight: 700 }}>
                      먼저 쓰레기를 촬영해 주세요.
                    </Typography>
                  )}
                  <Button
                    fullWidth
                    size="small"
                    variant="contained"
                    disabled={isFull || !hasHeldWaste}
                    onClick={() => onReady(m.serialNumber)}
                    sx={{
                      bgcolor: isFull || !hasHeldWaste ? "rgba(255,255,255,0.2)" : "#7CFF72",
                      color: isFull || !hasHeldWaste ? "rgba(255,255,255,0.75)" : "#050805",
                      fontWeight: 900,
                      textTransform: "none",
                      borderRadius: 2,
                      py: 0.75,
                      boxShadow: isFull || !hasHeldWaste ? "none" : "0 4px 16px rgba(124,255,114,0.25)",
                      "&:hover": { bgcolor: isFull || !hasHeldWaste ? "rgba(255,255,255,0.2)" : "#9dff92" },
                    }}
                  >
                    {isFull ? "가득참(FULL)" : !hasHeldWaste ? "촬영 필요" : "버리기"}
                  </Button>
                </Box>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </Box>
  );
}
