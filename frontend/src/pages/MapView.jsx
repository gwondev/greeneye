import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { Button, Stack, Typography } from "@mui/material";
import "leaflet/dist/leaflet.css";

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
 */
export default function MapView({ userPos, modules, onReady }) {
  const fallback = [35.1462, 126.9229];
  const center = userPos && userPos[0] != null && userPos[1] != null ? userPos : fallback;

  return (
    <MapContainer
      center={center}
      zoom={16}
      style={{ height: "100%", width: "100%", minHeight: 360 }}
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
          <Popup>
            <Typography variant="body2" fontWeight={700}>
              내 위치
            </Typography>
          </Popup>
        </CircleMarker>
      )}
      {modules.map((m) => {
        if (m.lat == null || m.lon == null) return null;
        return (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lon]}
            radius={11}
            pathOptions={{
              color: "#7CFF72",
              fillColor: "#1a2e1a",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <Stack spacing={1} sx={{ minWidth: 160 }}>
                <Typography variant="body2" fontWeight={700}>
                  {m.serialNumber}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.type} · {m.status}
                </Typography>
                <Button size="small" variant="contained" sx={{ bgcolor: "#7CFF72", color: "#000" }} onClick={() => onReady(m.serialNumber)}>
                  버리기(READY)
                </Button>
              </Stack>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
