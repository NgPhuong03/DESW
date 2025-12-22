import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    // Get or create session ID
    let storedSessionId = localStorage.getItem('pos_simulator_session_id');
    
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem('pos_simulator_session_id', storedSessionId);
    }
    
    setSessionId(storedSessionId);
  }, []);

  const resetSession = () => {
    const newSessionId = uuidv4();
    localStorage.setItem('pos_simulator_session_id', newSessionId);
    setSessionId(newSessionId);
  };

  const value = {
    sessionId,
    resetSession
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
