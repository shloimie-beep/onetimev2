export const campaign = {
  id: 'configured-free-access',
  timezone: 'Asia/Jerusalem',
  label: 'FREE ACCESS',
};

export const landingContent = {
  seo: {
    title: 'Help Your Son Love Learning Mishnayos | One Time Mishnayos',
    description:
      'A fast-paced live-streamed class with Rabbi Eli Scheller, with clear explanations and review so boys understand and remember what they learn.',
    canonical: 'https://join.onetimeonetime.com/',
    ogTitle: 'Help Your Son Love Learning Mishnayos',
    ogDescription:
      'A fast-paced live-streamed class with Rabbi Eli Scheller. One perek each class day, with clear explanations and review.',
  },
  hero: {
    eyebrow: 'LIVE, ONLINE + ON-DEMAND',
    headline: 'Help your son love learning Mishnayos.',
    cta: {
      label: 'Create your Family account',
      href: '/signup',
      analyticsEvent: 'landing.signup.cta.clicked',
      analyticsPlacement: 'hero',
    },
    image: '/assets/rabbi/rabbi-eli-holding-book.jpg',
    imageAlt: 'Rabbi Eli Scheller holding the One Time Mishnayos book',
  },
  receive: {
    heading: 'Everything He Needs to Learn, Review, and Remember',
    detailLine:
      'Live Sunday–Thursday at 7:00 p.m. Israel time, completing one perek each class day.',
    eyebrow: 'A COMPLETE DIGITAL TORAH-LEARNING EXPERIENCE',
    iconLabel: 'Live class',
    title: 'Live Mishnayos—plus the tools to make it stick.',
    bullets: [
      {
        lead: 'LIVE SUNDAY–THURSDAY',
        body: 'Join Rabbi Scheller for a clear, engaging Mishnayos class.',
      },
      {
        lead: 'REVIEW ANYTIME',
        body: 'Catch up or review through the online class library.',
      },
      {
        lead: 'REMEMBER THE LEARNING',
        body: 'Weekly review sheets reinforce the important ideas.',
      },
      {
        lead: 'STAY ON TRACK',
        body: 'Sunday-through-Thursday reminders help keep the learning consistent.',
      },
      {
        lead: 'STUDENT PORTAL',
        body: 'Classes, updates, rewards, and questions in one secure place.',
      },
      {
        lead: 'PARENT PORTAL',
        body: 'Schedule, progress, access, and support in one place.',
      },
    ],
  },
  gain: {
    heading: "What He'll Gain",
    intro: 'Real understanding. Stronger memory. Steady progress. A genuine love for learning.',
    cards: [
      {
        title: 'Clarity',
        body: 'He understands what the Mishnah is saying, the questions being asked, and how the ideas fit together.',
        image: '/assets/outcomes/clarity-class.webp',
        alt: 'Clear Mishnah class materials and review notes',
        assetBlocker: null,
        provisionalCopy: null,
      },
      {
        title: 'Retention',
        body: 'Replays and review sheets help him remember the learning and return to the key ideas with confidence.',
        image: '/assets/outcomes/retention-review-class-720.webp',
        srcset:
          '/assets/outcomes/retention-review-class-480.webp 480w, /assets/outcomes/retention-review-class-720.webp 720w, /assets/outcomes/retention-review-class-945.webp 945w',
        sizes: '(max-width: 820px) calc(100vw - 44px), 540px',
        alt: 'Rabbi Scheller teaching beside a large classroom display with Mishnayos sefarim on the table',
        assetBlocker: null,
        provisionalCopy: null,
      },
      {
        title: 'Progress',
        body: 'A clear Sunday-through-Thursday rhythm gives him confidence, consistent progress, and something real to build on.',
        image: '/assets/outcomes/accomplishment-toronto-class.jpg',
        alt: 'Rabbi Scheller smiling with boys after a Toronto One Time Torah class',
        assetBlocker: null,
        provisionalCopy: null,
      },
      {
        title: 'A Love of Learning',
        body: "Rabbi Scheller's energy and personal connection make Torah learning something he looks forward to.",
        image: '/assets/outcomes/excitement-learning-torah.webp',
        alt: 'Boys engaged in Torah learning',
        assetBlocker: null,
        provisionalCopy: null,
      },
    ],
  },
  how: {
    heading: 'How It Works',
    body: 'A parent manages the Family account. Each Student learns in a separate protected space.',
    flows: [
      {
        title: 'Create your Family account',
        body: 'A parent creates the Family account and adds up to three separate Student logins.',
        image: '/assets/how-it-works/parent-creates-student-login-1254.webp',
        srcset:
          '/assets/how-it-works/parent-creates-student-login-480.webp 480w, /assets/how-it-works/parent-creates-student-login-800.webp 800w, /assets/how-it-works/parent-creates-student-login-1254.webp 1254w',
        sizes: '(max-width: 720px) calc(100vw - 44px), 560px',
        width: 1254,
        height: 1254,
        alt: 'A parent and child creating the child’s separate One Time Student login',
      },
      {
        title: 'Your child learns in his own space',
        body: 'Each Student signs in separately to join live class, watch replays, review, and ask questions.',
        image: '/assets/how-it-works/student-uses-mishnah-lesson-1254.webp',
        srcset:
          '/assets/how-it-works/student-uses-mishnah-lesson-480.webp 480w, /assets/how-it-works/student-uses-mishnah-lesson-800.webp 800w, /assets/how-it-works/student-uses-mishnah-lesson-1254.webp 1254w',
        sizes: '(max-width: 720px) calc(100vw - 44px), 560px',
        width: 1254,
        height: 1254,
        alt: 'A Student using a tablet to learn a colorful Mishnah lesson',
      },
    ],
  },
  who: {
    heading: 'A Ready-to-Run Mishnayos Class—Wherever You Learn',
    audiences: [
      {
        lead: 'FAMILIES',
        body: 'A dependable Sunday-through-Thursday Torah-learning routine without having to build the entire program yourself.',
      },
      {
        lead: 'HOMESCHOOLERS',
        body: 'A real live class, connection with a rabbi, and a wider learning community.',
      },
      {
        lead: 'LOCAL STUDENTS',
        body: "Join Rabbi Scheller's Sunday-through-Thursday learning community from Ramat Beit Shemesh.",
      },
      {
        lead: 'ADULT LEARNERS',
        body: 'An adult may learn as a Student by creating a separate Student seat inside the Family account.',
      },
    ],
  },
  rabbi: {
    eyebrow: 'Meet Rabbi Scheller',
    heading: 'Clear Torah teaching with warmth and energy.',
    body: 'Rabbi Eli Scheller has taught Torah to students and audiences across the Jewish world. His clarity, warmth, and energy help boys understand what they are learning and look forward to coming back.',
  },
  gallery: {
    heading: 'Seen Across the Jewish World',
    slides: [
      ['Atlanta, Georgia', '/assets/rabbi/teaching-locations/rabbi-scheller-atlanta-georgia.webp'],
      [
        'Baltimore, Maryland',
        '/assets/rabbi/teaching-locations/rabbi-scheller-baltimore-maryland.webp',
      ],
      ['Flatbush, New York', '/assets/rabbi/teaching-locations/rabbi-scheller-flatbush-ny.webp'],
      [
        'Hollywood, Florida',
        '/assets/rabbi/teaching-locations/rabbi-scheller-hollywood-florida.webp',
      ],
      ['Lakewood, New Jersey', '/assets/rabbi/teaching-locations/rabbi-scheller-lakewood-nj.webp'],
      ['Miami, Florida', '/assets/rabbi/teaching-locations/rabbi-scheller-miami-florida.webp'],
      [
        'Philadelphia, Pennsylvania',
        '/assets/rabbi/teaching-locations/rabbi-scheller-philadelphia.webp',
      ],
      [
        'Silver Spring, Maryland',
        '/assets/rabbi/teaching-locations/rabbi-scheller-silver-spring.webp',
      ],
    ],
  },
  press: [
    ['TorahAnytime', '/assets/press/torah-anytime.png'],
    ['24Six', '/assets/press/24six.png'],
    ['The Loop', '/assets/press/the-loop.png'],
    ['NakiRadio', '/assets/press/naki.webp'],
    ['Mishpacha', '/assets/press/mishpacha.webp'],
  ],
  finalCta: {
    heading: 'Ready to start learning?',
  },
  footer: {
    line: 'One Time Mishnayos with Rabbi Eli Scheller.',
    links: [
      ['Home', '/'],
      ['Create your Family account', '/signup'],
      ['Privacy Notice', '/privacy'],
      ['Terms', '/terms'],
      ['Cancellation and refunds', '/cancellation-refund'],
      ['Student Data Notice', '/student-data'],
      ['Member Login', '/login'],
      ['Support', '/support'],
    ],
  },
} as const;

export const sharedNav = [
  ['What You Receive', '#receive'],
  ["Who It's For", '#who'],
  ['How It Works', '#how-it-works'],
  ['Rabbi Scheller', '#rabbi'],
  ['Member Login', '/login'],
] as const;
