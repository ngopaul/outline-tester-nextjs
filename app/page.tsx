"use client";

import React, { useState, useEffect } from 'react';
import OutlineSelector from '../components/OutlineSelector';
import OutlineEditor from '../components/OutlineEditor';
import { generate_initial_outline, OccludedOutline, calculate_new_dropout_rate } from '../lib/occlusionLogic';
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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Outline Memorization Tool</h1>
      {mode === "select" && (
        <div>
          <OutlineSelector onSelect={handleSelect} outlines={combinedOutlines} />
          <OutlineEditor onDone={handleDone} refreshOutlines={refreshOutlines} />
        </div>
      )}
      {mode === "test" && currentOutlineObj && (
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
    </div>
  );
}
