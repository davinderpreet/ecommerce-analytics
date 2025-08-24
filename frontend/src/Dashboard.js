import React, { useState } from 'react';

const Dashboard = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  // Sample data
  const metrics = [
    { title: 'Total Revenue', value: '$262,640', change: '+12.5%' },
    { title: 'Total Orders', value: '3,858', change: '+8.2%' },
    { title: 'Products Sold', value: '15,432', change: '+15.7%' },
    { title: 'Avg Order Value', value: '$68.12', change: '-2.1%' }
  ];

  const platforms = [
    { id: 'all', name: 'All Platforms' },
    { id: 'bestbuy', name: 'BestBuy' },
    { id: 'shopify', name: 'Shopify' }
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1e293b 0%, #7c3aed 50%, #1e293b 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 'bold', 
          color: 'white', 
          margin: '0 0 10px 0' 
        }}>
          Sales Analytics Dashboard
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
          Real-time insights across all your sales channels
        </p>
      </div>

      {/* Platform Selector */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {platforms.map(platform => (
            <button
              key={platform.id}
              onClick={() => setSelectedPlatform(platform.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '15px',
                border: 'none',
                backgroundColor: selectedPlatform === platform.id 
                  ? '#8b5cf6' 
                  : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
            >
              {platform.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {metrics.map((metric, index) => (
          <div key={index} style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h3 style={{ 
              color: 'rgba(255, 255, 255, 0.7)', 
              fontSize: '0.9rem', 
              margin: '0 0 10px 0' 
            }}>
              {metric.title}
            </h3>
            <p style={{ 
              color: 'white', 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              margin: '0 0 5px 0' 
            }}>
              {metric.value}
            </p>
            <span style={{ 
              color: metric.change.startsWith('+') ? '#10b981' : '#ef4444',
              fontSize: '0.9rem'
            }}>
              {metric.change}
            </span>
          </div>
        ))}
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '25px',
          padding: '10px 20px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#10b981',
            borderRadius: '50%'
          }}></div>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
            Dashboard loaded with sample data
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
