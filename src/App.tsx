import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ShieldCheck, Share2, Loader2, Send, Activity, ListChecks, Smartphone, BellRing, ArrowRight, CheckCircle2, User, GraduationCap, Users, LogOut, KeyRound, Mountain, Sun, Sprout, TreePine, Smile, Heart, MessageCircleHeart, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

/**
 * Utility for generating DOCX and PPTX reports via window globals.
 */
const generateDocxReport = async (studentId: string, analyticsData: any, messages: any[]) => {
  const docx = (window as any).docx;
  if (!docx) return alert('Thư viện DOCX chưa tải xong, vui lòng thử lại!');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "BÁO CÁO TÂM LÝ HỌC SINH", heading: HeadingLevel.HEADING_1, alignment: "center" }),
        new Paragraph({ children: [new TextRun({ text: `Học sinh: ${studentId}`, bold: true })] }),
        new Paragraph({ text: `\nChủ đề: ${analyticsData.topic}` }),
        new Paragraph({ text: `Cảm xúc: ${analyticsData.emotionAnalysis}` }),
        ...analyticsData.teacherSuggestions.map((s: string) => new Paragraph({ text: `• ${s}` })),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bao_cao_${studentId}.docx`;
  link.click();
};

const generatePptxReport = async (studentId: string, analyticsData: any) => {
  const PptxGenJS = (window as any).PptxGenJS;
  if (!PptxGenJS) return alert('Thư viện PowerPoint chưa tải xong, vui lòng thử lại!');
  const pptx = new PptxGenJS();
  let slide = pptx.addSlide();
  slide.addText("BÁO CÁO TÂM LÝ", { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 24, bold: true });
  slide.addText(`Học sinh: ${studentId}`, { x: 0.5, y: 1.5, w: 9, h: 0.5, fontSize: 18 });
  slide.addText(analyticsData.emotionAnalysis, { x: 0.5, y: 2.5, w: 9, h: 2, fontSize: 14 });
  pptx.writeFile({ fileName: `Bao_cao_${studentId}.pptx` });
};

const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY as string) || '' });

interface AnalysisResult {
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

interface Message {
  id: string;
  sender: 'student' | 'ai';
  text: string;
  analysis?: AnalysisResult;
  timestamp?: any;
  studentId?: string;
}

export default function App() {
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  
  // Auth States
  const [studentIdInput, setStudentIdInput] = useState('');
  const [teacherIdInput, setTeacherIdInput] = useState('');
  const [teacherPasswordInput, setTeacherPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loggedInStudent, setLoggedInStudent] = useState<string | null>(null);
  const [loggedInTeacher, setLoggedInTeacher] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [studentPoints, setStudentPoints] = useState(0);
  const [studentLevel, setStudentLevel] = useState(1);

  // Stats States
  const [totalAccesses, setTotalAccesses] = useState(0);
  const [onlineStudents, setOnlineStudents] = useState(0);
  const [totalInteractions, setTotalInteractions] = useState(0);
  const [topicDistribution, setTopicDistribution] = useState([
    { name: 'Áp lực học tập', value: 0, color: '#f97316' },
    { name: 'Nhớ nhà / Gia đình', value: 0, color: '#14b8a6' },
    { name: 'Xích mích bạn bè', value: 0, color: '#eab308' },
    { name: 'Tình cảm tuổi teen', value: 0, color: '#ec4899' },
  ]);
  const [sentimentTrend, setSentimentTrend] = useState<{name: string, value: number}[]>([]);

  // Chat & Analysis States
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    sender: 'ai',
    text: 'Chào em! Thầy/cô là Mầm Xanh, luôn ở đây để lắng nghe em. Hôm nay ở trường, ở bản có chuyện gì vui buồn, em kể cho Mầm Xanh nghe nhé?'
  }]);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<'idle' | 'sent' | 'resolved'>('idle');
  const [chatOwnerId, setChatOwnerId] = useState<string | null>(null);

  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Auth (Local Only)
  useEffect(() => {
    setIsAuthReady(true);
  }, []);

  // Real-time Stats for Teacher (Real Data from API)
  useEffect(() => {
    if (role !== 'teacher' || !loggedInTeacher) return;

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/teacher/stats');
        if (response.ok) {
          const data = await response.json();
          setTotalAccesses(data.totalAccesses);
          setOnlineStudents(data.onlineStudents);
          setTotalInteractions(data.totalInteractions);
          
          // Map API distribution to include colors
          const colors = ['#f97316', '#14b8a6', '#eab308', '#ec4899', '#6366f1'];
          setTopicDistribution(data.topicDistribution.map((t: any, i: number) => ({
            ...t,
            color: colors[i % colors.length]
          })));

          if (data.latestAlert) {
            setLatestAnalysis(data.latestAlert);
            setChatOwnerId(data.latestAlertStudentId);
          }

          // Mock Sentiment Trend for Demo
          setSentimentTrend([
            { name: 'Th 2', value: 20 },
            { name: 'Th 3', value: 45 },
            { name: 'Th 4', value: 30 },
            { name: 'Th 5', value: 70 },
            { name: 'Th 6', value: 40 },
            { name: 'Th 7', value: 65 },
            { name: 'CN', value: 50 },
          ]);
        }
      } catch (err) {
        console.error("Fetch Stats Error:", err);
      }
    };

    const fetchAllMessages = async () => {
      try {
        const response = await fetch('/api/teacher/messages');
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("Fetch Messages Error:", err);
      }
    };

    fetchStats();
    fetchAllMessages();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchAllMessages();
    }, 10000);

    return () => clearInterval(interval);
  }, [role, loggedInTeacher]);

  // Load Chat History (Real Data from API)
  useEffect(() => {
    if (role !== 'student' || !loggedInStudent) return;
    
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/messages/${loggedInStudent}`);
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            setMessages(data);
            // Find latest analysis
            const lastAiMsg = [...data].reverse().find(m => m.sender === 'ai' && m.analysis);
            if (lastAiMsg?.analysis) {
              setLatestAnalysis(lastAiMsg.analysis);
              if (lastAiMsg.analysis.requiresTeacherIntervention && actionStatus === 'idle') {
                setActionStatus('sent');
              }
            }
          }
        }
      } catch (err) {
        console.error("Fetch History Error:", err);
      }
    };

    fetchHistory();
    // Poll for AI responses if analyzing
    const interval = setInterval(() => {
      if (isAnalyzing) fetchHistory();
    }, 3000);

    return () => clearInterval(interval);
  }, [role, loggedInStudent, isAnalyzing]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAnalyzing]);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = studentIdInput.trim().toUpperCase();
    if (id) {
      setIsLoggingIn(true);
      setError(null);
      try {
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, role: 'student' })
        });
        if (response.ok) {
          const data = await response.json();
          setLoggedInStudent(id);
          setChatOwnerId(id);
          setStudentPoints(data.points || 0);
          setStudentLevel(Math.floor((data.points || 0) / 100) + 1);
        } else {
          throw new Error("Không thể đăng nhập.");
        }
      } catch (err) {
        setError("Lỗi kết nối máy chủ.");
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = teacherIdInput.trim().toUpperCase();
    const password = teacherPasswordInput.trim();
    if (id && password) {
      setIsLoggingIn(true);
      setError(null);
      try {
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, password, role: 'teacher' })
        });
        if (response.ok) {
          setLoggedInTeacher(id);
        } else {
          const data = await response.json();
          throw new Error(data.error || "Không thể đăng nhập.");
        }
      } catch (err: any) {
        setError(err.message || "Lỗi kết nối máy chủ.");
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleLogout = () => {
    if (role === 'student') {
      setLoggedInStudent(null);
      setStudentIdInput('');
    } else {
      setLoggedInTeacher(null);
      setTeacherIdInput('');
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !loggedInStudent) return;

    if (!chatOwnerId || chatOwnerId !== loggedInStudent) {
      setChatOwnerId(loggedInStudent);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'student',
      text: inputText.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsAnalyzing(true);
    setError(null);

    try {
      // Save Student Message to API
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: loggedInStudent,
          text: userMsg.text,
          sender: 'student'
        })
      });

      if (!chatRef.current) {
        const systemInstruction = `Bạn là "Mầm Xanh", một chuyên gia tâm lý học đường thân thiện, thấu cảm, đóng vai như một người anh/chị/thầy/cô gần gũi. Bạn đang trò chuyện với một học sinh nội trú vùng cao (Mã HS: ${loggedInStudent}).
Nhiệm vụ: Lắng nghe, thấu hiểu, dùng ngôn từ mộc mạc, ấm áp, có thể dùng các hình ảnh ẩn dụ về thiên nhiên vùng cao (như cây rừng, sương sớm, nương ngô, mặt trời...) để động viên các em. Đồng thời, đánh giá ngầm mức độ nguy cơ bạo lực để báo giáo viên.

Quy trình phân tích mức độ:
Mức độ 1 (Xanh): Bình thường, tâm sự nhẹ nhàng, nhớ nhà, áp lực học tập.
Mức độ 2 (Vàng): Xích mích nhỏ, hiểu lầm bạn bè, có thể tự giải quyết.
Mức độ 3 (Cam): Nguy cơ bạo lực, bị cô lập, bắt nạt. BẮT BUỘC báo giáo viên.
Mức độ 4 (Đỏ): Bạo lực sắp/đang xảy ra, đe dọa an toàn. BẮT BUỘC báo giáo viên khẩn cấp.

Yêu cầu đầu ra (JSON):
- chatReply: Câu trả lời trực tiếp, tự nhiên, thấu cảm, xưng "Mầm Xanh" hoặc "thầy/cô" và gọi "em".
- emotionAnalysis: Nhận diện cảm xúc hiện tại của học sinh.
- level: Mức độ từ 1 đến 4.
- levelName: Tên mức độ (Xanh, Vàng, Cam, Đỏ).
- studentAdvice: 03 lời khuyên thiết thực, ngắn gọn, dễ hiểu để em tự tháo gỡ.
- requiresTeacherIntervention: true (nếu mức 3, 4), false (nếu mức 1, 2).
- teacherWarning: Cảnh báo chuyên môn dành cho giáo viên.
- teacherSuggestions: 03 bước can thiệp cho giáo viên.
- topic: Chọn một trong các chủ đề sau: "Áp lực học tập", "Nhớ nhà / Gia đình", "Xích mích bạn bè", "Tình cảm tuổi teen", "Khác".`;

        chatRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction,
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
          }
        });
      }

      const response = await chatRef.current.sendMessage({ message: userMsg.text });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as AnalysisResult;
        
        // Save AI Response to API
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: loggedInStudent,
            text: parsedResult.chatReply,
            sender: 'ai',
            topic: parsedResult.topic,
            level: parsedResult.level,
            requiresTeacherIntervention: parsedResult.requiresTeacherIntervention,
            analysis: parsedResult
          })
        });

        setStudentPoints(prev => {
          const newPoints = prev + 10;
          setStudentLevel(Math.floor(newPoints / 100) + 1);
          return newPoints;
        });

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: parsedResult.chatReply,
          analysis: parsedResult,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMsg]);
        setLatestAnalysis(parsedResult);
        
        if (parsedResult.requiresTeacherIntervention && actionStatus === 'idle') {
          setActionStatus('sent');
        }
      } else {
        throw new Error("Không nhận được phản hồi từ hệ thống.");
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Đã xảy ra lỗi kết nối. Em thử gửi lại nhé!";
      const errString = err.toString();
      if (errString.includes('429') || errString.includes('quota') || errString.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = "Hệ thống đang có quá nhiều bạn truy cập cùng lúc. Em vui lòng đợi khoảng 1-2 phút rồi gửi lại tin nhắn nhé!";
      } else if (err.message) {
        // Fallback to show the error but make it slightly friendlier if it's not a quota issue
        errorMsg = err.message.length > 100 ? "Đã xảy ra lỗi kết nối. Em thử gửi lại nhé!" : err.message;
      }
      
      setError(errorMsg);
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      setInputText(userMsg.text);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getLevelStyles = (level: number) => {
    switch (level) {
      case 1: return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' };
      case 2: return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' };
      case 3: return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' };
      case 4: return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' };
    }
  };

  const [showShareToast, setShowShareToast] = useState(false);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] font-sans text-gray-800 selection:bg-orange-200 pb-12">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b-2 border-orange-100/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg border border-indigo-400/30 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-orange-800 font-heading tracking-tight">Smart Guardian AI - Người bảo vệ thông minh</h1>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Share Button */}
            <button 
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-orange-100 text-orange-600 hover:bg-orange-50 transition-all shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              Chia sẻ
            </button>

            {/* Role Switcher */}
            <div className="flex bg-orange-50/50 p-1 rounded-2xl border border-orange-100/50">
              <button 
                onClick={() => setRole('student')} 
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${role === 'student' ? 'bg-white shadow-sm text-orange-600 border border-orange-100' : 'text-gray-500 hover:text-orange-500'}`}
              >
                <Users className="w-4 h-4" />
                Học sinh
              </button>
              <button 
                onClick={() => setRole('teacher')} 
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${role === 'teacher' ? 'bg-white shadow-sm text-teal-600 border border-teal-100' : 'text-gray-500 hover:text-teal-500'}`}
              >
                <GraduationCap className="w-4 h-4" />
                Giáo viên
              </button>
            </div>

            {/* User Profile / Logout */}
            {((role === 'student' && loggedInStudent) || (role === 'teacher' && loggedInTeacher)) && (
              <div className="flex items-center gap-3 pl-4 sm:border-l border-orange-200/50">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${role === 'student' ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span>{role === 'student' ? loggedInStudent : loggedInTeacher}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* ========================================== */}
        {/* GÓC NHÌN HỌC SINH */}
        {/* ========================================== */}
        {role === 'student' && (
          <div className="animate-in fade-in duration-500">
            {!loggedInStudent ? (
              /* Màn hình đăng nhập Học sinh */
              <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-orange-100/40 border-2 border-orange-50 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute -top-12 -right-12 text-orange-100 opacity-60">
                  <Sun className="w-48 h-48" />
                </div>
                <div className="absolute -bottom-8 -left-8 text-green-50 opacity-80">
                  <TreePine className="w-40 h-40" />
                </div>
                
                <div className="text-center mb-8 relative z-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border-4 border-white">
                    <Mountain className="w-12 h-12" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 font-heading">Chào em nhé!</h2>
                  <p className="text-gray-500 mt-3 text-[15px] leading-relaxed px-4">
                    Nhập mã số của em để bắt đầu trò chuyện cùng người bạn đồng hành.
                  </p>
                  {error && (
                    <div className="mt-4 p-3 bg-orange-50 text-orange-600 text-sm font-medium rounded-xl border border-orange-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                </div>
                <form onSubmit={handleStudentLogin} className="space-y-5 relative z-10">
                  <div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-orange-400" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Mã số học sinh (VD: HS001)"
                        value={studentIdInput}
                        onChange={(e) => setStudentIdInput(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-orange-50/30 border-2 border-orange-100 rounded-2xl focus:ring-0 focus:border-orange-400 transition-all uppercase font-bold text-gray-700 placeholder:text-gray-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!studentIdInput.trim() || isLoggingIn}
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-2xl shadow-lg shadow-orange-200/50 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Vào phòng Chat <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Giao diện Chat Học sinh */
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-[2rem] shadow-xl shadow-orange-100/30 border-2 border-orange-50 overflow-hidden flex flex-col h-[680px]">
                  
                  {/* Chat Header */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-100/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center border-2 border-green-100 relative">
                        <Sprout className="w-8 h-8 text-green-500" />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white"></span>
                      </div>
                      <div>
                        <h2 className="font-bold text-green-800 font-heading text-xl">Mầm Xanh</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs font-bold text-green-600 bg-white/50 px-2 py-0.5 rounded-full border border-green-200">
                            Cấp {studentLevel}
                          </p>
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <Sun className="w-3 h-3 fill-amber-500" />
                            {studentPoints} điểm
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#FAFAFA] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'student' ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border-2 border-white ${
                            msg.sender === 'student' ? 'bg-orange-400 text-white' : 'bg-green-100 text-green-600'
                          }`}>
                            {msg.sender === 'student' ? <Smile className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
                          </div>

                          {/* Bubble */}
                          <div className="space-y-3">
                            <div className={`p-4 rounded-[1.5rem] shadow-sm ${
                              msg.sender === 'student' 
                                ? 'bg-orange-500 text-white rounded-tr-sm shadow-orange-200' 
                                : 'bg-white border-2 border-green-50 text-gray-800 rounded-tl-sm'
                            }`}>
                              <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.text}</p>
                            </div>

                            {/* AI Analysis Extras (Advice & Warnings) */}
                            {msg.sender === 'ai' && msg.analysis && (
                              <div className="space-y-3">
                                {/* Lời khuyên */}
                                {msg.analysis.studentAdvice && msg.analysis.studentAdvice.length > 0 && (
                                  <div className="bg-white rounded-[1.5rem] p-5 border-2 border-green-100 shadow-sm">
                                    <h4 className="font-bold text-green-800 mb-3 text-sm flex items-center gap-2 font-heading">
                                      <Heart className="w-4 h-4 text-green-500 fill-green-500" />
                                      Mầm Xanh gợi ý cho em:
                                    </h4>
                                    <ul className="space-y-3">
                                      {msg.analysis.studentAdvice.map((advice, index) => (
                                        <li key={index} className="flex items-start gap-3 text-gray-700 text-sm">
                                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs mt-0.5">
                                            {index + 1}
                                          </span>
                                          <span className="leading-relaxed pt-0.5">{advice}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Cảnh báo an toàn */}
                                {msg.analysis.requiresTeacherIntervention && (
                                  <div className="bg-red-50 border-2 border-red-100 rounded-[1.5rem] p-4 flex items-start gap-3">
                                    <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 leading-relaxed font-medium">
                                      Mầm Xanh thấy chuyện này cần người lớn giúp đỡ. Thầy cô giáo đã được báo tin để bảo vệ em. Em đừng lo lắng nhé!
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {isAnalyzing && (
                      <div className="flex justify-start">
                        <div className="flex gap-3 max-w-[80%]">
                          <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-1 border-2 border-white shadow-sm">
                            <Sprout className="w-5 h-5" />
                          </div>
                          <div className="bg-white border-2 border-green-50 p-4 rounded-[1.5rem] rounded-tl-sm shadow-sm flex items-center gap-3">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <span className="text-sm text-green-600 font-medium">Mầm Xanh đang gõ...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="px-5 py-3 bg-red-50 border-t border-red-100 text-red-600 text-sm flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-5 h-5" />
                      {error}
                    </div>
                  )}

                  {/* Input Area */}
                  <div className="p-4 bg-white border-t-2 border-orange-50">
                    <div className="flex items-end gap-3">
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập tin nhắn của em... (Nhấn Enter để gửi)"
                        className="flex-1 max-h-32 min-h-[52px] p-3.5 bg-orange-50/50 border-2 border-orange-100 rounded-2xl focus:ring-0 focus:border-orange-400 transition-all resize-none text-[15px]"
                        rows={1}
                        disabled={isAnalyzing}
                        style={{ height: 'auto' }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isAnalyzing || !inputText.trim()}
                        className="flex-shrink-0 w-14 h-14 flex items-center justify-center bg-orange-500 text-white rounded-2xl hover:bg-orange-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-orange-200 transform active:scale-95"
                      >
                        <Send className="w-6 h-6 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* GÓC NHÌN GIÁO VIÊN */}
        {/* ========================================== */}
        {role === 'teacher' && (
          <div className="animate-in fade-in duration-500">
            {!loggedInTeacher ? (
              /* Màn hình đăng nhập Giáo viên */
              <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-teal-100/40 border-2 border-teal-50 relative overflow-hidden">
                <div className="text-center mb-8 relative z-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-teal-100 to-teal-200 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border-4 border-white">
                    <GraduationCap className="w-12 h-12" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 font-heading">Khu vực Giáo viên</h2>
                  <p className="text-gray-500 mt-3 text-[15px] leading-relaxed">
                    Quản lý và hỗ trợ an toàn học đường
                  </p>
                </div>
                <form onSubmit={handleTeacherLogin} className="space-y-5 relative z-10">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                  <div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-teal-400" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Mã giáo viên (VD: GV001)"
                        value={teacherIdInput}
                        onChange={(e) => setTeacherIdInput(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-teal-50/30 border-2 border-teal-100 rounded-2xl focus:ring-0 focus:border-teal-400 transition-all uppercase font-bold text-gray-700 placeholder:text-gray-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-teal-400" />
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="Mật khẩu"
                        value={teacherPasswordInput}
                        onChange={(e) => setTeacherPasswordInput(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-teal-50/30 border-2 border-teal-100 rounded-2xl focus:ring-0 focus:border-teal-400 transition-all font-bold text-gray-700 placeholder:text-gray-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!teacherIdInput.trim() || !teacherPasswordInput.trim() || isLoggingIn}
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-2xl shadow-lg shadow-teal-200/50 text-base font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
                  >
                    {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Truy cập Bảng điều khiển <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </form>
              </div>
            ) : (
              /* Bảng điều khiển Giáo viên */
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 font-heading">Bảng điều khiển</h2>
                  <span className="bg-teal-100 text-teal-800 text-sm font-bold px-4 py-1.5 rounded-full border border-teal-200">
                    Trực ban Nội trú
                  </span>
                </div>

                {/* Thống kê tổng quan */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-white rounded-[1.5rem] p-5 border-2 border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-bold">Học sinh truy cập (Tháng)</p>
                      <p className="text-2xl font-bold text-gray-800">{totalAccesses}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-[1.5rem] p-5 border-2 border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-bold">Đang trực tuyến</p>
                      <p className="text-2xl font-bold text-gray-800">{onlineStudents}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-[1.5rem] p-5 border-2 border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                      <MessageCircleHeart className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-bold">Tổng lượt tâm sự</p>
                      <p className="text-2xl font-bold text-gray-800">{totalInteractions}</p>
                    </div>
                  </div>
                </div>

                {/* Biểu đồ chủ đề */}
                <div className="bg-white rounded-[2rem] border-2 border-gray-100 p-6 shadow-sm mb-8">
                  <h3 className="text-lg font-bold text-gray-800 font-heading mb-6 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-teal-600" />
                    Chủ đề học sinh quan tâm (%)
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topicDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 600 }} width={140} />
                        <Tooltip 
                          cursor={{fill: '#f3f4f6'}}
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                          {topicDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Dashboard Nâng cao: Xu hướng tâm lý */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-[2rem] border-2 border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 font-heading mb-6 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-600" />
                      Chỉ số tích cực theo tuần
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sentimentTrend}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] border-2 border-gray-100 p-6 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                      <ShieldCheck className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 font-heading mb-2">Xuất báo cáo chuyên môn</h3>
                    <p className="text-gray-500 mb-6 text-sm px-8">
                      Tải xuống hồ sơ tâm lý và lộ trình hỗ trợ học sinh dưới dạng văn bản hoặc trình chiếu.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <button 
                        onClick={() => latestAnalysis && generateDocxReport(chatOwnerId || 'Unknown', latestAnalysis, messages)}
                        disabled={!latestAnalysis}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                      >
                        <Activity className="w-5 h-5" />
                        Tải Word (.docx)
                      </button>
                      <button 
                        onClick={() => latestAnalysis && generatePptxReport(chatOwnerId || 'Unknown', latestAnalysis)}
                        disabled={!latestAnalysis}
                        className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
                      >
                        <ShieldCheck className="w-5 h-5" />
                        Tải PowerPoint (.pptx)
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-800 font-heading mb-4 mt-8 flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6 text-teal-600" />
                  Cảnh báo & Xử lý sự cố
                </h3>

                {!latestAnalysis ? (
                  <div className="bg-white rounded-[2rem] border-2 border-gray-100 p-16 text-center shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 font-heading">Chưa có cảnh báo mới</h3>
                    <p className="text-gray-500 mt-2">Hệ thống đang theo dõi an toàn học đường. Các cảnh báo sẽ xuất hiện tại đây.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Cột trái: Phân tích & Cảnh báo */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Chi tiết cảnh báo & Can thiệp */}
                      {latestAnalysis.requiresTeacherIntervention ? (
                        <div className={`rounded-[2rem] border-2 p-8 ${getLevelStyles(latestAnalysis.level).bg} ${getLevelStyles(latestAnalysis.level).border} relative overflow-hidden shadow-sm`}>
                          <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-bl-2xl">
                            CẦN CAN THIỆP
                          </div>
                          <div className="flex items-start gap-5">
                            <div className="mt-1 flex-shrink-0 bg-white p-3 rounded-2xl shadow-sm">
                              <ShieldAlert className={`w-8 h-8 ${getLevelStyles(latestAnalysis.level).text}`} />
                            </div>
                            <div className="space-y-5 flex-1">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className={`text-xl font-bold font-heading ${getLevelStyles(latestAnalysis.level).text}`}>
                                    Mức độ {latestAnalysis.level}: {latestAnalysis.levelName}
                                  </h3>
                                  <span className="bg-white/80 px-3 py-1 rounded-lg text-sm font-bold text-gray-800 shadow-sm">
                                    Học sinh: {chatOwnerId}
                                  </span>
                                </div>
                                <p className="mt-2 text-gray-800 leading-relaxed">
                                  <strong>Cảnh báo chuyên môn:</strong> {latestAnalysis.teacherWarning}
                                </p>
                              </div>

                              <div className="bg-white/80 rounded-[1.5rem] p-5 shadow-sm border border-white">
                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                  <ListChecks className="w-5 h-5 text-teal-600" />
                                  Gợi ý can thiệp cho Giáo viên:
                                </h4>
                                <ul className="space-y-3">
                                  {latestAnalysis.teacherSuggestions.map((sug, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-gray-800">
                                      <span className="text-teal-500 font-bold mt-0.5">•</span>
                                      <span className="leading-relaxed">{sug}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Workflow / Action Section */}
                              <div className="mt-4 bg-white rounded-[1.5rem] p-5 shadow-sm border border-gray-100">
                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                  <Smartphone className="w-5 h-5 text-gray-500" />
                                  Xác nhận xử lý sự cố
                                </h4>
                                
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-blue-50 text-blue-700 border border-blue-100">
                                    <BellRing className="w-4 h-4" />
                                    Hệ thống đã gửi cảnh báo
                                  </div>

                                  <ArrowRight className="hidden sm:block w-5 h-5 text-gray-300" />

                                  <button 
                                    onClick={() => setActionStatus('resolved')}
                                    disabled={actionStatus === 'resolved'}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                      actionStatus === 'resolved' 
                                        ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                                        : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-200 animate-pulse'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                    {actionStatus === 'resolved' ? 'Đã xác nhận tiếp nhận' : 'Click để xác nhận can thiệp'}
                                  </button>
                                </div>

                                {actionStatus === 'resolved' && (
                                  <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-xl">
                                    <p className="text-sm text-teal-800 flex items-start gap-2 font-medium leading-relaxed">
                                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" /> 
                                      Bạn đã xác nhận tiếp nhận thông tin. Hồ sơ sự việc đã được lưu vào hệ thống để theo dõi. Vui lòng tiến hành các bước can thiệp như gợi ý.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-green-50 border-2 border-green-100 rounded-[2rem] p-8 flex items-start gap-5 shadow-sm">
                          <div className="bg-white p-3 rounded-2xl shadow-sm flex-shrink-0">
                            <Info className="w-8 h-8 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-xl font-bold font-heading text-green-800">Tình trạng an toàn (Mức {latestAnalysis.level}: {latestAnalysis.levelName})</h4>
                              <span className="bg-white px-3 py-1 rounded-lg text-sm font-bold text-green-700 shadow-sm">
                                Học sinh: {chatOwnerId}
                              </span>
                            </div>
                            <p className="text-green-700 mt-2 leading-relaxed">
                              Học sinh đang gặp vấn đề tâm lý nhẹ hoặc xích mích nhỏ. Hệ thống đã tự động đưa ra lời khuyên để học sinh tự tháo gỡ. 
                              Giáo viên không cần can thiệp khẩn cấp, nhưng có thể theo dõi thêm qua lịch sử trò chuyện.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Phân tích cảm xúc */}
                      <div className="bg-white rounded-[2rem] border-2 border-gray-100 p-8 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Activity className="w-5 h-5" />
                          Phân tích tâm lý hiện tại
                        </h3>
                        <p className="text-gray-800 leading-relaxed text-lg">
                          {latestAnalysis.emotionAnalysis}
                        </p>
                      </div>
                    </div>

                    {/* Cột phải: Lịch sử Chat */}
                    <div className="lg:col-span-1">
                      <div className="bg-white rounded-[2rem] border-2 border-gray-100 shadow-sm overflow-hidden flex flex-col h-[700px]">
                        <div className="bg-gray-50 border-b-2 border-gray-100 p-5">
                          <h3 className="font-bold text-gray-900 flex items-center gap-2 font-heading text-lg">
                            <MessageCircleHeart className="w-5 h-5 text-teal-600" />
                            Lịch sử trò chuyện
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 font-medium">
                            Hồ sơ: <strong className="text-teal-700">{chatOwnerId}</strong>
                          </p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                          {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'}`}>
                              <span className="text-xs text-gray-400 mb-1.5 font-bold px-1">
                                {msg.sender === 'student' ? `Học sinh (${chatOwnerId})` : 'Mầm Xanh'}
                              </span>
                              <div className={`px-4 py-3 rounded-2xl text-sm max-w-[90%] shadow-sm ${
                                msg.sender === 'student' 
                                  ? 'bg-gray-100 text-gray-800 rounded-tr-sm' 
                                  : 'bg-green-50 text-green-900 border border-green-100 rounded-tl-sm'
                              }`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span className="font-bold text-sm">Đã sao chép liên kết chia sẻ!</span>
        </div>
      )}
    </div>
  );
}
