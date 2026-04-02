'use client';
import React, { useEffect, useState, useRef } from 'react';

type ClaimedPair = {
  assignmentId: string;
  pairId: string;
  leftHtml: string;
  rightHtml: string;
};

export default function PairsPage() {
  const [currentPair, setCurrentPair] = useState<ClaimedPair | null>(null);
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | null>(null);
  const [comparisonsCount, setComparisonsCount] = useState<number>(0);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const participantIdRef = useRef<string | null>(null);

  // Read participant identifier from URL + fetch first pair (once only)
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const rid = params.get('response_id');
    setParticipantId(rid);
    participantIdRef.current = rid;

    // Fetch first pair immediately
    fetch('/api/get-pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: rid ?? undefined }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.pair) {
          setCurrentPair(data.pair as ClaimedPair);
        }
      });
  }, []);

  // Notify Qualtrics parent when we've hit 10 comparisons
  useEffect(() => {
    if (comparisonsCount >= 10) {
      try {
        if (typeof window !== 'undefined' && window.parent) {
          window.parent.postMessage({ type: 'QUALTRICS_ADVANCE' }, '*');
        }
      } catch {
        // ignore cross-origin errors
      }
    }
  }, [comparisonsCount]);

  const fetchNextPair = async () => {
    const res = await fetch('/api/get-pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantIdRef.current ?? undefined }),
    });
    const data = await res.json();
    if (data?.pair) {
      setCurrentPair(data.pair as ClaimedPair);
      setSelectedSide(null);
    } else {
      setCurrentPair(null);
    }
  };

  const handleSubmit = async () => {
    if (selectedSide == null || !currentPair) return;
    await fetch('/api/submit-comparison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId: currentPair.assignmentId,
        participantId: participantId ?? undefined,
        choice: selectedSide,
      }),
    });

    const newCount = comparisonsCount + 1;
    setComparisonsCount(newCount);
    if (newCount < 10) {
      await fetchNextPair();
    } else {
      setCurrentPair(null);
    }
  };

  if (comparisonsCount >= 10) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2>Thank you for participating!</h2>
        <p>You have completed all 10 comparisons.</p>
      </div>
    );
  }

  if (!currentPair) {
    if (comparisonsCount === 0) {
      return (
        <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h2>Loading...</h2>
          <p>Please wait a moment.</p>
        </div>
      );
    } else {
      return (
        <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h2>Thank you for participating!</h2>
          <p>You have completed all available comparisons.</p>
        </div>
      );
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '40px auto',
    fontFamily: 'sans-serif',
    padding: '0 20px',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    marginBottom: '20px',
    textAlign: 'center',
    fontWeight: 'normal',
  };

  const comparisonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '20px',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  };

  const cardBaseStyle: React.CSSProperties = {
    flex: '1 1 45%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    cursor: 'pointer',
    boxSizing: 'border-box',
    background: '#fff',
    transition: 'all 0.3s'
  };

  const selectedCardStyle: React.CSSProperties = {
    borderColor: '#0070f3',
    boxShadow: '0 0 12px rgba(0,112,243,0.3)',
    background: 'rgba(0,112,243,0.05)'
  };

  const buttonStyle: React.CSSProperties = {
    display: 'block',
    margin: '40px auto 0 auto',
    padding: '10px 20px',
    fontSize: '1rem',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: '#0070f3',
    color: '#fff',
    cursor: selectedSide == null ? 'not-allowed' : 'pointer',
    opacity: selectedSide == null ? 0.6 : 1,
    transition: 'opacity 0.3s',
  };

  const getCardStyle = (side: 'left' | 'right'): React.CSSProperties => {
    return selectedSide === side ? { ...cardBaseStyle, ...selectedCardStyle } : cardBaseStyle;
  };

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>
        Imagine you're hiring someone to join your team. Which cover letter would make you more likely to offer an interview to the candidate? Choose one.
      </h2>
      <div style={comparisonContainerStyle}>
        <div
          style={getCardStyle('left')}
          onClick={() => setSelectedSide('left')}
          dangerouslySetInnerHTML={{ __html: currentPair.leftHtml }}
        />
        <div
          style={getCardStyle('right')}
          onClick={() => setSelectedSide('right')}
          dangerouslySetInnerHTML={{ __html: currentPair.rightHtml }}
        />
      </div>
      <button style={buttonStyle} onClick={handleSubmit} disabled={selectedSide == null}>
        Next
      </button>
    </div>
  );
}
