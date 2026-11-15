'use strict';

const bidiFactory = require('bidi-js');

const bidi = bidiFactory();

/**
 * PDFKit draws the letters of Arabic correctly joined, but it does not put mixed text (Arabic
 * words next to numbers or English) in reading order. This splits a text of a right-to-left page
 * into runs and gives them in the order they appear on the page, from left to right:
 * [{ text, level }]. Draw each run one after the other. A run of an odd level is Arabic (PDFKit
 * lays it out right to left), an even level is a number or English (left to right).
 */
function visualRuns(text) {
  if (!text) return [];
  const { levels } = bidi.getEmbeddingLevels(text, 'rtl');

  const runs = [];
  for (let i = 0; i < text.length; i += 1) {
    const level = levels[i];
    const last = runs[runs.length - 1];
    if (last && last.level === level) last.text += text[i];
    else runs.push({ text: text[i], level });
  }

  // Rule L2 of the Unicode bidirectional algorithm: from the deepest level up to the lowest odd
  // level, turn each group of neighbouring runs at that level or deeper around.
  const deepest = Math.max(...runs.map((run) => run.level));
  const odd = runs.filter((run) => run.level % 2 === 1).map((run) => run.level);
  if (odd.length > 0) {
    for (let level = deepest; level >= Math.min(...odd); level -= 1) {
      for (let i = 0; i < runs.length; i += 1) {
        if (runs[i].level >= level) {
          let end = i;
          while (end + 1 < runs.length && runs[end + 1].level >= level) end += 1;
          const group = runs.slice(i, end + 1).reverse();
          runs.splice(i, group.length, ...group);
          i = end;
        }
      }
    }
  }

  // Brackets and the like are drawn mirrored inside right-to-left runs.
  return runs.map((run) =>
    run.level % 2 === 1
      ? {
          level: run.level,
          text: [...run.text].map((char) => bidi.getMirroredCharacter(char) ?? char).join(''),
        }
      : run,
  );
}

module.exports = { visualRuns };
