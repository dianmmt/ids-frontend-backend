import React from 'react';

interface ChartProps {
  type: 'line' | 'bar';
}

export const Chart: React.FC<ChartProps> = ({ type }) => {
  // Mock data visualization - in real implementation, integrate with charting library
  const data = Array.from({ length: 20 }, (_, i) => ({
    x: i,
    y: Math.random() * 100 + 20
  }));

  if (type === 'line') {
    return (
      <div className="h-40 bg-gray-900/50 rounded-lg p-4 flex items-end space-x-1">
        {data.map((point, index) => (
          <div key={index} className="flex-1 flex flex-col justify-end">
            <div 
              className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
              style={{ height: `${point.y}%` }}
            ></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-40 bg-gray-900/50 rounded-lg p-4 flex items-end space-x-2">
      {data.slice(0, 10).map((point, index) => (
        <div key={index} className="flex-1 flex flex-col justify-end">
          <div 
            className="bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
            style={{ height: `${point.y}%` }}
          ></div>
        </div>
      ))}
    </div>
  );
};