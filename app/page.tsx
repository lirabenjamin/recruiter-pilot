// app/page.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontFamily: 'sans-serif',
    background: 'linear-gradient(to bottom right, #e0f7fa, #fff)',
    padding: '20px'
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    textAlign: 'center'
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '1.8rem',
    marginBottom: '20px',
    fontWeight: 'normal'
  };

  const paragraphStyle: React.CSSProperties = {
    fontSize: '1rem',
    lineHeight: '1.6',
    marginBottom: '30px',
    color: '#555'
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#0070f3',
    border: 'none',
    borderRadius: '5px',
    color: '#fff',
    fontSize: '1rem',
    padding: '10px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  const handleBegin = () => {
    router.push('/pairs');
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Click begin to get started!</h1>
        
        <button
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#005bb5')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0070f3')}
          onClick={handleBegin}
        >
          Begin
        </button>
      </div>
    </div>
  );
}
