# giftd — Question Bank

Third pass · 3 fixed openers + 52 bank questions

These are all the questions giftd can ask. On each turn the server removes the questions that don't apply. Claude then picks the most useful one left by ID, or decides it's ready to recommend gifts. Claude never writes questions itself. In Phase 1 this file becomes `src/lib/questions.ts`.

## Voice

Funny like a friend who knows the person, not like a brand mascot. The gifts are never a joke.

- **Specific, recognizable behavior over hype labels.** "Groans when they sit down" is funny because you can picture it. "Certified legend" is just a slogan.
- **The joke goes in the question; options stay plain.** Options are tapped fast, so they should be scannable: "Diehard fan · Casual fan · Not a sports person". The exception is the age question, where the behaviors *are* the options.
- **A little ambiguity is fine.** No explanatory hints under options. If a joke option is a bit open to interpretation, that's part of the fun.
- **Playful, never mean.** Tease habits everyone recognizes, not the giver or the recipient.
- **PG.** Fine for a teenager shopping for their grandma.
- **Timeless, not trendy.** No memes, slang or current-events references. The app should feel just as fresh in a few years.
- **Every option still maps to a real fact.** The data behind each option is what Claude reasons from.

## Schema

```ts
type AgeBand = "under_12" | "teen" | "20s" | "30s_40s" | "50s_60s" | "70_plus"; // ordered
type Relationship = "partner" | "parent" | "grandparent" | "sibling" | "friend" | "coworker" | "kid" | "other";

type Question = {
  id: string;                       // stable forever; used in analytics. Retire, don't rename.
  text: string;                     // the question shown in the app
  options: {
    id: string;
    label: string;                  // the only thing the user sees
    fact?: string;                  // server-side only, never shown: the plain meaning Claude reads, when the label alone isn't a clear fact
  }[];                              // 2–4; the UI adds "Skip / idk"
  category: "interests" | "personality" | "lifestyle" | "gift_style" | "situational";
  priority: number;                 // 1–10; fallback order if Claude is unavailable
  when?: {
    relationship?: Relationship[];  // only ask for these relationships
    notRelationship?: Relationship[];
    minAge?: AgeBand;               // inclusive
    maxAge?: AgeBand;               // inclusive
    occasion?: Occasion[];
    requires?: { question: string; options: string[] };  // follow-up: only if that answer was given
  };
  excludes?: string[];              // near-duplicates: once one is asked, the others are dropped
};
```

Claude reads each answer as a plain fact: the option's `fact` if it has one, otherwise its label. For example, "Calls you for help" reaches Claude as "Tech → avoids tech". For age, Claude gets both the band and the behavior ("Age → probably 50s–60s (groans when they sit down)") and treats the band as approximate.

**Eligibility filter** (runs on the server each turn). A question is eligible if:

