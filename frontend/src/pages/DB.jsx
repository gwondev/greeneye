import { useEffect, useState } from "react";
import { Container, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper } from "@mui/material";
import { getUser, isDevBypass } from "../services/auth";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const DB = () => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const currentUser = getUser();

  useEffect(() => {
    if (currentUser?.role !== "ADMIN" && !isDevBypass()) {
      alert("관리자 전용 페이지입니다.");
      navigate("/");
      return;
    }

    axios.get(`${import.meta.env.VITE_API_BASE_URL}/users`)
      .then((res) => setUsers(res.data))
      .catch(() => console.error("데이터 로드 실패"));
  }, [currentUser?.role, navigate]);

  return (
    <Container sx={{ mt: 5, color: "#fff" }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 900 }}>회원 관리 시스템 (ADMIN)</Typography>
      <Paper sx={{ bgcolor: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: "rgba(124, 255, 114, 0.1)" }}>
            <TableRow>
              <TableCell sx={{ color: "#7CFF72" }}>ID</TableCell>
              <TableCell sx={{ color: "#7CFF72" }}>별명</TableCell>
              <TableCell sx={{ color: "#7CFF72" }}>역할</TableCell>
              <TableCell sx={{ color: "#7CFF72" }}>포인트</TableCell>
              <TableCell sx={{ color: "#7CFF72" }}>상태</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                <TableCell sx={{ color: "#fff" }}>{(u.oauthId || "").substring(0, 8)}...</TableCell>
                <TableCell sx={{ color: "#fff" }}>{u.nickname || "설정 안 됨"}</TableCell>
                <TableCell sx={{ color: "#fff" }}>{u.role}</TableCell>
                <TableCell sx={{ color: "#fff" }}>{u.totalRewards ?? 0}</TableCell>
                <TableCell sx={{ color: "#fff" }}>{u.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
};

export default DB;
