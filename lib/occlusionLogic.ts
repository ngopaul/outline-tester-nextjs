"use client";

export class Occlusion {
  answer: string;
  words_in_answer: string[];
  hints: string[];
  generated_hints: boolean;
  attempts: number;
  hint_counter: number;
  use_as_blank: boolean;
  guessed_correctly: boolean;
  skipped: boolean;

  constructor(answer: string, hintString: string = "") {
    this.answer = answer;
    this.words_in_answer = this.answer.split(" ");
    this.hints = hintString ? hintString.split(",").filter(h => h) : [];
    if (this.hints.length === 0) {
      this.generated_hints = true;
      this.hints = this.generateHints(this.answer);
    } else {
      this.generated_hints = false;
    }
    this.attempts = 0;
    this.hint_counter = -1;
    this.use_as_blank = true;
    this.guessed_correctly = false;
    this.skipped = false;
  }

  private generateHints(answer: string): string[] {
    const words = answer.split(" ");
    const hints: string[] = [];
    let idx = 1;
    let adder = 1;
    let incAdderCounter = 0;
    let wordsCompleted = words.map(() => false);

    while (!wordsCompleted.every(v => v)) {
      const hint = words.map(w => {
        const visibleLen = Math.min(w.length, idx);
        return w.slice(0, visibleLen) + "_".repeat(Math.max(0, w.length - visibleLen));
      }).join(" ");
      hints.push(hint);
      wordsCompleted = words.map(w => idx >= w.length);
      idx += adder;
      incAdderCounter = 1 - incAdderCounter;
      if (incAdderCounter === 0) adder += 1;
    }
    return hints;
  }

  guess(guessStr: string, ignore_case=true, ignore_whitespace=true) {
    this.attempts += 1;
    let correctAns = this.answer;
    let userAns = guessStr;
    if (ignore_case) {
      correctAns = correctAns.toLowerCase();
      userAns = userAns.toLowerCase();
    }
    if (ignore_whitespace) {
      correctAns = correctAns.trim();
      userAns = userAns.trim();
    }
    if (userAns === correctAns) {
      this.guessed_correctly = true;
      return true;
    }
    return false;
  }

  skip() {
    this.skipped = true;
  }

  increase_hint() {
    if (this.hint_counter < this.hints.length - 1) {
      this.hint_counter += 1;
      return true;
    }
    return false;
  }

  get_display_value(with_number_of_words=false) {
    if (!this.use_as_blank || this.guessed_correctly || this.skipped) {
      return this.answer;
    } else {
      const wordHintHelper = with_number_of_words && this.words_in_answer.length > 1 
        ? `(${this.words_in_answer.length})` : "";
      if (this.hint_counter === -1) {
        return "_".repeat(this.answer.length) + wordHintHelper;
      } else {
        return this.hints[this.hint_counter] + wordHintHelper;
      }
    }
  }
}

export class OccludedOutline {
  original_use_as_blanks: boolean[] = [];
  outline: (Occlusion|string)[];
  filehash: string;

  constructor(rawText: string) {
    this.outline = this.parseOutline(rawText);
    this.filehash = this.hashText(rawText);
  }

  private hashText(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const chr = text.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString();
  }

  parseOutline(raw_outline: string) {
    const lines = raw_outline.split('\n').map(line => {
      let i = 0;
      let newLine = line;
      while (i < newLine.length && newLine[i] === ' ') {
        newLine = newLine.slice(0,i) + '&nbsp;' + newLine.slice(i+1);
        i++;
      }
      return newLine;
    });
    const force_spaced_outline = lines.join('\n');

    const result: (Occlusion|string)[] = [];
    const segments = force_spaced_outline.split('{{');
    for (let i = 0; i < segments.length; i++) {
      const part = segments[i].split('}}');
      if (part.length === 1) {
        result.push(part[0]);
      } else {
        const occlusionPart = part[0].split('|');
        if (occlusionPart.length === 1) {
          result.push(new Occlusion(occlusionPart[0], ''));
          result.push(part[1]);
        } else {
          result.push(new Occlusion(occlusionPart[0], occlusionPart[1]));
          result.push(part[1]);
        }
      }
    }
    return result.filter(x => x !== '');
  }

  set_blanks(dropout_rate: number, wordMapping: Record<string, number>) {
    const avoid_words = ["the", "of", "to", "and", "a"];

    for (let i = 0; i < this.outline.length; i++) {
      const item = this.outline[i];
      if (item instanceof Occlusion) {
        const answerLower = item.answer.toLowerCase();
        if (avoid_words.includes(answerLower) && dropout_rate < 1) {
          item.use_as_blank = false;
        } else {
          let lowest_word_mapping = 1/2; 
          const allWords = item.answer.split(" ");
          for (const originalWord of allWords) {
            const w = originalWord.toLowerCase().replace(/[,\.\?\!;:\(\)\[\]{}]/g, "");
            if (w in wordMapping && wordMapping[w] < lowest_word_mapping) {
              lowest_word_mapping = wordMapping[w];
            } else if (!(w in wordMapping)) {
              // If word not in the list, treat as very frequent (0)
              lowest_word_mapping = 0;
              break;
            }
          }

          const temp_dropout_rate = dropout_rate * dropout_rate + (dropout_rate * (1 - lowest_word_mapping) ** 5) * (1 - dropout_rate);
          if (Math.random() > temp_dropout_rate) {
            item.use_as_blank = false;
          }
        }
      }
    }
    this.original_use_as_blanks = this.outline
      .filter(x => x instanceof Occlusion)
      .map(x => x instanceof Occlusion ? x.use_as_blank : false);
    this.combine_consecutive_occlusions();
  }

