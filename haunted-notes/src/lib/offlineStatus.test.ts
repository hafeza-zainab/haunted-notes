import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  modelStatus,
  REQUIRED_MODEL_FILES,
  WHISPER_MODEL_ID,
} from './offlineStatus';

const base = `https://huggingface.co/${WHISPER_MODEL_ID}/resolve/main/`;
const fullList = [
  `${base}config.json`,
  `${base}tokenizer.json`,
  `${base}onnx/encoder_model_quantized.onnx`,
  `${base}onnx/decoder_model_merged_quantized.onnx`,
];

describe('modelStatus', () => {
  it('is ready when all required files are cached', () => {
    expect(modelStatus(fullList)).toBe('ready');
  });

  it('is not-downloaded when one file is missing', () => {
    expect(modelStatus(fullList.slice(0, 3))).toBe('not-downloaded');
  });

  it('is not-downloaded for an empty list', () => {
    expect(modelStatus([])).toBe('not-downloaded');
  });

  it('ignores URLs of another model', () => {
    const other = fullList.map((u) => u.replace(WHISPER_MODEL_ID, 'Xenova/other-model'));
    expect(modelStatus(other)).toBe('not-downloaded');
  });
});

describe('modelStatus properties', () => {
  // Feature: data-safety-offline, Property 14: Model status matches the cached files
  // **Validates: Requirements 13.2, 13.3, 13.4**
  it('is ready exactly when every required file is cached; unrelated URLs change nothing', () => {
    const fileUrls = REQUIRED_MODEL_FILES.map((f) => `${base}${f}`);
    fc.assert(
      fc.property(
        fc.subarray(fileUrls),
        fc.array(fc.webUrl().filter((u) => !u.includes(`/${WHISPER_MODEL_ID}/`))),
        (subset, unrelated) => {
          const expected = subset.length === fileUrls.length ? 'ready' : 'not-downloaded';
          expect(modelStatus(subset)).toBe(expected);
          expect(modelStatus([...unrelated, ...subset])).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
