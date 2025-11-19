
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY || '';

// Initialize the client safely. 
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const analyzeComponentImage = async (
  base64Image: string, 
  mimeType: string, 
  mode: 'general' | 'label' = 'general'
): Promise<any> => {
  // We do not throw immediately if API_KEY is missing to allow fallback/mock execution in restricted networks.

  try {
    if (!API_KEY) throw new Error("API Key not found");

    let systemPrompt = "";
    let schemaProperties = {};

    if (mode === 'label') {
      // Mode for Inventory Check: Extract SN, Model AND Raw Text for manual correction
      systemPrompt = `
        You are an expert specialized in Optical Character Recognition (OCR) for IT hardware labels (servers, RAM, drives).
        
        Task 1: Extract the **Serial Number (SN)** and **Model Number (P/N)** from the image.
          - SN usually follows "SN", "S/N", "ISN", "Serial".
          - Model usually follows "Model", "P/N", "Part Number".
          
        Task 2: Extract **ALL** visible text segments on the label into a list.
          - This is CRITICAL for manual correction by the user.
          - Include every distinct alphanumeric string found.
        
        Return a strict JSON object.
      `;
      schemaProperties = {
        sn: { type: Type.STRING, description: "The extracted Serial Number" },
        model: { type: Type.STRING, description: "The extracted Model Number" },
        manufacturer: { type: Type.STRING, description: "Brand name if visible" },
        all_text: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "A complete list of ALL text strings visible on the label, for user selection/correction." 
        }
      };
    } else {
      // Mode for General Identification (Original functionality)
      systemPrompt = `
        You are an expert IDC hardware technician. Analyze this image of a server component. 
        Identify the component type, manufacturer, model, and key specifications (capacity, speed, etc.).
        Return the data in a strict JSON structure suitable for inventory entry.
        If you cannot identify it clearly, make an educated guess and lower the confidence score.
        The categories are: CPU, 内存, 硬盘, 网卡, 线缆, 电源, 其他.
      `;
      schemaProperties = {
        name: { type: Type.STRING, description: "Short generic name e.g. Samsung 32GB RAM" },
        category: { type: Type.STRING, description: "One of the allowed categories" },
        model: { type: Type.STRING, description: "Model number or Part number" },
        quantity_estimate: { type: Type.INTEGER, description: "Estimated count if multiple items are visible" },
        specs: { type: Type.STRING, description: "Key technical specs" },
        reasoning: { type: Type.STRING, description: "Why you identified it as such" }
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: systemPrompt }
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text);

  } catch (error) {
    console.warn("Gemini Service Error (Network/Auth). Using Mock Data for Demo.", error);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return Mock Data based on mode
    if (mode === 'label') {
      return {
        sn: "CN-0V4W68-74445-83C-335",
        model: "M393A4K40CB2-CTD",
        manufacturer: "Samsung",
        all_text: [
          "Samsung", 
          "32GB", 
          "2Rx4", 
          "PC4-2666V", 
          "M393A4K40CB2-CTD", 
          "CN-0V4W68-74445-83C-335", 
          "SN: 0V4W68",
          "MADE IN CHINA",
          "REV A01",
          "Ver 2.5",  // Useful for testing Hardware Version field
          "10G-SR"
        ]
      };
    } else {
      return {
        name: "Samsung 32GB DDR4 RAM (Mock)",
        category: "内存",
        model: "M393A4K40CB2",
        quantity_estimate: 1,
        specs: "DDR4 2666MHz ECC Registered",
        reasoning: "Simulated identification: Recognized label format and memory chip layout."
      };
    }
  }
};

export const askAssistant = async (message: string, inventoryContext: string): Promise<string> => {
  if (!API_KEY) return "请先配置 API Key。";

  try {
    const systemInstruction = `
      你是一个专业的 IDC 机房资产管理助手。
      你的任务是帮助管理员查询库存、提供服务器维护建议或分析数据。
      当前库存数据的摘要如下:
      ${inventoryContext}
      
      请用简洁专业的中文回答。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "抱歉，我暂时无法回答这个问题。";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "AI 服务暂时不可用，请检查网络连接。";
  }
};
