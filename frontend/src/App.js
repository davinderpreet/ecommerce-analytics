// frontend/src/App.js - Updated with Returns route
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import ProductPerformance from './ProductPerformance';
import Inventory from './Inventory';
import ReturnLog from './ReturnLog';
import Returns from './Returns'; // Add this import
import './App.css';

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-6">
          E-commerce Analytics
        </h1>
        <p className="text-white/70 text-xl mb-8">AI-Powered Multi-Platform Dashboard</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap max-w-4xl mx-auto">
          <a 
            href="/dashboard" 
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-8 py-4 rounded-2xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 inline-block"
          >
            View Dashboard →
          </a>
          <a 
            href="/inventory" 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 px-8 py-4 rounded-2xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 inline-block"
          >
            Inventory Management →
          </a>
          <a 
            href="/performance" 
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-8 py-4 rounded-2xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 inline-block"
          >
            Performance Matrix →
          </a>
          <a 
            href="/returns" 
            className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 px-8 py-4 rounded-2xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 inline-block"
          >
            Returns Management →
          </a>              
        </div>
      </div>
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
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/performance" element={<ProductPerformance />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/return-log" element={<ReturnLog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
