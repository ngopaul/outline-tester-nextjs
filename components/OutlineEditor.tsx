"use client";

import React, { useState, useEffect, useRef } from 'react';

interface OutlineEditorProps {
  onDone?: (title: string) => void;
  refreshOutlines: () => void; 
  initialTitle?: string;
  initialText?: string;
}

export default function OutlineEditor({ onDone, refreshOutlines, initialTitle, initialText }: OutlineEditorProps) {
  const [title, setTitle] = useState(initialTitle || "");
  const [text, setText] = useState(initialText || "");
  const [savedMessage, setSavedMessage] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // If initialTitle or initialText changes, update state
    setTitle(initialTitle || "");
    setText(initialText || "");
  }, [initialTitle, initialText]);

  function saveOutline() {
    if (!title || !text) {
      alert("Please provide both title and text.");
      return;
    }
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

  function wrapCurrentWord() {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    textarea.focus();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fullText = textarea.value;

    // If no selection, use the cursor as both start and end
    const cursorPos = start === end ? start : end;

    // Find word boundaries
    let wordStart = cursorPos;
    while (wordStart > 0 && !/\s|[.:]/.test(fullText[wordStart - 1])) {
      wordStart--;
    }

    let wordEnd = cursorPos;
    while (wordEnd < fullText.length && !/\s|[.:]/.test(fullText[wordEnd])) {
      wordEnd++;
    }

    const word = fullText.slice(wordStart, wordEnd);
    const newText = fullText.slice(0, wordStart) + `{{${word}}}` + fullText.slice(wordEnd);

    setText(newText);

    // Position cursor after the inserted }}:
    const newCursorPos = wordStart + 2 + word.length + 2 + 1; // `{{` + word + `}}  nextword`
    requestAnimationFrame(() => {
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
    });
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
        ref={textAreaRef}
        className="border p-2 mb-2 w-full"
        placeholder="Put outline text here. Only words wrapped with double curly braces ({{word}}) will be tested."
        value={text}
        onChange={(e)=>setText(e.target.value)}
        rows={10}
      ></textarea>
      <button
        className="px-4 py-2 bg-green-600 text-white rounded mr-2"
        onClick={wrapCurrentWord}
      >
        Wrap Word
      </button>
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
