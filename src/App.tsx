import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";
import { RelationshipRequestModal } from "./components/notifications/RelationshipRequestModal";
import { Toaster } from "./components/ui/sonner";

const App = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <RouterProvider router={router} />
        <RelationshipRequestModal />
        <Toaster />
      </div>
    </AuthProvider>
  );
};

export default App;