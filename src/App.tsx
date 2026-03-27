import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Activity, 
  AlertTriangle, 
  User, 
  LogOut, 
  Send, 
  ChevronRight, 
  Plus, 
  CheckCircle2, 
  Info, 
  Stethoscope, 
  Menu, 
  X,
  Calendar,
  Droplets,
  Weight,
  Thermometer,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { auth, logout, db, handleFirestoreError, OperationType, saveUserData } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getRiskAssessment, getChatResponse, PregnancyRiskAssessment } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translations, type Language, type TranslationKeys } from './translations';
import { Moon, Sun, Languages } from 'lucide-react';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm hover:shadow-rose-500/20',
    secondary: 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm hover:shadow-teal-500/20',
    outline: 'border-2 border-rose-500 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600',
    ghost: 'text-muted hover:bg-app',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-red-500/20',
  };
  return (
    <motion.button 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      className={cn('px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2', variants[variant], className)} 
      {...(props as any)} 
    />
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & any) => (
  <motion.div 
    whileHover={{ y: -2, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05)" }}
    transition={{ duration: 0.2 }}
    className={cn('bg-card rounded-2xl shadow-sm border border-divider overflow-hidden', className)}
    {...props}
  >
    {children}
  </motion.div>
);

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-semibold text-main opacity-80 ml-1">{label}</label>}
    <motion.input 
      whileFocus={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="w-full px-4 py-2.5 bg-app border border-divider rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-colors text-main placeholder:text-muted" 
      {...(props as any)} 
    />
  </div>
);

const Badge = ({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'success' | 'warning' | 'danger' }) => {
  const variants = {
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50',
    success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50',
    warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50',
    danger: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50',
  };
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider', variants[variant])}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'assessment' | 'kicks' | 'mood'>('dashboard');
  const [pregnancyData, setPregnancyData] = useState<any>(null);
  const [riskAssessment, setRiskAssessment] = useState<PregnancyRiskAssessment | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [kickSessions, setKickSessions] = useState<any[]>([]);
  const [moodEntries, setMoodEntries] = useState<any[]>([]);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('maternal-ai-lang');
    return (saved as Language) || 'en';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('maternal-ai-theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const t = (key: TranslationKeys) => translations[language][key] || key;

  useEffect(() => {
    localStorage.setItem('maternal-ai-lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('maternal-ai-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u);
      if (u && u.uid !== 'test-user-123') {
        saveUserData(u).catch(err => console.error('Error saving user data:', err));
      }
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  console.log('App render - loading:', loading, 'user:', user);

  useEffect(() => {
    if (!user) return;

    if (user.uid === 'test-user-123') {
      // Set sample data for mock testing
      setPregnancyData({
        systolicBP: 120,
        diastolicBP: 80,
        heartRate: 72,
        weight: 65,
        trimester: 2,
        weeks: 24,
      });
      setRiskAssessment({
        riskLevel: 'low',
        summary: 'Mock assessment status: Stable and healthy.',
        recommendations: ['Stay hydrated', 'Keep monitoring kicks'],
        alerts: []
      });
      setMessages([{ id: '1', role: 'assistant', content: t('welcomeMama') }]);
      return;
    }

    // Listen to pregnancy data
    const unsubscribePregnancy = onSnapshot(doc(db, 'pregnancy_data', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setPregnancyData(snapshot.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `pregnancy_data/${user.uid}`));

    // Listen to latest risk assessment
    const q = query(collection(db, `risk_assessments/${user.uid}/history`), orderBy('assessmentDate', 'desc'), limit(1));
    const unsubscribeRisk = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setRiskAssessment(snapshot.docs[0].data() as PregnancyRiskAssessment);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, `risk_assessments/${user.uid}/history`));

    // Listen to chat messages
    const chatQ = query(collection(db, `chats/${user.uid}/messages`), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribeChat = onSnapshot(chatQ, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${user.uid}/messages`));

    // Listen to kick sessions
    const kickQ = query(collection(db, `kick_sessions/${user.uid}/sessions`), orderBy('startTime', 'desc'), limit(10));
    const unsubscribeKicks = onSnapshot(kickQ, (snapshot) => {
      setKickSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `kick_sessions/${user.uid}/sessions`));

    // Listen to mood entries
    const moodQ = query(collection(db, `mood_entries/${user.uid}/entries`), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribeMood = onSnapshot(moodQ, (snapshot) => {
      setMoodEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `mood_entries/${user.uid}/entries`));

    // Listen to vitals history
    const vitalsQ = query(collection(db, `vitals_history/${user.uid}/entries`), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeVitals = onSnapshot(vitalsQ, (snapshot) => {
      setVitalsHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `vitals_history/${user.uid}/entries`));

    return () => {
      unsubscribePregnancy();
      unsubscribeRisk();
      unsubscribeChat();
      unsubscribeKicks();
      unsubscribeMood();
      unsubscribeVitals();
    };
  }, [user]);

  const [isLoggingIn, _setIsLoggingIn] = useState(false); // Kept for UI compatibility but unused

  const handleEmergency = () => {
    // Attempt to open dialer for emergency number (e.g., 108 for ambulance in India, or 911)
    // and also open a search for nearby hospitals
    window.open('tel:108', '_self');
    setTimeout(() => {
      window.open('https://www.google.com/maps/search/hospitals+near+me', '_blank');
    }, 1000);
  };

  const handleMockLogin = () => {
    const mockUser = {
      uid: 'test-user-123',
      displayName: 'Test Mama',
      email: 'test@example.com',
      isAnonymous: true,
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MaternalAI'
    };
    setUser(mockUser as any);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-rose-50 dark:bg-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex flex-col items-center gap-4"
        >
          <Heart className="w-12 h-12 text-rose-500 fill-rose-500" />
          <p className="text-rose-600 dark:text-rose-400 font-medium font-serif italic">{t('preparing')}</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center shadow-inner">
              <Heart className="w-10 h-10 text-rose-500 fill-rose-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-serif font-bold text-main tracking-tight">{t('appName')}</h1>
            <p className="text-muted text-lg leading-relaxed">{t('tagline')}</p>
          </div>
          <div className="space-y-6">
            <Button 
              onClick={handleMockLogin} 
              className="w-full py-6 text-2xl rounded-2xl shadow-xl shadow-rose-200 dark:shadow-none bg-rose-600 hover:bg-rose-700 font-serif"
            >
              Get Started
            </Button>
            
            <p className="text-sm text-muted text-center px-6 leading-relaxed italic">
              Experience personalized maternal care and 24/7 AI-powered support instantly.
            </p>

            <div className="pt-4">
              <Button 
                onClick={handleEmergency} 
                variant="danger"
                className="w-full py-4 text-lg rounded-2xl shadow-xl shadow-red-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-6 h-6" />
                {t('emergencyAmbulance')}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-muted text-sm">
            <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('aiRiskFeature')}</div>
            <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('chatSupportFeature')}</div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-card border border-divider rounded-lg px-2 py-1 text-sm text-main outline-none"
            >
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ</option>
              <option value="hi">हिन्दी</option>
            </select>
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 bg-card border border-divider rounded-lg text-muted"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app flex flex-col md:flex-row transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden bg-card border-b border-divider p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          <span className="font-serif font-bold text-xl text-main">{t('appName')}</span>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          className="p-2 text-muted"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </motion.button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-card border-r border-divider w-72 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 hidden md:flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          </div>
          <span className="font-serif font-bold text-2xl text-main tracking-tight">{t('appName')}</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          <SidebarLink 
            icon={<Activity className="w-5 h-5" />} 
            label={t('dashboard')} 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
          />
          <SidebarLink 
            icon={<MessageCircle className="w-5 h-5" />} 
            label={t('aiAssistant')} 
            active={activeTab === 'chat'} 
            onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }} 
          />
          <SidebarLink 
            icon={<Stethoscope className="w-5 h-5" />} 
            label={t('healthCheck')} 
            active={activeTab === 'assessment'} 
            onClick={() => { setActiveTab('assessment'); setIsSidebarOpen(false); }} 
          />
          <SidebarLink 
            icon={<Plus className="w-5 h-5" />} 
            label={t('kickCounter')} 
            active={activeTab === 'kicks'} 
            onClick={() => { setActiveTab('kicks'); setIsSidebarOpen(false); }} 
          />
          <SidebarLink 
            icon={<Heart className="w-5 h-5" />} 
            label={t('moodTracker')} 
            active={activeTab === 'mood'} 
            onClick={() => { setActiveTab('mood'); setIsSidebarOpen(false); }} 
          />
          
          <div className="pt-4 mt-4 border-t border-divider">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={handleEmergency} 
                variant="danger"
                className="w-full py-3 text-sm rounded-xl shadow-md shadow-red-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" />
                {t('emergencyAmbulance')}
              </Button>
            </motion.div>
          </div>
        </nav>

        <div className="p-4 border-t border-divider space-y-4">
          <div className="flex items-center justify-between px-2">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 text-muted"
            >
              <Languages className="w-4 h-4" />
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent text-xs font-bold uppercase tracking-wider outline-none cursor-pointer"
              >
                <option value="en" className="text-slate-900">EN</option>
                <option value="kn" className="text-slate-900">KN</option>
                <option value="hi" className="text-slate-900">HI</option>
              </select>
            </motion.div>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 bg-app rounded-xl text-muted hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </motion.button>
          </div>

          <div className="bg-app rounded-2xl p-4 flex items-center gap-3">
            {user.isAnonymous ? (
              <div className="w-10 h-10 rounded-full border-2 border-card shadow-sm bg-rose-100 flex items-center justify-center">
                <User className="w-5 h-5 text-rose-500" />
              </div>
            ) : (
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-card shadow-sm" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-main truncate">{user.isAnonymous ? 'Guest User' : user.displayName}</p>
              <p className="text-xs text-muted truncate">{user.isAnonymous ? 'Not logged in' : user.email}</p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1, x: 2 }}
              whileTap={{ scale: 0.9 }}
              onClick={logout} 
              className="p-2 text-muted hover:text-rose-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dashboard" data={pregnancyData} assessment={riskAssessment} moodEntries={moodEntries} vitalsHistory={vitalsHistory} t={t} />}
          {activeTab === 'chat' && (
            <Chat 
              key="chat" 
              user={user} 
              messages={messages} 
              setMessages={setMessages} 
              t={t} 
              language={language} 
            />
          )}
          {activeTab === 'assessment' && (
            <AssessmentForm 
              key="assessment" 
              user={user} 
              currentData={pregnancyData} 
              setPregnancyData={setPregnancyData} 
              setRiskAssessment={setRiskAssessment} 
              setVitalsHistory={setVitalsHistory} 
              onComplete={() => setActiveTab('dashboard')} 
              t={t} 
              language={language} 
            />
          )}
          {activeTab === 'kicks' && <KickCounter key="kicks" user={user} sessions={kickSessions} t={t} />}
          {activeTab === 'mood' && <MoodTracker key="mood" user={user} entries={moodEntries} t={t} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button 
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium",
        active 
          ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shadow-sm shadow-rose-100 dark:shadow-none" 
          : "text-muted hover:bg-app hover:text-main"
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-500" />}
    </motion.button>
  );
}

// --- Tab Views ---

function Dashboard({ data, assessment, moodEntries, vitalsHistory, t }: { data: any; assessment: PregnancyRiskAssessment | null; moodEntries: any[]; vitalsHistory: any[]; t: (key: TranslationKeys) => string }) {
  const latestMood = moodEntries[0];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-main">{t('welcomeBack')}</h2>
          <p className="text-muted mt-1">{t('overview')}</p>
        </div>
        <div className="flex items-center gap-4">
          {latestMood && (
            <div className="bg-card px-4 py-2 rounded-2xl border border-divider shadow-sm flex items-center gap-2">
              <span className="text-lg">{latestMood.mood === 'happy' ? '😊' : latestMood.mood === 'calm' ? '😌' : latestMood.mood === 'tired' ? '😴' : latestMood.mood === 'anxious' ? '😟' : '😢'}</span>
              <span className="text-sm font-medium text-muted capitalize">{t(latestMood.mood as TranslationKeys)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-2xl border border-divider shadow-sm">
            <Calendar className="w-5 h-5 text-rose-500" />
            <span className="font-bold text-main">{t('week')} {data?.trimester ? (data.trimester * 12) : '--'}</span>
          </div>
        </div>
      </motion.header>

      {/* Daily Tip */}
      <motion.div variants={itemVariants}>
        <DailyTip trimester={data?.trimester || 1} t={t} />
      </motion.div>

      {/* Risk Status */}
      <motion.div variants={itemVariants}>
        <Card className={cn(
          "p-6 border-l-8",
          assessment?.riskLevel === 'high' ? "border-l-rose-500 bg-rose-50/30 dark:bg-rose-900/10" : 
          assessment?.riskLevel === 'medium' ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10" : 
          "border-l-teal-500 bg-teal-50/30 dark:bg-teal-900/10"
        )}>
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0",
              assessment?.riskLevel === 'high' ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" : 
              assessment?.riskLevel === 'medium' ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" : 
              "bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400"
            )}>
              {assessment?.riskLevel === 'high' ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-main">{t('riskAssessment')}</h3>
                <Badge variant={assessment?.riskLevel === 'high' ? 'danger' : assessment?.riskLevel === 'medium' ? 'warning' : 'success'}>
                  {assessment?.riskLevel ? t(assessment.riskLevel as TranslationKeys) : t('notAssessed')}
                </Badge>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{assessment?.summary || t('healthCheckDesc')}</p>
              
              {assessment?.alerts && assessment.alerts.length > 0 && (
                <div className="bg-card/60 rounded-xl p-4 border border-rose-100 dark:border-rose-900/30">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {t('criticalAlerts')}
                  </p>
                  <ul className="space-y-1.5">
                    {assessment.alerts.map((alert, i) => (
                      <li key={i} className="text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-400 shrink-0" />
                        {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Vitals Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard icon={<Droplets className="text-blue-500" />} label={t('bloodPressure')} value={data ? `${data.systolicBP}/${data.diastolicBP}` : '--'} unit="mmHg" />
        <VitalCard icon={<Activity className="text-rose-500" />} label={t('heartRate')} value={data?.heartRate || '--'} unit="bpm" />
        <VitalCard icon={<Weight className="text-teal-500" />} label={t('weight')} value={data?.weight || '--'} unit="kg" />
        <VitalCard icon={<Thermometer className="text-amber-500" />} label={t('trimester')} value={data?.trimester || '--'} unit="Stage" />
      </motion.div>

      {/* Trends & Milestones */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <HealthTrends history={vitalsHistory} t={t} />
        <PregnancyMilestones trimester={data?.trimester || 1} t={t} />
      </motion.div>

      {/* Recommendations */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-main mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-teal-500" /> {t('personalizedCare')}
          </h3>
          <motion.ul 
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.1 } }
            }}
            className="space-y-4"
          >
            {assessment?.recommendations ? assessment.recommendations.map((rec, i) => (
              <motion.li 
                key={i} 
                variants={{
                  hidden: { opacity: 0, x: -10 },
                  visible: { opacity: 1, x: 0 }
                }}
                className="flex gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
                <p className="text-slate-600 dark:text-slate-300 text-sm">{rec}</p>
              </motion.li>
            )) : (
              <p className="text-muted text-sm italic">{t('noRecommendations')}</p>
            )}
          </motion.ul>
        </Card>

        <Card className="p-6 bg-rose-500 text-white border-none relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <h3 className="text-lg font-bold">{t('emergencySupport')}</h3>
            <p className="text-rose-100 text-sm">{t('emergencyDesc')}</p>
            <Button 
              variant="ghost" 
              className="bg-white/20 hover:bg-white/30 text-white border-none w-full"
              onClick={() => {
                window.location.href = 'tel:108';
                window.open('https://www.google.com/maps/search/hospitals+near+me', '_blank');
              }}
            >
              {t('callEmergency')}
            </Button>
          </div>
          <motion.div 
            animate={{ scale: [1, 1.1, 1], rotate: [12, 15, 12] }} 
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="absolute -bottom-8 -right-8"
          >
            <Heart className="w-48 h-48 text-white/10" />
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function HealthTrends({ history, t }: { history: any[]; t: (key: TranslationKeys) => string }) {
  const chartData = [...history].reverse().map(h => ({
    date: new Date(h.timestamp?.toDate()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    systolic: h.systolicBP,
    diastolic: h.diastolicBP,
    weight: h.weight,
  }));

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-main flex items-center gap-2">
        <Activity className="w-5 h-5 text-rose-500" /> {t('healthTrends')}
      </h3>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="h-[300px] w-full"
      >
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="systolic" name={t('systolicBP')} stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="diastolic" name={t('diastolicBP')} stroke="#fb7185" strokeWidth={2} dot={{ r: 4, fill: '#fb7185' }} />
              <Line type="monotone" dataKey="weight" name={t('weight')} stroke="#14b8a6" strokeWidth={2} dot={{ r: 4, fill: '#14b8a6' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm italic">
            {t('noTrends')}
          </div>
        )}
      </motion.div>
    </Card>
  );
}

function PregnancyMilestones({ trimester, t }: { trimester: number; t: (key: TranslationKeys) => string }) {
  const milestones = {
    1: [
      { title: "Baby's Heartbeat", desc: "Around week 6, the heart starts beating." },
      { title: "Organ Development", desc: "Major organs begin to form." },
      { title: "First Ultrasound", desc: "Usually happens between weeks 8-12." }
    ],
    2: [
      { title: "Gender Reveal", desc: "Usually possible around week 18-20." },
      { title: "First Kicks", desc: "You'll start feeling movement (quickening)." },
      { title: "Hearing Develops", desc: "Baby can hear your voice and music." }
    ],
    3: [
      { title: "Rapid Growth", desc: "Baby gains most of their weight now." },
      { title: "Lung Maturity", desc: "Lungs prepare for breathing air." },
      { title: "Head Down", desc: "Baby usually turns head-down for birth." }
    ]
  };

  const currentMilestones = milestones[trimester as keyof typeof milestones] || milestones[1];

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-main flex items-center gap-2">
        <Calendar className="w-5 h-5 text-teal-500" /> {t('trimester')} {trimester} {t('milestones')}
      </h3>
      <motion.div 
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {currentMilestones.map((m, i) => (
          <motion.div 
            key={i} 
            variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 }
            }}
            className="flex gap-4 p-4 bg-app rounded-2xl border border-divider"
          >
            <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center shrink-0 shadow-sm text-teal-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-main">{m.title}</p>
              <p className="text-sm text-muted">{m.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Card>
  );
}

function DailyTip({ trimester, t }: { trimester: number; t: (key: TranslationKeys) => string }) {
  const tips = {
    1: "You're doing amazing, Mama! Remember to stay hydrated and take your prenatal vitamins. Small, frequent meals can help ease morning sickness.",
    2: "It's a beautiful time to connect with your baby. Try sleeping on your side for better comfort. You're doing great!",
    3: "You're almost there! Pack your hospital bag and practice your breathing. Keep monitoring those precious kicks!"
  };

  const tip = tips[trimester as keyof typeof tips] || tips[1];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-rose-100 dark:bg-rose-900/30 text-rose-900 dark:text-rose-100 p-6 rounded-3xl shadow-lg shadow-rose-100/50 dark:shadow-none flex items-center gap-6 relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-rose-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-300">{t('mamaTip')}</span>
        </div>
        <p className="text-lg font-medium leading-relaxed">{tip}</p>
      </div>
      <motion.div
        animate={{ scale: [1, 1.05, 1], rotate: [-5, 5, -5] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="absolute -right-12 -bottom-12"
      >
        <Heart className="w-48 h-48 text-rose-500/10" />
      </motion.div>
    </motion.div>
  );
}

function VitalCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string | number; unit: string }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card className="p-5 flex items-center gap-4 h-full">
        <div className="w-12 h-12 bg-app rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold text-muted uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-main">{value}</span>
            <span className="text-xs text-muted">{unit}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Chat({ user, messages, setMessages, t, language }: { user: FirebaseUser; messages: any[]; setMessages: React.Dispatch<React.SetStateAction<any[]>>; t: (key: TranslationKeys) => string; language: string }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const suggestions: TranslationKeys[] = [
    'suggestMorningSickness',
    'suggestHealthySnacks',
    'suggestSleep',
    'suggestGrowth',
    'suggestOverwhelmed'
  ];
  const [isRecording, setIsRecording] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + ' ' + transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, [language]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    try {
      if (user.uid === 'test-user-123') {
        setMessages(prev => [...prev, { id: 'temp-u-' + Date.now(), role: 'user', content: text, timestamp: new Date() }]);
      } else {
        await addDoc(collection(db, `chats/${user.uid}/messages`), {
          userId: user.uid,
          role: 'user',
          content: text,
          timestamp: serverTimestamp()
        });
      }

      setIsTyping(true);
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const responseStream = await getChatResponse(history, text, language);
      setIsTyping(false);

      const aiMessageId = 'temp-a-' + Date.now();
      let accumulatedText = "";

      // Add placeholder message
      setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '', timestamp: new Date() }]);

      // Process the stream
      for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        accumulatedText += chunkText;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg
          )
        );
      }

      if (user.uid !== 'test-user-123') {
        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, `chats/${user.uid}/messages`), {
          userId: user.uid,
          role: 'assistant',
          content: accumulatedText,
          timestamp: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const clearChat = async () => {
    setShowClearConfirm(false);
    if (user.uid === 'test-user-123') {
      setMessages([]);
      return;
    }
    try {
      const q = query(collection(db, `chats/${user.uid}/messages`));
      const snapshot = await getDocs(q);
      const { deleteDoc, doc } = await import('firebase/firestore');
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, `chats/${user.uid}/messages`, d.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="h-[calc(100vh-8rem)] md:h-[calc(100vh-12rem)] flex flex-col bg-card rounded-3xl shadow-xl border border-divider overflow-hidden relative"
    >
      <div className="absolute inset-0 z-[1] opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url(/chat-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 border border-divider"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto text-rose-500">
                  <X className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-main">{t('clearChatConfirm')}</h3>
                <p className="text-muted">{t('clearChatDesc')}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button onClick={clearChat} className="flex-1 bg-rose-500 hover:bg-rose-600">
                  {t('clearAll')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="p-6 border-b border-divider flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-main">{t('appName')} Assistant</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted font-medium">{t('alwaysHere')}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowClearConfirm(true)}
          className="p-2 text-muted hover:text-rose-500 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <X className="w-4 h-4" /> {t('clearChat')}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative z-10">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 text-rose-300 dark:text-rose-700" />
            </div>
            <p className="text-muted text-sm font-medium">{t('chatPlaceholder')}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            key={i} 
            className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
          >
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-rose-500 text-white rounded-tr-none shadow-lg shadow-rose-100 dark:shadow-none" 
                : "bg-app text-main rounded-tl-none border border-divider"
            )}>
              <div className="prose prose-sm prose-rose dark:prose-invert max-w-none">
                <ReactMarkdown>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-start"
          >
            <div className="bg-app p-4 rounded-2xl rounded-tl-none border border-divider flex gap-1">
              <motion.span 
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
                className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" 
              />
              <motion.span 
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" 
              />
              <motion.span 
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.4 }}
                className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" 
              />
            </div>
          </motion.div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-divider bg-app/30 flex gap-2 overflow-x-auto no-scrollbar">
        {suggestions.map((key) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage(t(key))}
            className="whitespace-nowrap px-4 py-2 rounded-full bg-card border border-divider text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shadow-sm"
          >
            {t(key)}
          </motion.button>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-app/50 border-t border-divider flex gap-2 relative z-10">
        <motion.input 
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRecording ? t('recordingAudio') : t('typeMessage')}
          disabled={isRecording}
          className="flex-1 bg-card px-6 py-3 rounded-2xl border border-divider disabled:bg-app disabled:opacity-80 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-colors text-main"
        />
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleRecording}
          className={cn(
            "w-12 h-12 p-0 rounded-2xl flex items-center justify-center transition-colors",
            isRecording ? "bg-rose-600 text-white" : "bg-card border border-divider text-muted hover:text-rose-500"
          )}
        >
          <Mic className="w-5 h-5" />
        </motion.button>
        <Button type="submit" className="w-12 h-12 p-0 rounded-2xl">
          <Send className="w-5 h-5" />
        </Button>
      </form>
    </motion.div>
  );
}

function AssessmentForm({ user, currentData, setPregnancyData, setRiskAssessment, setVitalsHistory, onComplete, t, language }: { user: FirebaseUser; currentData: any; setPregnancyData: (d: any) => void; setRiskAssessment: (d: any) => void; setVitalsHistory: React.Dispatch<React.SetStateAction<any[]>>; onComplete: () => void; t: (key: TranslationKeys) => string; language: string }) {
  const [formData, setFormData] = useState({
    age: currentData?.age || '',
    trimester: currentData?.trimester || '1',
    systolicBP: currentData?.systolicBP || '',
    diastolicBP: currentData?.diastolicBP || '',
    heartRate: currentData?.heartRate || '',
    weight: currentData?.weight || '',
    medicalHistory: currentData?.medicalHistory || '',
    symptoms: currentData?.symptoms?.join(', ') || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = {
        ...formData,
        userId: user.uid,
        age: Number(formData.age),
        trimester: Number(formData.trimester),
        systolicBP: Number(formData.systolicBP),
        diastolicBP: Number(formData.diastolicBP),
        heartRate: Number(formData.heartRate),
        weight: Number(formData.weight),
        symptoms: formData.symptoms.split(',').map(s => s.trim()).filter(s => s),
        updatedAt: new Date().toISOString()
      };

      if (user.uid === 'test-user-123') {
        setPregnancyData(data);
        setVitalsHistory(prev => [{ ...data, timestamp: { toDate: () => new Date() } }, ...prev]);
      } else {
        // Save to Firestore
        await setDoc(doc(db, 'pregnancy_data', user.uid), data);

        // Save to vitals history
        await addDoc(collection(db, `vitals_history/${user.uid}/entries`), {
          ...data,
          timestamp: serverTimestamp()
        });
      }

      // Get AI Assessment
      const assessment = await getRiskAssessment(data, language);

      if (user.uid === 'test-user-123') {
        setRiskAssessment(assessment);
      } else {
        // Save assessment history
        await addDoc(collection(db, `risk_assessments/${user.uid}/history`), {
          ...assessment,
          userId: user.uid,
          assessmentDate: serverTimestamp()
        });
      }

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-2xl mx-auto"
    >
      <Card className="p-8 space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-main">{t('healthCheckIn')}</h2>
          <p className="text-muted">{t('healthCheckDesc')}</p>
        </div>

        <motion.form 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit} 
          className="space-y-6"
        >
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label={t('age')} 
              type="number" 
              required 
              value={formData.age} 
              onChange={e => setFormData({ ...formData, age: e.target.value })} 
            />
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-main opacity-80 ml-1">{t('trimester')}</label>
              <motion.select 
                whileFocus={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
                className="w-full px-4 py-2.5 bg-app border border-divider rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-colors text-main"
                value={formData.trimester}
                onChange={e => setFormData({ ...formData, trimester: e.target.value })}
              >
                <option value="1">{t('trimester1')}</option>
                <option value="2">{t('trimester2')}</option>
                <option value="3">{t('trimester3')}</option>
              </motion.select>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label={t('systolicBP')} 
              type="number" 
              required 
              placeholder="e.g. 120"
              value={formData.systolicBP} 
              onChange={e => setFormData({ ...formData, systolicBP: e.target.value })} 
            />
            <Input 
              label={t('diastolicBP')} 
              type="number" 
              required 
              placeholder="e.g. 80"
              value={formData.diastolicBP} 
              onChange={e => setFormData({ ...formData, diastolicBP: e.target.value })} 
            />
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label={t('heartRateBpm')} 
              type="number" 
              required 
              value={formData.heartRate} 
              onChange={e => setFormData({ ...formData, heartRate: e.target.value })} 
            />
            <Input 
              label={t('weightKg')} 
              type="number" 
              required 
              value={formData.weight} 
              onChange={e => setFormData({ ...formData, weight: e.target.value })} 
            />
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-sm font-semibold text-main opacity-80 ml-1">{t('symptoms')}</label>
            <motion.textarea 
              whileFocus={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
              placeholder="e.g. Nausea, headache, swelling (comma separated)"
              className="w-full px-4 py-2.5 bg-app border border-divider rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-colors text-main min-h-[100px]"
              value={formData.symptoms}
              onChange={e => setFormData({ ...formData, symptoms: e.target.value })}
            />
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-sm font-semibold text-main opacity-80 ml-1">{t('medicalHistory')}</label>
            <motion.textarea 
              whileFocus={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
              placeholder="Any pre-existing conditions or concerns..."
              className="w-full px-4 py-2.5 bg-app border border-divider rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-colors text-main min-h-[100px]"
              value={formData.medicalHistory}
              onChange={e => setFormData({ ...formData, medicalHistory: e.target.value })}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <Button type="submit" disabled={isSubmitting} className="w-full py-4 text-lg">
              {isSubmitting ? t('analyzing') : t('submitAssessment')}
            </Button>
          </motion.div>
        </motion.form>
      </Card>
    </motion.div>
  );
}

function KickCounter({ user, sessions, t }: { user: FirebaseUser; sessions: any[]; t: (key: TranslationKeys) => string }) {
  const [count, setCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const startSession = () => {
    setIsTracking(true);
    setCount(0);
    setStartTime(new Date());
  };

  const stopSession = async () => {
    if (!startTime) return;
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    
    try {
      await addDoc(collection(db, `kick_sessions/${user.uid}/sessions`), {
        userId: user.uid,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        kickCount: count,
        durationMinutes: duration
      });
      setIsTracking(false);
      setStartTime(null);
      setCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <Card className="p-8 text-center space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-main">{t('kickCounter')}</h2>
          <p className="text-muted">{t('kickCounterDesc')}</p>
        </div>

        {!isTracking ? (
          <div className="py-12 flex justify-center">
            <Button onClick={startSession} className="w-48 h-48 rounded-full text-xl flex flex-col gap-2 shadow-2xl shadow-rose-200 dark:shadow-none">
              <Plus className="w-8 h-8" />
              {t('startSession')}
            </Button>
          </div>
        ) : (
          <div className="space-y-8 py-8">
            <div className="relative inline-block">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setCount(c => c + 1)}
                className="w-64 h-64 rounded-full bg-rose-500 text-white flex flex-col items-center justify-center gap-2 shadow-2xl shadow-rose-200 dark:shadow-none border-8 border-white dark:border-slate-800"
              >
                <span className="text-6xl font-bold">{count}</span>
                <span className="text-sm font-bold uppercase tracking-widest">{t('kicks')}</span>
              </motion.button>
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                <Heart className="w-6 h-6 fill-white" />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <p className="text-muted font-medium">{t('sessionStarted')} {startTime?.toLocaleTimeString()}</p>
              <Button variant="outline" onClick={stopSession} className="w-full max-w-xs">
                {t('finish')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h3 className="text-lg font-bold text-main ml-2">{t('recentSessions')}</h3>
        {sessions.length === 0 ? (
          <p className="text-muted text-center py-8 italic">{t('noSessions')}</p>
        ) : (
          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {sessions.map((session, i) => (
              <motion.div 
                key={i}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  show: { opacity: 1, x: 0 }
                }}
              >
                <Card className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-app rounded-xl flex items-center justify-center text-rose-500">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-main">{session.kickCount} {t('kicks')}</p>
                      <p className="text-xs text-muted">{new Date(session.startTime).toLocaleDateString()} • {session.durationMinutes} {t('minutes')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={session.kickCount >= 10 ? 'success' : 'warning'}>
                      {session.kickCount >= 10 ? t('healthy') : t('lowMovement')}
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function MoodTracker({ user, entries, t }: { user: FirebaseUser; entries: any[]; t: (key: TranslationKeys) => string }) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const moods = [
    { id: 'happy', emoji: '😊', label: t('happy'), color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    { id: 'calm', emoji: '😌', label: t('calm'), color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    { id: 'tired', emoji: '😴', label: t('tired'), color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { id: 'anxious', emoji: '😟', label: t('anxious'), color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
    { id: 'sad', emoji: '😢', label: t('sad'), color: 'bg-app text-muted' },
  ];

  const saveMood = async () => {
    if (!selectedMood) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `mood_entries/${user.uid}/entries`), {
        userId: user.uid,
        mood: selectedMood,
        note,
        timestamp: serverTimestamp()
      });
      setSelectedMood(null);
      setNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <Card className="p-8 space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-serif font-bold text-main">{t('moodTracker')}</h2>
          <p className="text-muted">{t('moodTrackerDesc')}</p>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {moods.map((m) => (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              key={m.id}
              onClick={() => setSelectedMood(m.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2",
                selectedMood === m.id 
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20" 
                  : "border-transparent bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span className="text-3xl">{m.emoji}</span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">{m.label}</span>
            </motion.button>
          ))}
        </div>

        <div className="space-y-4">
          <motion.textarea 
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
            placeholder={t('moodPlaceholder')}
            className="w-full px-4 py-3 bg-app border border-divider rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-colors text-main min-h-[100px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button 
            disabled={!selectedMood || isSubmitting} 
            onClick={saveMood} 
            className="w-full py-4"
          >
            {isSubmitting ? t('saving') : t('saveMood')}
          </Button>
        </div>
      </Card>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h3 className="text-lg font-bold text-main ml-2">{t('moodHistory')}</h3>
        {entries.length === 0 ? (
          <p className="text-muted text-center py-8 italic">{t('noEntries')}</p>
        ) : (
          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {entries.map((entry, i) => {
              const moodData = moods.find(m => m.id === entry.mood);
              return (
                <motion.div 
                  key={i}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show: { opacity: 1, x: 0 }
                  }}
                >
                  <Card className="p-4 flex items-start gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl", moodData?.color)}>
                      {moodData?.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-main capitalize">{entry.mood}</p>
                        <p className="text-xs text-muted">{entry.timestamp?.toDate().toLocaleDateString()}</p>
                      </div>
                      {entry.note && <p className="text-sm text-muted mt-1 italic">"{entry.note}"</p>}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
