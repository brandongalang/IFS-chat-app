import { MastraClient } from "@mastra/client-js";

const baseUrl = process.env.NEXT_PUBLIC_MASTRA_API_URL || "http://localhost:4111";
export const mastraClient = new MastraClient({
  baseUrl
});
