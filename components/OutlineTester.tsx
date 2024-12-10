"use client";

import React, { useState, useEffect, KeyboardEvent } from 'react';
import { Occlusion, calculate_new_dropout_rate } from '../lib/occlusionLogic';

interface OutlineTesterProps {
  outlineObj: {
    outline: (Occlusion | string)[];
    dropout_rate: number;
  };
  onDone: (data: {
    num_blanks: number;
    num_attempts: number;
    num_skipped: number;
    num_hints: number;
    suggestedDifficulty: number;
  }) => void;
  onQuit: () => void;
}

export default function OutlineTester({ outlineObj, onDone, onQuit }: OutlineTesterProps) {
  const [occlusions, setOcclusions] = useState<Occlusion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [guess, setGuess] = useState("");

  useEffect(() => {
    const blanks = outlineObj.outline.filter(x => x instanceof Occlusion && x.use_as_blank) as Occlusion[];
    setOcclusions(blanks);
  }, [outlineObj]);

  if (!occlusions.length) {
    return <div className="text-sm text-gray-600">No blanks to guess. Check difficulty or outline content.</div>;
  }

  const currentOcclusion = occlusions[currentIndex];

  function handleGuessAction(input: string) {
    const cmd = input.trim().toLowerCase();
    if (cmd === 'hint') {
      handleHint();
    } else if (cmd === 'skip') {
      handleSkip();
    } else if (cmd === 'quit') {
      handleQuit();
    } else {
      handleGuess(input);
    }
  }

  function handleGuess(input: string) {
    if (!input.trim()) return;
    const correct = currentOcclusion.guess(input);
    if (correct) {
      setMessage("Correct!");
      setGuess("");
      if (currentIndex + 1 < occlusions.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        finishTest();
      }
    } else {
      setMessage(`'${input}' is incorrect.`);
      setGuess("");
    }
  }

  function handleHint() {
    const moreHints = currentOcclusion.increase_hint();
    if (moreHints) {
      setMessage("Hint given!");
    } else {
      setMessage("No more hints available.");
    }
    setGuess("");
    setOcclusions([...occlusions]); // re-render to show updated hint
  }

  function handleSkip() {
    currentOcclusion.skip();
    setMessage("Skipped.");
    setGuess("");
    if (currentIndex + 1 < occlusions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishTest();
    }
  }

  function handleQuit() {
    setMessage("Quitting...");
    onQuit();
  }

  function finishTest() {
    const num_blanks = occlusions.length;
    const num_attempts = occlusions.reduce((a, b) => a + b.attempts, 0);
    const num_skipped = occlusions.filter(o => o.skipped).length;
    const num_hints = occlusions.reduce((a, b) => a + ((b.hint_counter + 1) > 0 ? b.hint_counter + 1 : 0), 0);
    const newRate = calculate_new_dropout_rate(outlineObj.dropout_rate, num_attempts, num_skipped, num_blanks, num_hints);
    onDone({ num_blanks, num_attempts, num_skipped, num_hints, suggestedDifficulty: Math.round(newRate * 10) });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleGuessAction(guess);
    }
  }

  return (
    <div className="relative h-screen overflow-hidden">
      {/* The scrollable content area */}
      <div className="overflow-auto h-full pb-24 p-4 font-mono whitespace-pre-wrap">
        {outlineObj.outline.map((item, idx) => {
          if (typeof item === 'string') {
            return <span key={idx} dangerouslySetInnerHTML={{ __html: item }} />;
          } else {
            const isCurrent = occlusions[currentIndex] === item && !item.guessed_correctly && !item.skipped;
            let color = "text-black";
            if (item.guessed_correctly) color = "text-green-600";
            else if (item.skipped) color = "text-gray-400 italic";
            else if (isCurrent) color = "text-red-600";
            return <span key={idx} className={color}>{item.get_display_value()}</span>;
          }
        })}
      </div>

      {/* Fixed input panel with safe-area padding */}
      <div 
        className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {message && <div className="text-blue-700 mb-1">{message}</div>}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input 
            className="border p-1 flex-grow"
            value={guess} 
            onChange={(e) => setGuess(e.target.value)} 
            onKeyDown={handleKeyDown}
            placeholder="Type guess, 'hint', 'skip', or 'quit'..." 
          />
          <div className="flex gap-2">
            <button 
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={() => handleGuessAction(guess)}
            >
              Guess
            </button>
            <button 
              className="px-3 py-1 bg-yellow-500 text-white rounded"
              onClick={handleHint}
            >
              Hint
            </button>
            <button 
              className="px-3 py-1 bg-gray-500 text-white rounded"
              onClick={handleSkip}
            >
              Skip
            </button>
            <button 
              className="px-3 py-1 bg-red-500 text-white rounded"
              onClick={handleQuit}
            >
              Quit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
