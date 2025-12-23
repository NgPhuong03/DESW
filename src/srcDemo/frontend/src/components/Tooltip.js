import React, { useState } from "react";
import { Info } from "lucide-react";

const Tooltip = ({ content, children, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className="inline-flex items-center cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
        <Info className="w-4 h-4 ml-1 text-blue-500 hover:text-blue-600 transition-colors flex-shrink-0" />
      </div>
      {isVisible && (
        <div className="absolute z-50 w-72 p-3 mt-1 text-xs text-white bg-gray-900 rounded-lg shadow-xl left-0 top-full pointer-events-none">
          <div className="whitespace-pre-line leading-relaxed">{content}</div>
          {/* Arrow */}
          <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
