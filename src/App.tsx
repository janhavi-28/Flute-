// Fixed TypeScript errors and improved type safety for deployment
import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { removeBackground } from "@imgly/background-removal";
import type { User } from "@supabase/supabase-js";

type AppRoute = "home" | "biography" | "FluteRoots" | "organizersCorner" | "contact" | "admin" | "login" | "coursePlayer";

interface Course {
  id: string; // Changed to string for UUIDs
  title: string;
  description: string;
  level?: string;
  duration?: string;
  lessons?: number;
  price: string;
  video_url: string; // Renamed for general file/YouTube support
  thumbnail_url?: string;
  notes_url?: string;
  announcement?: string;
}

interface GalleryImage {
  id: string;
  image_url: string;
  display_order: number;
}

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'performance' | 'class' | 'blocked' | 'available';
}

interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
}

const STORAGE_KEY = "flute_courses";

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  const fallbackMatch = url.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
  if (fallbackMatch) return fallbackMatch[1];
  return null;
}

function loadCourses(): Course[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveCourses(courses: Course[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

const GALLERY_KEY = "flute_gallery";

function loadGalleryImages(): string[] {
  try {
    const stored = localStorage.getItem(GALLERY_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveGalleryImages(imgs: string[]) {
  localStorage.setItem(GALLERY_KEY, JSON.stringify(imgs));
}

const artistProfile = {
  name: "Digvijaysinh Chauhan",
  role: "Professional Flautist",
  email: "digvijayflute@gmail.com",
  phone: "+91 77890 23982",
  location: "Bhubaneswar, Odisha",
  summary:
    "Disciple of Padma Vibhushan Pandit Hariprasad Chaurasia ji, presenting Hindustani classical flute with deep meditative precision and contemporary flair."
};

const images = {
  hero: "/digvijay_hero_final.png",
  bio: "/images/digvijay-performance-blue.png",
  gallery: [
    "/images/digvijay-casual-flute.png",
    "/images/digvijay-performance-blue.png",
    "/images/digvijay-portrait-white.jpeg",
    "/images/digvijay-hero-white.jpeg",
    "/images/digvijay-hero-red.jpeg",
    "/images/digvijay-profile-poster.jpeg"
  ]
};

function App() {
  const [route, setRoute] = useState<AppRoute>(() => {
    const path = window.location.pathname.replace("/", "") || "home";
    const routes = ["home", "biography", "FluteRoots", "organizersCorner", "contact", "admin", "login", "coursePlayer"];
    return routes.includes(path) ? path as AppRoute : "home";
  });

  const navigate = (to: AppRoute) => {
    const path = to === "home" ? "/" : `/${to}`;
    window.history.pushState({}, "", path);
    setRoute(to);
    window.scrollTo(0, 0);
  };

  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [returnRoute, setReturnRoute] = useState<AppRoute | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryImage[]>([]);
  const [enrollments, setEnrollments] = useState<string[]>([]); // Array of course_ids
  const [heroImageUrl, setHeroImageUrl] = useState<string>(() => localStorage.getItem('local_hero_image') || "");
  const [heroAudioUrl, setHeroAudioUrl] = useState<string>("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const defaultWeeklySchedule: Record<string, Record<string, string>> = {
    "5-6 AM": { MON: "", TUE: "Thiag", WED: "", THU: "", FRI: "", SAT: "Suchi", SUN: "Ram" },
    "6-7 AM": { MON: "", TUE: "", WED: "", THU: "", FRI: "", SAT: "", SUN: "" },
    "7-8 AM": { MON: "", TUE: "Haren", WED: "", THU: "", FRI: "Subhash", SAT: "Ajay/deb", SUN: "Sneham" },
    "8-9 AM": { MON: "Karthik", TUE: "Abhisk", WED: "", THU: "", FRI: "Sang", SAT: "Vikas", SUN: "Dhiraj10" },
    "2-3 PM": { MON: "Rajiv", TUE: "Utsav", WED: "", THU: "", FRI: "Jagroop", SAT: "Bikram", SUN: "Mayur/ayan" },
    "5-6 PM": { MON: "Sd", TUE: "Sd", WED: "", THU: "", FRI: "Sd", SAT: "Aditya", SUN: "Momen" },
    "6-7 PM": { MON: "", TUE: "", WED: "", THU: "", FRI: "", SAT: "Satanu", SUN: "" },
    "7-8 PM": { MON: "", TUE: "Gc", WED: "", THU: "", FRI: "Gc", SAT: "GC", SUN: "Binod" },
    "8-9 PM": { MON: "", TUE: "Gc", WED: "", THU: "", FRI: "Gc", SAT: "GC", SUN: "" }
  };
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, Record<string, string>>>(defaultWeeklySchedule);
  const [introVideo, setIntroVideo] = useState({
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Default fallback
    title: "Introductory Video",
    description: "Welcome to the world of Bansuri. Here we explore the deep meditative qualities of the Indian flute."
  });
  const [stageSetupUrl, setStageSetupUrl] = useState<string>("");
  const [announcements, setAnnouncements] = useState<{title: string, text: string}[]>([
    { title: "New Advanced Raag Course Coming Soon!", text: "We are launching an intensive course on Raag Yaman next month. Registrations open shortly." },
    { title: "LMS Feature Update", text: "You can now download course materials and certificates directly from your dashboard." }
  ]);
  const [bioImageUrl, setBioImageUrl] = useState<string>(images.bio);
  const [bioParagraphs, setBioParagraphs] = useState<string[]>([
    "Digvijaysinh Chauhan is a renowned Indian classical flautist and a dedicated disciple of Padma Vibhushan Pandit Hariprasad Chaurasia ji. His musical journey is rooted in the authentic Guru-Shishya Parampara system at Vrindaban Gurukul, Bhubaneswar.",
    "A PhD scholar in Electronics Engineering, Digvijay represents a rare blend of scientific precision and artistic depth. His style of playing reflects the pure tone, clear raga presentation, and deeply expressive approach of the Maihar tradition.",
    "Through his brand 'Flute Roots | Nothing But Music', he is committed to preserving and promoting the traditional art of bansuri while exploring contemporary collaborations that resonate with global audiences."
  ]);
  const [bioAwards, setBioAwards] = useState<string[]>([
    "Sanskar Vibhushan Samman",
    "CCRT Scholarship",
    "OMC Foundation Award",
    "NALCO Cultural Honor"
  ]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const isInitialLoad = useRef(true);
  const isFetching = useRef(false);

  const fetchData = useCallback(async () => {
    if (isFetching.current) return;
    
    try {
      isFetching.current = true;
      // Only show loading spinner on the very first visit
      if (isInitialLoad.current) setLoading(true);

      const [coursesRes, galleryRes, settingsRes, eventsRes] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('gallery').select('*').order('display_order', { ascending: true }),
        supabase.from('settings').select('*'),
        supabase.from('events').select('*').order('date', { ascending: true })
      ]);

      if (!coursesRes.error) setCourses(coursesRes.data || []);
      if (!galleryRes.error) setGalleryItems(galleryRes.data || []);
      
      if (!settingsRes.error && settingsRes.data) {
        const settings = settingsRes.data;
        const hero = settings.find(s => s.key === 'hero_image_url');
        if (hero) {
          setHeroImageUrl(hero.value);
          localStorage.setItem('local_hero_image', hero.value);
        }

        const heroAudio = settings.find(s => s.key === 'hero_audio_url');
        if (heroAudio) setHeroAudioUrl(heroAudio.value);

        const newIntro = { ...introVideo };
        settings.forEach(s => {
          if (s.key === 'intro_video_url') newIntro.url = s.value;
          if (s.key === 'intro_video_title') newIntro.title = s.value;
          if (s.key === 'intro_video_description') newIntro.description = s.value;
        });
        setIntroVideo(newIntro);

        const setup = settings.find(s => s.key === 'stage_setup_url_1');
        if (setup) setStageSetupUrl(setup.value);

        const bioImage = settings.find(s => s.key === 'bio_image_url');
        if (bioImage) {
          setBioImageUrl(bioImage.value);
        } else {
          const localBioImage = localStorage.getItem('local_bio_image');
          if (localBioImage) setBioImageUrl(localBioImage);
        }

        const bioParaJson = settings.find(s => s.key === 'bio_paragraphs_json');
        if (bioParaJson) {
          try {
            setBioParagraphs(JSON.parse(bioParaJson.value));
          } catch (e) { console.error("Error parsing bio paragraphs:", e); }
        } else {
          const localBioParas = localStorage.getItem('local_bio_paragraphs');
          if (localBioParas) {
            try {
              setBioParagraphs(JSON.parse(localBioParas));
            } catch (e) { console.error(e); }
          }
        }

        const bioAwardsJson = settings.find(s => s.key === 'bio_awards_json');
        if (bioAwardsJson) {
          try {
            setBioAwards(JSON.parse(bioAwardsJson.value));
          } catch (e) { console.error("Error parsing bio awards:", e); }
        } else {
          const localBioAwards = localStorage.getItem('local_bio_awards');
          if (localBioAwards) {
            try {
              setBioAwards(JSON.parse(localBioAwards));
            } catch (e) { console.error(e); }
          }
        }

        // Load announcements from JSON or individual keys
        const annJson = settings.find(s => s.key === 'course_announcements_json');
        if (annJson) {
          try {
            setAnnouncements(JSON.parse(annJson.value));
          } catch (e) { console.error(e); }
        } else {
          const ann1Title = settings.find(s => s.key === 'announcement_1_title');
          const ann1Text = settings.find(s => s.key === 'announcement_1_text');
          const ann2Title = settings.find(s => s.key === 'announcement_2_title');
          const ann2Text = settings.find(s => s.key === 'announcement_2_text');
          const loadedAnn = [];
          if (ann1Title || ann1Text) loadedAnn.push({ title: ann1Title?.value || "", text: ann1Text?.value || "" });
          if (ann2Title || ann2Text) loadedAnn.push({ title: ann2Title?.value || "", text: ann2Text?.value || "" });
          if (loadedAnn.length > 0) setAnnouncements(loadedAnn);
        }

        // Load weekly schedule from database or local storage cache
        const scheduleJson = settings.find(s => s.key === 'weekly_schedule_json');
        if (scheduleJson) {
          try {
            setWeeklySchedule(JSON.parse(scheduleJson.value));
          } catch (e) { console.error("Error parsing weekly schedule:", e); }
        } else {
          const localSchedule = localStorage.getItem('local_weekly_schedule');
          if (localSchedule) {
            try {
              setWeeklySchedule(JSON.parse(localSchedule));
            } catch (e) { console.error(e); }
          }
        }
      }

      if (!eventsRes.error) setCalendarEvents(eventsRes.data || []);

      // Fetch enrollments if user session exists to keep enrollment state in sync instantly
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: enrollData } = await supabase.from('enrollments').select('course_id').eq('user_id', session.user.id);
        if (enrollData) {
          setEnrollments(enrollData.map(e => e.course_id));
        }
      } else {
        setEnrollments([]);
      }

      isInitialLoad.current = false;
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []); // Remove user dependency to prevent loop

  // Fetch enrollments separately when user changes
  useEffect(() => {
    const fetchEnrollments = async () => {
      if (user) {
        const { data } = await supabase.from('enrollments').select('course_id').eq('user_id', user.id);
        if (data) setEnrollments(data.map(e => e.course_id));
      } else {
        setEnrollments([]);
      }
    };
    fetchEnrollments();
  }, [user]);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsUserAdmin(currentUser?.email === "digvijayflute@gmail.com" || currentUser?.email === "janhavikolekar280@gmail.com");
      fetchData();
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setIsUserAdmin(newUser?.email === "digvijayflute@gmail.com" || newUser?.email === "janhavikolekar280@gmail.com");
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
        fetchData();
      }
      if (_event === 'PASSWORD_RECOVERY') {
        setShowPasswordChange(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Only run once on mount

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace("/", "") || "home";
      const routes = ["home", "biography", "FluteRoots", "organizersCorner", "contact", "admin", "login", "coursePlayer"];
      if (routes.includes(path)) {
        setRoute(path as AppRoute);
      }
    };
    
    // Auto-redirect if trying to access login while already logged in
    if (user && route === "login") {
      navigate("home");
    }

    window.addEventListener("popstate", handlePopState);
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []); // Static effect

  const pageIsDark = route === "home" || route === "biography" || route === "FluteRoots" || route === "organizersCorner" || route === "contact";
  const onAdminPage = route === "admin";

  return (
    <div className="app-container">
      {!onAdminPage && (
        <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
          <div className="nav-container">
            <div className="brand-logo" onClick={() => navigate("home")} style={{ cursor: 'pointer' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--bg-dark)' }}>
                <path d="M2 22C2 22 6.5 20.5 11 16C15.5 11.5 16.5 6.5 16.5 6.5C16.5 6.5 11.5 7.5 7 12C2.5 16.5 2 22 2 22Z" fill="currentColor" />
                <path d="M12 13C12 13 15 12.5 18 9.5C21 6.5 21.5 2.5 21.5 2.5C21.5 2.5 17.5 3 14.5 6C11.5 9 11 12 11 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M7 17C7 17 8.5 16.5 10 15C11.5 13.5 12 11.5 12 11.5C12 11.5 10 12 8.5 13.5C7 15 6.5 17 6.5 17Z" fill="currentColor" opacity="0.5" />
              </svg>
              <span className="logo-text" style={{ fontSize: '22px', transition: 'color 0.3s' }}>Flute Roots</span>
            </div>
            <nav className="site-nav">
              <a href="/" onClick={(e) => { e.preventDefault(); navigate("home"); }} className={`nav-link ${route === "home" ? "active" : ""}`}>HOME</a>
              <a href="/FluteRoots" onClick={(e) => { e.preventDefault(); navigate("FluteRoots"); }} className={`nav-link ${route === "FluteRoots" ? "active" : ""}`}>COURSES</a>
              <a href="/organizersCorner" onClick={(e) => { e.preventDefault(); navigate("organizersCorner"); }} className={`nav-link ${route === "organizersCorner" ? "active" : ""}`}>ORGANIZERS CORNER</a>
              <a href="/biography" onClick={(e) => { e.preventDefault(); navigate("biography"); }} className={`nav-link ${route === "biography" ? "active" : ""}`}>BIOGRAPHY</a>
              <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("contact"); }} className={`nav-link ${route === "contact" ? "active" : ""}`}>CONTACT</a>
            </nav>
            <div className="auth-nav">
              {isUserAdmin && <a href="/admin" onClick={(e) => { e.preventDefault(); navigate("admin"); }} className="dashboard-pill-btn">Dashboard</a>}
              {user ? (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '24px', transition: 'background 0.2s' }}
                    title="Profile Settings"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontWeight: 'bold', fontSize: '16px' }}>
                      {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  </button>
                  
                  {showUserMenu && (
                    <>
                      {/* Invisible backdrop to close the menu when clicking outside */}
                      <div 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                        onClick={() => setShowUserMenu(false)}
                      ></div>
                      
                      {/* Dropdown Menu */}
                      <div 
                        style={{ 
                          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                          background: 'white', borderRadius: '12px', 
                          boxShadow: '0 4px 24px rgba(0,0,0,0.15)', 
                          width: '280px', padding: '16px 0', 
                          zIndex: 100, display: 'flex', flexDirection: 'column',
                          border: '1px solid #f0f0f0'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 16px', borderBottom: '1px solid #f0f0f0', marginBottom: '8px' }}>
                          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '28px', fontWeight: 'bold', marginBottom: '12px' }}>
                            {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div style={{ fontWeight: '600', color: '#333', fontSize: '16px', textAlign: 'center' }}>
                            {user.user_metadata?.full_name || 'User'}
                          </div>
                          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                            {user.email}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 8px' }}>
                          <button 
                            onClick={() => { setShowPasswordChange(true); setShowUserMenu(false); }} 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', width: '100%', cursor: 'pointer', fontSize: '14px', color: '#333', borderRadius: '8px', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            Change Password
                          </button>
                          <button 
                            onClick={() => { supabase.auth.signOut(); setShowUserMenu(false); }} 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', width: '100%', cursor: 'pointer', fontSize: '14px', color: '#d32f2f', borderRadius: '8px', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#fff0f0'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <a href="/login" onClick={(e) => { e.preventDefault(); setReturnRoute(route); navigate("login"); }} className="nav-link login-btn">Login</a>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={!onAdminPage ? (route === "home" ? "has-header home-main" : "has-header") : ""}>
        {route === "home" && <HomePage navigate={navigate} galleryItems={galleryItems} heroImageUrl={heroImageUrl} setHeroImageUrl={setHeroImageUrl} heroAudioUrl={heroAudioUrl} introVideo={introVideo} calendarEvents={calendarEvents} loading={loading} />}
        {route === "biography" && <BiographyPage bioImageUrl={bioImageUrl} bioParagraphs={bioParagraphs} bioAwards={bioAwards} />}
        {route === "FluteRoots" && <CoursesPage navigate={navigate} courses={courses} user={user} enrollments={enrollments} calendarEvents={calendarEvents} announcements={announcements} onRefresh={fetchData} heroImageUrl={heroImageUrl} loading={loading} isUserAdmin={isUserAdmin} setActiveCourseId={setActiveCourseId} weeklySchedule={weeklySchedule} />}
        {route === "organizersCorner" && <OrganizersCornerPage images={galleryItems} calendarEvents={calendarEvents} navigate={navigate} stageSetupUrl={stageSetupUrl} weeklySchedule={weeklySchedule} />}
        {route === "contact" && <ContactPage />}
        {route === "coursePlayer" && activeCourseId && <CoursePlayerPage courseId={activeCourseId} courses={courses} user={user} navigate={navigate} announcements={announcements} />}
        {route === "admin" && (isUserAdmin ? (
          <AdminPage 
            navigate={navigate} 
            courses={courses} 
            galleryItems={galleryItems} 
            heroImageUrl={heroImageUrl} 
            setHeroImageUrl={setHeroImageUrl} 
            heroAudioUrl={heroAudioUrl}
            setHeroAudioUrl={setHeroAudioUrl}
            introVideo={introVideo}
            calendarEvents={calendarEvents}
            stageSetupUrl={stageSetupUrl}
            setStageSetupUrl={setStageSetupUrl}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            bioImageUrl={bioImageUrl}
            setBioImageUrl={setBioImageUrl}
            bioParagraphs={bioParagraphs}
            setBioParagraphs={setBioParagraphs}
            bioAwards={bioAwards}
            setBioAwards={setBioAwards}
            onRefresh={fetchData} 
            user={user}
            weeklySchedule={weeklySchedule}
            setWeeklySchedule={setWeeklySchedule}
          />
        ) : <LoginPage navigate={navigate} returnRoute={returnRoute} />)}
        {route === "login" && <LoginPage navigate={navigate} returnRoute={returnRoute} />}
      </main>
      {!onAdminPage && <Footer />}
      {showPasswordChange && <PasswordChangeModal onClose={() => setShowPasswordChange(false)} />}
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      {/* Golden wave top edge */}
      <div className="footer-wave-top">
        <svg viewBox="0 0 1200 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0,60 C150,20 350,70 500,40 C650,10 800,50 1000,30 C1100,20 1150,35 1200,25 L1200,80 L0,80 Z" fill="#233226" />
          <path d="M0,55 C200,30 400,65 600,35 C800,5 1000,45 1200,20" stroke="#eedcc6" strokeWidth="1.5" opacity="0.4" fill="none" />
          <path d="M0,65 C250,40 450,75 650,45 C850,15 1050,55 1200,30" stroke="#eedcc6" strokeWidth="1" opacity="0.25" fill="none" />
        </svg>
      </div>
      {/* Nature illustration background */}
      <div className="footer-nature-bg">
        <svg viewBox="0 0 1200 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMax meet">
          {/* Bamboo stalks - taller and more visible */}
          <line x1="1000" y1="300" x2="1000" y2="10" stroke="#3a5a3e" strokeWidth="4" opacity="0.35" />
          <line x1="1000" y1="80" x2="1000" y2="78" stroke="#3a5a3e" strokeWidth="8" opacity="0.2" />
          <line x1="1000" y1="160" x2="1000" y2="158" stroke="#3a5a3e" strokeWidth="8" opacity="0.2" />
          
          <line x1="1040" y1="300" x2="1040" y2="30" stroke="#3a5a3e" strokeWidth="3.5" opacity="0.3" />
          <line x1="1040" y1="100" x2="1040" y2="98" stroke="#3a5a3e" strokeWidth="7" opacity="0.18" />
          <line x1="1040" y1="200" x2="1040" y2="198" stroke="#3a5a3e" strokeWidth="7" opacity="0.18" />
          
          <line x1="1080" y1="300" x2="1080" y2="50" stroke="#3a5a3e" strokeWidth="3" opacity="0.25" />
          <line x1="1080" y1="120" x2="1080" y2="118" stroke="#3a5a3e" strokeWidth="6" opacity="0.15" />
          
          <line x1="1120" y1="300" x2="1120" y2="70" stroke="#3a5a3e" strokeWidth="2.5" opacity="0.2" />
          <line x1="1150" y1="300" x2="1150" y2="90" stroke="#3a5a3e" strokeWidth="2" opacity="0.15" />
          
          {/* Bamboo leaves - more prominent */}
          <path d="M1000,50 Q1025,25 1040,38 Q1020,48 1000,50Z" fill="#4a6a4e" opacity="0.2" />
          <path d="M1000,50 Q975,28 962,40 Q980,50 1000,50Z" fill="#4a6a4e" opacity="0.15" />
          <path d="M1040,70 Q1065,48 1078,60 Q1058,72 1040,70Z" fill="#4a6a4e" opacity="0.18" />
          <path d="M1040,70 Q1015,50 1005,62 Q1025,72 1040,70Z" fill="#4a6a4e" opacity="0.12" />
          <path d="M1000,130 Q1028,108 1042,120 Q1022,133 1000,130Z" fill="#4a6a4e" opacity="0.15" />
          <path d="M1080,90 Q1105,68 1118,80 Q1098,95 1080,90Z" fill="#4a6a4e" opacity="0.15" />
          <path d="M1080,90 Q1058,70 1048,82 Q1068,92 1080,90Z" fill="#4a6a4e" opacity="0.12" />
          
          {/* Rolling green hills at bottom */}
          <path d="M0,280 C200,240 400,260 600,245 C800,230 950,200 1200,215 L1200,300 L0,300 Z" fill="#2a4230" opacity="0.25" />
          <path d="M0,290 C300,260 500,275 700,260 C900,245 1100,220 1200,240 L1200,300 L0,300 Z" fill="#2a4230" opacity="0.15" />
        </svg>
      </div>
      <div className="footer-content">
        <h3 className="footer-brand">Flute Roots</h3>
        <p className="footer-tagline">Stay Connected</p>
        <div className="social-icons">
          <a href="https://whatsapp.com/channel/0029VbDPEv41SWsvjbY9f446" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="WhatsApp">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          </a>
          <a href="https://www.youtube.com/@digvijaysinhchauhan" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="YouTube">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
          </a>
          <a href="https://instagram.com/digvijay_flute" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
          </a>
          <a href="https://facebook.com/DigvijayFlute" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Facebook">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </a>
          <a href="https://open.spotify.com/artist/7z5GkC7y3gCigb7D72tS8U" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Spotify">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.438-5.305-1.764-8.785-.97-.337.078-.674-.137-.752-.475-.078-.337.137-.674.475-.752 3.81-.87 7.076-.496 9.712 1.12.293.18.385.563.207.87zM17.91 13.6c-.228.368-.712.49-1.08.262-2.69-1.654-6.79-2.13-9.97-1.165-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.637-1.103 8.142-.566 11.22 1.328.366.226.488.71.26 1.08zm.12-3.123c-3.228-1.917-8.564-2.093-11.674-1.15-.494.15-1.018-.128-1.168-.622-.15-.494.128-1.018.622-1.168 3.58-1.087 9.477-.887 13.184 1.313.444.263.59.837.327 1.28-.263.444-.837.59-1.28.327z"/></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

function HomePage({ navigate, galleryItems, heroImageUrl, setHeroImageUrl, heroAudioUrl, introVideo, calendarEvents, loading }: { 
  navigate: (to: AppRoute) => void,
  galleryItems: GalleryImage[], 
  heroImageUrl: string,
  setHeroImageUrl: (url: string) => void,
  heroAudioUrl?: string,
  introVideo: { url: string, title: string, description: string },
  calendarEvents: CalendarEvent[],
  loading?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !heroAudioUrl) return;

    audio.volume = 0.4;
    
    // Stop audio 10 seconds after it starts playing
    const handlePlay = () => {
      setTimeout(() => {
        if (audio) {
          audio.pause();
        }
      }, 10000);
    };
    audio.addEventListener('play', handlePlay, { once: true });

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Autoplay prevented by browser. Waiting for interaction...", error);
        
        const startAudio = () => {
          audio.play().catch(e => console.log("Audio play still prevented:", e));
          document.removeEventListener('click', startAudio);
          document.removeEventListener('touchstart', startAudio);
          document.removeEventListener('keydown', startAudio);
          document.removeEventListener('scroll', startAudio);
        };

        document.addEventListener('click', startAudio);
        document.addEventListener('touchstart', startAudio);
        document.addEventListener('keydown', startAudio);
        document.addEventListener('scroll', startAudio);
        
        return () => {
          document.removeEventListener('click', startAudio);
          document.removeEventListener('touchstart', startAudio);
          document.removeEventListener('keydown', startAudio);
          document.removeEventListener('scroll', startAudio);
        };
      });
    }
  }, [heroAudioUrl]);

  const { url, title, description } = introVideo;
  const videoId = getYouTubeId(url);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0` : url;
  
  return (
    <>
      <section className="hero">
        {/* Background Decorative elements */}
        <div className="hero-decorations">
          {/* Curved fine golden lines at bottom */}
          <div className="hero-wave">
            <svg viewBox="0 0 1200 220" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0,180 C200,100 400,200 600,140 C800,80 1000,160 1200,120" stroke="#eedcc6" strokeWidth="1.5" opacity="0.45" fill="none" />
              <path d="M0,200 C250,120 450,220 650,160 C850,100 1050,180 1200,140" stroke="#eedcc6" strokeWidth="1.5" opacity="0.3" fill="none" />
              <path d="M0,215 C300,140 500,240 700,180 C900,120 1100,200 1200,160" stroke="#eedcc6" strokeWidth="1" opacity="0.15" fill="none" />
            </svg>
          </div>
          
          {/* Bamboo stalks and leaves on the right edge */}
          <div className="hero-bamboo">
            <svg viewBox="0 0 200 700" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Main bamboo stalk 1 */}
              <line x1="120" y1="700" x2="120" y2="30" stroke="#384c3b" strokeWidth="4" opacity="0.18" />
              <line x1="120" y1="150" x2="120" y2="148" stroke="#384c3b" strokeWidth="8" opacity="0.12" />
              <line x1="120" y1="300" x2="120" y2="298" stroke="#384c3b" strokeWidth="8" opacity="0.12" />
              <line x1="120" y1="450" x2="120" y2="448" stroke="#384c3b" strokeWidth="8" opacity="0.12" />
              
              {/* Bamboo stalk 2 */}
              <line x1="150" y1="700" x2="150" y2="80" stroke="#384c3b" strokeWidth="3" opacity="0.14" />
              <line x1="150" y1="200" x2="150" y2="198" stroke="#384c3b" strokeWidth="6" opacity="0.10" />
              <line x1="150" y1="400" x2="150" y2="398" stroke="#384c3b" strokeWidth="6" opacity="0.10" />
              
              {/* Bamboo stalk 3 (thinner, further right) */}
              <line x1="175" y1="700" x2="175" y2="120" stroke="#384c3b" strokeWidth="2" opacity="0.10" />
              
              {/* Leaves on stalk 1 */}
              <path d="M120,100 C135,75 155,70 165,80" stroke="#384c3b" strokeWidth="1.5" opacity="0.15" fill="none" />
              <path d="M120,100 C105,78 85,75 78,85" stroke="#384c3b" strokeWidth="1.5" opacity="0.12" fill="none" />
              <path d="M120,250 C138,230 158,228 168,238" stroke="#384c3b" strokeWidth="1.5" opacity="0.12" fill="none" />
              <path d="M120,250 C102,232 82,230 75,240" stroke="#384c3b" strokeWidth="1.2" opacity="0.10" fill="none" />
              
              {/* Leaves on stalk 2 */}
              <path d="M150,160 C165,140 180,138 188,148" stroke="#384c3b" strokeWidth="1.2" opacity="0.12" fill="none" />
              <path d="M150,160 C135,142 118,140 112,150" stroke="#384c3b" strokeWidth="1.2" opacity="0.10" fill="none" />
              <path d="M150,350 C168,330 185,328 192,340" stroke="#384c3b" strokeWidth="1.2" opacity="0.10" fill="none" />
              
              {/* Broader leaf shapes (filled) */}
              <path d="M120,80 Q145,55 160,65 Q145,78 120,80Z" fill="#384c3b" opacity="0.08" />
              <path d="M150,130 Q175,108 188,118 Q172,132 150,130Z" fill="#384c3b" opacity="0.06" />
              <path d="M120,220 Q90,195 80,208 Q95,222 120,220Z" fill="#384c3b" opacity="0.06" />
              <path d="M150,300 Q178,278 190,290 Q175,305 150,300Z" fill="#384c3b" opacity="0.05" />
            </svg>
          </div>
          
          {/* Subtle floating leaves */}
          <div className="hero-leaf leaf-1">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 13.5 6 15 8C16.5 10 18.5 11 18.5 11C18.5 11 14.5 10.5 13 9C11.5 7.5 12 2 12 2Z" fill="#384c3b" opacity="0.12" />
            </svg>
          </div>
          <div className="hero-leaf leaf-2">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C12 22 10.5 18 9 16C7.5 14 5.5 13 5.5 13C5.5 13 9.5 13.5 11 15C12.5 16.5 12 22 12 22Z" fill="#384c3b" opacity="0.08" />
            </svg>
          </div>
          <div className="hero-leaf leaf-3">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 13.5 6 15 8C16.5 10 18.5 11 18.5 11C18.5 11 14.5 10.5 13 9C11.5 7.5 12 2 12 2Z" fill="#384c3b" opacity="0.07" />
            </svg>
          </div>
        </div>

        <div className="container" style={{ position: 'relative' }}>
          <div className="hero-container">
            <div className="hero-editorial">
              <span className="hero-eyebrow" style={{ color: '#a0a0a0', letterSpacing: '0.4em' }}>FLUTE ARTIST</span>
              <div className="hero-name-container">
                <span className="hero-name-serif" style={{ fontWeight: 300, fontSize: '5rem', lineHeight: 1.0 }}>Digvijaysinh</span>
                <span className="hero-name-cursive" style={{ fontStyle: 'italic', fontWeight: 400, fontSize: '5rem', lineHeight: 1.0, color: 'var(--text-dark)', transform: 'none', marginLeft: 0, marginTop: '10px', display: 'block' }}>Chauhan</span>
              </div>
              <div className="hero-divider-olive" style={{ backgroundColor: 'var(--gold)', width: '40px' }}></div>
              <p className="hero-desc" style={{ color: '#a0a0a0', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
                Rooted in tradition.<br />
                Inspired by pure expression.
              </p>
              <div className="hero-actions">
                {heroAudioUrl && <audio ref={audioRef} src={heroAudioUrl} loop autoPlay />}
                <button onClick={() => navigate("FluteRoots")} className="btn-pill btn-primary-green" style={{ backgroundColor: 'var(--bg-dark)', color: '#fff', border: 'none', padding: '14px 32px' }}>Explore Courses</button>
              </div>
            </div>
            <div className="hero-media">
              <div className="portrait-spotlight"></div>
              <div className="portrait-wrapper" style={{ position: 'relative' }}>
                {(heroImageUrl || !loading) && (
                  <img 
                    src={heroImageUrl || images.hero} 
                    alt={artistProfile.name} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = images.hero;
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="quote-section">
        <div className="quote-container">
          {/* Large decorative opening quote marks */}
          <div className="quote-mark-large">“</div>
          
          {/* Left side leaf decoration */}
          <div className="quote-leaf-left">
            <svg viewBox="0 0 120 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,12 C20,4 40,8 50,12 C60,16 80,12 90,12" stroke="#bda282" strokeWidth="1" opacity="0.5" fill="none" />
              <path d="M85,8 C90,4 98,6 100,12 C102,18 96,20 92,16 C88,12 90,6 95,8" fill="#bda282" opacity="0.4" />
              <path d="M95,8 C100,4 108,6 110,12 C112,18 106,20 102,16 C98,12 100,6 105,8" fill="#bda282" opacity="0.3" />
            </svg>
          </div>
          
          <p className="quote-text">
            Music is not just sound, it is the silence between the notes that speaks to the soul.
            The Bansuri is the breath of the divine, a bridge between the physical and the spiritual.
          </p>
          
          {/* Right side leaf decoration */}
          <div className="quote-leaf-right">
            <svg viewBox="0 0 120 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M120,12 C100,4 80,8 70,12 C60,16 40,12 30,12" stroke="#bda282" strokeWidth="1" opacity="0.5" fill="none" />
              <path d="M35,8 C30,4 22,6 20,12 C18,18 24,20 28,16 C32,12 30,6 25,8" fill="#bda282" opacity="0.4" />
              <path d="M25,8 C20,4 12,6 10,12 C8,18 14,20 18,16 C22,12 20,6 15,8" fill="#bda282" opacity="0.3" />
            </svg>
          </div>
          
          <p className="quote-author">Classical Music Review, India</p>
        </div>
      </section>

      <section className="split-section">
        <div className="split-image">
          <img src={images.bio} alt="Performance" />
          {/* Floating quote overlay on the image */}
          <div className="split-image-quote">
            <span className="split-image-quote-mark">“</span>
            <p className="split-image-quote-text">Every breath<br/>becomes<br/>a note.</p>
          </div>
        </div>
        <div className="split-content">
          <span className="eyebrow" style={{ color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '13px', fontWeight: 700 }}>Biography</span>
          <h2 className="split-title">Supreme Interpreter of the Classical Flute</h2>
          {/* Leaf divider under title */}
          <div className="leaf-divider-container" style={{ margin: '20px 0 28px 0', maxWidth: '120px', justifyContent: 'flex-start' }}>
            <svg className="leaf-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 13.5 6 15 8C16.5 10 18.5 11 18.5 11C18.5 11 14.5 10.5 13 9C11.5 7.5 12 2 12 2Z" fill="currentColor" />
              <path d="M12 22C12 22 10.5 18 9 16C7.5 14 5.5 13 5.5 13C5.5 13 9.5 13.5 11 15C12.5 16.5 12 22 12 22Z" fill="currentColor" />
            </svg>
          </div>
          <p className="split-text">
            Trained in the traditional Guru–Shishya Parampara, Digvijaysinh Chauhan brings a rare depth of emotion and technical mastery to the bansuri. His performances are a journey through the meditative landscapes of Indian Ragas.
          </p>
          <button onClick={() => navigate("biography")} className="split-cta-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
              <path d="M12 2C12 2 13.5 6 15 8C16.5 10 18.5 11 18.5 11C18.5 11 14.5 10.5 13 9C11.5 7.5 12 2 12 2Z" fill="currentColor" />
              <path d="M12 22C12 22 10.5 18 9 16C7.5 14 5.5 13 5.5 13C5.5 13 9.5 13.5 11 15C12.5 16.5 12 22 12 22Z" fill="currentColor" />
            </svg>
            Read more about the artist
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '12px' }}>
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </section>

      {/* Video Introduction Section */}
      <section className="intro-section" style={{ padding: '48px 0', backgroundColor: 'var(--bg-light)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
          <div className="intro-content">
            <span className="eyebrow" style={{ color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '16px' }}>Introductory Video</span>
            <h2 className="split-title" style={{ marginBottom: '16px' }}>Introductory Video</h2>
            <div className="hero-divider-olive" style={{ marginBottom: '24px' }}></div>
            <p style={{ color: 'var(--text-body)', lineHeight: '1.8', fontSize: '16px', marginBottom: '36px' }}>Welcome to the world of Bansuri. Here we explore the deep meditative qualities of the Indian flute.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-pill btn-secondary-outline" style={{ gap: '10px', width: 'fit-content' }}>
              Watch on
              <svg width="20" height="14" viewBox="0 0 24 17" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '6px', marginRight: '4px' }}>
                <rect width="24" height="17" rx="4" fill="#FF0000"/>
                <path d="M10 4.5V12.5L16 8.5L10 4.5Z" fill="white"/>
              </svg>
              YouTube
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
          </div>
          <div className="intro-video" style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', aspectRatio: '16/9', background: '#000' }}>
            {videoId ? (
              <iframe 
                src={embedUrl}
                title={title}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            ) : (
              <video 
                src={url} 
                controls 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function BiographyPage({ 
  bioImageUrl, 
  bioParagraphs, 
  bioAwards 
}: { 
  bioImageUrl?: string, 
  bioParagraphs?: string[], 
  bioAwards?: string[] 
}) {
  const currentBioImage = bioImageUrl || images.bio;
  const defaultParagraphs = [
    "Digvijaysinh Chauhan is a renowned Indian classical flautist and a dedicated disciple of Padma Vibhushan Pandit Hariprasad Chaurasia ji. His musical journey is rooted in the authentic Guru-Shishya Parampara system at Vrindaban Gurukul, Bhubaneswar.",
    "A PhD scholar in Electronics Engineering, Digvijay represents a rare blend of scientific precision and artistic depth. His style of playing reflects the pure tone, clear raga presentation, and deeply expressive approach of the Maihar tradition.",
    "Through his brand 'Flute Roots | Nothing But Music', he is committed to preserving and promoting the traditional art of bansuri while exploring contemporary collaborations that resonate with global audiences."
  ];
  const currentParagraphs = bioParagraphs && bioParagraphs.length > 0 ? bioParagraphs : defaultParagraphs;
  const defaultAwards = [
    "Sanskar Vibhushan Samman",
    "CCRT Scholarship",
    "OMC Foundation Award",
    "NALCO Cultural Honor"
  ];
  const currentAwards = bioAwards && bioAwards.length > 0 ? bioAwards : defaultAwards;

  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Biography</h1>
      </section>

      <section className="bio-section">
        <div className="bio-grid">
          <div className="bio-image-wrapper">
            <img src={currentBioImage} alt={artistProfile.name} className="bio-image" />
          </div>
          <div className="bio-content">
            <h3>{artistProfile.name}</h3>
            <div className="bio-text">
              {currentParagraphs.map((para, index) => (
                <p key={index}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="recognition">
        <p className="eyebrow">Awards & Recognition</p>
        <div className="logo-grid">
          {currentAwards.map((award, index) => (
            <span key={index} className="text-serif">{award}</span>
          ))}
        </div>
      </section>
    </>
  );
}



function CoursesPage({ navigate, courses, user, enrollments, calendarEvents, announcements, onRefresh, heroImageUrl, loading, isUserAdmin, setActiveCourseId, weeklySchedule }: { 
  navigate: (to: AppRoute) => void, 
  courses: Course[], 
  user: any, 
  enrollments: string[], 
  calendarEvents: CalendarEvent[],
  announcements: {title: string, text: string}[],
  onRefresh: () => void,
  heroImageUrl: string,
  loading: boolean,
  isUserAdmin: boolean,
  setActiveCourseId: (id: string) => void,
  weeklySchedule: Record<string, Record<string, string>>
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);

  // Fetch signed URLs for enrolled courses
  useEffect(() => {
    const fetchLinks = async () => {
      const links: Record<string, string> = {};
      for (const id of enrollments) {
        const course = courses.find(c => c.id === id);
        if (course && course.video_url && course.video_url.includes('supabase.co')) {
          // Extract filename from public URL or just use the URL if it's already a path
          const path = course.video_url.split('/').pop() || "";
          const { data, error } = await supabase.storage.from('images').createSignedUrl(path, 7200); // 2 hours
          if (data) links[id] = data.signedUrl;
        }
      }
      setSignedUrls(links);
    };
    if (enrollments.length > 0) fetchLinks();
  }, [enrollments, courses]);

  const handleEnroll = async (course: Course) => {
    if (!user) {
      navigate("login");
      return;
    }

    // Admin Bypass: If admin, enroll instantly without payment
    if (isUserAdmin) {
      try {
        const { error } = await supabase.from('enrollments').insert([{ user_id: user.id, course_id: course.id }]);
        if (error) throw error;
        alert("Admin Access: You have been enrolled instantly (No payment required).");
        onRefresh();
        setTimeout(() => {
          document.getElementById(`course-card-${course.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
      } catch (err: any) {
        if (err.message?.includes('unique_enrollment')) {
           alert("You are already enrolled in this course.");
        } else {
           alert("Admin enrollment failed: " + err.message);
        }
      }
      return;
    }

    const priceValue = course.price ? parseInt(course.price.replace(/[^0-9]/g, "")) : 0;
    
    // Handle Free Courses
    if (priceValue === 0) {
      try {
        const { error } = await supabase.from('enrollments').insert([{ user_id: user.id, course_id: course.id }]);
        if (error) throw error;
        alert("Success! You are now enrolled in this free course.");
        onRefresh();
        setTimeout(() => {
          document.getElementById(`course-card-${course.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
      } catch (err) {
        alert("Enrollment failed. Please try again.");
      }
      return;
    }

    setCheckoutCourse(course);
  };

  const startRazorpayPayment = async (course: Course) => {
    setCheckoutCourse(null);
    setPayingFor(course.id);
    
    const priceValue = course.price ? parseInt(course.price.replace(/[^0-9]/g, "")) : 0;
    
    try {
      // 1. Ask backend to securely create a Razorpay Order ID
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: priceValue * 100, 
          currency: "INR",
          notes: {
            user_id: user.id,
            course_id: course.id
          }
        })
      });
      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.id) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // 2. Open Razorpay Checkout with the secure Order ID
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder", 
        amount: orderData.amount, // from backend
        currency: orderData.currency, // from backend
        order_id: orderData.id, // THE SECURE ORDER ID
        name: "Flute Roots",
        description: `Enrollment: ${course.title}`,
        image: heroImageUrl || "/vite.svg",
        handler: async function (response: any) {
          try {
            // Payment success - the Webhook will handle the database insert!
            // We just show a success message on the frontend.
            alert("Payment successful! Your enrollment is being processed securely.");
            
            // Wait a few seconds for the webhook to finish, then refresh
            setTimeout(() => {
              onRefresh();
              document.getElementById(`course-card-${course.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 3000);
          } catch (err) {
            console.error(err);
          } finally {
            setPayingFor(null);
          }
        },
        prefill: {
          email: user.email,
          contact: "" 
        },
        notes: {
          user_id: user.id, // Send user info securely through Razorpay notes to the Webhook
          course_id: course.id,
          owner_email: "digvijayflute@gmail.com" 
        },
        theme: {
          color: "#c7a17a",
        },
        modal: {
          ondismiss: function() { 
            setPayingFor(null); 
          }
        }
      };

      if ((window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert("Payment Failed: " + response.error.description);
          setPayingFor(null);
        });
        rzp.open();
        
        // Safety timeout
        setTimeout(() => setPayingFor(prev => prev === course.id ? null : prev), 10000);
      } else {
        throw new Error("Razorpay SDK not loaded");
      }
    } catch (err) {
      console.error("Razorpay Error:", err);
      alert("Could not start payment system. Please try again.");
      setPayingFor(null);
    }
  };

  const displayCourses = courses.length > 0 ? courses : [];

  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Courses</h1>
        <p className="page-hero-subtitle">Learn the art of Bansuri from the tradition of Guru-Shishya Parampara</p>
      </section>

      {/* Rotating Notification Stripe - Flush against top */}
      <div className="notification-stripe" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: '#0a0a0a' }}>
        <div className="stripe-wrapper">
          <div className="stripe-container">
            {/* Repeated content for seamless loop */}
            {[1, 2, 3].map((set) => (
              <div key={set} style={{ display: 'contents' }}>
                {/* Live Classes in Stripe */}
                {calendarEvents
                  .filter(e => e.type === 'class' && new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
                  .map(ev => (
                    <div key={`live-${set}-${ev.id}`} className="stripe-item">
                      <span className="stripe-badge">LIVE SESSION</span>
                      <span>{ev.title} — {new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))
                }
                {/* Dynamic Announcements in Stripe */}
                {announcements.map((ann, idx) => (
                  <div key={`ann-${set}-${idx}`} className="stripe-item">
                    <span className="stripe-badge" style={{ background: idx % 2 === 0 ? 'var(--gold)' : '#4CAF50' }}>ANNOUNCEMENT</span>
                    <span><strong>{ann.title}:</strong> {ann.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="courses-section">
        {isUserAdmin && (
          <div style={{ 
            background: 'rgba(212, 175, 55, 0.1)', 
            border: '1px dashed var(--gold)', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: '500' }}>
              🛠️ <strong>Admin Preview Mode:</strong> You can enroll in any course instantly without payment.
            </span>
            <button 
              onClick={() => navigate("admin")} 
              style={{ background: 'var(--gold)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              RETURN TO DASHBOARD
            </button>
          </div>
        )}
        <div className="courses-header">
          <h2 className="courses-heading">Master the Classical Flute</h2>
          <p className="courses-desc">
            Whether you are a complete beginner or an advanced player, these carefully designed courses will guide you through the authentic tradition of Hindustani classical flute.
          </p>
        </div>

        {displayCourses.length === 0 ? (
          <div className="admin-empty" style={{ margin: '40px auto' }}>
            <p>No courses available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="courses-grid">
            {displayCourses.map((course) => {
              const isEnrolled = enrollments.includes(course.id);
              const videoSrc = isEnrolled ? (signedUrls[course.id] || course.video_url) : null;
              const ytId = getYouTubeId(course.video_url);
              const displayThumb = course.thumbnail_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

              return (
                <div 
                  key={course.id} 
                  id={`course-card-${course.id}`} 
                  className="course-card"
                  onClick={() => {
                    if (isEnrolled) {
                      setActiveCourseId(course.id);
                      navigate("coursePlayer");
                    } else if (payingFor !== course.id) {
                      handleEnroll(course);
                    }
                  }}
                >
                  <div className="course-thumbnail">
                    {isEnrolled ? (
                      <div 
                        className="course-thumbnail-overlay-clickable" 
                        onClick={() => {
                          setActiveCourseId(course.id);
                          navigate("coursePlayer");
                        }}
                      >
                        {displayThumb ? (
                          <img src={displayThumb} alt={course.title} className="course-thumbnail-img" />
                        ) : (
                          <div className="course-no-thumb">
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className="course-play-overlay">
                          <div className="play-button-circle">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                          </div>
                          <span>Continue Learning</span>
                        </div>
                      </div>
                    ) : (
                      <div className="course-locked-overlay">
                        {displayThumb ? (
                          <img src={displayThumb} alt={course.title} className="course-thumbnail-img" />
                        ) : (
                          <div className="course-no-thumb">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                    {course.level && <div className="course-level-badge">{course.level}</div>}
                  </div>
                  <div className="course-body">
                    <h3 className="course-title">{course.title}</h3>
                    <p className="course-meta">by {artistProfile.name}</p>
                    {course.description && (
                      <p className="course-description-preview">
                        {course.description}
                      </p>
                    )}
                    
                    <div style={{ marginTop: 'auto' }}>
                      {isEnrolled ? null : (
                        <>
                          <div className="course-price-label">
                            {course.price ? (course.price.startsWith('₹') ? course.price : `₹${course.price}`) : 'Free'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
      </section>

      {/* Udemy-style Checkout Modal */}
      {checkoutCourse && (
        <div className="checkout-modal-overlay">
          <div className="checkout-modal">
            <button className="close-checkout" onClick={() => setCheckoutCourse(null)}>&times;</button>
            <div className="checkout-content">
              <div className="checkout-header">
                <h2>Checkout</h2>
                <p>Complete your enrollment for this course</p>
              </div>
              
              <div className="checkout-item">
                <div className="checkout-item-thumb">
                  {checkoutCourse.thumbnail_url ? (
                    <img src={checkoutCourse.thumbnail_url} alt={checkoutCourse.title} />
                  ) : (
                    <div className="checkout-item-no-thumb">🎶</div>
                  )}
                </div>
                <div className="checkout-item-info">
                  <h3>{checkoutCourse.title}</h3>
                  <p>{checkoutCourse.level} • {checkoutCourse.duration}</p>
                </div>
                <div className="checkout-item-price">
                  {checkoutCourse.price ? (checkoutCourse.price.startsWith('₹') ? checkoutCourse.price : `₹${checkoutCourse.price}`) : 'Free'}
                </div>
              </div>
              
              <div className="checkout-summary">
                <div className="summary-row">
                  <span>Course Price</span>
                  <span>{checkoutCourse.price ? (checkoutCourse.price.startsWith('₹') ? checkoutCourse.price : `₹${checkoutCourse.price}`) : 'Free'}</span>
                </div>
                <div className="summary-row total">
                  <span>Total</span>
                  <span>{checkoutCourse.price ? (checkoutCourse.price.startsWith('₹') ? checkoutCourse.price : `₹${checkoutCourse.price}`) : 'Free'}</span>
                </div>
              </div>
              
              
              <button 
                className="complete-payment-btn"
                onClick={() => startRazorpayPayment(checkoutCourse)}
                disabled={payingFor === checkoutCourse.id}
              >
                {payingFor === checkoutCourse.id ? "Processing..." : "Complete Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CoursePlayerPage({ courseId, courses, user, navigate, announcements }: { courseId: string, courses: Course[], user: any, navigate: (to: AppRoute) => void, announcements: {title: string, text: string}[] }) {
  const course = courses.find(c => c.id === courseId);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!course) return;
      setLoading(true);
      try {
        if (!course.video_url) {
          setVideoUrl(null);
        } else if (course.video_url.includes('supabase.co')) {
          const path = course.video_url.split('/').pop() || "";
          const { data, error } = await supabase.storage.from('images').createSignedUrl(path, 7200);
          if (error) {
            console.error("Error creating signed URL:", error);
            setVideoUrl(course.video_url); // fallback
          } else if (data) {
            setVideoUrl(data.signedUrl);
          } else {
            setVideoUrl(course.video_url);
          }
        } else {
          setVideoUrl(course.video_url);
        }
      } catch (err) {
        console.error("Error in fetchSignedUrl:", err);
        setVideoUrl(course.video_url || null);
      } finally {
        setLoading(false);
      }
    };
    fetchSignedUrl();
  }, [course]);

  if (!course) return <div className="admin-empty">Course not found</div>;

  return (
    <div className="course-player-page">
      <header className="player-header">
        <div className="player-header-left">
          <button className="back-to-courses" onClick={() => navigate("FluteRoots")} style={{ border: 'none', background: 'transparent' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
          <h2 className="player-course-title">{course.title}</h2>
        </div>
        <div className="player-header-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize: '14px' }}>Your progress</span>
          </div>
          <button className="resource-btn" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
            Share <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
        </div>
      </header>

      <div className="player-layout">
        <div className="player-main">
          <div className="player-video-section">
            <div 
              className="player-video-container"
              onContextMenu={(e) => e.preventDefault()}
            >
              {loading ? (
                <div className="player-loader" style={{ color: '#fff' }}>Loading Video...</div>
              ) : videoUrl ? (
                (() => {
                  const ytId = getYouTubeId(videoUrl);
                  const isYt = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
                  const isBunny = videoUrl.includes("mediadelivery.net");
                  if (ytId || isYt || isBunny) {
                    const embedSrc = ytId 
                      ? `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&controls=1&disablekb=1&origin=${encodeURIComponent(window.location.origin)}`
                      : videoUrl;
                    return (
                      <>
                        <iframe
                          src={embedSrc}
                          className="player-video-element"
                          style={{ border: 'none' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                        {/* Top click-blocking overlay (Covers YouTube title, share, info) */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '52px',
                          background: 'transparent',
                          zIndex: 10,
                          cursor: 'default'
                        }} />
                        
                        {/* Bottom-right click-blocking overlay (Covers YouTube logo watermark, above the player control bar) */}
                        <div style={{
                          position: 'absolute',
                          bottom: '48px',
                          right: '12px',
                          width: '90px',
                          height: '40px',
                          background: 'transparent',
                          zIndex: 10,
                          cursor: 'default'
                        }} />
                      </>
                    );
                  }
                  return (
                    <video 
                      src={videoUrl} 
                      className="player-video-element" 
                      controls 
                      controlsList="nodownload"
                      onTimeUpdate={(e: any) => {
                        localStorage.setItem(`progress_${course.id}_${user?.id || 'anon'}`, e.target.currentTime);
                      }}
                      onLoadedMetadata={(e: any) => {
                        const savedTime = localStorage.getItem(`progress_${course.id}_${user?.id || 'anon'}`);
                        if (savedTime) e.target.currentTime = parseFloat(savedTime);
                      }}
                    />
                  );
                })()
              ) : (
                <div className="player-error">Video not available</div>
              )}
            </div>
          </div>
          
          <div className="player-content-area">
            <div className="player-tabs-container">
              <div className="player-tabs">
                {["Overview", "Notes", "Announcements"].map(tab => (
                  <button 
                    key={tab}
                    className={`player-tab ${activeTab === tab.toLowerCase() ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="player-tab-content">
              {activeTab === "overview" && (
                <div className="overview-content">
                  <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', fontFamily: 'Inter, sans-serif' }}>About this course</h1>
                  <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#1c1d1f', fontFamily: 'Inter, sans-serif' }}>{course.description}</p>
                </div>
              )}
              {activeTab === "notes" && (
                <div className="notes-content">
                  <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Course Resources</h3>
                  <p>Downloadable materials for this lecture:</p>
                  {course.notes_url ? (
                    <a href={course.notes_url} target="_blank" rel="noopener noreferrer" className="resource-btn" style={{ padding: '12px 24px', fontSize: '14px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Download PDF Notes
                    </a>
                  ) : (
                    <p style={{ color: '#6a6f73' }}>No resources available for this course.</p>
                  )}
                </div>
              )}
              {activeTab === "announcements" && (
                <div className="announcements-content">
                  <h3 style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Course Updates</h3>
                  {course.announcement ? (
                    <div style={{ padding: '20px', background: '#f7f9fa', borderRadius: '8px', borderLeft: '4px solid #5624d0', marginTop: '16px' }}>
                      <p style={{ margin: 0, fontSize: '15px', color: '#1c1d1f', fontFamily: 'Inter, sans-serif' }}>{course.announcement}</p>
                    </div>
                  ) : (
                    <p style={{ color: '#6a6f73', marginTop: '16px' }}>No announcements for this course yet.</p>
                  )}
                  
                  <div style={{ marginTop: '40px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1c1d1f', marginBottom: '16px' }}>Site-wide News</h4>
                    {announcements.map((ann: {title: string, text: string}, idx: number) => (
                      <div key={idx} style={{ marginBottom: '15px', padding: '15px', borderBottom: '1px solid #eee' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{ann.title}</div>
                        <div style={{ fontSize: '13px', color: '#6a6f73' }}>{ann.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="player-sidebar">
          <div className="sidebar-header">
            <h3>Course content</h3>
            <button style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="sidebar-content">
            <div className="curriculum-section">
              <div className="curriculum-section-header">
                <h4>Section 1: Introduction</h4>
                <div className="curriculum-section-meta">1 / 1 | {course.duration}min</div>
              </div>
              <div className="curriculum-item active">
                <div className="item-check done">✓</div>
                <div className="item-info">
                  <div className="item-title">1. Full Course Video</div>
                  <div className="item-meta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span>{course.duration}min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


function WeeklyScheduleTable({ schedule }: { schedule: Record<string, Record<string, string>> }) {
  const timeSlots = [
    "5-6 AM", "6-7 AM", "7-8 AM", "8-9 AM", "2-3 PM", "5-6 PM", "6-7 PM", "7-8 PM", "8-9 PM"
  ];
  
  return (
    <div className="weekly-schedule-container">
      <table className="weekly-schedule-table">
        <thead>
          <tr>
            <th>TIMING</th>
            <th>MON</th>
            <th>TUE</th>
            <th>WED</th>
            <th>THU</th>
            <th>FRI</th>
            <th>SAT</th>
            <th>SUN</th>
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot => {
            const row = schedule[slot] || {};
            return (
              <tr key={slot}>
                <td className="timing-col">{slot}</td>
                <td>{row.MON || ""}</td>
                <td>{row.TUE || ""}</td>
                <td>{row.WED || ""}</td>
                <td>{row.THU || ""}</td>
                <td>{row.FRI || ""}</td>
                <td>{row.SAT || ""}</td>
                <td>{row.SUN || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrganizersCornerPage({ images: dbImages, calendarEvents, navigate, stageSetupUrl, weeklySchedule }: { images: GalleryImage[], calendarEvents: CalendarEvent[], navigate: (to: AppRoute) => void, stageSetupUrl: string, weeklySchedule: Record<string, Record<string, string>> }) {
  const displayImages = dbImages.length > 0 ? dbImages.map(img => img.image_url) : images.gallery;
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showSlots, setShowSlots] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeImageIndex === null) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveImageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setActiveImageIndex((prev) => (prev !== null ? (prev - 1 + displayImages.length) % displayImages.length : null));
      } else if (e.key === 'ArrowRight') {
        setActiveImageIndex((prev) => (prev !== null ? (prev + 1) % displayImages.length : null));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [activeImageIndex, displayImages.length]);
  
  const selectedDayEvents = calendarEvents.filter(e => e.date === selectedDate);
  const bookedEvents = selectedDayEvents.filter(e => e.type === 'performance' || e.type === 'blocked');
  const availableSlots = selectedDayEvents.filter(e => e.type === 'available' || e.type === 'class');
  const isBlocked = bookedEvents.length > 0;

  const handleDownload = async () => {
    if (!stageSetupUrl) return;
    try {
      const response = await fetch(stageSetupUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Stage_Setup.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed, opening in new tab instead", error);
      window.open(stageSetupUrl, '_blank');
    }
  };

  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Organizers Corner</h1>
        <p className="page-hero-subtitle">Check availability and upcoming performances</p>
      </section>

      <section style={{ padding: '16px 0', background: '#fcfaf7' }}>
        <div className="container">
          <h2 className="standard-title text-center" style={{ marginBottom: '16px', fontSize: '36px' }}>Moments from Performances</h2>
          <div className="masonry-gallery">
            {displayImages.map((src, i) => (
              <div 
                key={i} 
                className="masonry-item" 
                onClick={() => setActiveImageIndex(i)}
              >
                <img src={src} alt={`Gallery image ${i + 1}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="quote-section" style={{ background: '#1c1d1f' }}>
        <p className="quote-text text-serif text-italic" style={{ color: '#fdfaf6' }}>
          "The bansuri is an extension of the breath, and through it, one breathes life into the silence."
        </p>
      </section>

      {/* Stage Setup Section */}
      <section style={{ padding: '32px 0', background: '#fff' }}>
        <div className="container">
          <h2 className="standard-title text-center" style={{ marginBottom: '24px', fontSize: '36px' }}>Stage Setup</h2>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {stageSetupUrl ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.05)', 
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img src={stageSetupUrl} alt="Stage Setup" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '12px' }} />
                </div>
                <button 
                  onClick={handleDownload}
                  className="admin-btn admin-btn-primary" 
                  style={{ display: 'inline-block', padding: '12px 40px', cursor: 'pointer', border: 'none' }}
                >
                  Download Stage Setup
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px', background: '#fcfaf7', borderRadius: '12px', border: '1px dashed #ddd' }}>
                <p style={{ color: '#999', fontStyle: 'italic', fontSize: '18px' }}>Stage setup diagram will be available here soon.</p>
                <p style={{ color: '#bbb', fontSize: '14px', marginTop: '8px' }}>Organizers can download this for concert planning.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Weekly Schedule Section */}
      <section style={{ padding: '32px 0', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <div className="container">
          <h2 className="standard-title text-center" style={{ marginBottom: '20px', fontSize: '36px' }}>Weekly Availability Routine</h2>
          <WeeklyScheduleTable schedule={weeklySchedule} />
        </div>
      </section>

      {/* Lightbox Modal */}
      {activeImageIndex !== null && (
        <div 
          className="lightbox-overlay"
          onClick={() => setActiveImageIndex(null)}
        >
          <button 
            className="lightbox-close" 
            onClick={(e) => { e.stopPropagation(); setActiveImageIndex(null); }}
            aria-label="Close lightbox"
          >
            &times;
          </button>
          
          <button 
            className="lightbox-nav lightbox-prev" 
            onClick={(e) => { 
              e.stopPropagation(); 
              setActiveImageIndex((prev) => (prev !== null ? (prev - 1 + displayImages.length) % displayImages.length : null)); 
            }}
            aria-label="Previous image"
          >
            &#10216;
          </button>

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={displayImages[activeImageIndex]} alt={`Enlarged moment ${activeImageIndex + 1}`} />
          </div>

          <button 
            className="lightbox-nav lightbox-next" 
            onClick={(e) => { 
              e.stopPropagation(); 
              setActiveImageIndex((prev) => (prev !== null ? (prev + 1) % displayImages.length : null)); 
            }}
            aria-label="Next image"
          >
            &#10217;
          </button>
        </div>
      )}

    </>
  );
}

function ContactPage() {
  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Contact</h1>
      </section>

      <div className="contact-container">
        <div className="contact-info">
          <h3>Get In Touch</h3>
          <p className="hero-text">Available for solo recitals, fusion collaborations, and lecture-demonstrations across India and internationally.</p>

          <div className="contact-details">
            <div className="detail-item">
              <span className="detail-icon">📍</span>
              <p>Vrindaban Gurukul, K-8 Kalinga Nagar, Bhubaneswar, Odisha 751029</p>
            </div>
            <div className="detail-item">
              <span className="detail-icon">📞</span>
              <p>{artistProfile.phone}</p>
            </div>
            <div className="detail-item">
              <span className="detail-icon">✉️</span>
              <p>{artistProfile.email}</p>
            </div>
          </div>


        </div>

        <form className="contact-form">
          <h3 style={{ marginBottom: '16px' }}>Send A Message</h3>
          <div className="form-group">
            <label>Name *</label>
            <input type="text" placeholder="Your name" required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" placeholder="Your email" required />
          </div>
          <div className="form-group">
            <label>Message *</label>
            <textarea rows={3} placeholder="How can I help you?" required></textarea>
          </div>
          <button type="submit" className="submit-btn">Submit</button>
        </form>
      </div>

    </>
  );
}

function AdminPage({ 
  navigate, 
  courses, 
  galleryItems, 
  heroImageUrl, 
  setHeroImageUrl, 
  heroAudioUrl,
  setHeroAudioUrl,
  introVideo, 
  calendarEvents, 
  stageSetupUrl,
  setStageSetupUrl,
  announcements,
  setAnnouncements,
  bioImageUrl,
  setBioImageUrl,
  bioParagraphs,
  setBioParagraphs,
  bioAwards,
  setBioAwards,
  onRefresh, 
  user,
  weeklySchedule,
  setWeeklySchedule
}: { 
  navigate: (to: AppRoute) => void,
  courses: Course[], 
  galleryItems: GalleryImage[], 
  heroImageUrl: string, 
  setHeroImageUrl: (url: string) => void,
  heroAudioUrl?: string,
  setHeroAudioUrl?: (url: string) => void,
  introVideo: { url: string, title: string, description: string },
  calendarEvents: CalendarEvent[],
  stageSetupUrl: string,
  setStageSetupUrl: (url: string) => void,
  announcements: {title: string, text: string}[],
  setAnnouncements: (anns: {title: string, text: string}[]) => void,
  bioImageUrl: string,
  setBioImageUrl: (url: string) => void,
  bioParagraphs: string[],
  setBioParagraphs: (paras: string[]) => void,
  bioAwards: string[],
  setBioAwards: (awards: string[]) => void,
  onRefresh: () => void,
  user: any,
  weeklySchedule: Record<string, Record<string, string>>,
  setWeeklySchedule: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", level: "Beginner", duration: "", lessons: 0, price: "", video_url: "", thumbnail_url: "", notes_url: "", announcement: "" });
  const [videoSource, setVideoSource] = useState<'youtube' | 'mp4'>('youtube');
  const [editedSchedule, setEditedSchedule] = useState<Record<string, Record<string, string>>>(weeklySchedule);
  
  useEffect(() => {
    setEditedSchedule(weeklySchedule);
  }, [weeklySchedule]);
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [bgProcessStep, setBgProcessStep] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [introForm, setIntroForm] = useState(introVideo);
  const [announcementForm, setAnnouncementForm] = useState(announcements);
  const [videoFiles, setVideoFiles] = useState<{name: string, url: string}[]>([]);

  const [activeTab, setActiveTab] = useState<'homepage' | 'biography' | 'courses' | 'calendar' | 'organizers'>('homepage');
  const [bioFormImageUrl, setBioFormImageUrl] = useState<string>(bioImageUrl);
  const [bioFormParagraphs, setBioFormParagraphs] = useState<string[]>(bioParagraphs);
  const [bioFormAwards, setBioFormAwards] = useState<string[]>(bioAwards);

  useEffect(() => { setBioFormImageUrl(bioImageUrl); }, [bioImageUrl]);
  useEffect(() => { setBioFormParagraphs(bioParagraphs); }, [bioParagraphs]);
  useEffect(() => { setBioFormAwards(bioAwards); }, [bioAwards]);

  // Fetch videos from storage bucket
  const fetchVideos = useCallback(async () => {
    const { data } = await supabase.storage.from('images').list('', { limit: 100 });
    if (data) {
      const videos = data
        .filter(f => f.name.match(/\.(mp4|webm|mov|avi|mkv)$/i))
        .map(f => ({
          name: f.name,
          url: supabase.storage.from('images').getPublicUrl(f.name).data.publicUrl
        }));
      setVideoFiles(videos);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // Paste handler for stage setup
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste if we're not currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            handleStageSetupUpload({ target: { files: [file] } } as any);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const resetForm = () => {
    setForm({ title: "", description: "", level: "Beginner", duration: "", lessons: 0, price: "", video_url: "", thumbnail_url: "", notes_url: "", announcement: "" });
    setEditingId(null);
    setVideoSource('youtube');
  };

  const handleBunnyVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('bunny-video');
    setUploadProgress('Initializing Bunny.net upload...');

    try {
      const libraryId = import.meta.env.VITE_BUNNY_STREAM_LIBRARY_ID;
      const apiKey = import.meta.env.VITE_BUNNY_STREAM_API_KEY;

      if (!libraryId || !apiKey) {
        throw new Error("Bunny Stream API keys are missing in .env");
      }

      setUploadProgress('Creating video entry in Bunny.net...');
      const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'POST',
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({ title: file.name })
      });

      if (!createRes.ok) throw new Error("Failed to create video on Bunny.net");
      const createData = await createRes.json();
      const videoId = createData.guid;

      setUploadProgress('Uploading video data (this might take a while)...');
      const uploadRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
        method: 'PUT',
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/octet-stream',
          'accept': 'application/json'
        },
        body: file
      });

      if (!uploadRes.ok) throw new Error("Failed to upload video data");

      const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
      setForm(prev => ({ ...prev, video_url: embedUrl }));
      showToast("Bunny.net video uploaded successfully!");

    } catch (err: any) {
      alert("UPLOAD ERROR: " + err.message);
    } finally {
      setUploading(null);
      setUploadProgress('');
      if (e.target) e.target.value = "";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, uploadType: 'video' | 'gallery') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(uploadType);
    
    try {
      if (!user) {
        alert("UPLOAD ERROR: Not logged in. Please login to upload files.");
        setUploading(null);
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Processing ${i + 1}/${files.length}...`);

        // 1. Pre-check: File Size
        if (file.size > 50 * 1024 * 1024) {
          const proceed = confirm(`WARNING: File "${file.name}" is ${Math.round(file.size / (1024 * 1024))}MB. Supabase free tier often blocks uploads larger than 50MB.\n\nTry anyway?`);
          if (!proceed) continue;
        }

        // 2. Sanitize Filename
        const fileExt = file.name.split('.').pop();
        const cleanBaseName = file.name.split('.').slice(0, -1).join('_').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${Date.now()}_${cleanBaseName}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || undefined
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);

        if (uploadType === 'video') {
          setForm(prev => ({ ...prev, video_url: publicUrl }));
          fetchVideos();
          showToast("Video uploaded successfully!");
        } else {
          const { error: dbError } = await supabase
            .from('gallery')
            .insert([{ image_url: publicUrl, display_order: galleryItems.length + i }]);
          if (dbError) throw dbError;
        }
      }

      if (uploadType === 'gallery') {
        onRefresh();
        showToast(`${files.length} images added to gallery!`);
      }
    } catch (err: any) {
      console.error("Bulk Upload Error:", err);
      alert("Error during upload: " + err.message);
    } finally {
      setUploading(null);
      setUploadProgress("");
      if (e.target) e.target.value = "";
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('course-thumb');
    try {
      if (file.size > 5 * 1024 * 1024) {
        alert("Thumbnail is too large (>5MB). Please use a smaller image.");
        setUploading(null);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_thumb.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      setForm({ ...form, thumbnail_url: publicUrl });
      showToast("Thumbnail uploaded!");
    } catch (err: any) {
      console.error(err);
      alert("Error uploading thumbnail: " + err.message);
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const handleNotesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('course-notes');
    try {
      if (file.size > 20 * 1024 * 1024) {
        alert("PDF is too large (>20MB). Please optimize the file.");
        setUploading(null);
        return;
      }

      const fileExt = file.name.split('.').pop();
      if (fileExt?.toLowerCase() !== 'pdf') {
        alert("Only PDF files are allowed for notes.");
        setUploading(null);
        return;
      }

      const fileName = `${Date.now()}_notes.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      setForm({ ...form, notes_url: publicUrl });
      showToast("PDF Notes uploaded!");
    } catch (err: any) {
      console.error(err);
      alert("Error uploading PDF: " + err.message);
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  // Multi-file gallery upload
  const handleMultipleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading('gallery');
    let successCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      // Image size check (10MB)
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`Skipping ${file.name}: Too large (${Math.round(file.size/1024/1024)}MB)`);
        continue;
      }

      setUploadProgress(`Uploading ${i + 1} of ${totalFiles}...`);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, file, { upsert: true });

        if (!uploadError) successCount++;
        else console.error(uploadError);
      } catch (err) { console.error(err); }
    }

    setUploading(null);
    setUploadProgress("");
    onRefresh();
    showToast(`${successCount} of ${totalFiles} photos uploaded!`);
    if (successCount < totalFiles) {
      alert(`Notice: ${totalFiles - successCount} files failed to upload. Check console for details (likely size limits or network).`);
    }
    e.target.value = "";
  };

  const handleMultipleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading('video-gallery');
    let successCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      if (file.size > 50 * 1024 * 1024) {
        console.warn(`Skipping ${file.name}: Too large for free tier (${Math.round(file.size/1024/1024)}MB)`);
        continue;
      }

      setUploadProgress(`Uploading video ${i + 1} of ${totalFiles}...`);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, file, { upsert: true });

        if (!uploadError) successCount++;
        else console.error(uploadError);
      } catch (err) { console.error(err); }
    }

    setUploading(null);
    setUploadProgress("");
    fetchVideos();
    showToast(`${successCount} of ${totalFiles} videos uploaded!`);
    if (successCount < totalFiles) {
      alert(`Notice: ${totalFiles - successCount} videos failed to upload. Check console for details (likely size limits or network).`);
    }
    e.target.value = "";
  };

  const handleDeleteVideo = async (name: string) => {
    if (!confirm("Delete this video?")) return;
    try {
      const { error } = await supabase.storage.from('images').remove([name]);
      if (error) alert("Server Error: " + error.message);
      else { fetchVideos(); showToast("Video deleted."); }
    } catch (err: any) {
      alert("Network Error: " + err.message + "\n\n(Your browser is blocking the deletion request. Try using an Incognito window!)");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      alert("Please fill in the Course Title and Description first.");
      return;
    }

    const courseData: any = {
      title: form.title,
      description: form.description,
      level: form.level,
      duration: form.duration,
      lessons: Number(form.lessons),
      price: form.price,
      video_url: form.video_url,
      thumbnail_url: form.thumbnail_url,
      notes_url: form.notes_url,
    };

    setUploading('course-save');
    try {
      if (editingId) {
        const { error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', editingId);
        if (error) throw error;
        showToast("Course updated!");
      } else {
        const { error } = await supabase
          .from('courses')
          .insert([courseData]);
        if (error) throw error;
        showToast("Course added!");
      }
      resetForm();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Save error:", err);
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        const existing = JSON.parse(localStorage.getItem('local_courses') || '[]');
        if (editingId) {
          const updated = existing.map((c: any) => c.id === editingId ? { ...c, ...courseData } : c);
          localStorage.setItem('local_courses', JSON.stringify(updated));
        } else {
          const newCourse = { ...courseData, id: 'local_' + Date.now() };
          localStorage.setItem('local_courses', JSON.stringify([...existing, newCourse]));
        }
        showToast("Saved locally (Offline)");
        resetForm();
        if (onRefresh) onRefresh();
      } else {
        alert("Database Error: " + err.message);
      }
    } finally {
      setUploading(null);
    }
  };


  const handleEdit = (course: Course) => {
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description,
      level: course.level || "Beginner",
      duration: course.duration || "",
      lessons: course.lessons || 0,
      price: course.price,
      video_url: course.video_url,
      thumbnail_url: course.thumbnail_url || "",
      notes_url: course.notes_url || "",
      announcement: course.announcement || ""
    });
    const isYt = course.video_url && (course.video_url.includes("youtube.com") || course.video_url.includes("youtu.be"));
    setVideoSource(isYt ? 'youtube' : 'mp4');
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteCourse = async (id: string | number) => {
    if (!confirm("Delete this course?")) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      showToast("Course deleted.");
      onRefresh();
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.message.includes('fetch')) {
        const existing = JSON.parse(localStorage.getItem('local_courses') || '[]');
        localStorage.setItem('local_courses', JSON.stringify(existing.filter((c: any) => c.id !== id)));
        showToast("Course deleted locally.");
        onRefresh();
      } else {
        alert(err.message);
      }
    }
  };

  const handleDeleteGallery = async (id: string) => {
    if (!confirm("Remove this image?")) return;
    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) alert(error.message);
    else {
      showToast("Image removed.");
      onRefresh();
    }
  };

  const handleHeroAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('hero_audio');
    try {
      if (file.size > 20 * 1024 * 1024) {
        alert("Audio file is too large (>20MB). Please use a smaller file.");
        setUploading(null);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `hero_audio_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('settings')
        .upsert({ key: 'hero_audio_url', value: publicUrl }, { onConflict: 'key' });

      if (dbError) {
        alert("Database error saving audio URL, but file was uploaded.");
      } else {
        if (setHeroAudioUrl) setHeroAudioUrl(publicUrl);
        showToast("Hero audio updated successfully!");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('hero');
    setIsProcessingBg(true);
    setBgProcessStep("Detecting background...");
    
    let uploadBlob: Blob = file;
    try {
      if (file.size > 10 * 1024 * 1024) {
        alert("Hero image is too large (>10MB). Please use a compressed image.");
        setUploading(null);
        setIsProcessingBg(false);
        return;
      }

      try {
        console.log("Starting background removal...");
        uploadBlob = await removeBackground(file, {
          progress: (key: string, current: number, total: number) => {
            if (key === 'compute:inference') {
              setBgProcessStep(`Removing BG... ${Math.round((current/total)*100)}%`);
            } else if (key.startsWith('fetch:')) {
              setBgProcessStep(`Loading AI model... ${Math.round((current/total)*100)}%`);
            }
          }
        });
        setBgProcessStep("Uploading to cloud...");
      } catch (bgError) {
        console.error("Background removal failed, uploading original:", bgError);
        setBgProcessStep("BG removal failed. Uploading original...");
      }

      console.log("Starting hero upload...");
      const fileExt = "png"; // ML background removal outputs PNG
      const fileName = `hero_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, uploadBlob, { upsert: true, contentType: "image/png" });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      console.log("File uploaded, public URL:", publicUrl);

      // Update or Insert in settings table
      const { error: dbError } = await supabase
        .from('settings')
        .upsert({ key: 'hero_image_url', value: publicUrl }, { onConflict: 'key' });

      if (dbError) {
        console.warn("Database update failed, but file was uploaded. Saving to local storage fallback.", dbError);
        localStorage.setItem('local_hero_image', publicUrl);
        setHeroImageUrl(publicUrl);
        showToast("Hero image updated (Local Fallback)!");
        if (dbError.code === '42P01') {
          alert("Database Error: The 'settings' table does not exist. For now, the image is saved locally in your browser.");
        }
      } else {
        setHeroImageUrl(publicUrl);
        showToast("Hero image updated and background removed!");
        navigate("home");
      }
    } catch (err: any) {
      console.error("Hero upload catch block:", err);
      if (err.message === 'Failed to fetch' || !err.message || err.name === 'TypeError') {
        alert("UPLOAD ERROR: Connection blocked.\n\nPossible reasons:\n1. Adblocker blocking Supabase storage.\n2. CORS settings on Supabase dashboard.\n3. File size exceeds limits.\n\nTry Incognito mode or a smaller file.");
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      setUploading(null);
      setIsProcessingBg(false);
      setBgProcessStep("");
      if (e.target) e.target.value = "";
    }
  };

  const handleStageSetupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(`stage-setup`);
    try {
      if (file.size > 10 * 1024 * 1024) {
        alert("Image is too large (>10MB).");
        setUploading(null);
        return;
      }

      const fileExt = file.name ? file.name.split('.').pop() : 'png';
      const fileName = `stage_setup_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('settings')
        .upsert({ key: 'stage_setup_url_1', value: publicUrl }, { onConflict: 'key' });

      if (dbError) {
        console.warn("DB Save failed, updating state only", dbError);
      }

      setStageSetupUrl(publicUrl);
      showToast(`Stage Setup updated!`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(null);
      if (e.target && e.target.value) e.target.value = "";
    }
  };

  const handleUpdateIntro = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading('intro');
    try {
      const updates = [
        { key: 'intro_video_url', value: introForm.url },
        { key: 'intro_video_title', value: introForm.title },
        { key: 'intro_video_description', value: introForm.description }
      ];

      for (const item of updates) {
        const { error } = await supabase.from('settings').upsert(item, { onConflict: 'key' });
        if (error) throw error;
      }

      showToast("Intro section updated successfully!");
      onRefresh();
    } catch (err: any) {
      console.warn("Database failed, using local storage:", err.message);
      // Fallback to local storage
      localStorage.setItem('local_intro_video_url', introForm.url);
      localStorage.setItem('local_intro_video_title', introForm.title);
      localStorage.setItem('local_intro_video_description', introForm.description);
      showToast("Intro updated locally (Database failed)");
      onRefresh();
    } finally {
      setUploading(null);
    }
  };

  const handleUpdateAnnouncements = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading('announcements');
    try {
      const { error } = await supabase.from('settings').upsert({ 
        key: 'course_announcements_json', 
        value: JSON.stringify(announcementForm) 
      }, { onConflict: 'key' });
      
      if (error) throw error;

      showToast("Announcements updated successfully!");
      onRefresh();
    } catch (err: any) {
      console.error("Announcement Save Error:", err);
      showToast("Error updating announcements");
    } finally {
      setUploading(null);
    }
  };

  const handleSaveWeeklySchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading('weekly-schedule-save');
    try {
      const jsonStr = JSON.stringify(editedSchedule);
      
      const { error } = await supabase.from('settings').upsert({ 
        key: 'weekly_schedule_json', 
        value: jsonStr 
      }, { onConflict: 'key' });
      
      if (error) throw error;
      
      localStorage.setItem('local_weekly_schedule', jsonStr);
      setWeeklySchedule(editedSchedule);
      showToast("Weekly schedule updated successfully!");
      onRefresh();
    } catch (err: any) {
      console.error("Weekly Schedule Save Error:", err);
      // Fallback
      localStorage.setItem('local_weekly_schedule', JSON.stringify(editedSchedule));
      setWeeklySchedule(editedSchedule);
      showToast("Saved locally (offline/sync error)");
      onRefresh();
    } finally {
      setUploading(null);
    }
  };

  const handleBioPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('bio-pic');
    try {
      if (file.size > 10 * 1024 * 1024) {
        alert("Image is too large (>10MB).");
        setUploading(null);
        return;
      }

      const fileExt = file.name ? file.name.split('.').pop() : 'png';
      const fileName = `bio_profile_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      setBioFormImageUrl(publicUrl);
      showToast("Biography photo uploaded! Click save to persist.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleSaveBiography = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading('biography-save');
    try {
      const updates = [
        { key: 'bio_image_url', value: bioFormImageUrl },
        { key: 'bio_paragraphs_json', value: JSON.stringify(bioFormParagraphs) },
        { key: 'bio_awards_json', value: JSON.stringify(bioFormAwards) }
      ];

      for (const item of updates) {
        const { error } = await supabase.from('settings').upsert(item, { onConflict: 'key' });
        if (error) throw error;
      }

      setBioImageUrl(bioFormImageUrl);
      setBioParagraphs(bioFormParagraphs);
      setBioAwards(bioFormAwards);
      showToast("Biography updated successfully!");
      onRefresh();
    } catch (err: any) {
      console.warn("Database save failed, using local storage:", err.message);
      localStorage.setItem('local_bio_image', bioFormImageUrl);
      localStorage.setItem('local_bio_paragraphs', JSON.stringify(bioFormParagraphs));
      localStorage.setItem('local_bio_awards', JSON.stringify(bioFormAwards));
      
      setBioImageUrl(bioFormImageUrl);
      setBioParagraphs(bioFormParagraphs);
      setBioAwards(bioFormAwards);
      showToast("Biography updated locally (Database failed)!");
      onRefresh();
    } finally {
      setUploading(null);
    }
  };

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'homepage':
        return {
          title: "Homepage Settings",
          subtitle: "Manage your hero banner and introductory features"
        };
      case 'biography':
        return {
          title: "Biography & Recognition",
          subtitle: "Update your personal profile, biography text paragraphs, and achievements"
        };
      case 'courses':
        return {
          title: editingId ? "Edit Course" : "Courses & LMS Settings",
          subtitle: editingId ? "Modify course content and publish changes" : "Create courses, upload PDFs, and post rotating announcements"
        };
      case 'calendar':
        return {
          title: "Calendar & Slots Availability",
          subtitle: "Manage your weekly availability, upcoming performances, and student slots"
        };
      case 'organizers':
        return {
          title: "Organizers Corner",
          subtitle: "Update your stage diagram setup and performance photography gallery"
        };
      default:
        return {
          title: "Admin Panel",
          subtitle: "Manage your platform settings"
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <div className="admin-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          <button 
            onClick={() => setActiveTab('homepage')} 
            className={`admin-nav-item ${activeTab === 'homepage' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            Homepage Edit
          </button>
          <button 
            onClick={() => setActiveTab('biography')} 
            className={`admin-nav-item ${activeTab === 'biography' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            Biography Edit
          </button>
          <button 
            onClick={() => setActiveTab('courses')} 
            className={`admin-nav-item ${activeTab === 'courses' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            Courses & LMS
          </button>
          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`admin-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            Calendar & Slots
          </button>
          <button 
            onClick={() => setActiveTab('organizers')} 
            className={`admin-nav-item ${activeTab === 'organizers' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            Organizers Corner
          </button>

          <div style={{ margin: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />

          <button 
            onClick={() => navigate("FluteRoots")} 
            className="admin-nav-item" 
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--gold)', fontWeight: '600' }}
          >
            👁️ Preview Student View
          </button>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("home"); }} className="admin-nav-item" style={{ display: 'block', textDecoration: 'none' }}>Back to Home</a>
        </nav>
        <div className="admin-stats">
          <div className="admin-stat"><span className="admin-stat-num">{courses.length}</span><span className="admin-stat-label">Courses</span></div>
          <div className="admin-stat"><span className="admin-stat-num">{calendarEvents.length}</span><span className="admin-stat-label">Calendar Events</span></div>
        </div>
      </div>

      <div className="admin-main">
        {toast && <div className="admin-toast">{toast}</div>}

        <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{headerInfo.title}</h1>
            <p className="admin-subtitle">{headerInfo.subtitle}</p>
          </div>
        </div>

        {/* ==================== HOMEPAGE TAB ==================== */}
        {activeTab === 'homepage' && (
          <>
            {/* Hero Content Management */}
            <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Hero Content Management</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <div className="hero-preview" style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#e9ecef', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', border: '1px solid #eee' }}>
                    <img src={heroImageUrl} alt="Current Hero" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isProcessingBg ? 0.3 : 1, transition: 'opacity 0.3s' }} />
                    {isProcessingBg && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245, 240, 232, 0.7)' }}>
                        <span style={{ color: 'var(--text-dark)', fontWeight: 'bold', fontSize: '1rem', textAlign: 'center', padding: '0 10px' }}>{bgProcessStep}</span>
                      </div>
                    )}
                  </div>
                  <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                    {uploading === 'hero' ? 'Processing...' : 'Upload & Remove BG'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleHeroUpload} disabled={uploading === 'hero'} />
                  </label>
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  <p style={{ marginBottom: '12px' }}><strong>Current Hero Image:</strong> This image appears on the top of your homepage.</p>
                  <ul style={{ paddingLeft: '20px' }}>
                    <li style={{ marginBottom: '8px' }}>Recommended size: 1920x1080px or larger.</li>
                    <li style={{ marginBottom: '8px' }}>The image will be centered and will cover the entire hero area.</li>
                    <li style={{ marginBottom: '8px' }}>Try to use an image with dark tones as it works best with the white typography.</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #eee', paddingTop: '24px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', alignItems: 'center' }}>
                <div>
                  {heroAudioUrl ? (
                    <audio src={heroAudioUrl} controls style={{ width: '100%', marginBottom: '16px' }} />
                  ) : (
                    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', marginBottom: '16px', color: '#666' }}>No audio set</div>
                  )}
                  <label className="admin-btn admin-btn-secondary" style={{ cursor: 'pointer', width: '100%', textAlign: 'center', display: 'block', backgroundColor: '#eef2ef', color: '#3d5a4a', padding: '12px', borderRadius: '4px', fontWeight: 600 }}>
                    {uploading === 'hero_audio' ? 'Uploading Audio...' : 'Upload MP3 (Listen Now)'}
                    <input type="file" accept="audio/mpeg,audio/mp3,audio/wav" style={{ display: 'none' }} onChange={handleHeroAudioUpload} disabled={uploading === 'hero_audio'} />
                  </label>
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  <p style={{ marginBottom: '12px' }}><strong>Hero Audio (Listen Now):</strong> If set, the "Listen Now" button will play this track instead of redirecting to Courses.</p>
                  <ul style={{ paddingLeft: '20px' }}>
                    <li style={{ marginBottom: '8px' }}>Format: MP3 or WAV</li>
                    <li style={{ marginBottom: '8px' }}>Max size: 20MB</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Introductory Video Management */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>Introductory Video Management</h3>
              </div>
              <form className="admin-form" onSubmit={handleUpdateIntro} style={{ padding: '20px' }}>
                <div className="admin-field">
                  <label>YouTube Video URL (Embed link or Watch link)</label>
                  <input 
                    type="text" 
                    value={introForm.url} 
                    onChange={e => setIntroForm({...introForm, url: e.target.value})}
                    placeholder="https://www.youtube.com/embed/..."
                  />
                </div>
                <div className="admin-field">
                  <label>Introduction Title</label>
                  <input 
                    type="text" 
                    value={introForm.title} 
                    onChange={e => setIntroForm({...introForm, title: e.target.value})}
                    placeholder="Enter title"
                  />
                </div>
                <div className="admin-field">
                  <label>Introduction Description</label>
                  <textarea 
                    rows={4} 
                    value={introForm.description} 
                    onChange={e => setIntroForm({...introForm, description: e.target.value})}
                    placeholder="Enter description text"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontFamily: 'inherit' }}
                  />
                </div>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={uploading === 'intro'}>
                  {uploading === 'intro' ? "SAVING..." : "UPDATE INTRO SECTION"}
                </button>
              </form>
            </div>
          </>
        )}

        {/* ==================== BIOGRAPHY TAB ==================== */}
        {activeTab === 'biography' && (
          <form onSubmit={handleSaveBiography}>
            {/* Biography Profile Photo Card */}
            <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Biography Profile Photo</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', alignItems: 'center' }}>
                <div>
                  <div className="bio-preview" style={{ width: '150px', height: '150px', background: '#000', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', border: '2px solid var(--gold)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <img src={bioFormImageUrl} alt="Bio Profile Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                    {uploading === 'bio-pic' ? 'Uploading...' : 'Change Profile Photo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBioPhotoUpload} disabled={uploading === 'bio-pic'} />
                  </label>
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  <p style={{ marginBottom: '12px' }}><strong>Profile Image:</strong> This photo represents you on your biography page.</p>
                  <ul style={{ paddingLeft: '20px' }}>
                    <li style={{ marginBottom: '8px' }}>Recommended: Square portrait aspect ratio.</li>
                    <li style={{ marginBottom: '8px' }}>Will be automatically cropped into a high-quality circle display.</li>
                    <li style={{ marginBottom: '8px' }}>Choose a crisp, well-lit performance or casual photo.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Biography Text Paragraphs */}
            <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Biography Paragraphs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {bioFormParagraphs.map((para, idx) => (
                  <div key={idx} style={{ position: 'relative', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <textarea
                      rows={3}
                      value={para}
                      onChange={e => {
                        const updated = [...bioFormParagraphs];
                        updated[idx] = e.target.value;
                        setBioFormParagraphs(updated);
                      }}
                      style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.6' }}
                      placeholder={`Paragraph ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => setBioFormParagraphs(bioFormParagraphs.filter((_, i) => i !== idx))}
                      className="admin-btn-icon admin-btn-danger"
                      style={{ marginTop: '10px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setBioFormParagraphs([...bioFormParagraphs, ""])}
                  className="admin-btn"
                  style={{ background: '#f0f0f0', color: '#444', width: '200px' }}
                >
                  + Add Paragraph
                </button>
              </div>
            </div>

            {/* Awards and Recognitions */}
            <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Awards & Recognitions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {bioFormAwards.map((award, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={award}
                      onChange={e => {
                        const updated = [...bioFormAwards];
                        updated[idx] = e.target.value;
                        setBioFormAwards(updated);
                      }}
                      style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                      placeholder={`Award Title ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => setBioFormAwards(bioFormAwards.filter((_, i) => i !== idx))}
                      className="admin-btn-icon admin-btn-danger"
                      style={{ padding: '8px 12px' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setBioFormAwards([...bioFormAwards, ""])}
                  className="admin-btn"
                  style={{ background: '#f0f0f0', color: '#444', width: '200px' }}
                >
                  + Add Award
                </button>
              </div>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '24px' }}>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={uploading === 'biography-save'}>
                {uploading === 'biography-save' ? "Saving Biography..." : "Save Biography Settings"}
              </button>
            </div>
          </form>
        )}

        {/* ==================== COURSES & LMS TAB ==================== */}
        {activeTab === 'courses' && (
          <>
            {/* Course Announcements Management */}
            <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Rotating Course Announcements</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {announcementForm.map((ann, idx) => (
                  <div key={idx} style={{ padding: '20px', background: '#fcfaf7', borderRadius: '8px', border: '1px solid #eee', position: 'relative' }}>
                    <button 
                      type="button"
                      onClick={() => setAnnouncementForm(announcementForm.filter((_, i) => i !== idx))}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '18px' }}
                    >
                      &times;
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                      <div className="admin-field" style={{ marginBottom: 0 }}>
                        <label>Badge Title</label>
                        <input 
                          type="text" 
                          value={ann.title} 
                          onChange={e => {
                            const newAnns = [...announcementForm];
                            newAnns[idx].title = e.target.value;
                            setAnnouncementForm(newAnns);
                          }} 
                          placeholder="e.g. NEW COURSE" 
                        />
                      </div>
                      <div className="admin-field" style={{ marginBottom: 0 }}>
                        <label>Announcement Message</label>
                        <textarea 
                          rows={2} 
                          value={ann.text} 
                          onChange={e => {
                            const newAnns = [...announcementForm];
                            newAnns[idx].text = e.target.value;
                            setAnnouncementForm(newAnns);
                          }} 
                          placeholder="e.g. Enrollments starting next Monday..." 
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  type="button"
                  onClick={() => setAnnouncementForm([...announcementForm, { title: "", text: "" }])}
                  className="admin-btn" 
                  style={{ background: '#f0f0f0', color: '#444', width: '200px' }}
                >
                  + ADD ANNOUNCEMENT
                </button>

                <div style={{ marginTop: '24px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '24px' }}>
                  <button 
                    type="button"
                    onClick={handleUpdateAnnouncements} 
                    className="admin-btn admin-btn-primary" 
                    disabled={uploading === 'announcements'}
                  >
                    {uploading === 'announcements' ? "UPDATING..." : "SAVE & PUSH TO STRIPE"}
                  </button>
                </div>
              </div>
              <p style={{ marginTop: '16px', color: '#888', fontSize: '13px' }}>
                These announcements will rotate in a continuous stripe on the Courses page.
              </p>
            </div>

            <form className="admin-form" onSubmit={handleSave}>
              <div className="admin-form-grid">
                <div className="admin-form-left">
                  <div className="admin-field">
                    <label>Title *</label>
                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                  </div>
                  <div className="admin-field">
                    <label>Description *</label>
                    <textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Level</label>
                      <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
                        <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>All Levels</option>
                      </select>
                    </div>
                    <div className="admin-field">
                      <label>Duration</label>
                      <input type="text" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 8 Weeks" />
                    </div>
                    <div className="admin-field">
                      <label>Lessons</label>
                      <input type="number" value={form.lessons || ""} onChange={e => setForm({ ...form, lessons: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Price</label>
                    <input type="text" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. ₹2,999" />
                  </div>
                </div>

                <div className="admin-form-right">
                  <div className="admin-field">
                    <label>Course Thumbnail (Image)</label>
                    <label className="admin-btn admin-btn-ghost" style={{ margin: 0, cursor: 'pointer', display: 'inline-block' }}>
                      {uploading === 'course-thumb' ? 'Processing...' : '🖼️ Choose Image File'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleThumbnailUpload(e)} />
                    </label>
                    {form.thumbnail_url && (
                      <div style={{ marginTop: '10px' }}>
                        <img src={form.thumbnail_url} alt="Thumbnail preview" style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                        <p style={{ fontSize: '12px', color: '#4CAF50' }}>✓ Thumbnail ready</p>
                      </div>
                    )}
                  </div>

                  <div className="admin-field" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Course Video Source</label>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSource('youtube');
                          if (form.video_url && !form.video_url.includes('youtube.com') && !form.video_url.includes('youtu.be') && !form.video_url.includes('mediadelivery.net')) {
                            setForm(prev => ({ ...prev, video_url: "" }));
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '6px',
                          border: videoSource === 'youtube' ? '2px solid var(--gold)' : '1px solid #ccc',
                          background: videoSource === 'youtube' ? '#fcfaf7' : 'white',
                          color: videoSource === 'youtube' ? 'var(--gold)' : '#333',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        🎥 YouTube / Embed URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSource('mp4');
                          if (form.video_url && (form.video_url.includes('youtube.com') || form.video_url.includes('youtu.be') || form.video_url.includes('mediadelivery.net'))) {
                            setForm(prev => ({ ...prev, video_url: "" }));
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '6px',
                          border: videoSource === 'mp4' ? '2px solid var(--gold)' : '1px solid #ccc',
                          background: videoSource === 'mp4' ? '#fcfaf7' : 'white',
                          color: videoSource === 'mp4' ? 'var(--gold)' : '#333',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        📁 MP4 Upload / Select
                      </button>
                    </div>

                    {videoSource === 'youtube' ? (
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>YouTube / Bunny Stream Embed URL</label>
                        <input 
                          type="text" 
                          placeholder="Paste YouTube or Embed URL here..." 
                          value={form.video_url} 
                          onChange={e => setForm({...form, video_url: e.target.value})}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        />
                        {form.video_url && !form.video_url.includes('http') && (
                          <p style={{ marginTop: '8px', fontSize: '13px', color: 'orange' }}>
                            Please enter a valid URL starting with http:// or https://
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Upload Video File Directly to Bunny.net</label>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <label className="admin-btn admin-btn-ghost" style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                              {uploading === 'bunny-video' ? '⏳ Uploading Video...' : '📁 Upload MP4 File'}
                              <input 
                                type="file" 
                                accept="video/mp4,video/webm,video/quicktime" 
                                style={{ display: 'none' }} 
                                onChange={handleBunnyVideoUpload} 
                                disabled={uploading === 'bunny-video'}
                              />
                            </label>
                            {uploading === 'bunny-video' && (
                              <span style={{ fontSize: '13px', color: 'var(--gold)' }}>
                                {uploadProgress || 'Uploading file... Please wait.'}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Video will securely upload to Bunny.net bypassing Supabase limits.</p>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Or Select from Uploaded Videos</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <select
                              value={form.video_url}
                              onChange={e => setForm({ ...form, video_url: e.target.value })}
                              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc', background: 'white' }}
                            >
                              <option value="">-- Choose an uploaded video --</option>
                              {videoFiles.map(vf => (
                                <option key={vf.name} value={vf.url}>
                                  {vf.name}
                                </option>
                              ))}
                            </select>
                            {form.video_url && videoFiles.some(vf => vf.url === form.video_url) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const fileObj = videoFiles.find(vf => vf.url === form.video_url);
                                  if (fileObj) {
                                    await handleDeleteVideo(fileObj.name);
                                    setForm(prev => ({ ...prev, video_url: "" }));
                                  }
                                }}
                                style={{
                                  padding: '10px 15px',
                                  background: '#ff4d4d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                Delete File
                              </button>
                            )}
                          </div>
                        </div>

                        {form.video_url && (
                          <div style={{ wordBreak: 'break-all', fontSize: '12px', color: '#666', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                            <strong>Selected URL:</strong> {form.video_url}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>Course Announcement (Optional)</label>
                    <textarea 
                      value={form.announcement || ""} 
                      onChange={(e) => setForm({ ...form, announcement: e.target.value })}
                      placeholder="e.g. Welcome to the course! Check out the new PDF notes added today."
                      style={{ minHeight: '80px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                    />
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>This will appear in the 'Announcements' tab of the course player.</p>
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>Course Notes (PDF)</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <label className="admin-btn admin-btn-ghost" style={{ margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {uploading === 'course-notes' ? 'Uploading...' : '📄 Upload PDF Notes'}
                        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleNotesUpload(e)} />
                      </label>
                      <input 
                        type="text" 
                        placeholder="Or paste PDF link here..." 
                        value={form.notes_url || ""} 
                        onChange={e => setForm({...form, notes_url: e.target.value})}
                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                      />
                    </div>
                    {form.notes_url && <p style={{ marginTop: '8px', fontSize: '13px', color: '#4CAF50' }}>✓ PDF Notes attached: {form.notes_url.split('/').pop()?.split('_').pop()}</p>}
                  </div>

                  <div className="admin-preview">
                    {form.video_url ? (
                      (() => {
                        const ytId = getYouTubeId(form.video_url);
                        const isYt = form.video_url.includes("youtube.com") || form.video_url.includes("youtu.be");
                        const isBunny = form.video_url.includes("mediadelivery.net");
                        if (ytId || isYt || isBunny) {
                          const embedSrc = ytId 
                            ? `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&controls=1`
                            : form.video_url;
                          return (
                            <iframe
                              src={embedSrc}
                              className="admin-preview-video"
                              style={{ border: 'none', aspectRatio: '16/9', width: '100%' }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          );
                        }
                        return <video src={form.video_url} className="admin-preview-video" controls />;
                      })()
                    ) : (
                      <div className="admin-preview-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        <p>{uploading === 'images' ? 'Processing...' : 'Video Preview'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-form-actions">
                {editingId && <button type="button" className="admin-btn admin-btn-ghost" onClick={resetForm}>Cancel</button>}
                <button type="submit" className="admin-btn admin-btn-primary" disabled={uploading === 'course-save'}>
                  {uploading === 'course-save' ? "Saving..." : (editingId ? "Update Course" : "Add Course")}
                </button>
              </div>
            </form>

            <div className="admin-list-header" style={{ marginTop: '40px' }}>
              <h2>All Courses ({courses.length})</h2>
            </div>

            <div className="admin-course-list">
              {courses.map(course => (
                <div key={course.id} className="admin-course-row">
                  <div className="admin-course-info">
                    <h4>{course.title}</h4>
                    <div className="admin-course-tags">
                      <span className="admin-tag">{course.level}</span>
                      <span className="admin-tag">{course.price}</span>
                    </div>
                  </div>
                  <div className="admin-course-actions">
                    <button className="admin-btn-icon" onClick={() => handleEdit(course)}>Edit</button>
                    <button className="admin-btn-icon admin-btn-danger" onClick={() => handleDeleteCourse(course.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ==================== CALENDAR TAB ==================== */}
        {activeTab === 'calendar' && (
          <div id="calendar-management-card" className="admin-card" style={{ background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #eee' }}>
            <h3 style={{ marginBottom: '8px', fontFamily: 'var(--font-serif)' }}>Interactive Weekly Timetable Grid</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
              Edit cells inline like a spreadsheet to configure your regular weekly availability. Once done, click the <strong>Save Weekly Schedule</strong> button below.
            </p>
            
            <form onSubmit={handleSaveWeeklySchedule} style={{ marginBottom: '48px' }}>
              <div className="weekly-schedule-container" style={{ margin: '0 0 24px 0' }}>
                <table className="weekly-schedule-table">
                  <thead>
                    <tr>
                      <th>TIMING</th>
                      <th>MON</th>
                      <th>TUE</th>
                      <th>WED</th>
                      <th>THU</th>
                      <th>FRI</th>
                      <th>SAT</th>
                      <th>SUN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["5-6 AM", "6-7 AM", "7-8 AM", "8-9 AM", "2-3 PM", "5-6 PM", "6-7 PM", "7-8 PM", "8-9 PM"].map(slot => {
                      const row = editedSchedule[slot] || {};
                      const handleCellChange = (day: string, val: string) => {
                        setEditedSchedule(prev => ({
                          ...prev,
                          [slot]: {
                            ...(prev[slot] || {}),
                            [day]: val
                          }
                        }));
                      };
                      return (
                        <tr key={slot}>
                          <td className="timing-col">{slot}</td>
                          <td>
                            <input 
                              type="text" 
                              value={row.MON || ""} 
                              onChange={e => handleCellChange("MON", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={row.TUE || ""} 
                              onChange={e => handleCellChange("TUE", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={row.WED || ""} 
                              onChange={e => handleCellChange("WED", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={row.THU || ""} 
                              onChange={e => handleCellChange("THU", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={row.FRI || ""} 
                              onChange={e => handleCellChange("FRI", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={row.SAT || ""} 
                              onChange={e => handleCellChange("SAT", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={row.SUN || ""} 
                              onChange={e => handleCellChange("SUN", e.target.value)} 
                              placeholder="-"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button 
                type="submit" 
                className="admin-btn admin-btn-primary" 
                disabled={uploading === 'weekly-schedule-save'}
                style={{ padding: '12px 32px' }}
              >
                {uploading === 'weekly-schedule-save' ? 'Saving weekly timetable...' : 'Save Weekly Schedule'}
              </button>
            </form>

          </div>
        )}

        {/* ==================== ORGANIZERS CORNER TAB ==================== */}
        {activeTab === 'organizers' && (
          <>
            {/* Stage Setup Management */}
            <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)' }}>Stage Setup Diagram</h3>
                <span style={{ fontSize: '12px', color: 'var(--gold)', background: '#fcfaf7', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--gold)' }}>
                  Tip: Press <strong>Ctrl + V</strong> to paste an image
                </span>
              </div>
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="admin-upload-card" style={{ 
                  background: '#fcfaf7', 
                  border: '2px dashed #ddd', 
                  borderRadius: '12px', 
                  padding: '30px', 
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '16/9', 
                    background: '#fff', 
                    borderRadius: '8px', 
                    marginBottom: '20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid #eee'
                  }}>
                    {stageSetupUrl ? (
                      <img src={stageSetupUrl} alt="Stage Setup" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ color: '#bbb' }}>
                        <p style={{ fontSize: '14px' }}>No setup diagram uploaded</p>
                        <p style={{ fontSize: '12px', marginTop: '4px' }}>Paste (Ctrl+V) or click upload below</p>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    id="stage-setup-file" 
                    style={{ display: 'none' }} 
                    onChange={handleStageSetupUpload} 
                    accept="image/*" 
                  />
                  <label htmlFor="stage-setup-file" className="admin-btn admin-btn-primary" style={{ cursor: 'pointer', display: 'inline-block', width: '100%' }}>
                    {uploading === 'stage-setup' ? "UPLOADING..." : (stageSetupUrl ? "REPLACE IMAGE" : "UPLOAD IMAGE")}
                  </label>
                </div>
              </div>
              <p style={{ marginTop: '20px', color: '#666', fontSize: '13px', textAlign: 'center' }}>
                This diagram will appear in the Organizers Corner and will be available for download.
              </p>
            </div>

            {/* Gallery Management */}
            <div className="admin-card" style={{ background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Gallery Management (Organizers Corner)</h3>
              <div style={{ marginBottom: '32px', padding: '20px', background: '#fcfaf7', borderRadius: '8px', border: '1px dashed var(--gold)' }}>
                <p style={{ marginBottom: '16px', fontWeight: '600' }}>Add New Performance Photo <span style={{ fontWeight: '400', fontSize: '12px', color: '#888', marginLeft: '8px' }}>(You can select multiple photos at once)</span></p>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  onChange={(e) => handleFileUpload(e, 'gallery')} 
                  disabled={uploading === 'gallery'}
                />
                {uploading === 'gallery' && <p style={{ color: 'var(--gold)', marginTop: '10px' }}>UPLOADING... {uploadProgress}</p>}
              </div>

              <div className="admin-gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                {galleryItems.map(item => (
                  <div key={item.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                    <img src={item.image_url} alt="Gallery Item" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                    <button 
                      type="button"
                      onClick={() => handleDeleteGallery(item.id)}
                      style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(231, 76, 60, 0.9)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}
                    >
                      DELETE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function LoginPage({ navigate, returnRoute }: { navigate: (to: AppRoute) => void, returnRoute?: AppRoute | null }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage("Check your email for the password reset link!");
      } else if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + "/login"
          }
        });
        if (error) throw error;
        
        // If email confirmation is turned OFF in Supabase, data.session will exist.
        // We can immediately log them in and redirect!
        if (data.session) {
          navigate(returnRoute || "home");
        } else {
          // If it's still ON, we show the message
          setMessage("Check your email for the confirmation link!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(returnRoute || "home");
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // CUSTOM GOOGLE SIGN-IN HANDLER
  // This takes the token from Google and logs into Supabase
  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      setLoading(true);
      setMessage("");
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });
      if (error) throw error;
      navigate(returnRoute || "home");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // INITIALIZE GOOGLE BUTTON
  React.useEffect(() => {
    // Only initialize if the user is on the auth screen and Google SDK is loaded
    if ((window as any).google && document.getElementById("google-signin-button")) {
      (window as any).google.accounts.id.initialize({
        // 🛑 IMPORTANT: REPLACE THIS STRING WITH YOUR ACTUAL GOOGLE CLIENT ID! 🛑
        client_id: "283235165973-fdr95ubkkhi303k65c50c0ne0tbcpj7u.apps.googleusercontent.com",
        callback: handleGoogleCredentialResponse
      });
      (window as any).google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large", text: "continue_with", width: 350 }
      );
    }
  }, [isSignUp]);

  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    // Left as fallback in case the custom button fails to load
    try {
      setLoading(true);
      setMessage("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "/FluteRoots"
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="admin-form-container" style={{ maxWidth: '400px', width: '100%' }}>
        <h2 className="text-serif text-center" style={{ marginBottom: '32px' }}>
          {isForgotPassword ? "Reset Password" : (isSignUp ? "Create Account" : "Login")}
        </h2>
        
        {!isForgotPassword && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {/* This empty div is where Google will inject the native button */}
              <div id="google-signin-button" style={{ display: 'flex', justifyContent: 'center' }}></div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
              <span style={{ padding: '0 12px', color: '#666', fontSize: '14px' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
            </div>
          </>
        )}

        <form onSubmit={handleAuth} className="admin-form">
          {!isForgotPassword && isSignUp && (
            <div className="admin-field">
              <label>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required={isSignUp} placeholder="Jane Doe" />
            </div>
          )}
          <div className="admin-field">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@example.com" />
          </div>
          {!isForgotPassword && (
            <div className="admin-field" style={{ marginBottom: '8px' }}>
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
          )}
          {!isForgotPassword && !isSignUp && (
            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <button type="button" onClick={() => setIsForgotPassword(true)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
                Forgot Password?
              </button>
            </div>
          )}
          {message && <div style={{ padding: '12px', borderRadius: '6px', background: message.includes('success') || message.includes('Check') ? '#d4edda' : '#f8d7da', color: message.includes('success') || message.includes('Check') ? '#155724' : '#721c24', fontSize: '14px', marginBottom: '16px' }}>{message}</div>}
          <button type="submit" className="admin-btn admin-btn-primary" style={{ width: '100%', marginTop: isForgotPassword ? '16px' : '0' }} disabled={loading}>
            {loading ? "Processing..." : (isForgotPassword ? "Send Reset Link" : (isSignUp ? "Sign Up" : "Login"))}
          </button>
        </form>
        
        <p className="text-center" style={{ marginTop: '24px', fontSize: '14px' }}>
          {isForgotPassword ? (
            <button onClick={() => setIsForgotPassword(false)} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontWeight: '600' }}>
              Back to Login
            </button>
          ) : (
            <>
              {isSignUp ? "Already have an account?" : "New to the platform?"}{" "}
              <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontWeight: '600' }}>
                {isSignUp ? "Login instead" : "Create one now"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage("Password updated successfully!");
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
        <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Change Password</h3>
        <form onSubmit={handleUpdate} className="admin-form">
          <div className="admin-field">
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {message && <div style={{ padding: '12px', borderRadius: '6px', background: message.includes('success') ? '#d4edda' : '#f8d7da', color: message.includes('success') ? '#155724' : '#721c24', fontSize: '14px', marginBottom: '16px' }}>{message}</div>}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onClose} className="admin-btn" style={{ flex: 1, background: '#f8f9fa', color: '#333' }}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
