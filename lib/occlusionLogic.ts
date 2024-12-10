// lib/occlusionLogic.ts
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
    let hints: string[] = [];
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
    let hash = 0, i, chr;
    for (i = 0; i < text.length; i++) {
      chr   = text.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString();
  }

  private parseOutline(raw_outline: string) {
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

    let result: (Occlusion|string)[] = [];
    const segments = force_spaced_outline.split('{{');
    for (let i = 0; i < segments.length; i++) {
      let part = segments[i].split('}}');
      if (part.length === 1) {
        // no occlusion
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
          // frequency-based logic
          // find least frequent word in the occlusion
          let lowest_word_mapping = 1/2; 
          for (let w of item.answer.split(" ")) {
            w = w.toLowerCase().replace(/[,\.\?\!;:\(\)\[\]{}]/g, "");
            if (wordMapping[w] !== undefined && wordMapping[w] < lowest_word_mapping) {
              lowest_word_mapping = wordMapping[w];
            } else if (wordMapping[w] === undefined) {
              // If word not in the list, treat as very frequent (0)
              lowest_word_mapping = 0;
              break;
            }
          }

          let temp_dropout_rate = dropout_rate * (1 - lowest_word_mapping) ** 5;
          temp_dropout_rate = dropout_rate * dropout_rate + temp_dropout_rate * (1 - dropout_rate);
          if (Math.random() > temp_dropout_rate) {
            item.use_as_blank = false;
          }
        }
      }
    }
    this.original_use_as_blanks = this.outline
      .filter(x => x instanceof Occlusion)
      .map((x: Occlusion| string) => x instanceof Occlusion ? x.use_as_blank : false);
    this.combine_consecutive_occlusions();
  }

  private has_consecutive_occlusions() {
    for (let i = 0; i < this.outline.length - 2; i++) {
      if ((this.outline[i] instanceof Occlusion) &&
          this.outline[i+1] === " " &&
          (this.outline[i+2] instanceof Occlusion) &&
          this.outline[i].use_as_blank &&
          this.outline[i+2].use_as_blank) {
        return true;
      }
    }
    return false;
  }

  combine_consecutive_occlusions() {
    while (this.has_consecutive_occlusions()) {
      let new_outline: (Occlusion|string)[] = [];
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
}

export function generate_initial_outline(rawText: string, dropout_rate: number, wordMapping: Record<string, number>) {
  const outline = new OccludedOutline(rawText);
  outline.set_blanks(dropout_rate, wordMapping);
  outline.combine_consecutive_occlusions();
  return outline;
}

export function calculate_new_dropout_rate(dropout_rate: number, num_attempts: number, num_skipped: number, num_blanks: number, num_hints: number) {
  if (num_blanks === 0) num_blanks = 1;
  let denominator = 0;
  const denom_denom = num_blanks - num_skipped;
  if (denom_denom !== 0) {
    denominator = (num_attempts + num_skipped * num_attempts / denom_denom + num_hints);
  }
  const breakeven_point = 1 - 1/Math.E;
  let overall_score = denominator === 0 ? breakeven_point : num_blanks / denominator;
  let scaling_factor = 1 / breakeven_point;
  let normalized_score = overall_score * scaling_factor;
  let additional_scaler = 0.75 + (1 - dropout_rate);
  dropout_rate = (dropout_rate * normalized_score - dropout_rate) * additional_scaler + dropout_rate;
  dropout_rate = Math.min(Math.max(dropout_rate, 0), 1);
  return dropout_rate;
}
