import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ No GEMINI_API_KEY found in .env file");
  process.exit(1);
}

console.log("🔍 Testing Gemini API access...\n");

const genAI = new GoogleGenerativeAI(apiKey);

// Common model names to try (ordered from newest to oldest)
const modelsToTry = [
  "gemini-2.5-flash", // Gemini 2.5 Flash (stable) - recommended
  "gemini-2.5-pro", // Gemini 2.5 Pro (stable) - more capable
  "gemini-2.0-flash", // Gemini 2.0 Flash (stable)
  "gemini-2.0-flash-exp", // Gemini 2.0 Flash (experimental)
];

console.log("Testing available models:\n");

for (const modelName of modelsToTry) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say hello in one word");
    const text = result.response.text();
    console.log(`✅ ${modelName.padEnd(30)} - WORKS! Response: ${text.trim()}`);
    break; // Stop after first working model
  } catch (error) {
    if (error.status === 404) {
      console.log(`❌ ${modelName.padEnd(30)} - Not found (404)`);
    } else if (error.status === 403) {
      console.log(`❌ ${modelName.padEnd(30)} - Access denied (403)`);
    } else if (error.status === 400) {
      console.log(
        `⚠️  ${modelName.padEnd(
          30
        )} - Bad request (400): ${error.message?.substring(0, 50)}...`
      );
    } else {
      console.log(
        `❌ ${modelName.padEnd(30)} - Error: ${error.message?.substring(
          0,
          50
        )}...`
      );
    }
  }
}

console.log("\n✨ Test complete!");
console.log("\nℹ️  If none of the models work, your API key may be:");
console.log("   1. Invalid or expired");
console.log("   2. From a trial/test account with limited access");
console.log("   3. Not activated for Gemini API access");
console.log("\n📌 Get a new API key at: https://aistudio.google.com/apikey");
