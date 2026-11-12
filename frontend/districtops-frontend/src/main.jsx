import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import { OperationsProvider } from './context/OperationsContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <OperationsProvider>
        <App />
      </OperationsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
