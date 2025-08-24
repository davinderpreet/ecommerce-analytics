import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function HomePage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>E-commerce Analytics Dashboard</h1>
      <p>Welcome to the analytics platform</p>
      <a href="/dashboard" style={{ 
        display: 'inline-block', 
        padding: '10px 20px', 
        backgroundColor: '#007bff', 
        color: 'white', 
        textDecoration: 'none',
        borderRadius: '5px'
      }}>
        Go to Dashboard
      </a>
    </div>
  );
}

function Dashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      <p>This is the dashboard page</p>
      <a href="/" style={{ color: '#007bff' }}>← Back to Home</a>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
