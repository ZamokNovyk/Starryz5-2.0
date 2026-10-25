import React, { useState, useEffect, useMemo } from 'react';
import { applyUserQuery } from './lib/supabaseHelper';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import RegisteredInstitutions from '@/components/RegisteredInstitutions';
import Footer from '@/components/Footer';
import InstallAppModal from '@/components/Modals/InstallAppModal';
import JoinModal from '@/components/Modals/JoinModal';
import ProfileModal from '@/components/Modals/ProfileModal';
import InstitutionModal from '@/components/Modals/InstitutionModal';
import SupabaseStatusBadge from '@/components/SupabaseStatusBadge';
import MyProfile from '@/components/MyProfile';
import CreateCenterModal from '@/components/Modals/CreateCenterModal';
import ToolsView from '@/components/ToolsView';
import PdfOrganizerView from '@/components/PdfOrganizerView';
import PdfSplitterView from '@/components/PdfSplitterView';
import PdfCompressorView from '@/components/PdfCompressorView';
import RuletaView from '@/components/RuletaView';
import FormadorGruposView from '@/components/FormadorGruposView';
import ActionNotificationPromptModal from '@/components/Modals/ActionNotificationPromptModal';
import SearchResultsView from '@/components/SearchResultsView';
import EducationalCenterProfileView from '@/components/EducationalCenterProfileView';
import ProfessorProfile from '@/src/pages/ProfessorProfile';
import StudentProfile from '@/src/pages/StudentProfile';
import AdminDashboard from '@/src/components/AdminDashboard';
import { useAuth } from '@/src/context/AuthContext';
import { LayoutGrid, User, Bell, X, Wrench } from 'lucide-react';
import { useFCMNotifications } from '@/hooks/useFCMNotifications';
import { Institution, Student } from '@/lib/mockData';
import { getEducationalCenters, EducationalCenter } from '@/src/lib/centers';
import { supabase } from '@/src/lib/supabase';
import { usePwaTabs, formatSlug, TabRichMeta } from '@/src/context/PwaTabsContext';
import PwaTabsSwitcherModal from '@/components/Modals/PwaTabsSwitcherModal';
import ThemeStudioDrawer from '@/components/ThemeStudio/ThemeStudioDrawer';
import { usePageTransition } from '@/src/context/PageTransitionContext';
import { PageTransitionOverlay } from '@/components/Transitions/PageTransitionOverlay';
import { TransitionSettingsModal } from '@/components/Transitions/TransitionSettingsModal';

function generateAcronym(name: string): string {
  const cleanWords = name
    .trim()
    .split(/\s+/)
    .filter(word => {
      const lower = word.toLowerCase();
      return lower.length > 2 && !['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'con', 'para', 'por'].includes(lower);
    });

  if (cleanWords.length === 0) return name.substring(0, 4).toUpperCase();
  if (cleanWords.length === 1) return cleanWords[0].substring(0, 4).toUpperCase();
  return cleanWords.map(w => w[0]).join('').toUpperCase().substring(0, 6);
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.|\.$/g, ''); // trim dots from start/end
}

function matchSlug(name: string, targetSlug: string): boolean {
  const slug1 = toSlug(name);
  const slug2 = targetSlug.toLowerCase().trim();
  if (slug1 === slug2) return true;
  return slug1.replace(/\./g, '') === slug2.replace(/\./g, '');
}

