import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase-client";

function DashBoard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default DashBoard;