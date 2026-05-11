import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
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

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
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
  hero: "/images/digvijay-hero-white.jpeg",
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryImage[]>([]);
  const [enrollments, setEnrollments] = useState<string[]>([]); // Array of course_ids
  const [heroImageUrl, setHeroImageUrl] = useState<string>(images.hero);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
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
        if (hero) setHeroImageUrl(hero.value);

        const newIntro = { ...introVideo };
        settings.forEach(s => {
          if (s.key === 'intro_video_url') newIntro.url = s.value;
          if (s.key === 'intro_video_title') newIntro.title = s.value;
          if (s.key === 'intro_video_description') newIntro.description = s.value;
        });
        setIntroVideo(newIntro);

        const setup = settings.find(s => s.key === 'stage_setup_url_1');
        if (setup) setStageSetupUrl(setup.value);

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
      }

      if (!eventsRes.error) setCalendarEvents(eventsRes.data || []);

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
        <header className={`site-header ${scrolled ? "scrolled" : ""} ${!scrolled && pageIsDark ? "dark-mode" : ""}`}>
          <div className="nav-container">
            <div className="site-logo" onClick={() => navigate("home")} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center' }}>
              <span className="logo-text serif-title" style={{ fontSize: '22px', color: scrolled ? '#000' : (pageIsDark ? 'var(--gold)' : '#000'), transition: 'color 0.3s' }}>Flute Roots</span>
            </div>
            <nav className="site-nav">
              <a href="/" onClick={(e) => { e.preventDefault(); navigate("home"); }} className="nav-link">Home</a>
              <a href="/FluteRoots" onClick={(e) => { e.preventDefault(); navigate("FluteRoots"); }} className="nav-link">Courses</a>
              <a href="/organizersCorner" onClick={(e) => { e.preventDefault(); navigate("organizersCorner"); }} className="nav-link">Organizers Corner</a>
              <a href="/biography" onClick={(e) => { e.preventDefault(); navigate("biography"); }} className="nav-link">Biography</a>
              <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("contact"); }} className="nav-link">Contact</a>
            </nav>
            <div className="auth-nav">
              {isUserAdmin && <a href="/admin" onClick={(e) => { e.preventDefault(); navigate("admin"); }} className="nav-link admin-link">Dashboard</a>}
              {user ? (
                <button onClick={() => supabase.auth.signOut()} className="nav-link signout-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Sign Out</button>
              ) : (
                <a href="/login" onClick={(e) => { e.preventDefault(); navigate("login"); }} className="nav-link login-btn">Login</a>
              )}
            </div>
          </div>
        </header>
      )}

      <main>
        {route === "home" && <HomePage navigate={navigate} galleryItems={galleryItems} heroImageUrl={heroImageUrl} introVideo={introVideo} calendarEvents={calendarEvents} />}
        {route === "biography" && <BiographyPage />}
        {route === "FluteRoots" && <CoursesPage navigate={navigate} courses={courses} user={user} enrollments={enrollments} calendarEvents={calendarEvents} announcements={announcements} onRefresh={fetchData} heroImageUrl={heroImageUrl} loading={loading} isUserAdmin={isUserAdmin} setActiveCourseId={setActiveCourseId} />}
        {route === "organizersCorner" && <OrganizersCornerPage images={galleryItems} calendarEvents={calendarEvents} navigate={navigate} stageSetupUrl={stageSetupUrl} />}
        {route === "contact" && <ContactPage />}
        {route === "coursePlayer" && activeCourseId && <CoursePlayerPage courseId={activeCourseId} courses={courses} user={user} navigate={navigate} announcements={announcements} />}
        {route === "admin" && (isUserAdmin ? (
          <AdminPage 
            navigate={navigate} 
            courses={courses} 
            galleryItems={galleryItems} 
            heroImageUrl={heroImageUrl} 
            setHeroImageUrl={setHeroImageUrl} 
            introVideo={introVideo}
            calendarEvents={calendarEvents}
            stageSetupUrl={stageSetupUrl}
            setStageSetupUrl={setStageSetupUrl}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            onRefresh={fetchData} 
            user={user}
          />
        ) : <LoginPage navigate={navigate} />)}
        {route === "login" && <LoginPage navigate={navigate} />}
      </main>
      {!onAdminPage && <Footer />}
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-logo serif-title" style={{ fontSize: '20px', color: 'var(--gold)', marginBottom: '16px' }}>Flute Roots</div>
        <p className="text-serif text-italic">Stay Connected</p>
        <div className="social-icons">
          <a href="https://www.youtube.com/@digvijaysinhchauhan" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="YouTube">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
          </a>
          <a href="https://instagram.com/digvijay_flute" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
          </a>
          <a href="https://facebook.com/DigvijayFlute" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Facebook">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

