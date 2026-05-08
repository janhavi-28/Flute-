import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import type { User } from "@supabase/supabase-js";

type AppRoute = "home" | "biography" | "FluteRoots" | "organizersCorner" | "contact" | "admin" | "login";

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
  type: 'performance' | 'class' | 'blocked';
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
    return ["home", "biography", "FluteRoots", "organizersCorner", "contact", "admin", "login"].includes(path) ? path as AppRoute : "home";
  });

  const navigate = (to: AppRoute) => {
    window.history.pushState({}, "", to === "home" ? "/" : `/${to}`);
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
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const isInitialLoad = useRef(true);
  const isFetching = useRef(false);

  const fetchData = useCallback(async () => {
    if (isFetching.current) return;
    
    try {
      isFetching.current = true;
      if (isInitialLoad.current) setLoading(true);

      const [coursesRes, galleryRes, settingsRes, eventsRes] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('gallery').select('*').order('display_order', { ascending: true }),
        supabase.from('settings').select('*'),
        supabase.from('events').select('*').order('date', { ascending: true })
      ]);

      if (coursesRes.error) {
        const local = JSON.parse(localStorage.getItem('local_courses') || '[]');
        setCourses(local);
      } else {
        setCourses(coursesRes.data || []);
      }

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
      }

      if (eventsRes.error) {
        const local = JSON.parse(localStorage.getItem('local_events') || '[]');
        setCalendarEvents(local);
      } else {
        setCalendarEvents(eventsRes.data || []);
      }

      if (user) {
        const { data: enrollData } = await supabase.from('enrollments').select('course_id').eq('user_id', user.id);
        if (enrollData) setEnrollments(enrollData.map(e => e.course_id));
      }

      isInitialLoad.current = false;
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [user]);

  useEffect(() => {
    // Initial Session Check
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
      // Only re-fetch if user changed
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
        fetchData();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname.replace("/", "") || "home";
      setRoute(["home", "biography", "FluteRoots", "organizersCorner", "contact", "admin", "login"].includes(path) ? path as AppRoute : "home");
      window.scrollTo(0, 0);
    };

    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("popstate", handlePathChange);
    window.addEventListener("scroll", handleScroll);
    document.title = `${artistProfile.name} | ${artistProfile.role}`;

    return () => {
      window.removeEventListener("popstate", handlePathChange);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [fetchData]);

  const isDarkMode = route === "home" || route === "biography" || route === "FluteRoots" || route === "organizersCorner" || route === "contact";
  const isAdmin = route === "admin";

  return (
    <div className="app-container">
      {!isAdmin && (
        <header className={`site-header ${scrolled ? "scrolled" : ""} ${!scrolled && isDarkMode ? "dark-mode" : ""}`}>
          <div className="nav-container">
            <div className="header-placeholder" style={{ flex: 1 }}></div>
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
        {route === "home" && <HomePage navigate={navigate} galleryItems={galleryItems} heroImageUrl={heroImageUrl} introVideo={introVideo} />}
        {route === "biography" && <BiographyPage />}
        {route === "FluteRoots" && <CoursesPage navigate={navigate} courses={courses} user={user} enrollments={enrollments} calendarEvents={calendarEvents} onRefresh={fetchData} heroImageUrl={heroImageUrl} />}
        {route === "organizersCorner" && <OrganizersCornerPage images={galleryItems} calendarEvents={calendarEvents} navigate={navigate} />}
        {route === "contact" && <ContactPage />}
        {route === "admin" && (isUserAdmin ? (
          <AdminPage 
            navigate={navigate} 
            courses={courses} 
            galleryItems={galleryItems} 
            heroImageUrl={heroImageUrl} 
            setHeroImageUrl={setHeroImageUrl} 
            introVideo={introVideo}
            calendarEvents={calendarEvents}
            onRefresh={fetchData} 
            user={user}
          />
        ) : <LoginPage navigate={navigate} />)}
        {route === "login" && <LoginPage navigate={navigate} />}
      </main>
      {!isAdmin && <Footer />}
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
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

function HomePage({ navigate, galleryItems, heroImageUrl, introVideo }: { 
  navigate: (to: AppRoute) => void,
  galleryItems: GalleryImage[], 
  heroImageUrl: string,
  introVideo: { url: string, title: string, description: string }
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
                <iframe 
                  src={embedUrl}
                  title={title}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
          </div>
          <div className="intro-content">
            <span className="section-label" style={{ color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '12px', display: 'block', marginBottom: '12px' }}>Introduction</span>
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



function CoursesPage({ navigate, courses, user, enrollments, calendarEvents, onRefresh, heroImageUrl }: { 
  navigate: (to: AppRoute) => void, 
  courses: Course[], 
  user: any, 
  enrollments: string[], 
  calendarEvents: CalendarEvent[],
  onRefresh: () => void,
  heroImageUrl: string
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [payingFor, setPayingFor] = useState<string | null>(null);

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

    const priceValue = course.price ? parseInt(course.price.replace(/[^0-9]/g, "")) : 0;
    
    // Handle Free Courses
    if (priceValue === 0) {
      try {
        const { error } = await supabase.from('enrollments').insert([{ user_id: user.id, course_id: course.id }]);
        if (error) throw error;
        alert("Success! You are now enrolled in this free course.");
        onRefresh();
      } catch (err) {
        alert("Enrollment failed. Please try again.");
      } finally {
        setPayingFor(null);
      }
      return;
    }

    setPayingFor(course.id);
    
    const options = {
      // IMPORTANT: Replace the string below with your real Key ID from Razorpay Dashboard
      key: "rzp_test_YOUR_KEY_HERE", 
      amount: priceValue * 100, // in paisa
      currency: "INR",
      name: "Flute Roots",
      description: `Enrollment: ${course.title}`,
      image: heroImageUrl || "/vite.svg",
      handler: async function (response: any) {
        // Payment success
        const { error } = await supabase
          .from('enrollments')
          .insert([{ 
            user_id: user.id, 
            course_id: course.id,
            payment_id: response.razorpay_payment_id 
          }]);

        if (error) {
          alert("Payment recorded, but enrollment failed. Contact admin.");
          console.error(error);
        } else {
          alert("Congratulations! You are now enrolled.");
          onRefresh();
        }
        setPayingFor(null);
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
        ondismiss: function() { setPayingFor(null); }
      }
    };

    if ((window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      alert("Payment gateway not loaded. Please refresh.");
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

      <section className="courses-section">
        <div className="courses-header">
          <span className="eyebrow">Learn Bansuri</span>
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

              return (
                <div key={course.id} className="course-card">
                  <div className="course-thumbnail">
                    {isEnrolled && videoSrc ? (
                      <video src={videoSrc} className="course-video-embed" controls controlsList="nodownload" />
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
                  <div className="course-body">
                    <h3 className="course-title">{course.title}</h3>
                    <p className="course-description">{course.description}</p>
                    <div className="course-meta">
                      {course.duration && (
                        <span className="course-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                          {course.duration}
                        </span>
                      )}
                      {course.lessons !== undefined && (
                        <span className="course-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                          {course.lessons} Lessons
                        </span>
                      )}
                    </div>
                    <div className="course-footer">
                      <div className="course-price-container">
                        <span className="course-price">
                          {isEnrolled ? (
                            <span className="text-gold" style={{ fontWeight: '600' }}>✓ Enrolled</span>
                          ) : (
                            course.price ? (course.price.startsWith('₹') ? course.price : `₹${course.price}`) : 'Free'
                          )}
                        </span>
                        {!isEnrolled && course.price && parseInt(course.price.replace(/[^0-9]/g, "")) > 0 && (
                          <div className="payment-methods-mini">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" alt="UPI" title="UPI Supported" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" title="Cards Supported" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" />
                          </div>
                        )}
                      </div>
                      {!isEnrolled && (
                        <button 
                          className="course-enroll-btn" 
                          onClick={() => handleEnroll(course)}
                          disabled={payingFor === course.id}
                        >
                          {payingFor === course.id ? (
                            <span className="btn-loader-container">
                              <span className="btn-loader"></span> Processing...
                            </span>
                          ) : (user ? "Enroll Now" : "Login to Enroll")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {!loading && displayCourses.length > 0 && (
          <div className="secure-checkout-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Secure 256-bit SSL Encrypted Payment via Razorpay
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
    </>
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
              {day && isBlocked && !isSelected && (
                <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--gold)' }}></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrganizersCornerPage({ images, calendarEvents, navigate }: { images: any[], calendarEvents: CalendarEvent[], navigate: (to: AppRoute) => void }) {
  const displayImages = images.length > 0 ? images.map(img => img.image_url) : [];
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const selectedDayEvents = calendarEvents.filter(e => e.date === selectedDate);
  const isBlocked = selectedDayEvents.some(e => e.type === 'blocked' || e.type === 'performance');

  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Organizers Corner</h1>
        <p className="page-hero-subtitle">Check availability and upcoming performances</p>
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
                  selectedDayEvents.map(e => (
                    <div key={e.id} style={{ padding: '16px', background: '#fff9f2', borderRadius: '8px', borderLeft: '4px solid var(--gold)' }}>
                      <span style={{ display: 'block', fontSize: '12px', color: '#c5a059', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Status: Booked</span>
                      <strong style={{ display: 'block', fontSize: '18px', marginBottom: '8px' }}>
                        Digvijaysinh is {e.title}
                      </strong>
                      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                        This date is currently reserved for a {e.type} and is unavailable for new bookings.
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="status-indicator">
                    <span style={{ display: 'block', fontSize: '12px', color: '#4CAF50', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Status: Available</span>
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

      <section style={{ padding: '80px 0', background: '#fcfaf7' }}>
        <div className="container">
          <h2 className="serif-title text-center" style={{ marginBottom: '60px', fontSize: '36px' }}>Moments from Performances</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '30px',
            width: '100%'
          }}>
            {displayImages.map((src, i) => (
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

      <section className="quote-section">
        <p className="quote-text text-serif text-italic">
          "The bansuri is an extension of the breath, and through it, one breathes life into the silence."
        </p>
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

function AdminPage({ navigate, courses, galleryItems, heroImageUrl, setHeroImageUrl, introVideo, calendarEvents, onRefresh, user }: { 
  navigate: (to: AppRoute) => void,
  courses: Course[], 
  galleryItems: GalleryImage[], 
  heroImageUrl: string, 
  setHeroImageUrl: (url: string) => void,
  introVideo: { url: string, title: string, description: string },
  calendarEvents: CalendarEvent[],
  onRefresh: () => void,
  user: any
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", level: "Beginner", duration: "", lessons: 0, price: "", video_url: "", thumbnail_url: "" });
  const [eventForm, setEventForm] = useState({ title: "", date: new Date().toISOString().split('T')[0], type: 'performance' as const });
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [introForm, setIntroForm] = useState(introVideo);
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const resetForm = () => {
    setForm({ title: "", description: "", level: "Beginner", duration: "", lessons: 0, price: "", video_url: "", thumbnail_url: "" });
    setEditingId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bucket: 'course-media' | 'gallery-photos') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(bucket === 'course-media' ? 'course-media' : 'gallery');
    
    try {
      // DEBUG: Log current session
      console.log("Current user for upload:", user);
      if (!user) {
        alert("UPLOAD ERROR: Not logged in. Please login to upload files.");
        setUploading(null);
        return;
      }

      // 1. Pre-check: File Size
      if (file.size > 50 * 1024 * 1024) {
        const proceed = confirm(`WARNING: This file is ${Math.round(file.size / (1024 * 1024))}MB. Supabase free tier often blocks uploads larger than 50MB.\n\nTry anyway?`);
        if (!proceed) {
          setUploading(null);
          return;
        }
      }

      // 2. Sanitize Filename (Aggressive)
      const fileExt = file.name.split('.').pop();
      const cleanBaseName = file.name.split('.').slice(0, -1).join('_').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${Date.now()}_${cleanBaseName}.${fileExt}`;
      
      console.log(`Uploading ${file.name} -> ${fileName} (${Math.round(file.size / 1024)} KB) to ${bucket}...`);
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || undefined
        });

      if (uploadError) {
        console.error("Supabase Storage Error Object:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (bucket === 'course-media') {
        setForm({ ...form, video_url: publicUrl });
        showToast("Video uploaded successfully!");
      } else {
        const { error: dbError } = await supabase
          .from('gallery')
          .insert([{ image_url: publicUrl, display_order: galleryItems.length }]);
        if (dbError) throw dbError;
        onRefresh();
        showToast("Image added to gallery!");
      }
    } catch (err: any) {
      console.error("DIAGNOSTIC UPLOAD ERROR:", err);
      
      // Fallback: Use Local URL for preview
      const localUrl = URL.createObjectURL(file);
      setForm({ ...form, video_url: localUrl });
      
      let errorMsg = err.message || "Unknown error";
      const errorCode = err.status || err.code || "No Code";
      
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
        alert(`NETWORK ERROR (CORS or Adblock):\n\nYour browser blocked the upload to Supabase.\n\n1. Disable Adblockers\n2. Check Supabase Storage -> Settings -> CORS\n3. Use http://localhost:5173 (not 127.0.0.1)`);
      } else {
        alert(`SUPABASE ERROR:\nMessage: ${errorMsg}\nCode: ${errorCode}\n\nThis usually means the 'course-media' bucket is missing or private.`);
      }
    } finally {
      setUploading(null);
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

        if (uploadError) { console.error(uploadError); continue; }

        const { data: { publicUrl } } = supabase.storage
          .from('gallery-photos')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('gallery')
          .insert([{ image_url: publicUrl, display_order: galleryItems.length + i }]);

        if (!dbError) successCount++;
        else console.error(dbError);
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

  // Multi-video upload
  const handleMultipleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading('video-gallery');
    let successCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      // Video size check (50MB)
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

    const courseData = {
      title: form.title,
      description: form.description,
      level: form.level,
      duration: form.duration,
      lessons: Number(form.lessons),
      price: form.price,
      video_url: form.video_url,
      thumbnail_url: form.thumbnail_url
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
      onRefresh();
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.message.includes('fetch') || err.message.includes('security') || true) {
        // Fallback to local storage for ANY database error to ensure smooth UX
        const existing = JSON.parse(localStorage.getItem('local_courses') || '[]');
        if (editingId) {
          const updated = existing.map((c: any) => c.id === editingId ? { ...c, ...courseData } : c);
          localStorage.setItem('local_courses', JSON.stringify(updated));
          showToast("Course updated locally.");
          alert("SUCCESS: Course updated in your local browser storage.");
        } else {
          const newCourse = { ...courseData, id: Date.now().toString() };
          localStorage.setItem('local_courses', JSON.stringify([...existing, newCourse]));
          showToast("Course saved locally.");
          alert("SUCCESS: Course saved to your local browser storage.");
        }
        resetForm();
        onRefresh();
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
      const { error } = await supabase.from('events').insert([eventForm]);
      if (error) throw error;
      showToast("Event added to calendar!");
      setEventForm({ title: "", date: new Date().toISOString().split('T')[0], type: 'performance' });
      onRefresh();
    } catch (err: any) {
      console.error("EVENT SAVE ERROR:", err);
      alert(`CALENDAR ERROR: ${err.message || "Connection blocked"}\n\nThis is usually caused by an Adblocker or missing CORS settings in your Supabase Dashboard.`);
      
      const local = JSON.parse(localStorage.getItem('local_events') || '[]');
      const newEvent = { ...eventForm, id: Date.now().toString() };
      localStorage.setItem('local_events', JSON.stringify([...local, newEvent]));
      showToast("Event saved locally (Database failed)");
      setEventForm({ title: "", date: new Date().toISOString().split('T')[0], type: 'performance' });
      onRefresh();
    } finally {
      setUploading(null);
    }
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
      thumbnail_url: course.thumbnail_url || ""
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

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <div className="admin-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          <button onClick={() => navigate("admin")} className="admin-nav-item active" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>Dashboard</button>
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
            <h3>Video Introduction Management</h3>
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
        <div className="admin-card" style={{ marginTop: '40px', background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #eee' }}>
          <h3 style={{ marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>Calendar & Availability Management</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            <form onSubmit={handleAddEvent}>
              <div className="admin-field">
                <label>Event/Status Title</label>
                <input type="text" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="e.g. Concert in Mumbai" required />
              </div>
              <div className="admin-field">
                <label>Date</label>
                <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} required />
              </div>
              <div className="admin-field">
                <label>Type</label>
                <select value={eventForm.type} onChange={e => setEventForm({...eventForm, type: e.target.value as any})}>
                  <option value="performance">Performance</option>
                  <option value="class">Class</option>
                  <option value="blocked">Blocked/Not Free</option>
                </select>
              </div>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={uploading === 'event-add'}>
                {uploading === 'event-add' ? 'Adding...' : 'Add Event to Calendar'}
              </button>
            </form>
            
            <div className="admin-event-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '16px' }}>Existing Events</h4>
              {calendarEvents.length === 0 ? <p style={{ color: '#888' }}>No events scheduled.</p> : (
                calendarEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee' }}>
                    <div>
                      <strong>{ev.date}</strong> - {ev.title} ({ev.type})
                    </div>
                    <button onClick={() => handleDeleteEvent(ev.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>
                  </div>
                ))
              )}
            </div>
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
