import { TranslationDictionary } from './types';

export const ko: TranslationDictionary = {
  'nav.home': '홈',
  'nav.tools': '도구',
  'nav.my_profile': '내 프로필',
  'nav.search_placeholder': '이름으로 사용자 검색...',
  'nav.search_button': '검색',
  'settings.title': '설정',
  'settings.theme': '테마',
  'settings.theme_day': '주간',
  'settings.theme_night': '야간',
  'settings.theme_isppu': 'IESPPU',
  'settings.language': '언어',
  'settings.customize_colors': '색상 맞춤설정',
  'settings.studio': '스튜디오',
  'settings.page_transition': '페이지 전환 효과',
  'settings.community_guidelines': '커뮤니티 가이드라인',
  'settings.pwa_mode': 'PWA 모드 (탭)',
  'settings.pwa_inactive': '비활성',
  'settings.enable_notifications': '알림 켜기',
  'settings.logout': '로그아웃',
  'tabs.wiki': '위키',
  'tabs.professors': '교수진',
  'tabs.students': '학생 목록',
  'tabs.confessions': '익명 고백',
  'tabs.gallery': '갤러리',
  'action.create_student_profile': '학생 프로필 생성',
  'action.create_professor_profile': '교수 프로필 생성',
  'action.order': '정렬',
  'action.order_by': '정렬 기준',
  'action.carrera': '전공/학과',
  'action.all_carreras': '모든 전공',
  'action.claim_profile': '프로필 등록/소유',
  'action.verified_profile': '인증된 프로필',
  'action.change_photo': '사진 변경',
  'action.publish': '게시하기',
  'action.add_photo': '사진 추가',
  'action.everyone': '모두',
  'profile.my_data': '내 정보',
  'profile.data': '정보',
  'profile.publications': '게시물',
  'profile.reviews_received': '받은 평가',
  'profile.crushes': '관심/호감',
  'profile.saved': '보관함',
  'profile.information': '정보',
  'profile.my_interactions': '내 활동',
  'profile.subscriptions': '구독',
  'profile.followers': '팔로워',
  'profile.fans': '팬',
  'profile.following': '팔로잉',
  'profile.follow': '팔로우',
  'profile.member_since': '가입일',
  'profile.back_home': '홈으로 돌아가기',
  'post.placeholder': '오늘 어떤 이야기를 나누고 싶나요?',
  'post.only_fans': '팬 전용',
  'hero.measure_your': '당신의',
  'hero.popularity': '인기도를 확인하세요',
  'hero.in_campus': '캠퍼스 안에서',
  'auth.access_title': 'STARRYZ 5 입장',
  'auth.login_title': '로그인',
  'auth.choose_method': '커뮤니티에 참여할 방법을 선택하세요.',
  'auth.login': '로그인',
  'auth.continue_google': 'Google 계정으로 계속',
  'auth.continue_anon': '게스트로 입장',
  'auth.continue_to_site': '사이트로 이동',
  'auth.join': '참여하기',
  'auth.terms_link': '서비스 이용약관',
  'auth.privacy_link': '개인정보 처리방침',
  'notifications.title': '알림',
  'notifications.empty': '새로운 알림이 없습니다',

  legal_terms: {
    "title": "TERMS OF SERVICE",
    "badge": "LEGAL CONDITIONS",
    "updated": "Last updated: November 2026",
    "back": "Back",
    "sections": [
      {
        "title": "1. ACCEPTANCE OF TERMS",
        "content": "By accessing, browsing, or using the STARRYZ 5 platform and signing in with Google or as anonymous guest, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service."
      },
      {
        "title": "2. PURPOSE OF THE PLATFORM",
        "content": "STARRYZ 5 is a student and educational community network created to connect students and educational centers, supporting community ratings, student feed, moderated confessions, and interactive campus tools."
      },
      {
        "title": "3. ACCOUNT REGISTRATION & USE",
        "content": "Google Login: Authenticating with Google authorizes STARRYZ 5 to obtain your public name, email address, and avatar to establish your user identity.\\n\\nAnonymous Guest: Allows exploratory access without sharing personal credentials, stored locally on your device.\\n\\nProfile Claiming: Claiming pre-existing campus profiles requires institutional email confirmation."
      },
      {
        "title": "4. COMMUNITY STANDARDS",
        "content": "Harassment, cyberbullying, hate speech, and privacy violations are strictly forbidden. STARRYZ 5 reserves the right to suspend any account violating these community safety policies."
      },
      {
        "title": "5. ANONYMOUS CONFESSIONS & MODERATION",
        "content": "Confessions submitted are anonymous to users but filtered through moderation algorithms and community review. Defamatory speech or private info disclosure is strictly prohibited."
      },
      {
        "title": "6. RATINGS & CAMPUS POPULARITY",
        "content": "Star ratings and popularity counters reflect social campus interaction and do not represent official academic records or judgments by institutions."
      },
      {
        "title": "7. INTELLECTUAL PROPERTY",
        "content": "All STARRYZ 5 branding, design, UI components, and software code are the property of its authors. User-submitted media remains owned by creators under license for platform display."
      },
      {
        "title": "8. SERVICE MODIFICATIONS",
        "content": "STARRYZ 5 reserves the right to update or modify features to continuously optimize user experience."
      }
    ]
  },
  legal_privacy: {
    "title": "PRIVACY POLICY",
    "badge": "DATA PROTECTION",
    "updated": "Last updated: November 2026",
    "back": "Back",
    "sections": [
      {
        "title": "1. INFORMATION WE COLLECT",
        "content": "We only collect data strictly necessary to deliver the STARRYZ 5 experience: public name, email address, and profile photo provided via Google authentication."
      },
      {
        "title": "2. HOW WE USE YOUR INFORMATION",
        "content": "Information is used exclusively to: securely authenticate sessions, manage your public profile, calculate community interactions (followers, votes, reviews), and protect the community from harassment."
      },
      {
        "title": "3. ANONYMOUS GUESTS & CONFESSIONS",
        "content": "Anonymous guest browsing does not gather personal identities. In confessions, creator identities are strictly hidden from other campus members."
      },
      {
        "title": "4. DATA STORAGE & SECURITY",
        "content": "All data is stored in modern cloud infrastructure (Firebase / Supabase) adhering to industry-standard encryption protocols (HTTPS/TLS) and Row Level Security policies."
      },
      {
        "title": "5. COOKIES & LOCAL STORAGE",
        "content": "We use localStorage to remember your UI preferences, such as selected language (among 20 languages) and visual theme (Day, Night, or IESPPU)."
      },
      {
        "title": "6. YOUR RIGHTS",
        "content": "You retain full rights to access, update, or request deletion of your account and personal information at any time."
      }
    ]
  },
};
