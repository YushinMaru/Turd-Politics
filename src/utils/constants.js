module.exports = {
  // Embed colors
  COLORS: {
    PRIMARY: 0x5865F2,    // Discord blurple
    SUCCESS: 0x57F287,    // Green
    ERROR: 0xED4245,      // Red
    WARNING: 0xFEE75C,    // Yellow
    INFO: 0x5865F2,       // Blurple
    VOTE: 0xEB459E,       // Pink
    WINNER: 0xFFD700,     // Gold
    PROFILE: 0x9B59B6,    // Purple
    TOURNAMENT: 0xE67E22, // Orange
    FUN: 0x1ABC9C,        // Teal
  },

  // Points awarded for actions
  POINTS: {
    CREATE_TOPIC: 5,
    PARTICIPATE: 2,
    WIN_DEBATE: 15,
    BS_CALL_COST: 5,       // Deducted from caller
    TOURNAMENT_WIN: 30,
  },

  // Role thresholds
  ROLES: {
    DEBATER: { debates: 1, label: 'Debater' },
    VETERAN: { debates: 5, label: 'Veteran Debater' },
    CHAMPION: { wins: 3, label: 'Champion' },
    TOPIC_CREATOR: { topics: 5, label: 'Topic Creator' },
  },

  // Debate statuses
  STATUS: {
    OPEN: 'open',
    VOTING: 'voting',
    CLOSED: 'closed',
    ARCHIVED: 'archived',
  },

  // Vote options
  VOTE: {
    SIDE_A: 'side_a',
    SIDE_B: 'side_b',
    DRAW: 'draw',
  },

  // Tournament statuses
  TOURNAMENT_STATUS: {
    SIGNUP: 'signup',
    ACTIVE: 'active',
    COMPLETE: 'complete',
  },

  // Random debate topics (100+)
  RANDOM_TOPICS: [
    'Should voting be mandatory for all eligible citizens?',
    'Is universal basic income a viable economic policy?',
    'Should the death penalty be abolished?',
    'Is capitalism the best economic system available?',
    'Should college education be free for all citizens?',
    'Is social media doing more harm than good to democracy?',
    'Should there be term limits for all elected officials?',
    'Is immigration net positive for host countries?',
    'Should drugs be decriminalized or legalized?',
    'Is the two-party political system broken?',
    'Should gun ownership be more strictly regulated?',
    'Is affirmative action still necessary?',
    'Should there be a wealth cap or maximum wage?',
    'Is climate change legislation being prioritized enough?',
    'Should the voting age be lowered to 16?',
    'Is free speech absolute or should there be limits?',
    'Should lobbying be banned in government?',
    'Is the media too biased to be trusted?',
    'Should healthcare be a guaranteed right?',
    'Is the military budget too large?',
    'Should the electoral college be abolished?',
    'Is political correctness stifling free speech?',
    'Should there be stricter regulations on big tech?',
    'Is nuclear energy the solution to climate change?',
    'Should religious beliefs influence law-making?',
    'Is the war on drugs a failure?',
    'Should welfare programs be expanded or cut?',
    'Is globalization good for working class people?',
    'Should the minimum wage be raised to a living wage?',
    'Is cancel culture harmful to society?',
    'Should prison be about punishment or rehabilitation?',
    'Is democracy the best form of government?',
    'Should the US have stricter foreign policy?',
    'Is student loan debt a personal responsibility or systemic failure?',
    'Should political donations be capped or banned?',
    'Is universal healthcare fiscally realistic?',
    'Should the police be defunded and reformed?',
    'Is the justice system biased against minorities?',
    'Should genetically modified organisms (GMOs) be banned?',
    'Is the UN an effective global organization?',
    'Should there be a global government?',
    'Is Brexit a success or failure?',
    'Should social media companies be liable for user content?',
    'Is the American dream still achievable?',
    'Should billionaires exist?',
    'Is cancel culture just accountability?',
    'Should the federal reserve be abolished?',
    'Is privacy a right that should override national security?',
    'Should voting machines replace paper ballots?',
    'Is the political establishment too corrupt to reform from within?',
    'Should countries prioritize their own citizens over foreign aid?',
    'Is patriotism healthy or harmful?',
    'Should AI be regulated by governments?',
    'Is automation a threat to employment?',
    'Should the internet be treated as a public utility?',
    'Is the United Nations Human Rights Council effective?',
    'Should zoos and animal captivity be banned?',
    'Is political polarization the biggest threat to democracy?',
    'Should there be limits on how many terms a president can serve?',
    'Is the gig economy exploitative?',
    'Should governments be allowed to censor the internet?',
    'Is nuclear weapons deterrence a stable strategy?',
    'Should reparations be paid for historical injustices?',
    'Is the welfare state creating dependency?',
    'Should all workers have the right to strike?',
    'Is gentrification good or bad for cities?',
    'Should the legal voting age be raised to 21?',
    'Is the UN Security Council veto system fair?',
    'Should there be a flat tax or progressive tax system?',
    'Is civil disobedience ever justified?',
    'Should there be a universal basic income?',
    'Is the current immigration system broken?',
    'Should political parties be banned?',
    'Is the media responsible for political polarization?',
    'Should corporations have the same rights as individuals?',
    'Is free trade good for all nations equally?',
    'Should the police have qualified immunity?',
    'Is money in politics the root of political corruption?',
    'Should there be term limits on Supreme Court justices?',
    'Is democracy declining globally?',
    'Should states have more power than the federal government?',
    'Is the current tax code fair?',
    'Should homeschooling be regulated more strictly?',
    'Is cancel culture a form of censorship?',
    'Should pharmaceutical prices be regulated by the government?',
    'Is the stock market a fair representation of the economy?',
    'Should governments invest more in space exploration?',
    'Is civil liberties vs security a false dilemma?',
    'Should the two-party system be replaced with proportional representation?',
    'Is climate change mitigation worth the economic cost?',
    'Should there be universal preschool?',
    'Is the criminal justice system in need of radical reform?',
    'Should social media influencers be regulated?',
    'Is NATO still relevant today?',
    'Should the US rejoin the Paris Climate Agreement?',
    'Is the gig economy the future of work?',
    'Should governments bail out failing industries?',
    'Is meritocracy a myth?',
    'Should voting be done online?',
    'Is political apathy a bigger threat than extremism?',
    'Should there be a right to housing?',
  ],
};
