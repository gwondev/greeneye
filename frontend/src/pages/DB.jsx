import { Navigate } from "react-router-dom";

/** @deprecated `/manage` 로 통합됩니다.*/
const DB = () => <Navigate to="/manage" replace />;

export default DB;
