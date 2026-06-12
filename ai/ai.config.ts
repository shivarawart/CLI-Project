import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getAgentModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_DEFAULT_MODEL;

  console.log("API KEY EXISTS:");
 

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not defined"
    );
  }
  

  const provider = createOpenRouter({
    apiKey: apiKey.trim(),
  });

  return provider(modelId!);
}