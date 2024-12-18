"use client";

import React, { useState } from 'react';

interface OutlineSelectorProps {
  onSelect: (outlineName: string, difficulty: number) => void;
  outlines: string[];
  onDelete: (outlineName: string) => void;
  onEdit: (outlineName: string) => void;
}

export default function OutlineSelector({ onSelect, outlines, onDelete, onEdit }: OutlineSelectorProps) {
  const [difficulty, setDifficulty] = useState<number>(5);
  const [selectedOutline, setSelectedOutline] = useState("");

  function startTest() {
    if (!selectedOutline) {
      alert("No outline selected.");
      return;
    }
    onSelect(selectedOutline, difficulty);
  }

  function handleDeleteClick() {
    if (!selectedOutline) {
      alert("No outline selected.");
      return;
    }
    onDelete(selectedOutline);
  }

  function handleEditClick() {
    if (!selectedOutline) {
      alert("No outline selected.");
      return;
    }
    onEdit(selectedOutline);
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
        <div className="text-sm text-gray-600">0 for no blanks, 1000 for all blanks</div>
      </div>
      <div className="flex gap-2">
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={startTest}
        >
          Start Testing
        </button>
        <button 
          className="px-4 py-2 bg-red-600 text-white rounded"
          onClick={handleDeleteClick}
        >
          Delete Outline
        </button>
        <button 
          className="px-4 py-2 bg-yellow-600 text-white rounded"
          onClick={handleEditClick}
        >
          Edit Outline
        </button>
      </div>
    </div>
  );
}
