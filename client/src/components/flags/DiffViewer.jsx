import React from 'react';

export function DiffViewer({ fromRev, toRev, fromContent = '', toContent = '', changedBy }) {
  const fromLines = fromContent.split('\n');
  const toLines = toContent.split('\n');

  return (
    <div className="diff-viewer">
      {/* Left Pane: Old Revision */}
      <div className="diff-pane">
        <div className="diff-pane-header">
          <span>Previous: Rev {fromRev}</span>
          <span style={{ color: '#f87171' }}>Original Baseline</span>
        </div>
        {fromLines.map((line, idx) => {
          const isRemoved = !toLines.includes(line);
          return (
            <div
              key={idx}
              className={isRemoved ? 'diff-line-removed' : 'diff-line-normal'}
            >
              <span style={{ opacity: 0.5, marginRight: '8px', userSelect: 'none' }}>{idx + 1}</span>
              {isRemoved ? '- ' : '  '}{line}
            </div>
          );
        })}
      </div>

      {/* Right Pane: New Revision */}
      <div className="diff-pane">
        <div className="diff-pane-header">
          <span>Revised: Rev {toRev}</span>
          <span style={{ color: '#34d399' }}>Changed by: {changedBy || 'teammate'}</span>
        </div>
        {toLines.map((line, idx) => {
          const isAdded = !fromLines.includes(line);
          return (
            <div
              key={idx}
              className={isAdded ? 'diff-line-added' : 'diff-line-normal'}
            >
              <span style={{ opacity: 0.5, marginRight: '8px', userSelect: 'none' }}>{idx + 1}</span>
              {isAdded ? '+ ' : '  '}{line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
