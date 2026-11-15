export const WHISPER_MODEL_ID = 'Xenova/whisper-tiny.en';

/** Name fragments that must appear in cached URLs of the model. Verified against the real cache in task 11.2. */
export const REQUIRED_MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'encoder_model',
  'decoder_model_merged',
] as const;

export type ModelStatus = 'ready' | 'not-downloaded' | 'unknown';

/** 'ready' when every required name appears in at least one URL that contains `/<modelId>/`. */
export function modelStatus(
  cachedUrls: readonly string[],
  modelId: string = WHISPER_MODEL_ID,
  required: readonly string[] = REQUIRED_MODEL_FILES,
): 'ready' | 'not-downloaded' {
  const segment = `/${modelId}/`;
  const modelUrls = cachedUrls.filter((u) => u.includes(segment));
  return required.every((name) => modelUrls.some((u) => u.includes(name)))
    ? 'ready'
    : 'not-downloaded';
}
