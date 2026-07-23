import { useState } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { router } from "./routes";
import { createQueryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { ValentineProvider } from "./contexts/ValentineContext";
import { BirthdayProvider } from "./contexts/BirthdayContext";
import { RelationshipRequestModal } from "./components/notifications/RelationshipRequestModal";
import { FloatingHearts } from "./components/valentine/FloatingHearts";
import { ValentineWelcome } from "./components/valentine/ValentineWelcome";
import { BirthdayWelcome } from "./components/birthday/BirthdayWelcome";
import { Toaster } from "./components/ui/sonner";
// removed PushNotificationManager

const App = () => {
  // Single QueryClient for the whole app lifetime (P3). Lives outside the
  // AuthProvider so the data cache survives auth-context internals; hooks
  // consume both contexts further down the tree.
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ValentineProvider>
          <BirthdayProvider>
            <div className="min-h-screen">
              <RouterProvider router={router} />
              <RelationshipRequestModal />
              <FloatingHearts />
              <ValentineWelcome />
              <BirthdayWelcome />
              <Toaster />
            </div>
          </BirthdayProvider>
        </ValentineProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;