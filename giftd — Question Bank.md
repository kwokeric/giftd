# giftd — Question Bank

Seventh pass · 3 fixed openers + 60 bank questions

These are all the questions giftd can ask. On each turn the server removes the questions that don't apply. Claude then picks the most useful one left by ID, or decides it's ready to recommend gifts. Claude never writes questions itself. In code this file is `src/lib/questions.ts`; keep the two in sync (`npx tsx scripts/bank-tables.ts` prints these tables from the code).

## Voice

Funny like a friend who knows the person, not like a brand mascot. The gifts are never a joke.

- **The answers are part of the joke.** Set up a situation in the question, and let each answer be a funny, recognizable reaction. Example: "How would they react to a sentimental gift?" → Immediately tear up · "Aww, thanks so much!" · Ask for the receipt.
- **Specific, recognizable behavior over hype labels.** "Groans when they sit down" is funny because you can picture it. "Certified legend" is just a slogan.
- **Every joke answer has a hidden `fact`.** The fact is the plain meaning ("very sentimental") that Claude reasons from. Users never see it.
- **A little ambiguity is fine.** No explanatory hints under answers. If an answer is a bit open to interpretation, that's part of the fun.
- **No skip.** Every question needs an answer that works for most people, so include a "none" or "not sure" answer where one is needed ("Honestly, nothing", "Truly no idea").
- **Playful, never mean.** Tease habits everyone recognizes, not the giver or the recipient.
- **PG.** Fine for anyone shopping for their grandma.
- **Timeless, not trendy.** No memes, slang or current-events references. The app should feel just as fresh in a few years.

Plain labels stay where clarity matters more than a joke: who it's for, the budget, and answers that are already funny in context ("Likes nice things").

## Schema

