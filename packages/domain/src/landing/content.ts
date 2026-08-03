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
    eyebrow: 'LIVE ONLINE + ON-DEMAND',
    titleLines: ['HELP YOUR SON', 'LOVE LEARNING', 'MISHNAYOS'],
    supporting:
      'A fast-paced live-streamed class with Rabbi Eli Scheller. The boys complete one perek each class day, with clear explanations and review so they understand and remember what they learn.',
    schedule: 'LIVE SUNDAY–THURSDAY · 7:00 PM ISRAEL TIME',
    firstClass: 'Class begins Sunday, August 16, 2026 at 7:00 PM Asia/Jerusalem.',
    freeAccessCutoff: 'Free access cutoff: Friday, September 11, 2026 at 6:00 PM Asia/Jerusalem.',
    cta: {
      label: 'Pre-register Your Family',
      href: '/signup',
      analyticsEvent: 'landing.signup.cta.clicked',
      analyticsPlacement: 'hero',
    },
    note: 'Adult email only • No Student details • No credit card or automatic charge',
    kickerLines: ['LIVE ONLINE', 'ON-DEMAND REVIEW'],
    heading: 'Mishnayos made memorable.',
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
        body: 'Daily reminders help keep the learning consistent.',
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
        body: 'A clear daily rhythm gives him confidence, consistent progress, and something real to build on.',
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
    body: 'Pre-register one adult contact now. The One Time team will follow up when Family portal access is ready.',
    steps: [
      'Pre-register the adult Family contact',
      'Receive a personal access-readiness follow-up',
      'Add separate Student seats only after secure access opens',
    ],
  },
  who: {
    heading: 'A Ready-to-Run Mishnayos Class—Wherever You Learn',
    audiences: [
      {
        lead: 'FAMILIES',
        body: 'A dependable daily Torah-learning routine without having to build the entire program yourself.',
      },
      {
        lead: 'HOMESCHOOLERS',
        body: 'A real live class, connection with a rabbi, and a wider learning community.',
      },
      {
        lead: 'LOCAL STUDENTS',
        body: "Join Rabbi Scheller's daily learning community from Ramat Beit Shemesh.",
      },
      {
        lead: 'ADULT LEARNERS',
        body: 'An adult may learn as a Student by creating a separate Student seat inside the Family account.',
      },
    ],
  },
  experience: {
    heading: 'One protected place for live class and review',
    intro:
      'The member experience keeps the embedded live class, protected on-demand library, schedules, and progress together after sign-in.',
    cards: [
      {
        title: 'Live class',
        body: 'Open the protected classroom from your portal at class time. Access details stay inside the signed-in experience.',
      },
      {
        title: 'On-demand library',
        body: 'Return to approved class recordings and review materials anytime through the protected library.',
      },
      {
        title: 'Family and Student views',
        body: 'Adults manage access from the Family portal; each learner uses a separate Student seat. Student email is not required.',
      },
    ],
  },
  participation: {
    heading: 'What you need for class',
    bullets: [
      'Use a current desktop or mobile browser with a stable internet connection and working audio.',
      'A camera is optional unless the class team gives a specific participation instruction; learners can still follow the lesson without broadcasting video.',
      'Live sessions are moderated. Class recordings may be made available in the protected library; recording and recognition choices follow the published notices and operator controls.',
    ],
  },
  enrollment: {
    heading: 'Pre-register your Family',
    family: {
      title: 'Family',
      body: 'Save one adult contact for launch follow-up. This does not yet create an account or learner seat, and no Student information is collected.',
    },
  },
  access: {
    heading: 'Pre-registration and future access',
    before:
      'Pre-register an adult contact during the configured free-access period. No credit card is collected, and portal access is not created by this form.',
    after:
      'Pre-registration remains cardless. If paid Family access is offered later, it is $67/month through a separate secure hosted billing flow; this form creates no charge.',
  },
  assurances: {
    heading: 'Clear expectations before you join',
    items: [
      {
        title: 'Privacy and Student data',
        body: 'This pre-registration collects adult contact details only. Review the Privacy Notice now; Student data is requested only after secure Family access is ready.',
      },
      {
        title: 'Cancellation and refunds',
        body: 'Review the Terms for cancellation and refund rules before paid continuation. Billing changes use the hosted account flow.',
      },
      {
        title: 'Login and support',
        body: 'Existing members can sign in from Member Login. For access or account help, use the Support path; WhatsApp is not an active launch support channel.',
      },
    ],
  },
  rabbi: {
    eyebrow: 'Meet Rabbi Scheller',
    heading: 'A world-renowned Torah teacher.',
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
    heading: 'Ready to pre-register your Family?',
  },
  footer: {
    line: 'One Time Mishnayos with Rabbi Eli Scheller.',
    links: [
      ['Home', '/'],
      ['Pre-register', '/signup'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Student Data', '/student-data'],
      ['Member Login', '/login'],
      ['Support', '/support'],
    ],
  },
} as const;

export const sharedNav = [
  ['What You Receive', '#receive'],
  ['Experience', '#experience'],
  ["Who It's For", '#who'],
  ['How It Works', '#how-it-works'],
  ['Pricing', '#access'],
  ['Rabbi Scheller', '#rabbi'],
  ['Member Login', '/login'],
] as const;
