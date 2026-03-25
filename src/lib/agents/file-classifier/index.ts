import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { classificationSchema, type ClassificationResult } from "./schema";
import { buildClassificationPrompt } from "./prompt";

export const MODEL_ID = "gemini-2.5-flash";

interface ClassifyInput {
  fileName: string;
  mimeType: string;
  parentPath: string;
}

/**
 * Classify a single file using its metadata (filename + folder path).
 * No file download needed — classification is purely from metadata.
 */
export async function classifyFile(
  input: ClassifyInput,
): Promise<ClassificationResult> {
  const systemPrompt = await buildClassificationPrompt();

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: classificationSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Classify this file:
- File name: ${input.fileName}
- MIME type: ${input.mimeType}
- Folder path: ${input.parentPath || "(root folder)"}`,
      },
    ],
    temperature: 0,
  });

  return object;
}

/**
 * Classify multiple files in batch.
 * Processes sequentially to avoid rate limits on the LLM API.
 */
export async function classifyFiles(
  inputs: ClassifyInput[],
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];
  for (const input of inputs) {
    results.push(await classifyFile(input));
  }
  return results;
}
