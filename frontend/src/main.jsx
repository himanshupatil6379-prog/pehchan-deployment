import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { MessagesProvider } from './context/MessagesContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MessagesProvider>
          <App />
        </MessagesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
