import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";
import { RelationshipRequestModal } from "./components/notifications/RelationshipRequestModal";

const App = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <RouterProvider router={router} />
        <RelationshipRequestModal />
      </div>
    </AuthProvider>
  );
};

export default App;