export default function App() {
  const { user } = useAuth();
  const { toastNotification, closeToast } = useFCMNotifications();
  const { syncCurrentRoute } = usePwaTabs();
  const { startTransition, activeTransition } = usePageTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [autoNavigateToProfile, setAutoNavigateToProfile] = useState(false);

  // Router state
  const [route, setRoute] = useState({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    search: typeof window !== 'undefined' ? window.location.search : '',
  });

  // DB Centers state
  const [dbCenters, setDbCenters] = useState<EducationalCenter[]>([]);
  const [dbCentersLoading, setDbCentersLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Modals state
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createCenterModalOpen, setCreateCenterModalOpen] = useState(false);
  const [institutionsRefreshKey, setInstitutionsRefreshKey] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  // Fetch user role on user state change
  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setUserRole(null);
        return;
      }
      try {
        let query = supabase.from('users').select('role');
        query = applyUserQuery(query, user);
        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          setUserRole(data.role);
        } else {
          setUserRole(null);
        }
      } catch (err) {
        console.error('Error fetching user role in App:', err);
        setUserRole(null);
      }
    }
    fetchUserRole();
  }, [user]);

  // Sync route popstate events
  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname;
      const nextSearch = window.location.search;
      if (activeTransition === 'none') {
        setRoute({ pathname: nextPath, search: nextSearch });
      } else {
        startTransition(() => {
          setRoute({ pathname: nextPath, search: nextSearch });
        });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTransition, startTransition]);

  const navigate = (pathname: string, search: string = '') => {
    if (route.pathname === pathname && route.search === search) return;

    if (activeTransition === 'none') {
      window.history.pushState(null, '', pathname + search);
      setRoute({ pathname, search });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      startTransition(() => {
        window.history.pushState(null, '', pathname + search);
        setRoute({ pathname, search });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  // Fetch educational centers globally
  useEffect(() => {
    async function loadCenters() {
      try {
        setDbCentersLoading(true);
        const data = await getEducationalCenters();
        setDbCenters(data);
      } catch (err) {
        console.error('Error al cargar centros de Supabase en App:', err);
      } finally {
        setDbCentersLoading(false);
      }
    }
    loadCenters();
  }, [institutionsRefreshKey]);

  // Map centers to Institution type
  const mappedDbCenters: Institution[] = useMemo(() => {
    const fallbackImages = {
      'Colegio': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
      'Instituto': 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop',
      'Universidad': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop'
    };

    return dbCenters.map(center => {
      const category: 'Universidad' | 'Instituto' | 'Colegio' = 
        center.type === 'colegio' 
          ? 'Colegio' 
          : center.type === 'instituto' 
            ? 'Instituto' 
            : 'Universidad';

      return {
        id: center.id,
        name: center.name,
        acronym: generateAcronym(center.name),
        category,
        campus: 'Sede Principal',
        city: 'Registrado por Alumno',
        studentsCount: 1,
        popularityScore: 7.0,
        verified: false,
        image: center.profile_photo_url || fallbackImages[category],
        topStudent: 'Sin líder',
      };
    });
  }, [dbCenters]);

  const allInstitutions = mappedDbCenters;

  // Auto-navigate to profile when user logs in if they previously clicked "Perfil"
  useEffect(() => {
    if (user && autoNavigateToProfile) {
      navigate(`/perfil/${user.uid}`);
      setAutoNavigateToProfile(false);
    }
  }, [user, autoNavigateToProfile]);

  // Sync searchQuery from URL params if present
  useEffect(() => {
    const searchParams = new URLSearchParams(route.search);
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
    } else if (route.pathname === '/') {
      setSearchQuery('');
    }
  }, [route]);

  const handleProfileTabClick = () => {
    if (user) {
      navigate(`/perfil/${user.uid}`);
    } else {
      setJoinModalOpen(true);
      setAutoNavigateToProfile(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/search', `?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      const element = document.getElementById('seccion-resultados');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleDirectSearch = (queryText: string) => {
    const clean = queryText.trim();
    setSearchQuery(clean);
    if (clean) {
      navigate('/search', `?q=${encodeURIComponent(clean)}`);
    } else if (route.pathname === '/search') {
      navigate('/');
    }
  };

  const handleSelectInstitution = (inst: Institution) => {
    navigate(`/educational_centers/${toSlug(inst.name)}`);
  };

  // Route matches
  const isProfileRoute = route.pathname.startsWith('/educational_centers/');
  const profileSlug = isProfileRoute ? route.pathname.replace('/educational_centers/', '') : '';
  const currentProfileInstitution = isProfileRoute
    ? allInstitutions.find(inst => matchSlug(inst.name, profileSlug) || inst.id === profileSlug)
    : null;

  const isProfessorRoute = route.pathname.startsWith('/profesores/');
  const professorSlug = isProfessorRoute ? route.pathname.replace('/profesores/', '') : '';

  const isStudentRoute = route.pathname.startsWith('/estudiantes/');
  const studentSlug = isStudentRoute ? route.pathname.replace('/estudiantes/', '') : '';

  const isUserProfileRoute = route.pathname.startsWith('/perfil/');
  const userProfileUid = isUserProfileRoute ? route.pathname.replace('/perfil/', '') : '';

  const isAdminRoute = route.pathname === '/admin';
  const isPdfOrganizerRoute = route.pathname === '/herramientas/organizadorpdf' || route.pathname === '/herramientas/organizador-pdf';
  const isPdfSplitterRoute = route.pathname === '/herramientas/dividirpdf' || route.pathname === '/herramientas/dividir-pdf';
  const isPdfCompressorRoute = route.pathname === '/herramientas/comprimirpdf' || route.pathname === '/herramientas/comprimir-pdf' || route.pathname === '/herramientas/compresor-pdf';
  const isRuletaRoute = route.pathname === '/herramientas/ruleta';
  const isFormadorGruposRoute = route.pathname === '/herramientas/grupos' || route.pathname === '/herramientas/formador-grupos';
  const isToolsRoute = route.pathname === '/herramientas';

  const isSearchRoute = route.pathname === '/search' || (route.pathname === '/' && new URLSearchParams(route.search).has('q'));
  const currentQuery = new URLSearchParams(route.search).get('q') || searchQuery;

  const searchResults = useMemo(() => {
    return allInstitutions.filter(inst => {
      if (!currentQuery) return true;
      return (
        inst.name.toLowerCase().includes(currentQuery.toLowerCase()) ||
        inst.acronym.toLowerCase().includes(currentQuery.toLowerCase())
      );
    });
  }, [allInstitutions, currentQuery]);

  const currentProfileInstId = currentProfileInstitution?.id;
  const currentProfileInstName = currentProfileInstitution?.name;

  // Sincronizar ruta activa y título real con la pestaña actual de la PWA
  useEffect(() => {
    let customTitle: string | undefined;
    let customMeta: TabRichMeta | undefined;

    if (isProfileRoute) {
      const instName = currentProfileInstitution?.name || formatSlug(profileSlug);
      customTitle = instName;
      customMeta = {
        institutionName: instName,
        institutionAcronym: generateAcronym(instName),
        institutionType: currentProfileInstitution?.type || 'Centro de Educación Superior',
        institutionCity: currentProfileInstitution?.department || currentProfileInstitution?.province || 'Perú',
        institutionRating: currentProfileInstitution?.rating || 4.8,
        institutionReviews: currentProfileInstitution?.reviewCount || 34,
        institutionBanner: currentProfileInstitution?.bannerUrl,
        institutionLogo: currentProfileInstitution?.logoUrl
      };
    } else if (isProfessorRoute && professorSlug) {
      const profName = formatSlug(professorSlug);
      customTitle = `Prof. ${profName}`;
      customMeta = {
        professorName: profName,
        professorRating: 4.8,
        professorSubject: 'Docencia & Cátedra'
      };
    } else if (isStudentRoute && studentSlug) {
      const studName = formatSlug(studentSlug);
      customTitle = studName;
      customMeta = {
        studentName: studName,
        studentCrushes: 142,
        studentRating: 4.9
      };
    } else if (isPdfCompressorRoute) {
      customTitle = 'Compresor PDF';
      customMeta = { toolType: 'compressor' };
    } else if (isPdfOrganizerRoute) {
      customTitle = 'Organizador PDF';
      customMeta = { toolType: 'organizer' };
    } else if (isPdfSplitterRoute) {
      customTitle = 'Dividir PDF';
      customMeta = { toolType: 'splitter' };
    } else if (isRuletaRoute) {
      customTitle = 'Ruleta de Sorteos';
      customMeta = { toolType: 'ruleta' };
    } else if (isFormadorGruposRoute) {
      customTitle = 'Formador de Grupos';
      customMeta = { toolType: 'grupos' };
    } else if (isAdminRoute) {
      customTitle = 'Panel Admin';
    } else if (route.pathname === '/search' || (route.pathname === '/' && route.search)) {
      const queryParam = new URLSearchParams(route.search).get('q') || searchQuery;
      customTitle = queryParam ? `Búsqueda: ${queryParam}` : 'Buscador';
      customMeta = {
        searchQuery: queryParam,
        searchTotalResults: searchResults.length
      };
    } else if (route.pathname === '/') {
      customTitle = 'Inicio • Campus';
      customMeta = {
        topInstitutions: allInstitutions.slice(0, 3).map(inst => ({
          name: inst.name,
          acronym: generateAcronym(inst.name),
          rating: inst.rating || 4.8,
          city: inst.department || inst.province || 'Perú'
        }))
      };
    }

    syncCurrentRoute(route.pathname, route.search, customTitle, customMeta);
  }, [
    route.pathname,
    route.search,
    searchQuery,
    searchResults.length,
    dbCenters.length,
    isProfileRoute,
    profileSlug,
    currentProfileInstId,
    currentProfileInstName,
    isProfessorRoute,
    professorSlug,
    isStudentRoute,
    studentSlug,
    isPdfCompressorRoute,
    isPdfOrganizerRoute,
    isPdfSplitterRoute,
    isRuletaRoute,
    isFormadorGruposRoute,
    isAdminRoute,
    syncCurrentRoute
  ]);

  return (
    <div id="page-view-container" className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans selection:bg-[#eab308] selection:text-black">
      
      {/* 1. Header (Barra de Navegación con Buscador Integrado) */}
      <Header
        searchQuery={searchQuery}
        onSearch={handleDirectSearch}
        onNavigate={(url) => navigate(url)}
        onOpenInstallModal={() => setInstallModalOpen(true)}
        onOpenJoinModal={() => setJoinModalOpen(true)}
        onGoToProfile={handleProfileTabClick}
        onGoToHome={() => navigate('/')}
        onOpenCreateCenterModal={() => setCreateCenterModalOpen(true)}
      />

      {/* 2. Main Content Area according to Route */}
      <main className="flex-1 pb-28">
        {isAdminRoute ? (
          <AdminDashboard
            onBack={() => {
              if (user) {
                navigate(`/perfil/${user.uid}`);
              } else {
                navigate('/');
              }
            }}
            onNavigate={(url) => navigate(url)}
          />
        ) : isProfessorRoute ? (
          <ProfessorProfile
            slug={professorSlug}
            onBack={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate('/');
              }
            }}
            onRequireAuth={() => setJoinModalOpen(true)}
          />
        ) : isStudentRoute ? (
          <StudentProfile
            slug={studentSlug}
            onBack={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate('/');
              }
            }}
            onRequireAuth={() => setJoinModalOpen(true)}
          />
        ) : isProfileRoute ? (
          currentProfileInstitution ? (
            <EducationalCenterProfileView
              institution={currentProfileInstitution}
              onBack={() => navigate('/')}
              onSelectProfessor={(slug) => navigate(`/profesores/${slug}`)}
              onSelectStudent={(slug) => navigate(`/estudiantes/${slug}`)}
            />
          ) : (
            <div className="max-w-md mx-auto py-24 text-center space-y-4">
              <div className="text-zinc-500 font-black text-xl uppercase">Institución no encontrada</div>
              <p className="text-zinc-400 text-xs">El centro educativo solicitado no existe o no se encuentra registrado en nuestra base de datos.</p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase"
              >
                Volver al Inicio
              </button>
            </div>
          )
        ) : route.pathname === '/admin' ? (
          <AdminDashboard 
            onBack={() => navigate('/')} 
            onNavigate={(url) => navigate(url)} 
          />
        ) : route.pathname === '/perfil' || isUserProfileRoute ? (
          <MyProfile 
            uid={userProfileUid} 
            onBackToHome={() => navigate('/')} 
            onNavigate={(url) => navigate(url)}
          />
        ) : isPdfOrganizerRoute ? (
          <PdfOrganizerView
            onBack={() => navigate('/herramientas')}
            onNavigate={(url) => navigate(url)}
          />
        ) : isPdfSplitterRoute ? (
          <PdfSplitterView
            onBack={() => navigate('/herramientas')}
            onNavigate={(url) => navigate(url)}
          />
        ) : isPdfCompressorRoute ? (
          <PdfCompressorView
            onBack={() => navigate('/herramientas')}
            onNavigate={(url) => navigate(url)}
          />
        ) : isRuletaRoute ? (
          <RuletaView
            onBack={() => navigate('/herramientas')}
            onNavigate={(url) => navigate(url)}
          />
        ) : isFormadorGruposRoute ? (
          <FormadorGruposView
            onBack={() => navigate('/herramientas')}
            onNavigate={(url) => navigate(url)}
          />
        ) : isToolsRoute ? (
          <ToolsView
            onBack={() => navigate('/')}
            onNavigate={(url) => navigate(url)}
          />
        ) : isSearchRoute ? (
          <SearchResultsView
            query={currentQuery}
            results={searchResults}
            onSelectInstitution={handleSelectInstitution}
            onSelectStudent={(slugOrUid) => {
              if (slugOrUid.startsWith('user-')) {
                navigate(`/perfil/${slugOrUid.replace('user-', '')}`);
              } else if (slugOrUid.startsWith('stud-')) {
                navigate(`/estudiantes/${slugOrUid.replace('stud-', '')}`);
              } else if (slugOrUid.length > 25) {
                navigate(`/perfil/${slugOrUid}`);
              } else {
                navigate(`/estudiantes/${slugOrUid}`);
              }
            }}
            onBack={() => navigate('/')}
          />
        ) : (
          <>
            <HeroSection
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearchSubmit={handleSearchSubmit}
              onNavigate={(url) => navigate(url)}
            />

            <div id="seccion-resultados">
              {/* 3. Secciones UI Inferiores */}
              <RegisteredInstitutions
                onSelectInstitution={handleSelectInstitution}
                searchQuery={searchQuery}
                refreshKey={institutionsRefreshKey}
                dbCenters={dbCenters}
                loading={dbCentersLoading}
              />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0d0d0d]/95 backdrop-blur-md border border-[#ffffff15] rounded-full p-2 flex items-center gap-1.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] ring-1 ring-white/5">
        <button
          onClick={() => {
            navigate('/');
          }}
          className={`px-5 py-2.5 rounded-full flex items-center gap-2 text-xs font-black transition-all duration-300 cursor-pointer ${
            route.pathname === '/' || isSearchRoute || isProfileRoute || isProfessorRoute
              ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Home</span>
        </button>

        {userRole === 'admin' && (
          <button
            onClick={() => navigate('/herramientas')}
            className={`px-5 py-2.5 rounded-full flex items-center gap-2 text-xs font-black transition-all duration-300 cursor-pointer ${
              isToolsRoute || isPdfOrganizerRoute || isPdfSplitterRoute || isPdfCompressorRoute || isRuletaRoute || isFormadorGruposRoute
                ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Herramientas</span>
          </button>
        )}
        
        <button
          onClick={handleProfileTabClick}
          className={`px-5 py-2.5 rounded-full flex items-center gap-2 text-xs font-black transition-all duration-300 cursor-pointer ${
            route.pathname === '/perfil' || isUserProfileRoute
              ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Mi Perfil</span>
        </button>
      </div>



      {/* MODALS */}
      <InstallAppModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
      />

      <JoinModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />

      <ProfileModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      <InstitutionModal
        institution={selectedInstitution}
        onClose={() => setSelectedInstitution(null)}
      />

      <CreateCenterModal
        isOpen={createCenterModalOpen}
        onClose={() => setCreateCenterModalOpen(false)}
        onSuccess={() => setInstitutionsRefreshKey(prev => prev + 1)}
      />

      <ActionNotificationPromptModal />

      {/* Notification Toast for Foreground FCM Messages */}
      {toastNotification && (
        <div 
          id="fcm-toast"
          onClick={() => {
            if (toastNotification.linkUrl) {
              if (toastNotification.linkUrl.startsWith('/')) {
                const [path, search] = toastNotification.linkUrl.split('?');
                navigate(path, search ? `?${search}` : '');
              } else {
                window.location.href = toastNotification.linkUrl;
              }
            }
            closeToast();
          }}
          className="fixed top-24 right-6 z-50 max-w-sm w-full bg-[#121212]/95 border border-[#eab308]/40 backdrop-blur-md rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex gap-3 animate-fade-in transition-all duration-300 transform translate-y-0 scale-100 cursor-pointer hover:border-[#eab308]"
        >
          <div className="w-8 h-8 rounded-full bg-[#eab308]/10 border border-[#eab308]/20 flex items-center justify-center text-[#eab308] shrink-0">
            <Bell className="w-4 h-4 fill-[#eab308]/20" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-white uppercase tracking-wider">{toastNotification.title}</div>
            <div className="text-[11px] text-zinc-400 mt-1 leading-normal">{toastNotification.body}</div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              closeToast();
            }} 
            className="text-zinc-500 hover:text-white shrink-0 p-1 transition-colors self-start"
            title="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PWA Tabs Switcher Modal */}
      <PwaTabsSwitcherModal
        onNavigate={(pathname, search = '') => navigate(pathname, search)}
      />

      {/* Theme Studio / Personalizador Visual de Colores */}
      <ThemeStudioDrawer />

      {/* Page Transitions Overlay & Settings Modal */}
      <PageTransitionOverlay />
      <TransitionSettingsModal />
    </div>
  );
}
