/**
 * Utility for generating professional DOCX and PPTX reports.
 * Uses global 'docx' and 'PptxGenJS' from window (CDN).
 */

export const generateDocxReport = async (studentId: string, analyticsData: any, messages: any[]) => {
  const docx = (window as any).docx;
  if (!docx) {
    console.error('DOCX library not found');
    return;
  }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header
        new Paragraph({
          text: "BÁO CÁO PHÂN TÍCH TÂM LÝ HỌC SINH",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        // Student Info
        new Paragraph({
          children: [
            new TextRun({ text: "Học sinh: ", bold: true }),
            new TextRun({ text: studentId }),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Ngày lập báo cáo: ", bold: true }),
            new TextRun({ text: new Date().toLocaleDateString('vi-VN') }),
          ],
          spacing: { after: 400 },
        }),

        // Analysis Section
        new Paragraph({
          text: "1. Phân tích trạng thái",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Chủ đề chính: ", bold: true }),
            new TextRun({ text: analyticsData.topic }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Mức độ: ", bold: true }),
            new TextRun({ text: `${analyticsData.levelName} (Mức ${analyticsData.level})`, color: analyticsData.level > 2 ? 'FF0000' : '00B050' }),
          ],
        }),
        new Paragraph({
          text: analyticsData.emotionAnalysis,
          spacing: { before: 200, after: 400 },
        }),

        // Interventions
        new Paragraph({
          text: "2. Gợi ý can thiệp dành cho Giáo viên",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...analyticsData.teacherSuggestions.map((s: string) => 
          new Paragraph({
            text: `• ${s}`,
            bullet: { level: 0 },
          })
        ),

        // Chat History Summary
        new Paragraph({
          text: "3. Tóm tắt nội dung trao đổi gần nhất",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...messages.slice(-10).map((m: any) => 
          new Paragraph({
            children: [
              new TextRun({ text: `${m.sender === 'student' ? 'HS' : 'AI'}: `, bold: true }),
              new TextRun({ text: m.text }),
            ],
            spacing: { after: 100 },
          })
        ),

        new Paragraph({
          text: "\n--- Hết báo cáo ---",
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bao_cao_Tam_ly_${studentId}_${Date.now()}.docx`;
  link.click();
};

export const generatePptxReport = async (studentId: string, analyticsData: any) => {
  const PptxGenJS = (window as any).PptxGenJS;
  if (!PptxGenJS) {
    console.error('PptxGenJS library not found');
    return;
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  // Slide 1: Title
  let slide1 = pptx.addSlide();
  slide1.background = { fill: 'F1F5F9' };
  slide1.addText("HỒ SƠ TÂM LÝ HỌC SINH", { 
    x: 0.5, y: 1.5, w: 9, h: 1, 
    fontSize: 44, bold: true, color: '1E293B', align: 'center' 
  });
  slide1.addText(`Mã học sinh: ${studentId}`, { 
    x: 0.5, y: 2.8, w: 9, h: 0.5, 
    fontSize: 24, color: '64748B', align: 'center' 
  });

  // Slide 2: Analysis
  let slide2 = pptx.addSlide();
  slide2.addText("PHÂN TÍCH TRẠNG THÁI", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 28, bold: true, color: '0F172A' });
  slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.9, w: 9, h: 0.05, fill: { color: 'CBD5E1' } });
  
  slide2.addText(`Chủ đề: ${analyticsData.topic}`, { x: 0.5, y: 1.2, w: 4, h: 0.4, fontSize: 20, bold: true });
  slide2.addText(`Mức độ: ${analyticsData.levelName}`, { 
    x: 5, y: 1.2, w: 4, h: 0.4, 
    fontSize: 20, bold: true, color: analyticsData.level > 2 ? 'EF4444' : '10B981' 
  });
  
  slide2.addText(analyticsData.emotionAnalysis, { 
    x: 0.5, y: 2, w: 9, h: 3, 
    fontSize: 16, color: '334155', valign: 'top' 
  });

  // Slide 3: Recommendations
  let slide3 = pptx.addSlide();
  slide3.addText("ĐIỀU HƯỚNG CAN THIỆP", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 28, bold: true, color: '0F172A' });
  
  const suggestions = analyticsData.teacherSuggestions.map((s: string) => ({ text: s, options: { bullet: true, fontSize: 18, color: '1E293B' } }));
  slide3.addText(suggestions, { x: 0.5, y: 1.2, w: 9, h: 4, valign: 'top' });

  pptx.writeFile({ fileName: `Bao_cao_${studentId}.pptx` });
};
