export const campaign = {
  id: 'free-until-rosh-hashanah-2026',
  timezone: 'Asia/Jerusalem',
  deadlineDate: '2026-09-11',
  label: 'JOIN FREE UNTIL ROSH HASHANAH',
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
    kicker: 'Worldwide Mishnah learning - live from Eretz Yisrael',
    heading: 'Give your son a love for learning Torah.',
    schedule: 'Live every day at 7:00 p.m. Israel time.',
  },
  receive: {
    heading: 'What You Receive',
    iconLabel: 'Live class',
    title: 'Live Daily Mishnayos',
    bullets: [
      'Engaging hybrid streaming class from Eretz Yisrael',
      'Online class library for review and catching up on missed classes',
      'Secure student portal - gamified access to Rabbi Scheller and student-scoped updates',
      'Parent portal - admin updates and access to tech help',
      'Weekly review sheets',
      'Daily reminders - stay in the loop and up to date',
    ],
    highlightedPrefix: 'Secure student portal',
  },
  gain: {
    heading: "What He'll Gain",
    cards: [
      {
        title: 'Clarity',
        body: "He'll understand the main points, the questions, and the logic behind each Mishnah - with review sheets and opportunities to ask Rabbi Scheller questions.",
        image: '/assets/outcomes/clarity-class.webp',
        alt: 'Rabbi Scheller teaching boys around a classroom table',
        assetBlocker: null,
        provisionalCopy: null,
      },
      {
        title: 'Accomplishment',
        body: "One perek a day gives him a clear goal, steady progress, and a real sense of finishing each day's learning.",
        image: null,
        alt: '',
        assetBlocker:
          'Toronto.jpg was explicitly assigned for Accomplishment but was not present in the BNA repo or Downloads search. This card intentionally does not substitute Lakewood or another image.',
        provisionalCopy:
          'This paragraph is the currently deployed accomplishment copy preserved provisionally; it is not operator-certified final copy.',
      },
      {
        title: 'Excitement for learning Torah',
        body: 'A lively class and a real connection with Rabbi Scheller make Torah learning something he looks forward to each day.',
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
    heading: "Who It's For",
    body: 'Built for families, homeschoolers, schools, and local boys who want a clear daily Mishnayos rhythm.',
    audiences: [
      'Families',
      'English-speaking homeschoolers',
      'Schools',
      'Local boys in Ramat Beit Shemesh Alef',
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
      [
        'Atlanta, Georgia',
        'Rabbi Scheller teaching a large student group.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-atlanta-georgia.webp',
      ],
      [
        'Baltimore, Maryland',
        'Large live teaching session with students.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-baltimore-maryland.webp',
      ],
      [
        'Flatbush, New York',
        'Students gathered for Torah learning.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-flatbush-ny.webp',
      ],
      [
        'Hollywood, Florida',
        'Classroom teaching with engaged boys.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-hollywood-florida.webp',
      ],
      [
        'Lakewood, New Jersey',
        'Evening Torah gathering with Rabbi Scheller.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-lakewood-nj.webp',
      ],
      [
        'Miami, Florida',
        'Large outdoor teaching event.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-miami-florida.webp',
      ],
      [
        'Philadelphia, Pennsylvania',
        'Rabbi Scheller speaking to a full room.',
        '/assets/rabbi/teaching-locations/rabbi-scheller-philadelphia.webp',
      ],
      [
        'Silver Spring, Maryland',
        'Classroom learning with Rabbi Scheller.',
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
