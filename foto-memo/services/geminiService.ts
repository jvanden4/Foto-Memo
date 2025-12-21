import { GoogleGenAI, Type } from "@google/genai";
import { MapItem } from "../types";

// Initialize Gemini Client
// Note: In a real environment, always ensure API_KEY is set.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const fetchMapContent = async (mapName: string): Promise<MapItem[]> => {
  if (!apiKey) {
    console.warn("No API Key provided, returning mock data.");
    return generateMockData(mapName);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a list of 6 fictional files that one would find in a digital folder named "${mapName}". 
      Mix the file types between images (png/jpg), documents (pdf/txt), and system files.
      Make the titles creative and related to the theme.
      Include a short 1-sentence description for each file.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["image", "document", "file"] },
              size: { type: Type.STRING },
              dateModified: { type: Type.STRING },
            },
            required: ["title", "description", "type", "size", "dateModified"],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return generateMockData(mapName);

    const items = JSON.parse(jsonText) as Omit<MapItem, 'id'>[];
    
    return items.map((item, index) => ({
      ...item,
      id: `generated-${index}-${Date.now()}`,
      // Normalize type for UI icons
      type: (item.type === 'image' || item.type === 'document') ? item.type : 'file'
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    return generateMockData(mapName);
  }
};

// Fallback for when API fails or key is missing
const generateMockData = (theme: string): MapItem[] => {
  return [
    { id: '1', title: `${theme}_overview.pdf`, description: `General overview of ${theme}`, type: 'document', size: '2.4 MB', dateModified: '2023-10-01' },
    { id: '2', title: 'snapshot_001.png', description: 'A visual capture relative to the theme', type: 'image', size: '4.1 MB', dateModified: '2023-10-02' },
    { id: '3', title: 'notes.txt', description: 'Personal notes and observations', type: 'file', size: '12 KB', dateModified: '2023-10-05' },
    { id: '4', title: 'manifest.json', description: 'Configuration settings', type: 'file', size: '2 KB', dateModified: '2023-10-10' },
  ];
};
