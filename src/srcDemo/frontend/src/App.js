import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Simulation from "./pages/Simulation";
import Comparison from "./pages/Comparison";
import Results from "./pages/Results";
import ComparisonResults from "./pages/ComparisonResults";
import History from "./pages/History";
import RealDataAnalysis from "./pages/RealDataAnalysis";
import { SessionProvider } from "./contexts/SessionContext";

function App() {
  return (
    <SessionProvider>
      <Router>
        <div className="App">
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/simulation" element={<Simulation />} />
              <Route path="/comparison" element={<Comparison />} />
              <Route path="/real-data" element={<RealDataAnalysis />} />
              <Route path="/results/:id" element={<Results />} />
              <Route
                path="/comparison-results/:id"
                element={<ComparisonResults />}
              />
              <Route path="/history" element={<History />} />
            </Routes>
          </Layout>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: "#10B981",
                  secondary: "#fff",
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: "#EF4444",
                  secondary: "#fff",
                },
              },
            }}
          />
        </div>
      </Router>
    </SessionProvider>
  );
}

export default App;