  private has_consecutive_occlusions() {
    for (let i = 0; i < this.outline.length - 2; i++) {
      if ((this.outline[i] instanceof Occlusion) &&
          this.outline[i+1] === " " &&
          (this.outline[i+2] instanceof Occlusion)) {
        const firstOcclusion = this.outline[i] as Occlusion;
        const secondOcclusion = this.outline[i+2] as Occlusion;
        if (firstOcclusion.use_as_blank && secondOcclusion.use_as_blank) {
          return true;
        }
      }
    }
    return false;
  }

  combine_consecutive_occlusions() {
    while (this.has_consecutive_occlusions()) {
      const new_outline: (Occlusion|string)[] = [];
      let i = 0;
      while (i < this.outline.length - 2) {
        const a = this.outline[i];
        const b = this.outline[i+1];
        const c = this.outline[i+2];
        if ((a instanceof Occlusion) && 
            b === " " &&
            (c instanceof Occlusion) &&
            a.use_as_blank && c.use_as_blank) {
          new_outline.push(
            new Occlusion(a.answer + " " + c.answer, "")
          );
          i += 3;
        } else {
          new_outline.push(this.outline[i]);
          i++;
        }
      }
      while (i < this.outline.length) {
        new_outline.push(this.outline[i]);
        i++;
      }
      this.outline = new_outline;
    }
  }

  // Before splitting multi-word occlusions, replace all whitespace
  // inside occlusions with a single space.
  normalizeOcclusionWhitespace() {
    for (const item of this.outline) {
      if (item instanceof Occlusion) {
        // Replace all whitespace including newlines with a single space
        item.answer = item.answer.replace(/\s+/g, ' ');
        // Update words_in_answer too
        item.words_in_answer = item.answer.split(' ');
      }
    }
  }

  // Split multi-word occlusions into single-word occlusions,
  // keeping punctuation as separate string tokens around the words.
  splitMultiWordOcclusions() {
    const new_outline: (Occlusion|string)[] = [];
    for (const item of this.outline) {
      if (item instanceof Occlusion) {
        const words = item.answer.split(" ");
        if (words.length > 1) {
          for (const originalW of words) {
            const leadingMatch = originalW.match(/^[^A-Za-z0-9']+/);
            const leadingPunc = leadingMatch ? leadingMatch[0] : "";
            const trailingMatch = originalW.match(/[^A-Za-z0-9']+$/);
            const trailingPunc = trailingMatch ? trailingMatch[0] : "";
            const coreWord = originalW.slice(leadingPunc.length, originalW.length - trailingPunc.length);

            if (leadingPunc) {
              new_outline.push(leadingPunc);
            }
            if (coreWord.length > 0) {
              new_outline.push(new Occlusion(coreWord, ''));
            }
            if (trailingPunc) {
              new_outline.push(trailingPunc);
            }

            new_outline.push(" ");
          }
          // remove last space if present
          if (new_outline[new_outline.length - 1] === " ") {
            new_outline.pop();
          }
        } else {
          const originalW = words[0];
          const leadingMatch = originalW.match(/^[^A-Za-z0-9']+/);
          const leadingPunc = leadingMatch ? leadingMatch[0] : "";
          const trailingMatch = originalW.match(/[^A-Za-z0-9']+$/);
          const trailingPunc = trailingMatch ? trailingMatch[0] : "";
          const coreWord = originalW.slice(leadingPunc.length, originalW.length - trailingPunc.length);

          if (leadingPunc) {
            new_outline.push(leadingPunc);
          }
          if (coreWord.length > 0) {
            new_outline.push(new Occlusion(coreWord, ''));
          }
          if (trailingPunc) {
            new_outline.push(trailingPunc);
          }
        }
      } else {
        new_outline.push(item);
      }
    }
    this.outline = new_outline;
  }
}

export function generate_initial_outline(rawText: string, dropout_rate: number, wordMapping: Record<string, number>) {
  const outline = new OccludedOutline(rawText);
  
  // First normalize all whitespace inside occlusions
  outline.normalizeOcclusionWhitespace();

  // Then perform the splitting of multi-word occlusions
  outline.splitMultiWordOcclusions();

  outline.set_blanks(dropout_rate, wordMapping);
  outline.combine_consecutive_occlusions();
  return outline;
}

export function calculate_new_dropout_rate(dropout_rate: number, num_attempts: number, num_skipped: number, num_blanks: number, num_hints: number) {
  const tempNumBlanks = num_blanks === 0 ? 1 : num_blanks;
  let denominator = 0;
  const denom_denom = tempNumBlanks - num_skipped;
  if (denom_denom !== 0) {
    denominator = (num_attempts + num_skipped * num_attempts / denom_denom + num_hints);
  }
  const breakeven_point = 1 - 1/Math.E;
  const overall_score = denominator === 0 ? breakeven_point : tempNumBlanks / denominator;
  const scaling_factor = 1 / breakeven_point;
  const normalized_score = overall_score * scaling_factor;
  const additional_scaler = 0.75 + (1 - dropout_rate);
  let new_rate = (dropout_rate * normalized_score - dropout_rate) * additional_scaler + dropout_rate;
  new_rate = Math.min(Math.max(new_rate, 0), 1);
  return new_rate;
}
