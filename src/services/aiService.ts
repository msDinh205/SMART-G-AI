import { Type } from '@google/genai';


export interface AnalysisResult {
  chatReply: string;
  emotionAnalysis: string;
  level: number;
  levelName: string;
  studentAdvice: string[];
  requiresTeacherIntervention: boolean;
  teacherWarning: string;
  teacherSuggestions: string[];
  topic: 'Áp lực học tập' | 'Nhớ nhà / Gia đình' | 'Xích mích bạn bè' | 'Tình cảm tuổi teen' | 'Khác';
}

export const analyzeStudentMessage = async (
  apiKey: string,
  studentId: string,
  message: string,
  history: { role: string, parts: { text: string }[] }[] = []
): Promise<AnalysisResult> => {
  const genAI = new (window as any).GoogleGenAI({ apiKey });
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',

    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chatReply: { type: Type.STRING, description: "Câu trả lời chat tự nhiên với học sinh" },
          emotionAnalysis: { type: Type.STRING, description: "Phân tích cảm xúc của học sinh" },
          level: { type: Type.INTEGER, description: "Mức độ từ 1 đến 4" },
          levelName: { type: Type.STRING, description: "Tên mức độ: Xanh, Vàng, Cam, hoặc Đỏ" },
          studentAdvice: { type: Type.ARRAY, items: { type: Type.STRING }, description: "03 lời khuyên trực tiếp cho học sinh" },
          requiresTeacherIntervention: { type: Type.BOOLEAN, description: "Đánh dấu true nếu tình huống có nguy cơ bạo lực (mức 3, 4)" },
          teacherWarning: { type: Type.STRING, description: "Cảnh báo chuyên môn cho giáo viên" },
          teacherSuggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "03 bước can thiệp cho giáo viên" },
          topic: { type: Type.STRING, enum: ["Áp lực học tập", "Nhớ nhà / Gia đình", "Xích mích bạn bè", "Tình cảm tuổi teen", "Khác"], description: "Chủ đề chính của cuộc trò chuyện" }
        },
        required: ["chatReply", "emotionAnalysis", "level", "levelName", "studentAdvice", "requiresTeacherIntervention", "teacherWarning", "teacherSuggestions", "topic"]
      }
    },
    systemInstruction: `Bạn là "Mầm Xanh", một chuyên gia tâm lý học đường thân thiện, thấu cảm, đóng vai như một người anh/chị/thầy/cô gần gũi. Bạn đang trò chuyện với một học sinh nội trú vùng cao (Mã HS: ${studentId}).
Nhiệm vụ: Lắng nghe, thấu hiểu, dùng ngôn từ mộc mạc, ấm áp, có thể dùng các hình ảnh ẩn dụ về thiên nhiên vùng cao (như cây rừng, sương sớm, nương ng ngô, mặt trời...) để động viên các em. Đồng thời, đánh giá ngầm mức độ nguy cơ bạo lực để báo giáo viên.

Quy trình phân tích mức độ:
Mức độ 1 (Xanh): Bình thường, tâm sự nhẹ nhàng, nhớ nhà, áp lực học tập.
Mức độ 2 (Vàng): Xích mích nhỏ, hiểu lầm bạn bè, có thể tự giải quyết.
Mức độ 3 (Cam): Nguy cơ bạo lực, bị cô lập, bắt nạt. BẮT BUỘC báo giáo viên.
Mức độ 4 (Đỏ): Bạo lực sắp/đang xảy ra, đe dọa an toàn. BẮT BUỘC báo giáo viên khẩn cấp.

Yêu cầu đầu ra (JSON).`
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(message);
  const response = await result.response;
  return JSON.parse(response.text()) as AnalysisResult;
};
