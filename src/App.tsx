import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import type { User } from "@supabase/supabase-js";

type AppRoute = "home" | "biography" | "courses" | "gallery" | "contact" | "admin" | "login";

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
    const hash = window.location.hash.replace("#/", "") as AppRoute;
    return ["home", "biography", "courses", "gallery", "contact", "admin", "login"].includes(hash) ? hash : "home";
  });

  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryImage[]>([]);
  const [enrollments, setEnrollments] = useState<string[]>([]); // Array of course_ids
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: true });

      if (!coursesError) setCourses(coursesData || []);

      // Fetch Gallery
      const { data: galleryData, error: galleryError } = await supabase
        .from('gallery')
        .select('*')
        .order('display_order', { ascending: true });

      if (!galleryError) setGalleryItems(galleryData || []);

      // Fetch User Enrollments
      if (user) {
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', user.id);
        if (enrollData) setEnrollments(enrollData.map(e => e.course_id));
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      // For this project, we can check if email matches admin
      setIsUserAdmin(session?.user?.email === "digvijayflute@gmail.com" || session?.user?.email === "janhavikolekar280@gmail.com");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsUserAdmin(session?.user?.email === "digvijayflute@gmail.com" || session?.user?.email === "janhavikolekar280@gmail.com");
    });

    fetchData();

    const handleHashChange = () => {
      const hash = window.location.hash.replace("#/", "") as AppRoute;
      setRoute(["home", "biography", "courses", "gallery", "contact", "admin", "login"].includes(hash) ? hash : "home");
      window.scrollTo(0, 0);
    };

    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("scroll", handleScroll);
    document.title = `${artistProfile.name} | ${artistProfile.role}`;

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("scroll", handleScroll);
      subscription.unsubscribe();
    };
  }, [fetchData]);

  const isDarkMode = route === "home" || route === "biography" || route === "courses" || route === "gallery" || route === "contact";
  const isAdmin = route === "admin";

  return (
    <div className="app-container">
      {!isAdmin && (
        <header className={`site-header ${scrolled ? "scrolled" : ""} ${!scrolled && isDarkMode ? "dark-mode" : ""}`}>
          <div className="nav-container">
            <div className="header-placeholder" style={{ flex: 1 }}></div>
            <nav className="site-nav">
              <a href="#/home" className="nav-link">Home</a>
              <a href="#/biography" className="nav-link">Biography</a>
              <a href="#/courses" className="nav-link">Courses</a>
              <a href="#/gallery" className="nav-link">Event Gallery</a>
              <a href="#/contact" className="nav-link">Contact</a>
            </nav>
            <div className="auth-nav">
              {isUserAdmin && <a href="#/admin" className="nav-link admin-link">Dashboard</a>}
              {user ? (
                <button onClick={() => supabase.auth.signOut()} className="nav-link signout-btn">Sign Out</button>
              ) : (
                <a href="#/login" className="nav-link login-btn">Login</a>
              )}
            </div>
          </div>
        </header>
      )}

      <main>
        {route === "home" && <HomePage galleryItems={galleryItems} />}
        {route === "biography" && <BiographyPage />}
        {route === "courses" && <CoursesPage courses={courses} user={user} enrollments={enrollments} onRefresh={fetchData} />}
        {route === "gallery" && <GalleryPage images={galleryItems} />}
        {route === "contact" && <ContactPage />}
        {route === "admin" && (isUserAdmin ? <AdminPage courses={courses} galleryItems={galleryItems} onRefresh={fetchData} /> : <LoginPage />)}
        {route === "login" && <LoginPage />}
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

function HomePage({ galleryItems }: { galleryItems: GalleryImage[] }) {
  const displayGallery = galleryItems.length > 0 ? galleryItems.map(img => img.image_url) : images.gallery;
  
  return (
    <>
      <section className="hero">
        <div className="hero-bg">
          <img src={images.hero} alt={artistProfile.name} />
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
          <a href="#/biography" className="text-gold text-serif text-italic" style={{ marginTop: '32px', display: 'inline-block' }}>Read more about the artist →</a>
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

const placeholderCourses = [
  {
    id: 1,
    title: "Bansuri Basics — Foundation Course",
    level: "Beginner",
    duration: "8 Weeks",
    lessons: 24,
    description: "Master the fundamentals of bansuri playing — breath control, finger technique, and your first ragas.",
    price: "Coming Soon",
  },
  {
    id: 2,
    title: "Raga Exploration — Intermediate",
    level: "Intermediate",
    duration: "12 Weeks",
    lessons: 36,
    description: "Dive deep into Hindustani ragas, learn alap-jod-jhala structures and develop your improvisational skills.",
    price: "Coming Soon",
  },
  {
    id: 3,
    title: "Advanced Raga Rendition",
    level: "Advanced",
    duration: "16 Weeks",
    lessons: 48,
    description: "Master complex ragas, advanced taan patterns, and concert-level performance techniques.",
    price: "Coming Soon",
  },
];

function CoursesPage({ courses, user, enrollments, onRefresh }: { courses: Course[], user: any, enrollments: string[], onRefresh: () => void }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [payingFor, setPayingFor] = useState<string | null>(null);

  // Fetch signed URLs for enrolled courses
  useEffect(() => {
    const fetchLinks = async () => {
      const links: Record<string, string> = {};
      for (const id of enrollments) {
        const course = courses.find(c => c.id === id);
        if (course && course.video_url.includes('supabase.co')) {
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
      window.location.hash = "#/login";
      return;
    }

    setPayingFor(course.id);
    
    const options = {
      key: "rzp_test_YOUR_KEY_HERE", // Replace with real key
      amount: parseInt(course.price.replace(/[^0-9]/g, "")) * 100, // in paisa
      currency: "INR",
      name: "Flute Roots",
      description: `Enrollment for ${course.title}`,
      image: "/vite.svg",
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
                      <span className="course-price">
                        {isEnrolled ? (
                          <span className="text-gold" style={{ fontWeight: '600' }}>✓ Enrolled</span>
                        ) : (
                          course.price ? (course.price.startsWith('₹') ? course.price : `₹${course.price}`) : 'Free'
                        )}
                      </span>
                      {!isEnrolled && (
                        <button 
                          className="course-enroll-btn" 
                          onClick={() => handleEnroll(course)}
                          disabled={payingFor === course.id}
                        >
                          {payingFor === course.id ? "Processing..." : (user ? "Enroll Now" : "Login to Enroll")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="courses-cta">
        <div className="courses-cta-content">
          <h2 className="text-serif">Private Lessons Available</h2>
          <p>For personalized one-on-one training in the Guru-Shishya tradition, reach out directly.</p>
          <a href="#/contact" className="courses-cta-btn">Get In Touch</a>
        </div>
      </section>
    </>
  );
}

function GalleryPage({ images: dbImages }: { images: GalleryImage[] }) {
  const displayImages = dbImages.length > 0 ? dbImages.map(img => img.image_url) : images.gallery;

  return (
    <>
      <section className="page-hero">
        <h1 className="page-hero-title">Event Gallery</h1>
      </section>

      <section className="gallery-grid">
        {displayImages.map((src, i) => (
          <div key={i} className="gallery-item">
            <img src={src} alt={`Gallery image ${i + 1}`} />
          </div>
        ))}
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

          <div className="map-placeholder">
            [ Interactive Map Placeholder ]
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

function AdminPage({ courses, galleryItems, onRefresh }: { courses: Course[], galleryItems: GalleryImage[], onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", level: "Beginner", duration: "", lessons: 0, price: "", video_url: "", thumbnail_url: "" });
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
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

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

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
      console.error("Upload error:", err);
      if (err.message === 'Failed to fetch') {
        alert("Upload failed: Connection interrupted or file too large. Please check your internet or try a smaller file.");
      } else {
        alert("Upload error: " + (err.message || "Unknown error"));
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_thumb.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('course-media')
        .upload(fileName, file);

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
      setUploading(false);
      e.target.value = "";
    }
  };

  // Multi-file gallery upload
  const handleMultipleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1} of ${totalFiles}...`);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('gallery-photos')
          .upload(fileName, file);

        if (uploadError) { console.error(uploadError); continue; }

        const { data: { publicUrl } } = supabase.storage
          .from('gallery-photos')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('gallery')
          .insert([{ image_url: publicUrl, display_order: galleryItems.length + i }]);

        if (!dbError) successCount++;
      } catch (err) { console.error(err); }
    }

    setUploading(false);
    setUploadProgress("");
    onRefresh();
    showToast(`${successCount} of ${totalFiles} photos uploaded!`);
    e.target.value = "";
  };

  // Multi-video upload
  const handleMultipleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      setUploadProgress(`Uploading video ${i + 1} of ${totalFiles}...`);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('course-media')
          .upload(fileName, file);

        if (!uploadError) successCount++;
        else console.error(uploadError);
      } catch (err) { console.error(err); }
    }

    setUploading(false);
    setUploadProgress("");
    fetchVideos();
    showToast(`${successCount} of ${totalFiles} videos uploaded!`);
    e.target.value = "";
  };

  const handleDeleteVideo = async (name: string) => {
    if (!confirm("Delete this video?")) return;
    const { error } = await supabase.storage.from('course-media').remove([name]);
    if (error) alert(error.message);
    else { fetchVideos(); showToast("Video deleted."); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;

    setUploading(true);
    try {
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
      alert(err.message);
    } finally {
      setUploading(false);
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

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) alert(error.message);
    else {
      showToast("Course deleted.");
      onRefresh();
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


  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <div className="admin-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          <a href="#/admin" className="admin-nav-item active">Dashboard</a>
          <a href="#/courses" className="admin-nav-item">View Site</a>
          <a href="#/home" className="admin-nav-item">Back to Home</a>
        </nav>
        <div className="admin-stats">
          <div className="admin-stat"><span className="admin-stat-num">{courses.length}</span><span className="admin-stat-label">Courses</span></div>
          <div className="admin-stat"><span className="admin-stat-num">{galleryItems.length}</span><span className="admin-stat-label">Event Gallery</span></div>
        </div>
      </div>

      <div className="admin-main">
        {toast && <div className="admin-toast">{toast}</div>}

        <div className="admin-header">
          <h1>{editingId ? "Edit Course" : "Add New Course"}</h1>
          <p className="admin-subtitle">Fill in the details below to update your learning platform</p>
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
                  {uploading ? 'Processing...' : '🖼️ Choose Image File'}
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
                <label>Course Video (Upload from Device)</label>
                <label className="admin-btn admin-btn-ghost" style={{ margin: 0, cursor: 'pointer', display: 'inline-block' }}>
                  {uploading ? 'Uploading...' : '📁 Choose Video File'}
                  <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'course-media')} />
                </label>
                {form.video_url && <p style={{ marginTop: '8px', fontSize: '13px', color: '#4CAF50' }}>✓ Video uploaded successfully</p>}
              </div>
              <div className="admin-preview">
                {form.video_url ? (
                  <video src={form.video_url} className="admin-preview-video" controls />
                ) : (
                  <div className="admin-preview-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    <p>{uploading ? 'Processing...' : 'Video Preview'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="admin-form-actions">
            {editingId && <button type="button" className="admin-btn admin-btn-ghost" onClick={resetForm}>Cancel</button>}
            <button type="submit" className="admin-btn admin-btn-primary" disabled={uploading}>
              {uploading ? "Saving..." : (editingId ? "Update Course" : "Add Course")}
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

        <div className="admin-list-header" style={{ marginTop: '60px' }}>
          <h2>Event Gallery Manager</h2>
        </div>

        <div className="admin-gallery-add">
          <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer' }}>
            Upload Photos
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleMultipleGalleryUpload} />
          </label>
          {uploading && <span style={{ marginLeft: '12px' }}>{uploadProgress || 'Uploading...'}</span>}
        </div>

        <div className="admin-gallery-grid">
          {galleryItems.map(item => (
            <div key={item.id} className="admin-gallery-item">
              <img src={item.image_url} alt="" />
              <button className="admin-btn-icon admin-btn-danger" onClick={() => handleDeleteGallery(item.id)} title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
        </div>

        <div className="admin-list-header" style={{ marginTop: '60px' }}>
          <h2>Video Manager</h2>
        </div>

        <div className="admin-gallery-add">
          <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer' }}>
            Upload Videos
            <input type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={handleMultipleVideoUpload} />
          </label>
          {uploading && <span style={{ marginLeft: '12px' }}>{uploadProgress || 'Uploading...'}</span>}
        </div>

        <div className="admin-gallery-grid">
          {videoFiles.map(video => (
            <div key={video.name} className="admin-gallery-item" style={{ aspectRatio: '16/9' }}>
              <video src={video.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
              <button className="admin-btn-icon admin-btn-danger" onClick={() => handleDeleteVideo(video.name)} title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
          {videoFiles.length === 0 && <p style={{ color: '#999', fontSize: '14px' }}>No videos uploaded yet.</p>}
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
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
        window.location.hash = "#/home";
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
