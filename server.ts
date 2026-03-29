import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

interface AnalysisResult {
  chatReply: string;
  emotionAnalysis: string;
  level: number;
  levelName: string;
  studentAdvice: string[];
  requiresTeacherIntervention: boolean;
  teacherWarning: string;
  teacherSuggestions: string[];
  topic: string;
}

interface Message {
  id: string;
  sender: 'student' | 'ai';
  text: string;
  analysis?: AnalysisResult;
  timestamp: Date;
  studentId: string;
  topic?: string;
  level?: number;
  requiresTeacherIntervention?: boolean;
}

interface User {
  uid: string;
  role: 'student' | 'teacher';
  lastActive: Date;
  totalAccesses: number;
}

// In-memory store (Real data for the current session)
const messages: Message[] = [];
const users: Record<string, User> = {};

// Default Teacher Account
const TEACHER_ACCOUNTS: Record<string, string> = {
  'GV001': 'admin123',
  'VTDINH': 'vtdinh2026'
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---

  // User Login/Activity
  app.post("/api/users/login", (req, res) => {
    const { id, password, role } = req.body;
    
    // Teacher validation
    if (role === 'teacher') {
      if (!TEACHER_ACCOUNTS[id] || TEACHER_ACCOUNTS[id] !== password) {
        return res.status(401).json({ error: "Mã giáo viên hoặc mật khẩu không đúng." });
      }
    }

    if (!users[id]) {
      users[id] = {
        uid: id,
        role: role,
        lastActive: new Date(),
        totalAccesses: 0
      };
    }
    users[id].totalAccesses += 1;
    users[id].lastActive = new Date();
    res.json(users[id]);
  });

  // Save Message
  app.post("/api/messages", (req, res) => {
    const message: Message = {
      ...req.body,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    messages.push(message);
    
    // Update user activity
    if (users[message.studentId]) {
      users[message.studentId].lastActive = new Date();
    }
    
    res.json(message);
  });

  // Get Messages for a student
  app.get("/api/messages/:studentId", (req, res) => {
    const { studentId } = req.params;
    const studentMessages = messages.filter(m => m.studentId === studentId);
    res.json(studentMessages);
  });

  // Get All Messages (for Teacher)
  app.get("/api/teacher/messages", (req, res) => {
    res.json(messages);
  });

  // Get Stats (for Teacher)
  app.get("/api/teacher/stats", (req, res) => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    let totalAccesses = 0;
    let onlineStudents = 0;
    
    Object.values(users).forEach(user => {
      if (user.role === 'student') {
        totalAccesses += user.totalAccesses;
        if (new Date(user.lastActive).getTime() > fiveMinutesAgo) {
          onlineStudents++;
        }
      }
    });

    const topicCounts: Record<string, number> = {
      'Áp lực học tập': 0,
      'Nhớ nhà / Gia đình': 0,
      'Xích mích bạn bè': 0,
      'Tình cảm tuổi teen': 0,
      'Khác': 0
    };

    messages.forEach(m => {
      if (m.topic && topicCounts[m.topic] !== undefined) {
        topicCounts[m.topic]++;
      }
    });

    const latestAlert = messages
      .filter(m => m.sender === 'ai' && m.analysis)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    res.json({
      totalAccesses,
      onlineStudents,
      totalInteractions: messages.length,
      topicDistribution: Object.entries(topicCounts).map(([name, value]) => ({ name, value })),
      latestAlert: latestAlert ? latestAlert.analysis : null,
      latestAlertStudentId: latestAlert ? latestAlert.studentId : null
    });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