function HomePage({ navigate, galleryItems, heroImageUrl, introVideo, calendarEvents }: { 
  navigate: (to: AppRoute) => void,
  galleryItems: GalleryImage[], 
  heroImageUrl: string,
  introVideo: { url: string, title: string, description: string },
  calendarEvents: CalendarEvent[]
}) {
  const { url, title, description } = introVideo;
  const videoId = getYouTubeId(url);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0` : url;
  
  return (
    <>
      <section className="hero">
        <div className="hero-bg" style={{ backgroundColor: '#000' }}>
          <img 
            src={heroImageUrl || images.hero} 
            alt={artistProfile.name} 
            onError={(e) => {
              (e.target as HTMLImageElement).src = images.hero;
            }}
          />
        </div>
        <div className="hero-content hero-top-right">
          <h1 className="hero-title serif-title">{artistProfile.name}</h1>
        </div>
      </section>

      <section className="quote-section">
        <div className="quote-container">
          <span className="quote-marks top">“</span>
          <p className="quote-text text-serif text-italic">
            Music is not just sound, it is the silence between the notes that speaks to the soul.
            The Bansuri is the breath of the divine, a bridge between the physical and the spiritual.
          </p>
          <p className="quote-author">Classical Music Review, India</p>
          <span className="quote-marks bottom">“</span>
        </div>
      </section>

      <section className="split-section">
        <div className="split-image">
          <img src={images.bio} alt="Performance" />
        </div>
        <div className="split-content">
          <span className="eyebrow" style={{ color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '12px' }}>Biography</span>
          <h2 className="split-title serif-title" style={{ fontSize: '42px', margin: '16px 0 24px' }}>Supreme Interpreter Of The Classical Flute</h2>
          <p className="split-text">
            Trained in the traditional Guru-Shishya Parampara, Digvijaysinh Chauhan brings a rare depth of emotion and technical mastery to the bansuri. His performances are a journey through the meditative landscapes of Indian Ragas.
          </p>
          <button onClick={() => navigate("biography")} className="text-gold text-serif text-italic" style={{ background: 'none', border: 'none', padding: 0, marginTop: '32px', display: 'inline-block', cursor: 'pointer' }}>Read more about the artist →</button>
        </div>
      </section>

      {/* Video Introduction Section */}
      <section className="intro-section" style={{ padding: '80px 0', backgroundColor: '#fff' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
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
          <div className="intro-content">

            <h2 className="serif-title" style={{ fontSize: '42px', marginBottom: '24px' }}>{title}</h2>
            <p style={{ color: '#666', lineHeight: '1.8', fontSize: '18px' }}>{description}</p>
          </div>
        </div>
      </section>
    </>
  );
}

function BiographyPage() {
  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Biography</h1>
      </section>

      <section className="bio-section">
        <div className="bio-grid">
          <img src={images.bio} alt={artistProfile.name} className="bio-image" />
          <div className="bio-content">
            <h3>{artistProfile.name}</h3>
            <div className="bio-text">
              <p>
                Digvijaysinh Chauhan is a renowned Indian classical flautist and a dedicated disciple of Padma Vibhushan Pandit Hariprasad Chaurasia ji. His musical journey is rooted in the authentic Guru-Shishya Parampara system at Vrindaban Gurukul, Bhubaneswar.
              </p>
              <p>
                A PhD scholar in Electronics Engineering, Digvijay represents a rare blend of scientific precision and artistic depth. His style of playing reflects the pure tone, clear raga presentation, and deeply expressive approach of the Maihar tradition.
              </p>
              <p>
                Through his brand 'Flute Roots | Nothing But Music', he is committed to preserving and promoting the traditional art of bansuri while exploring contemporary collaborations that resonate with global audiences.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="recognition">
        <p className="eyebrow">Awards & Recognition</p>
        <div className="logo-grid">
          <span className="text-serif">Sanskar Vibhushan Samman</span>
          <span className="text-serif">CCRT Scholarship</span>
          <span className="text-serif">OMC Foundation Award</span>
          <span className="text-serif">NALCO Cultural Honor</span>
        </div>
      </section>
    </>
  );
}



function CoursesPage({ navigate, courses, user, enrollments, calendarEvents, announcements, onRefresh, heroImageUrl, loading, isUserAdmin, setActiveCourseId }: { 
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
  setActiveCourseId: (id: string) => void
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
          const { data, error } = await supabase.storage.from('course-media').createSignedUrl(path, 7200); // 2 hours
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
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder", 
        amount: priceValue * 100, // in paisa
        currency: "INR",
        name: "Flute Roots",
        description: `Enrollment: ${course.title}`,
        image: heroImageUrl || "/vite.svg",
        handler: async function (response: any) {
          try {
            // Payment success
            const { error } = await supabase
              .from('enrollments')
              .insert([{ 
                user_id: user.id, 
                course_id: course.id,
                payment_id: response.razorpay_payment_id 
              }]);

            if (error) throw error;
            alert("Congratulations! You are now enrolled.");
            onRefresh();
            setTimeout(() => {
              document.getElementById(`course-card-${course.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 1000);
          } catch (err) {
            alert("Payment recorded, but enrollment failed. Please contact support.");
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

      {/* Rotating Notification Stripe - Flush against hero */}
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

      <section className="courses-section" style={{ background: '#1c1d1f', paddingTop: '60px', paddingBottom: '60px' }}>
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
        <div className="courses-header" style={{ marginBottom: '50px' }}>
          <span className="eyebrow" style={{ color: 'var(--gold)' }}>Learn Bansuri</span>
          <h2 className="courses-heading" style={{ color: '#ffffff', fontSize: '36px', margin: '10px 0' }}>Master the Classical Flute</h2>
          <p className="courses-desc" style={{ color: '#a0a0a0', maxWidth: '800px', margin: '0 auto' }}>
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

              return (
                <div key={course.id} id={`course-card-${course.id}`} className="course-card" style={{ 
                  background: '#2d2f31', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  border: '1px solid #3e4143',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease'
                }}>
                  <div className="course-thumbnail" style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
                    {isEnrolled ? (
                      <div 
                        className="course-thumbnail-overlay-clickable" 
                        onClick={() => {
                          setActiveCourseId(course.id);
                          navigate("coursePlayer");
                        }}
                        style={{ cursor: 'pointer', position: 'relative' }}
                      >
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt={course.title} className="course-thumbnail-img" />
                        ) : (
                          <div className="course-no-thumb">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </div>
                        )}
                        <div className="course-play-overlay">
                          <div className="play-button-circle">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                          <span>Continue Learning</span>
                        </div>
                      </div>
                    ) : (
                      <div className="course-locked-overlay">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt={course.title} className="course-thumbnail-img" />
                        ) : (
                          <div className="course-no-thumb">
                            {/* Globe / Earth icon */}
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </div>
                        )}
                      </div>
                    )}
                    {course.level && <div className="course-level-badge">{course.level}</div>}
                  </div>
                  <div className="course-body" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 className="course-title" style={{ 
                      margin: '0 0 8px', 
                      fontFamily: "'Lora', Georgia, serif", 
                      fontSize: '22px', 
                      color: '#ffffff',
                      fontWeight: 700 
                    }}>{course.title}</h3>
                    <p className="course-meta" style={{ fontSize: '14px', color: '#a0a0a0', margin: '0 0 16px' }}>Digvijaysinh Chauhan</p>
                    
                    <div style={{ marginTop: 'auto' }}>
                      {isEnrolled ? (
                        <div className="course-progress-container" style={{ padding: '16px 0' }}>
                          <div className="progress-bar-bg" style={{ height: '4px', background: '#3e4143', width: '100%', marginBottom: '8px' }}>
                            <div className="progress-bar-fill" style={{ width: '25%', height: '100%', background: '#a435f0' }}></div>
                          </div>
                          <div className="progress-text">
                            <span style={{ fontSize: '12px', color: '#a0a0a0' }}>25% complete</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '15px', color: '#a0a0a0', fontSize: '13px', borderTop: '1px solid #3e4143', paddingTop: '16px', marginBottom: '16px' }}>
                             <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                               {course.duration}
                             </span>
                             <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                               {course.lessons} Lessons
                             </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                              {course.price ? (course.price.startsWith('₹') ? course.price : `₹${course.price}`) : 'Free'}
                            </div>
                            <button 
                              className="enroll-btn"
                              onClick={() => handleEnroll(course)}
                              disabled={payingFor === course.id}
                              style={{ 
                                background: '#a435f0', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '10px 20px', 
                                fontWeight: 700, 
                                cursor: 'pointer', 
                                fontSize: '14px',
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {payingFor === course.id ? "..." : (user ? "Enroll Now" : "Login to Enroll")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="course-footer" style={{ borderTop: '1px solid #d1d7dc', padding: '12px 16px' }}>
                    {isEnrolled ? (
                      <button 
                        className="enroll-btn-active" 
                        onClick={() => {
                          setActiveCourseId(course.id);
                          navigate("coursePlayer");
                        }}
                        style={{ width: '100%', background: '#5624d0', color: '#fff', border: 'none', padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                      >
                        START COURSE
                      </button>
                    ) : (
                      <button 
                        className="enroll-btn"
                        onClick={() => handleEnroll(course)}
                        disabled={payingFor === course.id}
                        style={{ width: '100%', background: '#1c1d1f', color: '#fff', border: 'none', padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                      >
                        {payingFor === course.id ? "Processing..." : (user ? "Enroll Now" : "Login to Enroll")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
      </section>

      <section className="courses-cta">
        <div className="courses-cta-content">
          <h2 className="text-serif">Book a Live Online Class</h2>
          <p>Check my availability and book a personalized one-on-one session.</p>
          
          <div style={{ maxWidth: '500px', margin: '40px auto' }}>
            <SimpleCalendar onDateSelect={(d) => alert("Checking availability for " + d + ". Please contact via the form below.")} events={calendarEvents} />
          </div>
          
          <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("contact"); }} className="courses-cta-btn">Enquire for Slot</a>
        </div>
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
      if (course.video_url.includes('supabase.co')) {
        const path = course.video_url.split('/').pop() || "";
        const { data } = await supabase.storage.from('course-media').createSignedUrl(path, 7200);
        if (data) setVideoUrl(data.signedUrl);
      } else {
        setVideoUrl(course.video_url);
      }
      setLoading(false);
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
            <div className="player-video-container">
              {loading ? (
                <div className="player-loader" style={{ color: '#fff' }}>Loading Video...</div>
              ) : videoUrl ? (
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

function SimpleCalendar({ onDateSelect, selectedDate, events = [] }: { onDateSelect: (date: string) => void, selectedDate?: string, events?: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth(year, month); i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth(year, month); i++) {
    days.push(i);
  }
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  
  return (
    <div className="simple-calendar" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', width: '100%' }}>
      <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontFamily: 'var(--font-serif)' }}>{monthNames[month]} {year}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrev} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>&lt;</button>
          <button onClick={handleNext} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>&gt;</button>
        </div>
      </div>
      <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
          <div key={day} style={{ fontWeight: '600', fontSize: '12px', color: '#999', paddingBottom: '8px' }}>{day}</div>
        ))}
        {days.map((day, i) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
          const isSelected = selectedDate === dateStr;
          const isToday = day && new Date().toDateString() === new Date(year, month, day).toDateString();
          const dayEvents = events.filter(e => e.date === dateStr);
          const isBlocked = dayEvents.some(e => e.type === 'blocked' || e.type === 'performance');
          const isAvailable = dayEvents.some(e => e.type === 'available' || e.type === 'class');
          
          return (
            <div 
              key={i} 
              onClick={() => dateStr && onDateSelect(dateStr)}
              style={{ 
                padding: '12px 0', 
                borderRadius: '8px', 
                cursor: day ? 'pointer' : 'default',
                background: isSelected ? 'var(--gold)' : (isToday ? '#fcfaf7' : 'transparent'),
                color: isSelected ? 'white' : (day ? 'inherit' : 'transparent'),
                fontWeight: isSelected || isToday ? '600' : '400',
                border: isToday && !isSelected ? '1px solid var(--gold)' : 'none',
                position: 'relative',
                transition: 'all 0.2s'
              }}
            >
              {day}
              {!isSelected && (
                <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px' }}>
                  {isBlocked && (
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--gold)' }}></div>
                  )}
                  {isAvailable && (
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4CAF50' }}></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrganizersCornerPage({ images: dbImages, calendarEvents, navigate, stageSetupUrl }: { images: any[], calendarEvents: CalendarEvent[], navigate: (to: AppRoute) => void, stageSetupUrl: string }) {
  const displayImages = dbImages.length > 0 ? dbImages.map(img => img.image_url) : images.gallery;
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showSlots, setShowSlots] = useState(false);
  
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

      <section style={{ padding: '80px 0', background: '#fcfaf7' }}>
        <div className="container">
          <h2 className="serif-title text-center" style={{ marginBottom: '60px', fontSize: '36px' }}>Moments from Performances</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '30px',
            width: '100%'
          }}>
            {displayImages.slice(0, 6).map((src, i) => (
              <div key={i} style={{ 
                borderRadius: '4px', 
                overflow: 'hidden', 
                height: '300px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
              }}>
                <img src={src} alt={`Gallery image ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="quote-section" style={{ background: '#1c1d1f' }}>
        <p className="quote-text text-serif text-italic">
          "The bansuri is an extension of the breath, and through it, one breathes life into the silence."
        </p>
      </section>

      {/* Stage Setup Section */}
      <section style={{ padding: '80px 0', background: '#fff' }}>
        <div className="container">
          <h2 className="serif-title text-center" style={{ marginBottom: '40px', fontSize: '36px' }}>Stage Setup</h2>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {stageSetupUrl ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  boxShadow: '0 20px 50px rgba(0,0,0,0.1)', 
                  marginBottom: '24px',
                  background: '#f9f9f9',
                  aspectRatio: '16/9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #eee'
                }}>
                  <img src={stageSetupUrl} alt="Stage Setup" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
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

      {/* Upcoming Event Band / Calendar Section */}
      <section className="calendar-band" style={{ padding: '60px 0', background: '#fcfaf7' }}>
        <div className="container">
          <div className="calendar-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'start' }}>
            <div className="calendar-info">
              <span className="eyebrow">Availability</span>
              <h2 className="serif-title" style={{ fontSize: '36px', marginBottom: '24px' }}>Upcoming Schedule</h2>
              <p style={{ color: '#666', lineHeight: '1.8', marginBottom: '32px' }}>
                Organizers can check my availability for concerts, workshops, and private sessions. Use the calendar to see booked dates and open slots.
              </p>
                <div className="event-details-card" style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', borderTop: '4px solid var(--gold)' }}>
                  <h4 style={{ marginBottom: '24px', color: '#2c3e50', fontFamily: 'var(--font-serif)', fontSize: '20px' }}>
                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h4>
                  
                  {selectedDayEvents.length > 0 ? (
                    <div className="events-list">
                      {/* Booked Events Section */}
                      {bookedEvents.map(e => (
                        <div key={e.id} style={{ padding: '16px', background: '#fff9f2', borderRadius: '8px', borderLeft: '4px solid var(--gold)', marginBottom: '16px' }}>
                          <span style={{ display: 'block', fontSize: '12px', color: '#c5a059', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Status: Booked</span>
                          <strong style={{ display: 'block', fontSize: '18px', marginBottom: '4px' }}>Digvijaysinh is {e.title}</strong>
                        </div>
                      ))}

                      {/* Available Slots Section with Dropdown */}
                      {availableSlots.length > 0 && (
                        <div className="available-slots-container" style={{ marginBottom: '16px' }}>
                          <button 
                            onClick={() => setShowSlots(!showSlots)}
                            style={{ 
                              width: '100%', 
                              padding: '16px', 
                              background: '#f2fff2', 
                              border: '1px solid #4CAF50', 
                              borderRadius: '8px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div>
                              <span style={{ display: 'block', fontSize: '12px', color: '#4CAF50', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Slots Available</span>
                              <strong style={{ display: 'block', fontSize: '16px', color: '#2c3e50' }}>{availableSlots.length} Slots Found</strong>
                            </div>
                            <span style={{ fontSize: '20px', transition: 'transform 0.3s', transform: showSlots ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                          </button>
                          
                          {showSlots && (
                            <div className="slots-dropdown" style={{ marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid #4CAF50' }}>
                              {availableSlots.map((e, idx) => (
                                <div key={e.id} style={{ padding: '12px', borderBottom: idx === availableSlots.length - 1 ? 'none' : '1px solid #eee' }}>
                                  <strong style={{ display: 'block', fontSize: '15px', color: '#2c3e50' }}>{e.title}</strong>
                                  <span style={{ fontSize: '12px', color: '#666' }}>Available</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!isBlocked && (
                        <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("contact"); }} className="admin-btn admin-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', textAlign: 'center', marginTop: '8px' }}>
                          Contact to Book a Slot
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="status-indicator">
                      <span style={{ display: 'block', fontSize: '12px', color: '#4CAF50', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Slots Available</span>
                      <strong style={{ display: 'block', fontSize: '18px', marginBottom: '8px' }}>Available for Sessions</strong>
                      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                        This date is currently open for concerts, workshops, or private flute sessions.
                      </p>
                      <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("contact"); }} className="admin-btn admin-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', textAlign: 'center' }}>
                        Contact for a Session
                      </a>
                    </div>
                  )}
                </div>
            </div>
            <div className="calendar-wrapper">
               <SimpleCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} events={calendarEvents} />
            </div>
          </div>
        </div>
      </section>
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
          <h3 style={{ marginBottom: '32px' }}>Send A Message</h3>
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
            <textarea rows={5} placeholder="How can I help you?" required></textarea>
          </div>
          <button type="submit" className="submit-btn">Submit</button>
        </form>
      </div>

      <footer className="site-footer">
        <div className="footer-col">
          <h4>{artistProfile.name}</h4>
          <p>© 2026 Flute Artist. Powered by Flute Roots.</p>
        </div>
        <div className="footer-col">
          <h4>Address</h4>
          <p>K-8 Kalinga Nagar, Bhubaneswar, Odisha</p>
        </div>
        <div className="footer-col">
          <h4>Phone</h4>
          <p>{artistProfile.phone}</p>
        </div>
        <div className="footer-col">
          <h4>Email</h4>
          <p>{artistProfile.email}</p>
        </div>
      </footer>
    </>
  );
}

function AdminPage({ 
  navigate, 
  courses, 
  galleryItems, 
  heroImageUrl, 
  setHeroImageUrl, 
  introVideo, 
  calendarEvents, 
  stageSetupUrl,
  setStageSetupUrl,
  announcements,
  setAnnouncements,
  onRefresh, 
  user 
}: { 
  navigate: (to: AppRoute) => void,
  courses: Course[], 
  galleryItems: GalleryImage[], 
  heroImageUrl: string, 
  setHeroImageUrl: (url: string) => void,
  introVideo: { url: string, title: string, description: string },
  calendarEvents: CalendarEvent[],
  stageSetupUrl: string,
  setStageSetupUrl: (url: string) => void,
  announcements: {title: string, text: string}[],
  setAnnouncements: (anns: {title: string, text: string}[]) => void,
  onRefresh: () => void,
  user: any
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", level: "Beginner", duration: "", lessons: 0, price: "", video_url: "", thumbnail_url: "", notes_url: "", announcement: "" });
  const [eventForm, setEventForm] = useState<{title: string, date: string, type: CalendarEvent['type']}>({ title: "", date: new Date().toISOString().split('T')[0], type: 'available' });
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [introForm, setIntroForm] = useState(introVideo);
  const [announcementForm, setAnnouncementForm] = useState(announcements);
  const [videoFiles, setVideoFiles] = useState<{name: string, url: string}[]>([]);

  // Fetch videos from storage bucket
  const fetchVideos = useCallback(async () => {
    const { data } = await supabase.storage.from('course-media').list('', { limit: 100 });
    if (data) {
      const videos = data
        .filter(f => f.name.match(/\.(mp4|webm|mov|avi|mkv)$/i))
        .map(f => ({
          name: f.name,
          url: supabase.storage.from('course-media').getPublicUrl(f.name).data.publicUrl
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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bucket: 'course-media' | 'gallery-photos') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(bucket === 'course-media' ? 'course-media' : 'gallery');
    
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
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || undefined
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        if (bucket === 'course-media') {
          setForm({ ...form, video_url: publicUrl });
          showToast("Video uploaded successfully!");
        } else {
          const { error: dbError } = await supabase
            .from('gallery')
            .insert([{ image_url: publicUrl, display_order: galleryItems.length + i }]);
          if (dbError) throw dbError;
        }
      }

      if (bucket === 'gallery-photos') {
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
        .from('course-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-media')
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
        .from('course-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-media')
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
          .from('gallery-photos')
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
          .from('course-media')
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
      const { error } = await supabase.storage.from('course-media').remove([name]);
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

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date) return;
    
    setUploading('event-add');
    try {
      if (editingEventId) {
        const { error } = await supabase.from('events').update(eventForm).eq('id', editingEventId);
        if (error) throw error;
        showToast("Event updated!");
      } else {
        const { error } = await supabase.from('events').insert([eventForm]);
        if (error) throw error;
        showToast("Event added to calendar!");
      }
      setEventForm({ title: "", date: new Date().toISOString().split('T')[0], type: 'available' });
      setEditingEventId(null);
      onRefresh();
    } catch (err: any) {
      console.error("EVENT SAVE ERROR:", err);
      
      const local = JSON.parse(localStorage.getItem('local_events') || '[]');
      if (editingEventId) {
        const updated = local.map((ev: any) => ev.id === editingEventId ? { ...ev, ...eventForm } : ev);
        localStorage.setItem('local_events', JSON.stringify(updated));
        showToast("Event updated locally");
      } else {
        const newEvent = { ...eventForm, id: Date.now().toString() };
        localStorage.setItem('local_events', JSON.stringify([...local, newEvent]));
        showToast("Event saved locally");
      }
      setEventForm({ title: "", date: new Date().toISOString().split('T')[0], type: 'available' });
      setEditingEventId(null);
      onRefresh();
    } finally {
      setUploading(null);
    }
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setEventForm({
      title: ev.title,
      date: ev.date,
      type: ev.type
    });
    // Scroll to the event form
    const el = document.getElementById('calendar-management-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Remove this event?")) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      showToast("Event removed.");
      onRefresh();
    } catch (err: any) {
      const local = JSON.parse(localStorage.getItem('local_events') || '[]');
      localStorage.setItem('local_events', JSON.stringify(local.filter((e: any) => e.id !== id)));
      showToast("Event removed locally.");
      onRefresh();
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

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('hero');
    try {
      if (file.size > 10 * 1024 * 1024) {
        alert("Hero image is too large (>10MB). Please use a compressed image.");
        setUploading(null);
        return;
      }

      console.log("Starting hero upload...");
      const fileExt = file.name.split('.').pop();
      const fileName = `hero_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('gallery-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('gallery-photos')
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
        showToast("Hero image updated successfully!");
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
        .from('gallery-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('gallery-photos')
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

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <div className="admin-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          <button onClick={() => navigate("admin")} className="admin-nav-item active" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>Dashboard</button>
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
            <h1>{editingId ? "Edit Course" : "Add New Course"}</h1>
            <p className="admin-subtitle">Fill in the details below to update your learning platform</p>
          </div>
        </div>

        {/* Hero Image Management - RESTORED TO TOP WITH PREVIOUS STYLING */}
        <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
          <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Hero Image Management</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', alignItems: 'center' }}>
            <div>
              <div className="hero-preview" style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', border: '1px solid #eee' }}>
                <img src={heroImageUrl} alt="Current Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                {uploading === 'hero' ? 'Uploading...' : 'Change Hero Image'}
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
        </div>

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

        {/* Course Announcements Management */}
        <div className="admin-section-card" style={{ marginBottom: '40px', padding: '32px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
          <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Rotating Course Announcements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {announcementForm.map((ann, idx) => (
              <div key={idx} style={{ padding: '20px', background: '#fcfaf7', borderRadius: '8px', border: '1px solid #eee', position: 'relative' }}>
                <button 
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
              onClick={() => setAnnouncementForm([...announcementForm, { title: "", text: "" }])}
              className="admin-btn" 
              style={{ background: '#f0f0f0', color: '#444', width: '200px' }}
            >
              + ADD ANNOUNCEMENT
            </button>

            <div style={{ marginTop: '24px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '24px' }}>
              <button 
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

              <div className="admin-field">
                <label>Course Video URL (Upload file OR Paste link directly)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label className="admin-btn admin-btn-ghost" style={{ margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {uploading === 'course-media' ? 'Uploading...' : '📁 Upload Video'}
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'course-media')} />
                  </label>
                  <input 
                    type="text" 
                    placeholder="Or paste video URL here..." 
                    value={form.video_url} 
                    onChange={e => setForm({...form, video_url: e.target.value})}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                {form.video_url && !form.video_url.includes('http') && <p style={{ marginTop: '8px', fontSize: '13px', color: 'orange' }}>Please enter a valid URL starting with http:// or https://</p>}
              </div>

                  <div className="form-group">
                    <label>Course Announcement (Optional)</label>
                    <textarea 
                      value={form.announcement || ""} 
                      onChange={(e) => setForm({ ...form, announcement: e.target.value })}
                      placeholder="e.g. Welcome to the course! Check out the new PDF notes added today."
                      style={{ minHeight: '80px' }}
                    />
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>This will appear in the 'Announcements' tab of the course player.</p>
                  </div>

                  <div className="form-group">
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
                  <video src={form.video_url} className="admin-preview-video" controls />
                ) : (
                  <div className="admin-preview-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    <p>{uploading === 'course-media' ? 'Processing...' : 'Video Preview'}</p>
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

        <div className="admin-list-header">
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


        {/* Intro Section Management */}
        <div className="admin-card" style={{ marginTop: '40px' }}>
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

        {/* Calendar & Availability Management */}
        <div id="calendar-management-card" className="admin-card" style={{ marginTop: '40px', background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #eee' }}>
          <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Calendar & Availability Management</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            <form onSubmit={handleAddEvent}>
              <div className="admin-field">
                <label>{eventForm.type === 'available' ? 'Slot Details / Availability' : 'Event Title'}</label>
                <input 
                  type="text" 
                  value={eventForm.title} 
                  onChange={e => setEventForm({...eventForm, title: e.target.value})} 
                  placeholder={eventForm.type === 'available' ? 'e.g. 12pm-1pm Available' : 'e.g. Concert in Mumbai'} 
                  required 
                />
              </div>
              <div className="admin-field">
                <label>Date</label>
                <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} required />
              </div>
              <div className="admin-field">
                <label>Type</label>
                <select value={eventForm.type} onChange={e => setEventForm({...eventForm, type: e.target.value as any})}>
                  <option value="available">Specific Slots (Available)</option>
                  <option value="performance">Performance (Booked)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={uploading === 'event-add'}>
                  {uploading === 'event-add' ? 'Saving...' : (editingEventId ? 'Update Event/Slot' : 'Add to Calendar')}
                </button>
                {editingEventId && (
                  <button 
                    type="button" 
                    className="admin-btn admin-btn-ghost" 
                    onClick={() => {
                      setEditingEventId(null);
                      setEventForm({ title: "", date: new Date().toISOString().split('T')[0], type: 'available' });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
            
            <div className="admin-event-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '16px' }}>Existing Events/Slots</h4>
              {calendarEvents.length === 0 ? <p style={{ color: '#888' }}>No events scheduled.</p> : (
                calendarEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee', background: editingEventId === ev.id ? '#fff9f2' : 'transparent' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{ev.date}</strong> - {ev.title} <span style={{ fontSize: '12px', color: '#888', marginLeft: '5px' }}>({ev.type})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEditEvent(ev)} style={{ color: 'var(--gold)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Edit</button>
                      <button onClick={() => handleDeleteEvent(ev.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>



        {/* Gallery Management */}
        <div className="admin-card" style={{ marginTop: '40px', background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #eee' }}>
          <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Gallery Management (Organizers Corner)</h3>
          <div style={{ marginBottom: '32px', padding: '20px', background: '#fcfaf7', borderRadius: '8px', border: '1px dashed var(--gold)' }}>
            <p style={{ marginBottom: '16px', fontWeight: '600' }}>Add New Performance Photo <span style={{ fontWeight: '400', fontSize: '12px', color: '#888', marginLeft: '8px' }}>(You can select multiple photos at once)</span></p>
            <input 
              type="file" 
              accept="image/*" 
              multiple
              onChange={(e) => handleFileUpload(e, 'gallery-photos')} 
              disabled={uploading === 'gallery'}
            />
            {uploading === 'gallery' && <p style={{ color: 'var(--gold)', marginTop: '10px' }}>UPLOADING... {uploadProgress}</p>}
          </div>

          <div className="admin-gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {galleryItems.map(item => (
              <div key={item.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                <img src={item.image_url} alt="Gallery Item" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                <button 
                  onClick={() => handleDeleteGallery(item.id)}
                  style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(231, 76, 60, 0.9)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}
                >
                  DELETE
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ navigate }: { navigate: (to: AppRoute) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("home");
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="admin-form-container" style={{ maxWidth: '400px', width: '100%' }}>
        <h2 className="text-serif text-center" style={{ marginBottom: '32px' }}>{isSignUp ? "Create Account" : "Login"}</h2>
        <form onSubmit={handleAuth} className="admin-form">
          <div className="admin-field">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@example.com" />
          </div>
          <div className="admin-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {message && <div style={{ padding: '12px', borderRadius: '6px', background: '#f8f9fa', color: '#666', fontSize: '14px', marginBottom: '16px' }}>{message}</div>}
          <button type="submit" className="admin-btn admin-btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Login")}
          </button>
        </form>
        <p className="text-center" style={{ marginTop: '24px', fontSize: '14px' }}>
          {isSignUp ? "Already have an account?" : "New to the platform?"}{" "}
          <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontWeight: '600' }}>
            {isSignUp ? "Login instead" : "Create one now"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
