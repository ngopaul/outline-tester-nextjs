// components/OutlineSelector.tsx
"use client";

import React, { useState, useEffect } from 'react';

interface OutlineSelectorProps {
  onSelect: (outlineName: string, difficulty: number) => void;
  outlines: string[]; // now we pass the outlines list as a prop
}

export default function OutlineSelector({ onSelect, outlines }: OutlineSelectorProps) {
  const [difficulty, setDifficulty] = useState<number>(5);
  const [selectedOutline, setSelectedOutline] = useState("");

  function startTest() {
    if (!selectedOutline) return;
    onSelect(selectedOutline, difficulty);
  }

  return (
    <div className="border p-4 rounded bg-gray-50">
      <h3 className="font-bold text-lg mb-2">Select Outline</h3>
      {outlines.length === 0 && <div className="text-sm text-gray-600">No outlines found. Add one below or refresh.</div>}
      <select 
        className="border p-2 mb-2 w-full" 
        onChange={(e) => setSelectedOutline(e.target.value)}
        value={selectedOutline}
      >
        <option value="">--Select Outline--</option>
        {outlines.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <div className="mb-2">
        <label className="mr-2">Difficulty (1-10):</label>
        <input 
          type="number" 
          className="border p-1 w-16" 
          value={difficulty} 
          min={0} 
          max={10} 
          onChange={(e) => setDifficulty(parseInt(e.target.value) || 0)} 
        />
      </div>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={startTest}
      >
        Start Testing
      </button>
    </div>
  );
}
