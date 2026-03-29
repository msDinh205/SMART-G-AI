/**
 * Utility for generating DOCX and PPTX reports.
 * Uses docx and pptxgenjs via global window scope (CDN).
 */

declare const docx: any;
declare const PptxGenJS: any;

export const generateDocxReport = async (studentId: string, analyticsData: any, messages: any[]) => {
  if (typeof docx === 'undefined') {
    throw new Error('docx library not loaded');
  }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "BÁO CÁO TÂM LÝ HỌC SINH",
          heading: HeadingLevel.HEADING_1,
          alignment: "center",
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Học sinh: ${studentId}`, bold: true }),
            new TextRun({ text: `\nNgày lập: ${new Date().toLocaleDateString('vi-VN')}` }),
          ],
        }),
        new Paragraph({ text: "\n1. PHÂN TÍCH TỔNG QUAN", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `Chủ đề chính: ${analyticsData.topic}` }),
        new Paragraph({ text: `Cảm xúc: ${analyticsData.emotionAnalysis}` }),
        new Paragraph({ text: `Mức độ cảnh báo: ${analyticsData.levelName} (Mức ${analyticsData.level})`, color: analyticsData.level > 2 ? "FF0000" : "000000" }),
        
        new Paragraph({ text: "\n2. GỢI Ý CAN THIỆP CHO GIÁO VIÊN", heading: HeadingLevel.HEADING_2 }),
        ...analyticsData.teacherSuggestions.map((sug: string) => new Paragraph({ text: `• ${sug}`, bullet: { level: 0 } })),
        
        new Paragraph({ text: "\n3. LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY", heading: HeadingLevel.HEADING_2 }),
        ...messages.slice(-10).map((msg: any) => new Paragraph({
          children: [
            new TextRun({ text: `${msg.sender === 'student' ? 'Học sinh' : 'AI'}: `, bold: true }),
            new TextRun({ text: msg.text }),
          ],
        })),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bao_cao_tam_ly_${studentId}.docx`;
  link.click();
};

export const generatePptxReport = async (studentId: string, analyticsData: any) => {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('PptxGenJS library not loaded');
  }

  const pptx = new PptxGenJS();
  
  // Slide 1: Title
  let slide1 = pptx.addSlide();
  slide1.addText("BÁO CÁO TÂM LÝ HỌC SINH", { x: 0.5, y: 1.0, w: 9, h: 1, fontSize: 32, bold: true, color: "363636", align: "center" });
  slide1.addText(`Học sinh: ${studentId}`, { x: 0.5, y: 2.0, w: 9, h: 0.5, fontSize: 18, align: "center" });
  slide1.addText(`Ngày: ${new Date().toLocaleDateString('vi-VN')}`, { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 14, color: "808080", align: "center" });

  // Slide 2: Analysis
  let slide2 = pptx.addSlide();
  slide2.addText("Phân Tích Tổng Quan", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: "0088CC" });
  slide2.addText(`Chủ đề: ${analyticsData.topic}`, { x: 0.5, y: 1.0, w: 9, h: 0.5, fontSize: 18 });
  slide2.addText(`Mức độ: ${analyticsData.levelName}`, { x: 0.5, y: 1.5, w: 9, h: 0.5, fontSize: 18, color: analyticsData.level > 2 ? "FF0000" : "008000" });
  slide2.addText("Nhận định tâm lý:", { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 18, bold: true });
  slide2.addText(analyticsData.emotionAnalysis, { x: 0.5, y: 3.0, w: 9, h: 2, fontSize: 14, italic: true });

  // Slide 3: Recommendations
  let slide3 = pptx.addSlide();
  slide3.addText("Gợi Ý Can Thiệp", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: "EE7700" });
  slide3.addNotes("Dành cho giáo viên trực ban");
  analyticsData.teacherSuggestions.forEach((sug: string, idx: number) => {
    slide3.addText(`• ${sug}`, { x: 0.5, y: 1.2 + (idx * 0.8), w: 8.5, h: 0.6, fontSize: 16 });
  });

  pptx.writeFile({ fileName: `Bao_cao_tam_ly_${studentId}.pptx` });
};