- it hasn't been asked yet,
- it isn't excluded by a question already asked,
- every `when` condition matches what's known so far, and
- for `requires`, the required option was actually chosen (a skip doesn't count).

When an age condition can't be checked because the opener was skipped, the question stays eligible, except for questions with `minAge: "20s"` or higher (alcohol and adult-life questions), which are dropped. A positive `relationship` condition (e.g. `couple_stage` for partners) needs a known matching relationship, so "How long have you been together?" never goes to someone who skipped Q1; `notRelationship` passes when the relationship is unknown.

**Notation below:** options are written as `id` Label *(fact)*. Facts in italics are never shown to users. In "Ask when", `free_time = active` means the user picked `active` for `free_time`.

## Fixed openers (Q1–Q3, always asked, in this order)

The openers are exempt from the 2–4 option limit.

| ID | Question | Options |
| --- | --- | --- |
| `relationship` | Who are we shopping for? | `partner` Partner · `parent` Parent · `grandparent` Grandparent · `sibling` Sibling · `friend` Friend · `coworker` Coworker · `kid` Kid · `other` Someone else |
| `age` | Which one sounds most like them? | `under_12` Still has a bedtime *(under 12)* · `teen` Communicates mostly in eye rolls *(13–19)* · `20s` Still uses a parent's streaming password *(20s)* · `30s_40s` Gets genuinely excited about a new vacuum *(30s–40s)* · `50s_60s` Groans when they sit down *(50s–60s)* · `70_plus` Signs their texts with their name *(70+)* |
| `budget` | What's the budget? | `under_25` Under $25 · `25_50` $25–50 · `50_100` $50–100 · `100_250` $100–250 · `250_plus` $250+ |

The age ranges are hidden on purpose: users pick the behavior that fits best, and some mis-bucketing (a 45-year-old who groans when sitting down) is accepted. The age rules that matter most are still safe, because the kid options ("Still has a bedtime", "Communicates mostly in eye rolls") are hard to pick for an adult.

## Interests

| ID | Question | Options | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `free_time` | Free afternoon, zero plans. What are they doing? | `active` Out and active · `making` Making something · `media` Gaming, watching or listening · `social` Seeing people | — | 10 |
| `active_type` | What gets them sweaty? | `outdoors` Hiking & camping · `gym` Gym & fitness · `sports` Team sports · `endurance` Running or cycling | `free_time = active` | 8 |
| `maker_type` | What are they always making? | `food` Food & drinks · `art` Art & crafts · `build` Building & fixing · `garden` Plants & garden | `free_time = making` | 8 |
| `media_type` | What are they glued to? | `games` Video games · `shows` Movies & shows · `music` Music · `internet` Internet rabbit holes | `free_time = media` | 8 |
| `gaming_platform` | Where do the hours disappear? | `pc` PC · `console` PlayStation / Xbox · `switch` Nintendo Switch · `phone` Phone | `media_type = games` | 6 |
| `social_type` | What's their idea of a big night? | `hosting` Hosting at home · `dining` Eating & drinking out · `events` Concerts & events · `travel` Trips with friends | `free_time = social` | 8 |
| `food_drink` | Are they a snob about anything they eat or drink? | `cook` Cooking · `coffee` Coffee or tea · `drinks` Wine, beer or cocktails · `none` Not really | age ≥ `20s` | 7 |
| `reader` | Do they actually read, or just own books? | `books` Physical books · `digital` Kindle / audiobooks · `articles` Articles & newsletters · `no` Not really | — | 5 |
| `music_level` | How much do they talk about music? | `plays` Plays an instrument · `collector` Collects vinyl · `live` Goes to lots of concerts · `background` It's background noise | — (natural follow-up to `media_type = music`) | 4 |
| `sports_fan` | Do they yell at the TV on game day? | `diehard` Diehard fan · `casual` Casual fan · `no` Not a sports person | — | 5 |
| `fandom` | Is there something they're a little too into? | `franchise` A movie or TV franchise · `anime` Anime or comics · `artist` A band or artist · `no` Not really | — | 5 |
| `pets` | Do they show you pet photos unprompted? | `dog` Dog · `cat` Cat · `other` Another animal · `none` No pets | — | 6 |
| `travel` | Always planning a trip, or happiest at home? | `frequent` Always planning a trip · `sometimes` Now and then · `homebody` Happiest at home | — | 6 |
| `wellness` | How do they unwind? | `pamper` Spa & skincare · `fitness` Workouts & step counts · `calm` Meditation & sleep · `other` They don't, really | age ≥ `teen` | 5 |
| `tech` | Do they fix everyone's tech, or call you for help? | `early` Always has the newest gadget · `practical` Uses what works · `averse` Calls you for help *(avoids tech)* | — | 5 |
| `style` | How would you describe their style? | `minimal` Minimal & neutral · `bold` Bold & colorful · `classic` Classic · `none` Doesn't care | age ≥ `teen` | 4 |

## Personality

| ID | Question | Options | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `sentimental` | Would they cry at a gift, or ask for the receipt? | `sentimental` Sentimental · `practical` Practical · `both` A bit of both | — | 9 |
| `old_soul` | Old soul or young at heart? | `old_soul` Old soul *(timeless, classic things)* · `young` Young at heart *(into whatever's new)* · `both` A bit of both | — | 6 |
| `humor` | Would they laugh at a gag gift? | `gag` Love a gag gift · `useful_funny` Funny but useful · `serious` Keep it serious | — | 6 |
| `adventurous` | Do they order the same thing every time? | `habit` Same thing every time · `sometimes` Depends · `always` Always tries something new | — | 7 |
| `energy` | After a party, are they energized or wiped out? | `extrovert` Energized *(extrovert)* · `introvert` Wiped out *(introvert)* · `depends` Depends | — | 5 |
| `organized` | Do they own a label maker? | `very` Yes, and they use it *(very organized)* · `mostly` Organized-ish · `chaos` Total chaos | — | 4 |
| `home_vibe` | What's their place like? | `cozy` Cozy · `modern` Modern & minimal · `eclectic` Full of stuff, eclectic · `bare` Haven't really decorated | age ≥ `20s`, not `kid` | 5 |
| `clutter` | Declutterer or collector? | `minimalist` Declutterer *(hates clutter)* · `normal` Somewhere in between · `more` Collector *(more is more)* | — | 6 |

## Lifestyle

| ID | Question | Options | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `work_style` | What's their work life like? | `desk` Desk job · `remote` Works from home · `hands_on` On their feet all day · `not_working` Student or retired | age ≥ `teen` | 6 |
| `busy` | How fried are they right now? | `slammed` Always slammed · `balanced` Pretty balanced · `free` Lots of free time | — | 5 |
| `living` | What's their living situation? | `own` Own place · `renting` Renting · `roommates` Roommates · `family` With family | age ≥ `20s` | 4 |
| `young_kids` | Do they have little kids at home? | `yes` Yes · `no` No | age ≥ `20s`, not `kid` | 6 |
| `milestone` | Anything big happen lately? | `new_home` New home · `new_baby` New baby · `new_job` New job or school · `nothing` Nothing new | — | 7 |
| `mobility` | How do they spend most days? | `very` Out and about · `easy` Taking it easy · `home` Mostly at home | age ≥ `70_plus` | 8 |

## Gift style

| ID | Question | Options | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `has_everything` | Are they impossible to shop for? | `impossible` Yes, impossible · `mostly` They have most things · `wants` There's lots they'd want | — | 9 |
| `bougie` | How bougie are they? | `luxe` Very, only the nice version · `nice` Likes nice things · `down_to_earth` Down to earth · `easy` Happy with anything | — | 8 |
| `gift_form` | What kind of gift feels right? | `experience` An experience · `keepsake` Something to keep · `consumable` Something to use up · `unsure` Not sure | — | 9 |
| `experience_type` | What would they actually show up for? | `food` Food & drink · `class` A class · `adventure` Something adventurous · `show` A show or event | `gift_form = experience` | 8 |
| `consumable_type` | What would they happily use up? | `treats` Snacks & treats · `beverages` Coffee, tea or drinks · `bath` Bath & body · `subscription` A subscription | `gift_form = consumable` | 8 |
| `practical_area` | Where's their life held together with tape? | `kitchen` Kitchen · `desk` Work or desk · `on_the_go` Car & commute · `routine` Morning routine | `sentimental = practical` | 7 |
| `upgrade_or_new` | Upgrade something they use every day, or try something new? | `upgrade` Upgrade a daily thing · `new` Something new · `either` Either | — | 7 |
| `personalized` | Their name on a gift: sweet or cringe? | `love` Sweet · `subtle` Only if subtle · `no` Cringe | — | 5 |
| `values` | Do they care where things come from? | `local` Handmade or local · `eco` Eco-friendly · `no` Doesn't matter | age ≥ `teen` | 4 |
| `last_gift` | How did your last gift for them go? Be honest. | `hit` Huge hit · `fine` Fine · `flop` Flopped · `first` First gift | — | 5 |
| `group_gift` | Is this from just you or a group? | `solo` Just me · `couple` A couple of us · `group` A whole group | — | 3 |

## Situational (relationship, age or occasion)

| ID | Question | Options | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `couple_stage` | How long have you been together? | `new` Just started · `few_years` 1–5 years · `long` 5+ years | relationship `partner` | 9 |
| `couple_vibe` | Romantic, something together, or just for them? | `romantic` Romantic · `shared` Something to do together · `just_them` Something just for them | relationship `partner` | 8 |
| `coworker_closeness` | Actual friends or just Slack friends? | `barely` Barely know them · `friendly` Friendly · `close` Work bestie | relationship `coworker` | 10 |
| `kid_interest` | What are they obsessed with this week? | `build` Building & science · `art` Arts & crafts · `play` Sports & outdoors · `screens` Games & screens | age ≤ `under_12`; excludes `free_time` | 10 |
| `kid_reading` | Do they like books? | `loves` Loves books · `some` Sometimes · `no` Not really | age ≤ `under_12` | 5 |
| `teen_vibe` | What's their whole personality right now? | `fashion` Fashion & beauty · `gaming` Gaming · `sports` Sports · `creative` Music & art | age = `teen`; excludes `free_time` | 10 |
| `wedding_angle` | What kind of wedding gift? | `home` Something for the home · `experience` An experience for two · `keepsake` Something sentimental | occasion `wedding` | 9 |
| `graduation_next` | What's next for them? | `college` College · `job` First job · `moving` Moving away · `unsure` Figuring it out | occasion `graduation` | 9 |
| `thank_you_for` | What are you thanking them for? | `favor` A big favor · `hosting` Hosting you · `work` Help at work · `general` Just being great | occasion `thank_you` | 9 |
| `new_parent_gift` | For the baby, or for the exhausted parents? | `baby` For the baby · `parents` For the parents · `both` Both | `milestone = new_baby` | 8 |
| `new_home_need` | What's the new place missing? | `decor` Decor · `kitchen` Kitchen · `comfort` Comfort · `tools` Tools & basics | `milestone = new_home` | 8 |

## Notes for review

- **Third pass changes:** the voice moved from hype labels to observational humor; option labels are plain again; the age opener is now a behavior question; budget options are plain prices. No hints are shown to users; options can carry a hidden `fact` for Claude. No memes or slang.
- **Age question:** the behaviors are deliberately broad and a little ambiguous. Watch its skip rate in analytics: if lots of people skip it because none of the behaviors fit, rewrite the options before adding anything else.
- **Why `bougie` isn't the budget question:** budget is the giver's wallet, and bougie-ness is the recipient's taste. A bougie friend on a $25 budget should get a small luxe thing (fancy olive oil), not a cheap version of a big thing.
- **Coverage:** there are 3 openers + 52 bank questions. A typical quiz asks 2–7 bank questions, so most never come up for a given person. That's intended: the filter and Claude pick the relevant ones.
- **Follow-up chains:** `free_time` → `active_type` / `maker_type` / `media_type` / `social_type` → `gaming_platform`, `gift_form` → `experience_type` / `consumable_type`, `sentimental` → `practical_area`, and `milestone` → `new_parent_gift` / `new_home_need`. They let a short quiz go deep on one thread instead of skimming.
- **Things that might be missing:** religion/holiday traditions (deliberately left out), dietary restrictions (vegan, allergies), sizes for clothing (skipped on purpose; clothing is risky as a gift), and hobbies that don't fit a bucket. Playtests will show where the gaps are.
- **Possible cuts:** `organized`, `group_gift` and `living` are the weakest signals. Keep them for now and let the analytics decide.
- **Kids and teens:** `kid_interest` and `teen_vibe` exclude `free_time`, since they cover the same ground with age-appropriate options.
