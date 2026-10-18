export interface Institution {
  id: string;
  name: string;
  acronym: string;
  category: 'Universidad' | 'Instituto' | 'Colegio';
  campus: string;
  city: string;
  studentsCount: number;
  popularityScore: number;
  verified: boolean;
  image: string;
  topStudent: string;
  badgeColor?: string;
}

export interface Student {
  id: string;
  name: string;
  username: string;
  institution: string;
  career: string;
  semester: string;
  votes: number;
  score: number;
  rank: number;
  avatar: string;
  bio: string;
  instagram?: string;
  verified: boolean;
  featuredBadge?: string;
}

export const MOCK_INSTITUTIONS: Institution[] = [
  {
    id: 'inst-1',
    name: 'Universidad Nacional Autónoma de México',
    acronym: 'UNAM',
    category: 'Universidad',
    campus: 'Ciudad Universitaria (CU)',
    city: 'Ciudad de México',
    studentsCount: 45200,
    popularityScore: 9.9,
    verified: true,
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop',
    topStudent: 'Valeria Morales',
  },
  {
    id: 'inst-2',
    name: 'Instituto Tecnológico y de Estudios Superiores',
    acronym: 'ITESM',
    category: 'Instituto',
    campus: 'Campus Monterrey & CDMX',
    city: 'Monterrey / CDMX',
    studentsCount: 32100,
    popularityScore: 9.8,
    verified: true,
    image: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop',
    topStudent: 'Mateo Silva',
  },
  {
    id: 'inst-3',
    name: 'Instituto Politécnico Nacional',
    acronym: 'IPN',
    category: 'Instituto',
    campus: 'Unidad Zacatenco',
    city: 'Ciudad de México',
    studentsCount: 38500,
    popularityScore: 9.7,
    verified: true,
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop',
    topStudent: 'Camila Hernández',
  },
  {
    id: 'inst-4',
    name: 'Universidad Iberoamericana',
    acronym: 'IBERO',
    category: 'Universidad',
    campus: 'Campus Santa Fe',
    city: 'Ciudad de México',
    studentsCount: 18900,
    popularityScore: 9.5,
    verified: true,
    image: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=800&auto=format&fit=crop',
    topStudent: 'Diego Fernández',
  },
  {
    id: 'inst-5',
    name: 'Universidad de Guadalajara',
    acronym: 'UDG',
    category: 'Universidad',
    campus: 'CUCEI & CUCEA',
    city: 'Guadalajara',
    studentsCount: 28400,
    popularityScore: 9.6,
    verified: true,
    image: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=800&auto=format&fit=crop',
    topStudent: 'Sofía Ramírez',
  },
  {
    id: 'inst-6',
    name: 'Universidad Anáhuac',
    acronym: 'ANÁHUAC',
    category: 'Universidad',
    campus: 'Campus Norte',
    city: 'Estado de México',
    studentsCount: 15300,
    popularityScore: 9.4,
    verified: true,
    image: 'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?q=80&w=800&auto=format&fit=crop',
    topStudent: 'Lucas Benítez',
  },
];

export const MOCK_STUDENTS: Student[] = [
  {
    id: 'stud-1',
    name: 'Valeria Morales',
    username: '@valeria.law',
    institution: 'UNAM - CU',
    career: 'Derecho Internacional',
    semester: '7mo Semestre',
    votes: 12450,
    score: 99.8,
    rank: 1,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
    bio: 'Presidenta del consejo estudiantil. Apasionada por el debate y el voluntariado.',
    instagram: 'valeriamorales_law',
    verified: true,
    featuredBadge: '👑 Top 1 Campus Leader',
  },
  {
    id: 'stud-2',
    name: 'Mateo Silva',
    username: '@mateo_tech',
    institution: 'Tec de Monterrey',
    career: 'Ingeniería Mecatrónica & IA',
    semester: '8vo Semestre',
    votes: 10820,
    score: 98.9,
    rank: 2,
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop',
    bio: 'Desarrollador de robótica y creador de contenido universitario de tecnología.',
    instagram: 'mateosilva.dev',
    verified: true,
    featuredBadge: '🥈 Starryz Innovador',
  },
  {
    id: 'stud-3',
    name: 'Camila Hernández',
    username: '@cami.med',
    institution: 'IPN - Zacatenco',
    career: 'Medicina Humana',
    semester: '6to Semestre',
    votes: 9430,
    score: 97.5,
    rank: 3,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop',
    bio: 'Futura cirujana. Coordinadora de campañas médicas juveniles.',
    instagram: 'camimed_ipn',
    verified: true,
    featuredBadge: '🥉 Estrella Médica',
  },
  {
    id: 'stud-4',
    name: 'Diego Fernández',
    username: '@diego.design',
    institution: 'IBERO CDMX',
    career: 'Diseño Gráfico & Moda',
    semester: '5to Semestre',
    votes: 8150,
    score: 96.2,
    rank: 4,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
    bio: 'Fotógrafo oficial del campus e ilustrador freelance.',
    instagram: 'diegofdz_art',
    verified: false,
  },
  {
    id: 'stud-5',
    name: 'Sofía Ramírez',
    username: '@sofi.comms',
    institution: 'UDG - Guadalajara',
    career: 'Comunicación Digital',
    semester: '4to Semestre',
    votes: 7920,
    score: 95.8,
    rank: 5,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
    bio: 'Podcaster universitaria sobre cultura pop y emprendimiento joven.',
    instagram: 'sofiaramirez.udg',
    verified: true,
  },
  {
    id: 'stud-6',
    name: 'Lucas Benítez',
    username: '@lucas_biz',
    institution: 'Anáhuac Norte',
    career: 'Negocios Internacionales',
    semester: '8vo Semestre',
    votes: 6840,
    score: 94.9,
    rank: 6,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
    bio: 'Organizador de torneos deportivos interuniversitarios.',
    instagram: 'lucasbenitez_anahuac',
    verified: false,
  },
];
