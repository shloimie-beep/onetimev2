export const campaign = {
  id: 'free-until-rosh-hashanah-2026',
  timezone: 'Asia/Jerusalem',
  deadlineDate: '2026-09-11',
  label: 'JOIN NOW — FREE UNTIL ROSH HASHANAH',
};

export const landingContent = {
  seo: {
    title: 'Give Your Son A Love For Learning Torah | One Time Mishnayos',
    description:
      'A live worldwide Mishnayos class with Rabbi Eli Scheller, built for boys to love learning Torah with clarity, excitement, and steady progress.',
    canonical: 'https://join.onetimeonetime.com/',
    ogTitle: 'Give your son a love for learning Torah.',
    ogDescription: 'Join One Time Mishnayos live from Eretz Yisrael with Rabbi Eli Scheller.',
  },
  hero: {
    kickerLines: ['WORLDWIDE MISHNAH LEARNING', 'LIVE FROM ERETZ YISRAEL'],
    heading: 'Give your son a love for learning Torah.',
    schedule: 'Live every day at 7:00 p.m. Israel time.',
  },
  receive: {
    heading: 'Everything He Needs to Learn, Review, and Remember',
    eyebrow: 'A COMPLETE DIGITAL TORAH-LEARNING EXPERIENCE',
    iconLabel: 'Live class',
    title: 'Live Daily Mishnayos—plus the tools to make it stick.',
    bullets: [
      {
        lead: 'LIVE EVERY DAY',
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
        image: '/assets/rabbi/teaching-locations/rabbi-scheller-atlanta-georgia.webp',
        alt: 'Rabbi Scheller teaching students in Atlanta, Georgia',
        assetBlocker: null,
        provisionalCopy: null,
      },
      {
        title: 'Retention',
        body: 'Replays and review sheets help him remember the learning instead of forgetting it after class.',
        image: '/assets/students/smiley-kid.png',
        alt: 'Smiling One Time Mishnayos student',
        assetBlocker: null,
        provisionalCopy: null,
      },
      {
        title: 'Progress',
        body: 'A clear daily rhythm gives him momentum, accomplishment, and something real to build on.',
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
    body: 'Sign up, get the class information, and join the daily 7:00 p.m. live Mishnayos class.',
    steps: ['Sign up', 'Receive the class information', 'Enjoy the live class'],
  },
  who: {
    heading: 'A Ready-to-Run Mishnayos Class—Wherever Your Son Learns',
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
    ],
  },
  rabbi: {
    eyebrow: 'Meet Rabbi Scheller',
    heading: 'A world-renowned Torah teacher.',
    body: 'Rabbi Eli Scheller has taught Torah to students and audiences across the Jewish world. His clarity, warmth, and energy help boys understand what they are learning and look forward to coming back.',
  },
  gallery: {
    heading: 'Teaching Torah Across the Jewish World',
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
      ['Member Login', '/login'],
    ],
  },
} as const;

export const sharedNav = [
  ['What You Receive', '#receive'],
  ["What He'll Gain", '#gain'],
  ['How It Works', '#how-it-works'],
  ["Who It's For", '#who'],
  ['Rabbi Scheller', '#rabbi'],
  ['Member Login', '/login'],
] as const;
