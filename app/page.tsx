"use client";

import React, { useState, useEffect } from 'react';
import OutlineSelector from '../components/OutlineSelector';
import OutlineEditor from '../components/OutlineEditor';
import { generate_initial_outline, OccludedOutline } from '../lib/occlusionLogic';
import OutlineTester from '../components/OutlineTester';

interface OutlineData {
  title: string;
  text: string;
}

interface OutlineWithRate {
  outline: (string | ReturnType<typeof OccludedOutline.prototype.parseOutline>[number])[];
  dropout_rate: number;
}

export default function Home() {
  const [mode, setMode] = useState<"select" | "test" | "results">("select");
  const [currentOutlineObj, setCurrentOutlineObj] = useState<OutlineWithRate | null>(null);
  const [results, setResults] = useState<{
    num_blanks: number;
    num_attempts: number;
    num_skipped: number;
    num_hints: number;
    suggestedDifficulty: number;
  } | null>(null);

  const [combinedOutlines, setCombinedOutlines] = useState<string[]>([]);
  const [wordMapping, setWordMapping] = useState<Record<string, number>>({});
  const [editingOutline, setEditingOutline] = useState<{title: string; text: string} | null>(null);

  const [codeInput, setCodeInput] = useState("");

  function refreshOutlines() {
    Promise.all([
      fetch('/outlines/outlines.json').then(r => r.json()),
    ]).then(([publicOutlines]) => {
      const stored: OutlineData[] = JSON.parse(localStorage.getItem("customOutlines") || "[]");
      const localTitles = stored.map(o => o.title);
      const combined = [...publicOutlines, ...localTitles];
      setCombinedOutlines(combined);
    }).catch(() => {
      const stored: OutlineData[] = JSON.parse(localStorage.getItem("customOutlines") || "[]");
      const localTitles = stored.map(o => o.title);
      setCombinedOutlines(localTitles);
    });
  }

  useEffect(() => {
    refreshOutlines();
    // Load 1000words.txt and create mapping
    fetch('/outlines/1000words.txt')
      .then(r => r.text())
      .then(text => {
        const words = text.split('\n').map(w => w.trim()).filter(w => w);
        const mapping: Record<string, number> = {};
        let denom = 2;
        for (const w of words) {
          mapping[w.toLowerCase()] = 1/denom;
          denom += 0.2;
        }
        setWordMapping(mapping);
      });
  }, []);

  async function handleLoadCode() {
    if (!codeInput) {
      alert("Please enter a code.");
      return;
    }
    const res = await fetch('/outlineCodes.json');
    if (!res.ok) {
      alert("Failed to load codes file.");
      return;
    }
    const mapping: Record<string, string[]> = await res.json();
    const filenames = mapping[codeInput.toUpperCase()];
    if (!filenames) {
      alert("Invalid code.");
      return;
    }
    if (!window.confirm(
        `This code will add or overwrite these outlines: ${filenames.join(', ')}.\n` +
        `Any other locally-stored outlines will remain untouched.\nProceed?`
      )) {
      return;
    }
  
    // 1. Fetch the new outlines
    const loaded: OutlineData[] = await Promise.all(
      filenames.map(async fname => {
        const r = await fetch(`/outlines/${fname}`);
        if (!r.ok) throw new Error(`Failed to fetch ${fname}`);
        const text = await r.text();
        return { title: fname.replace(/\.txt$/, ''), text };
      })
    );
  
    // 2. Merge into existing local outlines
    const existing: OutlineData[] = JSON.parse(
      localStorage.getItem("customOutlines") || "[]"
    );
  
    const mergedMap = new Map<string, OutlineData>();
    existing.forEach(o => mergedMap.set(o.title, o));
    loaded.forEach(o   => mergedMap.set(o.title, o));  // override or add
  
    const merged = Array.from(mergedMap.values());
    localStorage.setItem("customOutlines", JSON.stringify(merged));
  
    refreshOutlines();
    alert("Outlines loaded and merged into your local set.");
  }

  async function handleSelect(outlineName: string, difficulty: number) {
    const found = await fetchOutlineText(outlineName);
    if (!found) {
      alert("Outline not found");
      return;
    }
    const generatedOutline = generate_initial_outline(found, difficulty / 10.0, wordMapping);
    const outlineObjWithRate: OutlineWithRate = {
      outline: generatedOutline.outline,
      dropout_rate: difficulty / 10.0,
    };
    setCurrentOutlineObj(outlineObjWithRate);
    setMode("test");
  }

  async function fetchOutlineText(outlineName: string): Promise<string|null> {
    if (outlineName.endsWith('.txt')) {
      const res = await fetch(`/outlines/${outlineName}`);
      if (res.ok) {
        return await res.text();
      }
      return null;
    } else {
      const stored: OutlineData[] = JSON.parse(localStorage.getItem("customOutlines") || "[]");
      const found = stored.find(o => o.title === outlineName);
      return found ? found.text : null;
    }
  }

  function handleDone() {
    // After adding/editing, refresh outlines
    setEditingOutline(null);
    refreshOutlines();
  }

  function handleTestFinish(data: {
    num_blanks: number;
    num_attempts: number;
    num_skipped: number;
    num_hints: number;
    suggestedDifficulty: number;
  }) {
    setResults(data);
    setMode("results");
  }

  function handleQuit() {
    setMode("select");
    setCurrentOutlineObj(null);
  }

  async function handleDelete(outlineName: string) {
    if (!outlineName) {
      alert("No outline selected.");
      return;
    }
    if (outlineName.endsWith('.txt')) {
      alert("Cannot delete public outline.");
      return;
    }
    const stored: OutlineData[] = JSON.parse(localStorage.getItem("customOutlines") || "[]");
    const filtered = stored.filter(o => o.title !== outlineName);
    localStorage.setItem("customOutlines", JSON.stringify(filtered));
    refreshOutlines();
  }

  async function handleEdit(outlineName: string) {
    if (!outlineName) {
      alert("No outline selected.");
      return;
    }
    if (outlineName.endsWith('.txt')) {
      alert("Cannot edit public outline.");
      return;
    }
    const stored: OutlineData[] = JSON.parse(localStorage.getItem("customOutlines") || "[]");
    const found = stored.find(o => o.title === outlineName);
    if (!found) {
      alert("Outline not found in local storage.");
      return;
    }
    setEditingOutline({title: found.title, text: found.text});
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {mode === "select" && (
        <>
          {/* existing selector & editor */}
          <OutlineSelector 
            onSelect={handleSelect} 
            outlines={combinedOutlines}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
          <OutlineEditor
            onDone={handleDone}
            refreshOutlines={refreshOutlines}
            initialTitle={editingOutline?.title}
            initialText={editingOutline?.text}
          />
          <div className="border p-4 rounded bg-gray-50">
            <h3 className="font-bold mb-2">Enter Load Code</h3>
            <div className="flex gap-2">
              <input
                type="text"
                className="border p-2 flex-grow"
                placeholder="Enter code (e.g. ABCD)"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
              />
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded"
                onClick={handleLoadCode}
              >
                Load Outlines
              </button>
            </div>
          </div>
        </>
      )}
      {(mode === "results" || mode === "test") && currentOutlineObj && (
        <OutlineTester outlineObj={currentOutlineObj} onDone={handleTestFinish} onQuit={handleQuit} />
      )}
      {mode === "results" && results && (
        <div className="border p-4 rounded bg-gray-50 mt-4">
          <h3 className="font-bold mb-2">Results</h3>
          <p>Filled {results.num_blanks} blanks.</p>
          <p>Finished in {results.num_attempts} attempts, with {results.num_skipped} skipped, and {results.num_hints} hints.</p>
          <p>Suggested new difficulty: {results.suggestedDifficulty}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => setMode("select")}
          >
            Back to selection
          </button>
        </div>
      )}
      <div className="mt-4 pb-24"></div>
      <div className="mt-4 pb-24"></div>
    </div>
  );
}
