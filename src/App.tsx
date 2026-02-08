import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";
import { ValentineProvider } from "./contexts/ValentineContext";
import { RelationshipRequestModal } from "./components/notifications/RelationshipRequestModal";
import { FloatingHearts } from "./components/valentine/FloatingHearts";
import { ValentineWelcome } from "./components/valentine/ValentineWelcome";
import { Toaster } from "./components/ui/sonner";

const App = () => {
  return (
    <AuthProvider>
      <ValentineProvider>
        <div className="min-h-screen">
          <RouterProvider router={router} />
          <RelationshipRequestModal />
          <FloatingHearts />
          <ValentineWelcome />
          <Toaster />
        </div>
      </ValentineProvider>
    </AuthProvider>
  );
};

export default App;