```ts
type AgeBand = "20s" | "30s_40s" | "50s_60s" | "70_plus"; // ordered; adults only
type Relationship = "partner" | "relative" | "friend" | "coworker" | "other";

type Question = {
  id: string;                       // stable forever; used in analytics. Retire, don't rename.
  text: string;                     // the question shown in the app
  options: {
    id: string;                     // stable forever, like question ids
    label: string;                  // the only thing the user sees
    fact?: string;                  // server-side only, never shown: the plain meaning Claude reads
    hideFor?: Relationship[];       // hide this answer for these relationships
  }[];                              // 2–8; no skip
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

Claude reads each answer as the label plus its fact, e.g. "Who do they call when the Wi-Fi breaks? → You (avoids tech)". For age it reads "probably 50s–60s" and treats the band as approximate.

**Eligibility filter** (runs on the server each turn). A question is eligible if:

- it hasn't been asked yet,
- it isn't excluded by a question already asked (in either direction),
- every `when` condition matches what's known so far, and
- for `requires`, the required option was chosen.

The openers can't be skipped, so age and relationship are always known when bank questions are picked.

**Notation below:** answers are written as `id` Label *(fact)*. Facts in italics are never shown to users. In "Ask when", `free_time = active` means the user picked `active` for `free_time`.

## Fixed openers (Q1–Q3, always asked, in this order)

The openers are exempt from the 2–8 answer limit.

| ID | Question | Answers |
| --- | --- | --- |
| `relationship` | Who are we shopping for? | `partner` Partner · `relative` Relative · `friend` Friend · `coworker` Coworker · `other` Someone else |
| `age` | Which one sounds most like them? | `20s` Still uses a parent's streaming password *(probably in their 20s)* · `30s` Recently joined a run club *(probably 30s)* · `40s` Remembers having a cassette player *(probably 40s)* · `50s_60s` Groans when they sit down *(probably 50s–60s)* · `70_plus` Signs their texts with their name *(probably 70+)* |
| `budget` | What's the budget? | `under_25` Under $25 · `25_50` $25–50 · `50_100` $50–100 · `100_250` $100–250 · `250_plus` $250+ |

**Skipped when the occasion answers them** (`src/lib/implied.ts`). A skipped question beats a slightly better age guess. The answer is still recorded, and Claude is told it was assumed:

| Occasion | Who | Age |
| --- | --- | --- |
| Mother's Day | skipped: their mom (`relative`) | skipped: 50+ (`50s_60s`) |
| Father's Day | skipped: their dad (`relative`) | skipped: 50+ (`50s_60s`) |
| Valentine's | skipped: their partner (`partner`) | asked |
| Graduation | asked | skipped: their 20s (`20s`) |
| Wedding, Housewarming | asked | skipped: late 20s to 40s (`30s_40s`) |

The age ranges are hidden on purpose: users pick the behavior that fits best, and some mis-bucketing (a 45-year-old who groans when sitting down) is accepted. giftd is for adults (20+), so there are no kid or teen answers, and the AI is told never to mention an age in a gift name.

## Interests

| ID | Question | Answers | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `free_time` | Free afternoon, zero plans. Where do you find them? | `active` Halfway up a trail *(out and active)* · `sports` Yelling at the game on TV *(into sports, playing or watching)* · `making` Covered in paint or sawdust *(making things: art, crafts, building)* · `cooking` Trying out a new recipe *(cooking & baking)* · `media` Three episodes deep *(games, shows or music)* · `social` Wherever the group chat said *(seeing people)* · `wellness` On a yoga mat, phone on silent *(wellness: yoga, meditation, self-care)* · `beauty` Ten steps into a skincare routine *(beauty: skincare, makeup, hair)* | — | 10 |
| `active_type` | What's their idea of a good sweat? | `outdoors` A 10-mile hike, for fun *(hiking & camping)* · `gym` Never skips leg day *(gym & fitness)* · `sports` Rec league, way too competitive *(team sports)* · `endurance` Training for another race *(running or cycling)* · `water` Anything with a paddle *(water sports: kayaking, surfing, swimming)* | `free_time = active` | 8 |
| `maker_type` | What's always in progress at their place? | `art` A half-finished painting *(art & crafts)* · `build` A project in the garage *(building & fixing)* · `garden` Way too many plants *(plants & gardening)* · `fiber` A scarf that's been almost done since winter *(knitting, sewing & fiber crafts)* · `tinker` A circuit board on the kitchen table *(electronics, 3D printing & tinkering)* | `free_time = making` | 8 |
| `cooking_type` | What do they make when they're showing off? | `bake` Bread, with opinions about flour *(baking)* · `grill` Anything on a grill, rain or shine *(grilling & smoking)* · `global` A dish they learned on vacation *(world cuisines)* · `comfort` Grandma's recipe, perfected *(classic home cooking)* · `healthy` Meal prep for the whole week *(healthy cooking & meal prep)* | `free_time = cooking` | 8 |
| `beauty_type` | What's taking over their bathroom counter? | `skincare` Serums in a very specific order *(skincare)* · `makeup` A makeup bag the size of a suitcase *(makeup)* · `hair` Three hair tools and a diffuser *(hair care & styling)* · `fragrance` A signature scent they won't share *(fragrance)* · `nails` A nail polish for every mood *(nails)* | `free_time = beauty` | 8 |
| `media_type` | What are they glued to? | `games` A controller *(video games)* · `shows` The next episode *(movies & shows)* · `music` Headphones, always *(music)* · `internet` A 2am Wikipedia rabbit hole *(internet rabbit holes)* · `podcasts` A true-crime podcast *(podcasts)* | `free_time = media` | 8 |
| `gaming_platform` | Where do the hours disappear? | `pc` A PC with too many lights *(PC gaming)* · `console` The couch, controller in hand *(PlayStation / Xbox)* · `switch` A Switch, anywhere they go *(Nintendo Switch)* · `phone` Their phone, mid-conversation *(phone games)* · `tabletop` A board game with a 40-page rulebook *(board & tabletop games)* | `media_type = games` | 6 |
| `social_type` | What's their idea of a big night? | `hosting` Hosting, with a very serious cheese board *(hosting at home)* · `dining` A reservation they made weeks ago *(eating & drinking out)* · `events` Dancing at a show *(concerts & events)* · `travel` Planning the next group trip *(trips with friends)* · `games` Trivia night, and they take it personally *(trivia & game nights)* | `free_time = social` | 8 |
| `food_drink` | What will they lecture you about? | `cook` The right way to sear a steak *(into cooking)* · `coffee` Your coffee order *(coffee or tea snob)* · `drinks` Which wine goes with what *(into wine, beer or cocktails)* · `spicy` Which hot sauce is actually hot *(into spicy food & hot sauce)* · `none` Nothing, they eat cereal for dinner *(not a food or drink snob)* | — | 7 |
| `reader` | What's on their nightstand? | `books` A stack of half-read books *(reads physical books)* · `digital` A Kindle, or earbuds mid-audiobook *(reads on Kindle / audiobooks)* · `articles` Their phone, open to a newsletter *(reads articles & newsletters)* · `magazines` A magazine they actually subscribe to *(reads magazines)* · `no` Literally nothing *(not a reader)* | — | 5 |
| `music_level` | How do they listen to music? | `plays` They make it themselves *(plays an instrument)* · `collector` On vinyl, obviously *(collects vinyl)* · `live` Live, from the front row *(goes to lots of concerts)* · `playlists` A playlist for every mood *(makes playlists, streams a lot)* · `background` Whatever's on *(music is background noise)* | — | 4 |
| `sports_fan` | What happens on game day? | `diehard` Jersey on, phone off *(diehard sports fan)* · `casual` They'll watch if it's on *(casual sports fan)* · `fantasy` They check their fantasy team. Constantly *(into fantasy sports)* · `plays` They'd rather play than watch *(plays sports more than watching)* · `no` What game? *(not a sports person)* | — | 5 |
| `fandom` | What could they talk about for three hours straight? | `franchise` A movie or TV universe *(fan of a movie or TV franchise)* · `anime` An anime or comic series *(into anime or comics)* · `artist` Their favorite band *(fan of a band or artist)* · `history` A war, a king or a shipwreck *(history buff)* · `no` Honestly, nothing *(no big fandom)* | — | 5 |
| `pets` | Who's on their lock screen? | `dog` Their dog *(has a dog)* · `cat` Their cat *(has a cat)* · `other` Something with scales or fins *(has another kind of pet)* · `plants` Their plants. They have names *(no pets, but a plant parent)* · `none` A sunset *(no pets)* | — | 6 |
| `travel` | What's their dream weekend? | `frequent` A flight they booked last night *(always planning a trip)* · `sometimes` A road trip, if it's well planned *(travels now and then)* · `camping` A tent somewhere with no signal *(camping & outdoor trips)* · `beach` A beach chair and a paperback *(beach & relaxing trips)* · `homebody` Not leaving the couch *(homebody)* | — | 6 |
| `wellness` | How do they unwind? | `pamper` Face mask and a long bath *(spa & skincare)* · `fitness` A run, then checking their stats *(workouts & fitness tracking)* · `calm` Meditation app, lights out by 10 *(meditation & sleep)* · `outside` A long walk, no headphones *(walks & time outdoors)* · `other` They don't. They unwind by doing more *(not a self-care person)* | — | 5 |
| `tech` | Who do they call when the Wi-Fi breaks? | `early` Nobody. They are the IT department *(tech-savvy early adopter)* · `smart_home` Their smart speaker, by name *(into smart home gadgets)* · `practical` Customer support, eventually *(uses what works)* · `averse` You *(avoids tech)* | — | 5 |
| `style` | How would you describe their style? | `minimal` All black, all neutral *(minimal & neutral style)* · `bold` Loud, and proud of it *(bold & colorful style)* · `classic` Could wear it in any decade *(classic style)* · `comfy` Sweatpants, but nice ones *(comfy & casual style)* · `none` Whatever was clean *(doesn't care about style)* | — | 7 |
| `wardrobe` | What do they wear on repeat? | `tops` A hoodie that never comes off *(clothes: hoodies, sweaters, tops)* · `shoes` Sneakers, kept spotless *(shoes & sneakers)* · `accessories` The same hat, bag or belt every day *(accessories: hats, bags, belts)* · `jewelry` A ring they never take off *(jewelry & watches)* · `lounge` Pajamas by 7pm *(loungewear & cozy basics)* | `style = minimal / bold / classic / comfy` | 7 |
| `size_known` | Do you know their size? | `yes` I could pick it blindfolded *(knows their size)* · `roughly` Ballpark *(roughly knows their size, so pick forgiving fits)* · `no` Not a clue *(doesn't know their size, so avoid sized items)* | `wardrobe = tops / shoes / lounge` | 7 |

## Personality

| ID | Question | Answers | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `group_chat` | What are they like in the group chat? | `planner` Already made the itinerary *(the planner, organized)* · `memes` Memes at 2am *(the funny one)* · `lurker` Reads everything, replies never *(a quiet observer)* · `hype` Hypes up every selfie *(a supportive cheerleader)* · `voice` Sends four-minute voice memos *(a talker, very social)* | for fun | 3 |
| `mornings` | What are they like before coffee? | `early` Already ran five miles *(early riser, high energy)* · `zombie` Do not speak to them *(not a morning person)* · `slow` Slow breakfast and a crossword *(savors slow mornings)* · `snooze` On their fourth snooze *(a night owl)* · `sunny` Annoyingly cheerful *(a sunny morning person)* | for fun | 3 |
| `zombies` | How do they survive the zombie apocalypse? | `leader` Running the bunker by day two *(a natural leader)* · `prepper` They already had a go-bag *(prepared and practical)* · `fixer` Rewiring the generator *(handy, a tinkerer)* · `charm` Talking their way into a better bunker *(charming and social)* · `comfort` First one out, honestly *(not the survival type, loves comfort)* | for fun | 3 |
| `road_trip` | What's their job on a road trip? | `dj` Aux cord, no exceptions *(a music lover)* · `navigator` Navigator, with opinions *(likes being in charge)* · `snacks` In charge of snacks *(a food lover)* · `sleeper` Asleep before the highway *(easygoing)* · `driver` Drives the whole way, won't switch *(dependable and independent)* | for fun | 3 |
| `party_trick` | What's their party trick? | `trivia` Knows every trivia answer *(curious, a know-it-all in the best way)* · `karaoke` Karaoke, unprompted *(a performer)* · `fixer` Fixes anything with a butter knife *(handy)* · `animals` Every dog in the room finds them *(an animal lover)* · `stories` Tells the best stories *(a storyteller, social)* | for fun | 3 |
| `superpower` | Which superpower would they pick? | `teleport` Teleporting, to skip traffic *(loves travel, hates commutes)* · `pause` Pausing time, for a nap *(stretched thin, needs rest)* · `minds` Reading minds *(curious about people)* · `flight` Flying, obviously *(adventurous)* · `invisible` Invisibility *(private, a bit introverted)* | for fun | 3 |
| `care_style` | How do they show they care? | `thoughtful` Remembers your favorite snack *(values thoughtful gifts)* · `time` Plans the hangout *(values quality time)* · `helps` Fixes your bike without asking *(values acts of service)* · `words` Sends long birthday texts *(values heartfelt words)* · `hugs` Bear hugs, every time *(values physical affection)* *(hidden for coworker)* | — | 7 |
| `sentimental` | How would they react to a sentimental gift? | `sentimental` Immediately tear up *(very sentimental)* · `quiet` Go quiet, then hug you *(sentimental, but private about it)* · `both` "Aww, thanks so much!" *(a bit sentimental, a bit practical)* · `hesitant` Is that it? *(hesitant, but courteous)* · `practical` Ask for the receipt *(practical)* | — | 9 |
| `old_soul` | Old soul or young at heart? | `old_soul` Owns a record player and means it *(old soul, likes timeless classic things)* · `vintage` Thrifted everything they're wearing *(loves vintage & secondhand)* · `nostalgic` Still quotes the same movie from childhood *(nostalgic, loves throwbacks)* · `young` Knows every new app before you do *(young at heart, into whatever's new)* · `both` Somehow both *(a bit of both)* | — | 6 |
| `humor` | How would they react to a gag gift? | `gag` Hoot and holler *(loves gag gifts)* · `useful_funny` Laugh, then actually use it *(likes funny but useful gifts)* · `secret` Pretend to hate it, keep it forever *(secretly loves silly gifts)* · `serious` A polite, confused smile *(no gag gifts, keep it serious)* · `no_gag` Ask for a gift receipt *(no gag gifts at all)* | — | 6 |
| `adventurous` | Do they order the same thing every time? | `habit` Same thing since 2014 *(creature of habit)* · `sometimes` Depends on the mood *(somewhat adventurous)* · `recommend` Whatever the server recommends *(open to suggestions)* · `always` Whatever they can't pronounce *(adventurous, loves trying new things)* · `dare` The spiciest thing, as a challenge *(thrill-seeker)* | — | 7 |
| `energy` | It's 11pm at a party. Where are they? | `extrovert` Starting a dance circle *(extrovert)* · `host` Doing dishes. It's their party *(the host type)* · `depends` Deep conversation in the kitchen *(somewhere in between)* · `pets` Petting the host's dog *(introvert, loves animals)* · `introvert` Home since 9:30 *(introvert)* | — | 5 |
| `organized` | Do they own a label maker? | `very` Yes, and the label maker is labeled *(very organized)* · `apps` No, they have an app for that *(organized digitally, loves planners and apps)* · `mostly` They know where everything is, mostly *(organized-ish)* · `piles` No, but the piles have a system *(organized chaos)* · `chaos` They can't find their keys right now *(disorganized)* | — | 4 |
| `home_vibe` | What's their place like? | `cozy` Cozy Pinterest board *(cozy home)* · `modern` Belongs on Architectural Digest *(modern & minimal home)* · `rustic` Wood, flannel and a fireplace *(rustic, cabin-style home)* · `eclectic` Every wall has a story *(eclectic home, full of stuff)* · `bare` A mattress and good intentions *(hasn't really decorated)* | — | 5 |
| `clutter` | What would they do with a random knickknack? | `minimalist` Donate it by Friday *(hates clutter)* · `drawer` Junk drawer, forever *(keeps things but doesn't display them)* · `normal` Find it a shelf *(normal amount of stuff)* · `display` Put it front and center *(loves decor & display pieces)* · `more` Start a collection! *(more is more)* | — | 6 |

## Lifestyle

| ID | Question | Answers | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `work_style` | What does their workday look like? | `desk` Back-to-back meetings *(desk job)* · `remote` Sweatpants, camera off *(works from home)* · `hands_on` 10,000 steps by lunch *(on their feet all day)* · `shifts` Night shifts and early alarms *(works irregular shifts)* · `boss` Their own boss, always on *(self-employed or runs a business)* · `not_working` What workday? *(student or retired)* | — | 6 |
| `busy` | How fried are they right now? | `slammed` Running on coffee and calendar alerts *(always busy)* · `burnout` Needs a vacation from their vacation *(burnt out, needs rest)* · `transition` Between things, figuring it out *(in a transition)* · `balanced` Weirdly well-rested *(pretty balanced)* · `free` They have hobbies again *(lots of free time)* | — | 5 |
| `living` | What's their living situation? | `own` Homeowner, has opinions about gutters *(owns their place)* · `renting` Renting, can't paint the walls *(renting)* · `small` A tiny apartment, every inch counts *(small space)* · `roommates` Labeled food in a shared fridge *(lives with roommates)* · `family` Back home with family *(lives with family)* | — | 4 |
| `young_kids` | Do they have little kids at home? | `yes` Yes, they haven't slept since *(has young kids)* · `no` No, they aren't so little *(has kids, but not little ones)* · `grandkids` No, but the grandkids visit a lot *(grown kids, has grandkids)* · `fur` No, just a dog they call their baby *(no kids, treats a pet like one)* · `none` No kids *(no kids)* | — | 6 |
| `milestone` | Anything big happen lately? | `new_home` Surrounded by moving boxes *(new home)* · `new_baby` A brand new tiny human *(new baby)* · `new_job` New job or school, still learning names *(new job or school)* · `engaged` A ring and a lot of planning *(just got engaged)* · `new_pet` A new puppy chewing everything *(new pet)* · `retired` Retired, and somehow busier *(just retired)* · `nothing` Same old, in a good way *(nothing new)* | — | 7 |
| `mobility` | How do they spend most days? | `very` Busier than you *(very active)* · `garden` In the garden by 7am *(gardener, active at home)* · `grandkids` Chasing grandkids *(spends lots of time with grandkids)* · `easy` Puzzles, porch, a good nap *(takes it easy)* · `home` Home, and they like it that way *(mostly at home)* | age ≥ `70_plus` | 8 |

## Gift style

| ID | Question | Answers | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `has_everything` | What do they say when you ask what they want? | `impossible` "Nothing, I'm good!" *(impossible to shop for)* · `mostly` "Hmm, I'll think about it" *(has most things)* · `basics` "Socks, I guess" *(wants practical basics)* · `specific` One very specific thing they can't find *(wants something specific)* · `wants` They send you a list *(there's lots they'd want)* | — | 9 |
| `bougie` | How bougie are they? | `luxe` It's always Treat Yo' Self day *(very bougie, only the nice version)* · `brand` Only one brand, and you know which *(brand loyal)* · `nice` Likes nice things · `down_to_earth` Down to earth · `deal` Brags about how little they paid *(loves a bargain)* · `easy` Happy with anything | — | 8 |
| `gift_form` | What kind of gift feels right? | `experience` A memory, not a thing *(an experience)* · `keepsake` Personalized and sentimental *(a keepsake)* · `consumable` Something they'll use up *(a consumable)* · `gadget` As long as it's useful *(a gadget or cool thing)* · `diy` A project they make themselves *(a DIY kit or project)* · `handmade` Something thoughtfully handmade *(something handmade)* · `giftcard` Honestly? A gift card *(would genuinely prefer a gift card)* · `unsure` Truly no idea *(not sure)* | — | 9 |
| `experience_type` | What would they actually show up for? | `food` A tasting menu *(food & drink experience)* · `class` A class where they make something *(a class)* · `adventure` Anything with a waiver *(an adventure)* · `show` Good seats to a show *(a show or event)* · `game` Seats at a game *(a sporting event)* · `relax` A spa day, phone off *(something relaxing: spa, massage)* · `getaway` A night somewhere new *(a short getaway)* | `gift_form = experience` | 8 |
| `consumable_type` | What would they finish in a week? | `treats` A box of snacks *(snacks & treats)* · `beverages` Fancy coffee or tea *(coffee, tea or drinks)* · `pantry` Fancy olive oil and hot sauce *(gourmet pantry items)* · `bath` Every bath bomb in sight *(bath & body)* · `flowers` Fresh flowers, every week if possible *(flowers & plants)* · `subscription` Something that shows up monthly *(a subscription)* | `gift_form = consumable` | 8 |
| `practical_area` | What around them is overdue for an upgrade? | `kitchen` A drawer of dull knives *(kitchen)* · `desk` A laptop propped on books *(work or desk)* · `on_the_go` A car full of old receipts *(car & commute)* · `routine` An alarm clock from 2009 *(getting ready in the morning)* · `sleep` A pillow flatter than a pancake *(sleep & bedroom)* · `yard` A hose that's mostly leaks *(yard & garden)* | `sentimental = practical` | 7 |
| `upgrade_or_new` | What would they appreciate more? | `upgrade` Their old thing, but way nicer *(upgrade something they use every day)* · `fix` A cure for their pet peeve *(solves an everyday annoyance)* · `new` A thing they didn't know existed *(something new and surprising)* · `treat` Something they'd never buy themselves *(a small luxury they wouldn't buy for themselves)* · `show_off` Something they'll show everyone *(a conversation piece)* | — | 7 |
| `personalized` | Their name on a gift: sweet or cringe? | `love` So sweet *(would love something personalized)* · `inside_joke` Only if it's an inside joke *(personalized with an inside joke)* · `subtle` Only if it's subtle *(personalized only if subtle)* · `no` No thanks *(no personalized gifts)* | — | 5 |
| `values` | Do they care where things come from? | `local` They know the maker by name *(prefers handmade or local)* · `eco` They've lectured you about plastic *(prefers eco-friendly)* · `cause` Only if it gives back *(likes gifts that support a cause)* · `quality` Buy it once, keep it forever *(prefers durable, high-quality things)* · `no` As long as it ships fast *(doesn't matter)* | — | 4 |
| `last_gift` | How did your last gift for them go? Be honest. | `hit` They still bring it up *(huge hit)* · `fine` "Oh, thanks!" *(it was fine)* · `flop` Haven't seen it since *(flopped)* · `regifted` I saw it at someone else's house *(they regifted it)* · `forgot` I honestly can't remember *(doesn't remember)* · `first` This is my first one *(first gift for them)* | — | 5 |
| `group_gift` | Is this from just you or a group? | `solo` Just me, I've got this *(solo gift)* · `couple` A couple of us *(from a couple of people)* · `family` The whole family's name is on the card *(family gift)* · `office` The office passed around an envelope *(office group gift)* · `group` The whole group chat chipped in *(group gift)* | — | 3 |

## Situational (relationship, age or occasion)

| ID | Question | Answers | Ask when | Pri |
| --- | --- | --- | --- | --- |
| `couple_stage` | How long have you been together? | `new` Still in the butterflies phase *(just started dating)* · `few_years` I know their coffee order *(together 1–5 years)* · `long` We finish each other's sentences *(together 5+ years)* · `married` Married, with a shared calendar *(married)* · `decades` Long enough to remember flip phones *(together for decades)* | relationship `partner` | 9 |
| `couple_vibe` | What kind of gift for them? | `romantic` Swoon-worthy *(romantic)* · `nostalgic` Something about how we met *(nostalgic, about our history)* · `shared` Something we do together *(something to do together)* · `practical` Something that fixes a daily annoyance *(practical, solves a problem)* · `just_them` Something just for them | relationship `partner` | 8 |
| `coworker_closeness` | Actual friends or just Slack friends? | `secret_santa` Secret Santa drew their name *(secret santa, don't know them well)* · `barely` We've exchanged maybe four words *(barely know them)* · `friendly` Small talk by the coffee machine *(friendly)* · `close` Work bestie, we have a group chat *(close work friend)* · `boss` They approve my time off *(my boss or manager)* | relationship `coworker` | 10 |
| `wedding_angle` | Registry, or going rogue? | `registry` Whatever's left on the registry *(something practical they'd put on a registry)* · `home` Something for their new home *(a gift for the home)* · `experience` A night out for the two of them *(an experience for two)* · `honeymoon` Something for the honeymoon *(something for the honeymoon)* · `keepsake` Something they'll keep forever *(something sentimental)* | occasion `wedding` | 9 |
| `graduation_next` | What's next for them? | `college` More school *(going to college)* · `job` A real job, with a lanyard *(starting a first job)* · `moving` A new city *(moving away)* · `gap` A gap year and a backpack *(gap year or travel)* · `unsure` "Figuring it out" *(figuring it out)* | occasion `graduation` | 9 |
| `thank_you_for` | What did they do to deserve this? | `favor` Saved me, truly *(a big favor)* · `hosting` Let me crash at their place *(hosted me)* · `moving` Helped me move. Twice *(helped me move)* · `sitting` Kept my dog (and my plants) alive *(pet- or house-sat)* · `work` Covered for me at work *(helped at work)* · `general` Just being great *(being great in general)* | occasion `thank_you` | 9 |
| `new_parent_gift` | For the baby, or for the exhausted parents? | `baby` The baby, obviously *(a gift for the baby)* · `parents` The parents. They need it more *(a gift for the parents)* · `meals` Their freezer, honestly *(meals & food for the family)* · `sibling` The new big sibling, feeling left out *(a gift for the new big brother or sister)* · `both` Both | `milestone = new_baby` | 8 |
| `new_home_need` | What's the new place missing? | `decor` Literally anything on the walls *(decor)* · `kitchen` More than one pan *(kitchen stuff)* · `comfort` A comfy place to sit *(comfort)* · `tools` A single screwdriver *(tools & basics)* · `plants` Something alive besides them *(plants)* · `yard` A yard, and no plan for it *(yard & outdoor)* | `milestone = new_home` | 8 |

## Notes for review

- **Seventh pass changes:** adults only (20+). The kid and teen age answers are gone, along with `kid_interest`, `kid_reading` and `teen_vibe`; age floors of teen or 20s were dropped since every recipient clears them. Also: Valentine's skips who (always a partner); `upgrade_or_new` is now "What would they appreciate more?" with gift-shaped answers; `practical_area` is now "What around them is overdue for an upgrade?"; results no longer have a "why" blurb.
- **Sixth pass changes:** new `care_style` ("How do they show they care?", love-languages style); `style` now leads to clothes: `style` → `wardrobe` (what they wear on repeat) → `size_known` for sized things, and `style` moved up to priority 7; quizzes run up to 12 questions; every plan mixes in 1 random "discovery" question so the whole bank gets asked over time; 6 new "for fun" personality questions (`group_chat`, `mornings`, `zombies`, `road_trip`, `party_trick`, `superpower`), 2 of which go in every quiz to keep it engaging. The AI doesn't plan those, and their answers are a light signal for the picks.
- **Fifth pass changes:** more answers everywhere (5+ for personality, lifestyle, gift style and situational); `free_time` gained sports, cooking, wellness and beauty, with new follow-ups `cooking_type` and `beauty_type`; `gift_form` gained gadget, DIY, handmade and gift card; `maker_type` dropped food (now `free_time = cooking`); the relationship opener is now Partner · Relative · Friend · Coworker · Someone else; long answer lists use a tighter layout so 8 answers fit on a phone.
- **Fourth pass changes:** the answers now carry the joke, each with a hidden `fact`; many questions were reworded to set up the joke ("How would they react to a sentimental gift?", "Who do they call when the Wi-Fi breaks?"); skip removed. Question and option IDs didn't change.
- **Age question:** the behaviors are deliberately broad and a little ambiguous. Watch drop-off on it in analytics: if people quit there, rewrite the answers before anything else.
- **Why `bougie` isn't the budget question:** budget is the giver's wallet, and bougie-ness is the recipient's taste. A bougie friend on a $25 budget should get a small luxe thing (fancy olive oil), not a cheap version of a big thing.
- **Coverage:** there are 3 openers + 60 bank questions. A quiz asks up to 9 bank questions: the AI picks 4–6 that matter most for this person, follow-ups slot in, and the server adds 1 discovery question at random (weighted by priority, so lower-priority ones like `pets` and `reader` still come up and the click data covers the whole bank) plus 2 fun ones. The order alternates: useful, fun, useful, discovery, useful, fun, then the rest.
- **Fun questions** (Ask when says "for fun"): asked for engagement, not signal. The AI uses them to break ties or flavor the wildcard, never as the main reason for a pick. Add more freely; they don't need to map to a gift category.
- **Follow-up chains:** `free_time` → `active_type` / `maker_type` / `cooking_type` / `beauty_type` / `media_type` / `social_type` → `gaming_platform`, `style` → `wardrobe` → `size_known`, `gift_form` → `experience_type` / `consumable_type`, `sentimental` → `practical_area`, and `milestone` → `new_parent_gift` / `new_home_need`. They let a short quiz go deep on one thread instead of skimming.
- **Things that might be missing:** religion/holiday traditions (deliberately left out), dietary restrictions (vegan, allergies), sizes beyond "do you know it?" (clothing is risky, so `size_known` steers to forgiving fits or unsized items), and hobbies that don't fit a bucket. Playtests will show where the gaps are.
- **Possible cuts:** `organized`, `group_gift` and `living` are the weakest signals. Keep them for now and let the analytics decide.
- **Gift cards:** the prompt still steers away from gift cards unless the answers point there; "Honestly? A gift card" is that signal.
