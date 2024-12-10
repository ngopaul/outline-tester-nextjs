// components/OutlineEditor.tsx
"use client";

import React, { useState } from 'react';

interface OutlineEditorProps {
  onDone?: (title: string) => void;
  refreshOutlines: () => void; // added to refresh outlines after save
}

export default function OutlineEditor({ onDone, refreshOutlines }: OutlineEditorProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  function saveOutline() {
    if (!title || !text) return;
    const stored = JSON.parse(localStorage.getItem("customOutlines") || "[]");
    const filtered = stored.filter((o: {title: string; text: string}) => o.title !== title);
    filtered.push({title, text});
    localStorage.setItem("customOutlines", JSON.stringify(filtered));
    setSavedMessage("Saved!");
    refreshOutlines(); // refresh the dropdown
    if (onDone) onDone(title);

    // fade out "Saved!" after a short delay
    setTimeout(() => setSavedMessage(""), 2000);
  }

  return (
    <div className="border p-4 rounded bg-gray-50 mt-4">
      <h3 className="font-bold text-lg mb-2">Add/Edit Outline</h3>
      <input 
        className="border p-2 mb-2 w-full" 
        placeholder="Outline Title" 
        value={title} 
        onChange={(e)=>setTitle(e.target.value)} 
      />
      <textarea
        className="border p-2 mb-2 w-full"
        placeholder="Paste outline text here. Words within {{ }} are considered testable words. Otherwise, they will not be tested."
        value={text}
        onChange={(e)=>setText(e.target.value)}
        rows={10}
      ></textarea>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded mr-2"
        onClick={saveOutline}
      >
        Save Outline
      </button>
      {savedMessage && <span className="text-green-600 ml-2">{savedMessage}</span>}
    </div>
  );
}
