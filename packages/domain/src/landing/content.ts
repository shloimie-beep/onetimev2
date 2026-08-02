export const campaign = {
  id: 'configured-free-access',
  timezone: 'Asia/Jerusalem',
  label: 'FREE ACCESS',
};

export const landingContent = {
  seo: {
    title: 'Mishnayos Made Memorable | One Time Mishnayos',
    description: 'Join Rabbi Eli Scheller live from anywhere, then review every class anytime.',
    canonical: 'https://join.onetimeonetime.com/',
    ogTitle: 'Mishnayos Made Memorable',
    ogDescription: 'Join Rabbi Eli Scheller live from anywhere, then review every class anytime.',
  },
  hero: {
    eyebrow: 'LIVE ONLINE + ON-DEMAND',
    titleLines: ['MISHNAYOS', 'MADE MEMORABLE'],
    supporting: 'Join Rabbi Eli Scheller live from anywhere, then review every class anytime.',
    schedule: 'Sunday–Thursday at 7:00 PM Jerusalem time',
    cta: {
      label: 'JOIN FREE',
      href: '/signup',
      analyticsEvent: 'landing.signup.cta.clicked',
      analyticsPlacement: 'hero',
    },
    note: 'No credit card • Up to three learners per family',
    kickerLines: ['LIVE ONLINE', 'ON-DEMAND REVIEW'],
    heading: 'Mishnayos made memorable.',
  },
  receive: {
    heading: 'Everything He Needs to Learn, Review, and Remember',
    detailLine: 'Live Sunday–Thursday at 7:00 p.m. Jerusalem time.',
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
    body: 'Create a Family account, add up to three learner seats, and join live or review securely on demand.',
    steps: [
      'Create the adult Family account',
      'Add separate Student seats',
      'Join live or review on demand',
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
        lead: 'SCHOOLS',
        body: 'Add a complete live Mishnayos class to the school day.',
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
    heading: 'Choose the right entry',
    family: {
      title: 'Family',
      body: 'Create one adult-managed account with up to three learner seats. The adult supplies the account email; Student email is not required.',
    },
    school: {
      title: 'School',
      body: 'Send a School inquiry for manual follow-up. A School inquiry does not create learner access, enroll an audience, or start messages.',
    },
  },
  access: {
    heading: 'Family access and billing',
    before:
      'Create a Family account without a credit card during the configured free-access period.',
    after:
      'After the free period, continued Family access is $67/month through the secure hosted billing flow. Creating an account does not charge a card.',
  },
  assurances: {
    heading: 'Clear expectations before you join',
    items: [
      {
        title: 'Privacy and Student data',
        body: 'Review the Privacy Notice, Terms, and Parent/Guardian and Student Data Notice before creating learner seats.',
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
    heading: 'Ready to join the live class?',
  },
  footer: {
    line: 'One Time Mishnayos with Rabbi Eli Scheller.',
    links: [
      ['Home', '/'],
      ['Sign Up Now', '/signup'],
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
