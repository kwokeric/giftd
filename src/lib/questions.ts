// The question bank. Source of truth for wording is "giftd — Question Bank.md";
// keep the two in sync. Order matters: it is part of the cached system prompt.

import type { Option, Question } from "./types";

/** [id, label] or [id, label, fact] */
type Opt = [string, string] | [string, string, string];
const o = (...opts: Opt[]): Option[] =>
  opts.map(([id, label, fact]) => (fact ? { id, label, fact } : { id, label }));

// ---------------------------------------------------------------------------
// Fixed openers (Q1–Q3, always asked, in this order). Exempt from the 2–4 limit.
// ---------------------------------------------------------------------------

export const OPENERS: Question[] = [
  {
    id: "relationship",
    text: "Who are we shopping for?",
    options: o(
      ["partner", "Partner"],
      ["parent", "Parent"],
      ["grandparent", "Grandparent"],
      ["sibling", "Sibling"],
      ["friend", "Friend"],
      ["coworker", "Coworker"],
      ["kid", "Kid"],
      ["other", "Someone else"],
    ),
    category: "opener",
    priority: 10,
  },
  {
    id: "age",
    text: "Which one sounds most like them?",
    options: o(
      ["under_12", "Still has a bedtime", "probably under 12"],
      ["teen", "Communicates mostly in eye rolls", "probably 13–19"],
      ["20s", "Still uses a parent's streaming password", "probably in their 20s"],
      ["30s_40s", "Gets genuinely excited about a new vacuum", "probably 30s–40s"],
      ["50s_60s", "Groans when they sit down", "probably 50s–60s"],
      ["70_plus", "Signs their texts with their name", "probably 70+"],
    ),
    category: "opener",
    priority: 10,
  },
  {
    id: "budget",
    text: "What's the budget?",
    options: o(
      ["under_25", "Under $25"],
      ["25_50", "$25–50"],
      ["50_100", "$50–100"],
      ["100_250", "$100–250"],
      ["250_plus", "$250+"],
    ),
    category: "opener",
    priority: 10,
  },
];

export const OPENER_IDS = OPENERS.map((q) => q.id);

// ---------------------------------------------------------------------------
// Bank (Q4–Q10 are picked from here)
// ---------------------------------------------------------------------------

