import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Play,
  BarChart3,
  History,
  Settings,
  Github,
  ExternalLink,
  Database,
} from "lucide-react";

const Layout = ({ children }) => {
  const location = useLocation();

  const navigation = [
    { name: "Home", href: "/", icon: Home },
    { name: "Simulation", href: "/simulation", icon: Play },
    { name: "Model Comparison", href: "/comparison", icon: BarChart3 },
    { name: "Real Data Analysis", href: "/real-data", icon: Database },
    { name: "History", href: "/history", icon: History },
  ];

  const isActive = (href) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    PoS-Analyzer
                  </span>
                </Link>
              </div>

              {/* Navigation Links */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "border-primary-500 text-primary-600"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side */}
            {/* <div className="flex items-center space-x-4">
              <a
                href="https://github.com/your-repo/pos-simulator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <Github className="w-5 h-5" />
              </a>
            </div> */}
          </div>
        </div>

        {/* Mobile menu */}
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? "bg-primary-50 border-primary-500 text-primary-700"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="w-4 h-4 mr-3" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="text-sm text-gray-500">
              © 2025 PoS-Analyzer. A PoS stake-weighting model simulator.
            </div>
            {/* <div className="mt-2 sm:mt-0 flex items-center space-x-4">
              <a
                href="https://github.com/your-repo/pos-simulator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
              >
                <Github className="w-4 h-4 mr-1" />
                GitHub
              </a>
              <a
                href="/docs"
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Documentation
              </a>
            </div> */}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
