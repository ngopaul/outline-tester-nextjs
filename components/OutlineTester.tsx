"use client";

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
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
  const [occlusions, setOcclusions] = useState<Occlusion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [guess, setGuess] = useState("");

  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Compute occlusions based on the outline
    const blanks = outlineObj.outline.filter(x => x instanceof Occlusion && x.use_as_blank) as Occlusion[];
    setOcclusions(blanks);
  }, [outlineObj]);

  useEffect(() => {
    // Only run this after occlusions are computed (not null)
    if (occlusions !== null) {
      // If no blanks, treat as completed test immediately
      if (occlusions.length === 0 && outlineObj.outline.length > 0) {
        finishTest();
      }
    }
  }, [occlusions, outlineObj.outline.length]);

  useEffect(() => {
    function updateOffset() {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        setKeyboardOffset(offset > 0 ? offset : 0);
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateOffset);
      updateOffset();
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', updateOffset);
        }
      };
    }
  }, []);

  if (occlusions === null) {
    // Occlusions not computed yet - just show loading or the outline
    return (
      <div className="relative" style={{ height: '100dvh' }}>
        <div className="overflow-auto h-full p-4 font-mono whitespace-pre-wrap" ref={contentRef}>
          {outlineObj.outline.map((item, idx) => {
            if (typeof item === 'string') {
              return <span key={idx} dangerouslySetInnerHTML={{ __html: item }} />;
            } else {
              return <span key={idx}>{item.get_display_value()}</span>;
            }
          })}
        </div>
      </div>
    );
  }

  // If we got here, occlusions is not null
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
    inputRef.current?.focus();
  }

  function handleGuess(input: string) {
    if (!input.trim()) return;
    if (!occlusions) return;
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
    setMessage(moreHints ? "Hint given!" : "No more hints available.");
    setGuess("");
    if (!occlusions) return;
    setOcclusions([...occlusions]);
  }

  function handleSkip() {
    currentOcclusion.skip();
    setMessage("Skipped.");
    setGuess("");
    if (!occlusions) return;
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
    if (!occlusions) return;
    const num_blanks = occlusions.length;
    const num_attempts = occlusions.reduce((a, b) => a + b.attempts, 0);
    const num_skipped = occlusions.filter(o => o.skipped).length;
    const num_hints = occlusions.reduce((a, b) => a + ((b.hint_counter + 1) > 0 ? b.hint_counter + 1 : 0), 0);
    const newRate = calculate_new_dropout_rate(outlineObj.dropout_rate, num_attempts, num_skipped, num_blanks, num_hints);
    onDone({ 
      num_blanks, 
      num_attempts, 
      num_skipped, 
      num_hints, 
      suggestedDifficulty: Math.round(newRate * 10) 
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleGuessAction(guess);
    }
  }

  return (
    <div className="relative" style={{ height: '100dvh' }}>
      <div className="overflow-auto h-full p-4 font-mono whitespace-pre-wrap" ref={contentRef}>
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

      {(occlusions.length > 0 && currentIndex < occlusions.length) && (
        <div 
          className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 z-50"
          style={{ transform: `translateY(-${keyboardOffset}px)` }}
        >
          {message && <div className="text-blue-700 mb-1">{message}</div>}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input 
              className="border p-1 flex-grow"
              value={guess} 
              onChange={(e) => setGuess(e.target.value)} 
              onKeyDown={handleKeyDown}
              ref={inputRef}
              placeholder="Type guess, 'hint', 'skip', or 'quit'..."
            />
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => handleGuessAction(guess)}>
                Guess
              </button>
              <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={() => { handleHint(); inputRef.current?.focus(); }}>
                Hint
              </button>
              <button className="px-3 py-1 bg-gray-500 text-white rounded" onClick={() => { handleSkip(); inputRef.current?.focus(); }}>
                Skip
              </button>
              <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => { handleQuit(); inputRef.current?.focus(); }}>
                Quit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