export const BANK: Question[] = [
  // Interests
  {
    id: "free_time",
    text: "Free afternoon, zero plans. What are they doing?",
    options: o(
      ["active", "Out and active"],
      ["making", "Making something"],
      ["media", "Gaming, watching or listening"],
      ["social", "Seeing people"],
    ),
    category: "interests",
    priority: 10,
  },
  {
    id: "active_type",
    text: "What gets them sweaty?",
    options: o(
      ["outdoors", "Hiking & camping"],
      ["gym", "Gym & fitness"],
      ["sports", "Team sports"],
      ["endurance", "Running or cycling"],
    ),
    category: "interests",
    priority: 8,
    when: { requires: { question: "free_time", options: ["active"] } },
  },
  {
    id: "maker_type",
    text: "What are they always making?",
    options: o(
      ["food", "Food & drinks"],
      ["art", "Art & crafts"],
      ["build", "Building & fixing"],
      ["garden", "Plants & garden"],
    ),
    category: "interests",
    priority: 8,
    when: { requires: { question: "free_time", options: ["making"] } },
  },
  {
    id: "media_type",
    text: "What are they glued to?",
    options: o(
      ["games", "Video games"],
      ["shows", "Movies & shows"],
      ["music", "Music"],
      ["internet", "Internet rabbit holes"],
    ),
    category: "interests",
    priority: 8,
    when: { requires: { question: "free_time", options: ["media"] } },
  },
  {
    id: "gaming_platform",
    text: "Where do the hours disappear?",
    options: o(
      ["pc", "PC"],
      ["console", "PlayStation / Xbox"],
      ["switch", "Nintendo Switch"],
      ["phone", "Phone"],
    ),
    category: "interests",
    priority: 6,
    when: { requires: { question: "media_type", options: ["games"] } },
  },
  {
    id: "social_type",
    text: "What's their idea of a big night?",
    options: o(
      ["hosting", "Hosting at home"],
      ["dining", "Eating & drinking out"],
      ["events", "Concerts & events"],
      ["travel", "Trips with friends"],
    ),
    category: "interests",
    priority: 8,
    when: { requires: { question: "free_time", options: ["social"] } },
  },
  {
    id: "food_drink",
    text: "Are they a snob about anything they eat or drink?",
    options: o(
      ["cook", "Cooking"],
      ["coffee", "Coffee or tea"],
      ["drinks", "Wine, beer or cocktails"],
      ["none", "Not really"],
    ),
    category: "interests",
    priority: 7,
    when: { minAge: "20s" },
  },
  {
    id: "reader",
    text: "Do they actually read, or just own books?",
    options: o(
      ["books", "Physical books"],
      ["digital", "Kindle / audiobooks"],
      ["articles", "Articles & newsletters"],
      ["no", "Not really"],
    ),
    category: "interests",
    priority: 5,
  },
  {
    id: "music_level",
    text: "How much do they talk about music?",
    options: o(
      ["plays", "Plays an instrument"],
      ["collector", "Collects vinyl"],
      ["live", "Goes to lots of concerts"],
      ["background", "It's background noise"],
    ),
    category: "interests",
    priority: 4,
  },
  {
    id: "sports_fan",
    text: "Do they yell at the TV on game day?",
    options: o(["diehard", "Diehard fan"], ["casual", "Casual fan"], ["no", "Not a sports person"]),
    category: "interests",
    priority: 5,
  },
  {
    id: "fandom",
    text: "Is there something they're a little too into?",
    options: o(
      ["franchise", "A movie or TV franchise"],
      ["anime", "Anime or comics"],
      ["artist", "A band or artist"],
      ["no", "Not really"],
    ),
    category: "interests",
    priority: 5,
  },
  {
    id: "pets",
    text: "Do they show you pet photos unprompted?",
    options: o(["dog", "Dog"], ["cat", "Cat"], ["other", "Another animal"], ["none", "No pets"]),
    category: "interests",
    priority: 6,
  },
  {
    id: "travel",
    text: "Always planning a trip, or happiest at home?",
    options: o(
      ["frequent", "Always planning a trip"],
      ["sometimes", "Now and then"],
      ["homebody", "Happiest at home"],
    ),
    category: "interests",
    priority: 6,
  },
  {
    id: "wellness",
    text: "How do they unwind?",
    options: o(
      ["pamper", "Spa & skincare"],
      ["fitness", "Workouts & step counts"],
      ["calm", "Meditation & sleep"],
      ["other", "They don't, really", "not a self-care person"],
    ),
    category: "interests",
    priority: 5,
    when: { minAge: "teen" },
  },
  {
    id: "tech",
    text: "Do they fix everyone's tech, or call you for help?",
    options: o(
      ["early", "Always has the newest gadget", "early adopter"],
      ["practical", "Uses what works"],
      ["averse", "Calls you for help", "avoids tech"],
    ),
    category: "interests",
    priority: 5,
  },
  {
    id: "style",
    text: "How would you describe their style?",
    options: o(
      ["minimal", "Minimal & neutral"],
      ["bold", "Bold & colorful"],
      ["classic", "Classic"],
      ["none", "Doesn't care"],
    ),
    category: "interests",
    priority: 4,
    when: { minAge: "teen" },
  },

  // Personality
  {
    id: "sentimental",
    text: "Would they cry at a gift, or ask for the receipt?",
    options: o(["sentimental", "Sentimental"], ["practical", "Practical"], ["both", "A bit of both"]),
    category: "personality",
    priority: 9,
  },
  {
    id: "old_soul",
    text: "Old soul or young at heart?",
    options: o(
      ["old_soul", "Old soul", "likes timeless, classic things"],
      ["young", "Young at heart", "into whatever's new"],
      ["both", "A bit of both"],
    ),
    category: "personality",
    priority: 6,
  },
  {
    id: "humor",
    text: "Would they laugh at a gag gift?",
    options: o(
      ["gag", "Love a gag gift"],
      ["useful_funny", "Funny but useful"],
      ["serious", "Keep it serious"],
    ),
    category: "personality",
    priority: 6,
  },
  {
    id: "adventurous",
    text: "Do they order the same thing every time?",
    options: o(
      ["habit", "Same thing every time", "creature of habit"],
      ["sometimes", "Depends", "somewhat adventurous"],
      ["always", "Always tries something new", "adventurous"],
    ),
    category: "personality",
    priority: 7,
  },
  {
    id: "energy",
    text: "After a party, are they energized or wiped out?",
    options: o(
      ["extrovert", "Energized", "extrovert"],
      ["introvert", "Wiped out", "introvert"],
      ["depends", "Depends"],
    ),
    category: "personality",
    priority: 5,
  },
  {
    id: "organized",
    text: "Do they own a label maker?",
    options: o(
      ["very", "Yes, and they use it", "very organized"],
      ["mostly", "Organized-ish"],
      ["chaos", "Total chaos", "disorganized"],
    ),
    category: "personality",
    priority: 4,
  },
  {
    id: "home_vibe",
    text: "What's their place like?",
    options: o(
      ["cozy", "Cozy"],
      ["modern", "Modern & minimal"],
      ["eclectic", "Full of stuff, eclectic"],
      ["bare", "Haven't really decorated"],
    ),
    category: "personality",
    priority: 5,
    when: { minAge: "20s", notRelationship: ["kid"] },
  },
  {
    id: "clutter",
    text: "Declutterer or collector?",
    options: o(
      ["minimalist", "Declutterer", "hates clutter"],
      ["normal", "Somewhere in between"],
      ["more", "Collector", "more is more"],
    ),
    category: "personality",
    priority: 6,
  },

  // Lifestyle
  {
    id: "work_style",
    text: "What's their work life like?",
    options: o(
      ["desk", "Desk job"],
      ["remote", "Works from home"],
      ["hands_on", "On their feet all day"],
      ["not_working", "Student or retired"],
    ),
    category: "lifestyle",
    priority: 6,
    when: { minAge: "teen" },
  },
  {
    id: "busy",
    text: "How fried are they right now?",
    options: o(["slammed", "Always slammed"], ["balanced", "Pretty balanced"], ["free", "Lots of free time"]),
    category: "lifestyle",
    priority: 5,
  },
  {
    id: "living",
    text: "What's their living situation?",
    options: o(["own", "Own place"], ["renting", "Renting"], ["roommates", "Roommates"], ["family", "With family"]),
    category: "lifestyle",
    priority: 4,
    when: { minAge: "20s" },
  },
  {
    id: "young_kids",
    text: "Do they have little kids at home?",
    options: o(["yes", "Yes"], ["no", "No"]),
    category: "lifestyle",
    priority: 6,
    when: { minAge: "20s", notRelationship: ["kid"] },
  },
  {
    id: "milestone",
    text: "Anything big happen lately?",
    options: o(
      ["new_home", "New home"],
      ["new_baby", "New baby"],
      ["new_job", "New job or school"],
      ["nothing", "Nothing new"],
    ),
    category: "lifestyle",
    priority: 7,
  },
  {
    id: "mobility",
    text: "How do they spend most days?",
    options: o(["very", "Out and about"], ["easy", "Taking it easy"], ["home", "Mostly at home"]),
    category: "lifestyle",
    priority: 8,
    when: { minAge: "70_plus" },
  },

  // Gift style
  {
    id: "has_everything",
    text: "Are they impossible to shop for?",
    options: o(
      ["impossible", "Yes, impossible"],
      ["mostly", "They have most things"],
      ["wants", "There's lots they'd want"],
    ),
    category: "gift_style",
    priority: 9,
  },
  {
    id: "bougie",
    text: "How bougie are they?",
    options: o(
      ["luxe", "Very, only the nice version"],
      ["nice", "Likes nice things"],
      ["down_to_earth", "Down to earth"],
      ["easy", "Happy with anything"],
    ),
    category: "gift_style",
    priority: 8,
  },
  {
    id: "gift_form",
    text: "What kind of gift feels right?",
    options: o(
      ["experience", "An experience"],
      ["keepsake", "Something to keep"],
      ["consumable", "Something to use up"],
      ["unsure", "Not sure"],
    ),
    category: "gift_style",
    priority: 9,
  },
  {
    id: "experience_type",
    text: "What would they actually show up for?",
    options: o(
      ["food", "Food & drink"],
      ["class", "A class"],
      ["adventure", "Something adventurous"],
      ["show", "A show or event"],
    ),
    category: "gift_style",
    priority: 8,
    when: { requires: { question: "gift_form", options: ["experience"] } },
  },
  {
    id: "consumable_type",
    text: "What would they happily use up?",
    options: o(
      ["treats", "Snacks & treats"],
      ["beverages", "Coffee, tea or drinks"],
      ["bath", "Bath & body"],
      ["subscription", "A subscription"],
    ),
    category: "gift_style",
    priority: 8,
    when: { requires: { question: "gift_form", options: ["consumable"] } },
  },
  {
    id: "practical_area",
    text: "Where's their life held together with tape?",
    options: o(
      ["kitchen", "Kitchen"],
      ["desk", "Work or desk"],
      ["on_the_go", "Car & commute"],
      ["routine", "Morning routine"],
    ),
    category: "gift_style",
    priority: 7,
    when: { requires: { question: "sentimental", options: ["practical"] } },
  },
  {
    id: "upgrade_or_new",
    text: "Upgrade something they use every day, or try something new?",
    options: o(["upgrade", "Upgrade a daily thing"], ["new", "Something new"], ["either", "Either"]),
    category: "gift_style",
    priority: 7,
  },
  {
    id: "personalized",
    text: "Their name on a gift: sweet or cringe?",
    options: o(
      ["love", "Sweet", "would love something personalized"],
      ["subtle", "Only if subtle"],
      ["no", "Cringe", "no personalized gifts"],
    ),
    category: "gift_style",
    priority: 5,
  },
  {
    id: "values",
    text: "Do they care where things come from?",
    options: o(["local", "Handmade or local"], ["eco", "Eco-friendly"], ["no", "Doesn't matter"]),
    category: "gift_style",
    priority: 4,
    when: { minAge: "teen" },
  },
  {
    id: "last_gift",
    text: "How did your last gift for them go? Be honest.",
    options: o(["hit", "Huge hit"], ["fine", "Fine"], ["flop", "Flopped"], ["first", "First gift"]),
    category: "gift_style",
    priority: 5,
  },
  {
    id: "group_gift",
    text: "Is this from just you or a group?",
    options: o(["solo", "Just me"], ["couple", "A couple of us"], ["group", "A whole group"]),
    category: "gift_style",
    priority: 3,
  },

  // Situational
  {
    id: "couple_stage",
    text: "How long have you been together?",
    options: o(["new", "Just started"], ["few_years", "1–5 years"], ["long", "5+ years"]),
    category: "situational",
    priority: 9,
    when: { relationship: ["partner"] },
  },
  {
    id: "couple_vibe",
    text: "Romantic, something together, or just for them?",
    options: o(
      ["romantic", "Romantic"],
      ["shared", "Something to do together"],
      ["just_them", "Something just for them"],
    ),
    category: "situational",
    priority: 8,
    when: { relationship: ["partner"] },
  },
  {
    id: "coworker_closeness",
    text: "Actual friends or just Slack friends?",
    options: o(["barely", "Barely know them"], ["friendly", "Friendly"], ["close", "Work bestie"]),
    category: "situational",
    priority: 10,
    when: { relationship: ["coworker"] },
  },
  {
    id: "kid_interest",
    text: "What are they obsessed with this week?",
    options: o(
      ["build", "Building & science"],
      ["art", "Arts & crafts"],
      ["play", "Sports & outdoors"],
      ["screens", "Games & screens"],
    ),
    category: "situational",
    priority: 10,
    when: { maxAge: "under_12" },
    excludes: ["free_time"],
  },
  {
    id: "kid_reading",
    text: "Do they like books?",
    options: o(["loves", "Loves books"], ["some", "Sometimes"], ["no", "Not really"]),
    category: "situational",
    priority: 5,
    when: { maxAge: "under_12" },
  },
  {
    id: "teen_vibe",
    text: "What's their whole personality right now?",
    options: o(
      ["fashion", "Fashion & beauty"],
      ["gaming", "Gaming"],
      ["sports", "Sports"],
      ["creative", "Music & art"],
    ),
    category: "situational",
    priority: 10,
    when: { minAge: "teen", maxAge: "teen" },
    excludes: ["free_time"],
  },
  {
    id: "wedding_angle",
    text: "What kind of wedding gift?",
    options: o(
      ["home", "Something for the home"],
      ["experience", "An experience for two"],
      ["keepsake", "Something sentimental"],
    ),
    category: "situational",
    priority: 9,
    when: { occasion: ["wedding"] },
  },
  {
    id: "graduation_next",
    text: "What's next for them?",
    options: o(["college", "College"], ["job", "First job"], ["moving", "Moving away"], ["unsure", "Figuring it out"]),
    category: "situational",
    priority: 9,
    when: { occasion: ["graduation"] },
  },
  {
    id: "thank_you_for",
    text: "What are you thanking them for?",
    options: o(
      ["favor", "A big favor"],
      ["hosting", "Hosting you"],
      ["work", "Help at work"],
      ["general", "Just being great"],
    ),
    category: "situational",
    priority: 9,
    when: { occasion: ["thank_you"] },
  },
  {
    id: "new_parent_gift",
    text: "For the baby, or for the exhausted parents?",
    options: o(["baby", "For the baby"], ["parents", "For the parents"], ["both", "Both"]),
    category: "situational",
    priority: 8,
    when: { requires: { question: "milestone", options: ["new_baby"] } },
  },
  {
    id: "new_home_need",
    text: "What's the new place missing?",
    options: o(["decor", "Decor"], ["kitchen", "Kitchen"], ["comfort", "Comfort"], ["tools", "Tools & basics"]),
    category: "situational",
    priority: 8,
    when: { requires: { question: "milestone", options: ["new_home"] } },
  },
];

export const ALL_QUESTIONS: Question[] = [...OPENERS, ...BANK];
export const QUESTIONS_BY_ID: ReadonlyMap<string, Question> = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS_BY_ID.get(id);
}
