// Topic taxonomy for thematic vocabulary review.
// Each topic has: slug, name, emoji, and a set of keyword stems.
// A word is assigned to a topic if the word itself, its definition, example,
// or synonyms contain any of the topic's keyword stems (word-boundary match).

export type Topic = {
  slug: string;
  name: string;
  emoji: string;
  blurb: string;
  keywords: string[];
  /** optional accent color class */
  accent: string;
};

export const TOPICS: Topic[] = [
  {
    slug: "food",
    name: "Food & Drink",
    emoji: "🍜",
    blurb: "Eat, cook, taste, and everything on the table.",
    accent: "text-cefr-b1",
    keywords: [
      "food", "drink", "eat", "meal", "cook", "taste", "hungry", "thirsty",
      "fruit", "vegetable", "meat", "fish", "bread", "rice", "cheese", "egg",
      "milk", "coffee", "tea", "water", "wine", "beer", "sugar", "salt",
      "sweet", "sour", "bitter", "delicious", "restaurant", "kitchen", "recipe",
      "dish", "snack", "breakfast", "lunch", "dinner", "dessert", "soup",
      "flavour", "flavor", "spice", "bake", "fry", "boil", "chew", "swallow",
      "appetite", "cuisine", "ingredient", "menu", "portion", "bite",
    ],
  },
  {
    slug: "travel",
    name: "Travel & Transport",
    emoji: "✈️",
    blurb: "Journeys, roads, tickets, and getting around.",
    accent: "text-cefr-a2",
    keywords: [
      "travel", "journey", "trip", "tour", "tourist", "holiday", "vacation",
      "visit", "arrive", "depart", "departure", "arrival", "destination",
      "car", "bus", "train", "plane", "airplane", "flight", "boat", "ship",
      "bicycle", "bike", "taxi", "tube", "subway", "vehicle", "lorry", "van",
      "road", "street", "path", "map", "direction", "passport", "visa",
      "ticket", "luggage", "baggage", "suitcase", "hotel", "guest", "guide",
      "abroad", "foreign", "border", "station", "airport", "drive", "ride",
      "park", "route", "distance", "passenger",
    ],
  },
  {
    slug: "family",
    name: "Family & People",
    emoji: "👨‍👩‍👧",
    blurb: "Relations, friends, and the people around us.",
    accent: "text-cefr-a1",
    keywords: [
      "family", "mother", "mom", "mum", "father", "dad", "parent", "child",
      "son", "daughter", "brother", "sister", "sibling", "uncle", "aunt",
      "cousin", "grandmother", "grandfather", "grandparent", "grandchild",
      "wife", "husband", "spouse", "marry", "marriage", "married", "wedding",
      "baby", "kid", "friend", "friendship", "neighbour", "neighbor",
      "relative", "orphan", "twins", "bride", "groom", "divorce",
    ],
  },
  {
    slug: "body",
    name: "Body & Health",
    emoji: "🫀",
    blurb: "Anatomy, illness, and staying well.",
    accent: "text-red-400",
    keywords: [
      "body", "head", "hair", "face", "eye", "ear", "nose", "mouth", "tooth",
      "teeth", "neck", "shoulder", "arm", "hand", "finger", "leg", "foot",
      "knee", "heart", "blood", "bone", "skin", "brain", "lung", "stomach",
      "health", "healthy", "sick", "ill", "illness", "disease", "pain",
      "hurt", "wound", "injury", "medicine", "medical", "doctor", "nurse",
      "hospital", "clinic", "patient", "treatment", "cure", "recover",
      "fever", "cough", "cold", "infection", "virus", "exercise", "diet",
      "tired", "weak", "strong", "breath", "breathe", "muscle",
    ],
  },
  {
    slug: "home",
    name: "Home & Living",
    emoji: "🏡",
    blurb: "Houses, rooms, and the things inside.",
    accent: "text-moss-500",
    keywords: [
      "home", "house", "flat", "apartment", "building", "room", "kitchen",
      "bedroom", "bathroom", "living", "garden", "yard", "garage", "basement",
      "door", "window", "wall", "floor", "ceiling", "roof", "stairs", "gate",
      "furniture", "table", "chair", "bed", "sofa", "shelf", "cupboard",
      "drawer", "mirror", "lamp", "carpet", "curtain", "blanket", "pillow",
      "key", "lock", "address", "neighbour", "neighbourhood", "rent",
      "furnish", "decorate", "cozy", "comfortable",
    ],
  },
  {
    slug: "work",
    name: "Work & Business",
    emoji: "💼",
    blurb: "Jobs, offices, companies, and careers.",
    accent: "text-cefr-b2",
    keywords: [
      "work", "job", "career", "profession", "office", "company", "business",
      "employ", "employer", "employee", "employment", "interview", "hire",
      "fire", "salary", "wage", "income", "boss", "manager", "staff",
      "colleague", "coworker", "meeting", "task", "project", "deadline",
      "client", "customer", "service", "trade", "industry", "factory",
      "production", "produce", "market", "marketing", "advertise", "sale",
      "contract", "agreement", "negotiate", "responsible", "duty", "shift",
      "retire", "promotion", "apply", "application", "experience", "skill",
    ],
  },
  {
    slug: "education",
    name: "Education & School",
    emoji: "📚",
    blurb: "Learning, teaching, and the classroom.",
    accent: "text-cefr-a2",
    keywords: [
      "school", "education", "learn", "learning", "teach", "teacher",
      "student", "pupil", "study", "studying", "class", "classroom", "lesson",
      "course", "subject", "exam", "examination", "test", "grade", "mark",
      "score", "homework", "assignment", "university", "college", "degree",
      "diploma", "book", "textbook", "library", "knowledge", "know",
      "understand", "research", "essay", "report", "lecture", "professor",
      "principal", "pupil", "scholarship", "graduate", "revision", "revise",
      "practice", "academic", "curriculum", "term", "semester",
    ],
  },
  {
    slug: "nature",
    name: "Nature & Environment",
    emoji: "🌿",
    blurb: "Trees, rivers, weather, and the outdoors.",
    accent: "text-moss-500",
    keywords: [
      "nature", "natural", "tree", "flower", "grass", "leaf", "leaves",
      "forest", "wood", "plant", "garden", "river", "lake", "sea", "ocean",
      "beach", "mountain", "hill", "valley", "island", "desert", "field",
      "farm", "environment", "climate", "pollution", "recycle", "green",
      "earth", "ground", "soil", "stone", "rock", "sand", "sky", "cloud",
      "sun", "moon", "star", "wind", "rain", "snow", "storm", "season",
      "spring", "summer", "autumn", "winter", "weather", "wildlife",
    ],
  },
  {
    slug: "emotions",
    name: "Emotions & Feelings",
    emoji: "💭",
    blurb: "How we feel — joy, fear, anger, and calm.",
    accent: "text-ember",
    keywords: [
      "happy", "happiness", "sad", "sadness", "angry", "anger", "love",
      "hate", "afraid", "fear", "scared", "worried", "worry", "anxious",
      "excited", "excitement", "calm", "relaxed", "nervous", "proud",
      "ashamed", "guilty", "jealous", "lonely", "bored", "boring", "surprised",
      "surprise", "shocked", "disappointed", "grateful", "thankful", "hope",
      "hopeful", "despair", "miserable", "delighted", "pleased", "upset",
      "emotion", "feeling", "mood", "feel", "felt", "passion", "enjoy",
    ],
  },
  {
    slug: "clothing",
    name: "Clothing & Shopping",
    emoji: "🛍️",
    blurb: "What we wear and how we buy it.",
    accent: "text-cefr-b1",
    keywords: [
      "clothes", "clothing", "shirt", "t-shirt", "trousers", "pants",
      "jeans", "skirt", "dress", "jacket", "coat", "jumper", "sweater",
      "shoe", "shoes", "boot", "hat", "cap", "glove", "scarf", "sock",
      "pocket", "button", "zip", "collar", "wear", "fit", "size",
      "shop", "store", "shopping", "buy", "bought", "sell", "sold", "sale",
      "price", "cost", "expensive", "cheap", "discount", "receipt", "cash",
      "change", "customer", "market", "mall", "brand", "fashion",
    ],
  },
  {
    slug: "sports",
    name: "Sports & Leisure",
    emoji: "⚽",
    blurb: "Games, music, art, and free time.",
    accent: "text-cefr-a2",
    keywords: [
      "sport", "sports", "play", "game", "match", "team", "player", "ball",
      "race", "racing", "win", "won", "lose", "lost", "loss", "score",
      "goal", "football", "tennis", "swim", "swimming", "run", "running",
      "cycle", "gym", "fitness", "athlete", "champion", "competition",
      "music", "musical", "song", "sing", "singer", "dance", "dancing",
      "instrument", "guitar", "piano", "art", "artist", "paint", "painting",
      "draw", "drawing", "film", "movie", "cinema", "theatre", "theater",
      "hobby", "leisure", "relax", "fun",
    ],
  },
  {
    slug: "technology",
    name: "Technology & Media",
    emoji: "💻",
    blurb: "Screens, signals, and the digital world.",
    accent: "text-cefr-a2",
    keywords: [
      "computer", "laptop", "phone", "mobile", "smartphone", "tablet",
      "screen", "keyboard", "mouse", "software", "hardware", "program",
      "programming", "code", "app", "application", "internet", "online",
      "website", "email", "message", "text", "digital", "data", "file",
      "download", "upload", "click", "battery", "charge", "device",
      "technology", "television", "tv", "radio", "video", "camera",
      "photograph", "photo", "picture", "news", "newspaper", "magazine",
      "social", "network", "virtual",
    ],
  },
  {
    slug: "animals",
    name: "Animals",
    emoji: "🐾",
    blurb: "Creatures wild and tame.",
    accent: "text-cefr-b2",
    keywords: [
      "animal", "dog", "cat", "horse", "cow", "sheep", "pig", "goat",
      "chicken", "duck", "rabbit", "mouse", "rat", "bird", "fish", "shark",
      "whale", "bear", "lion", "tiger", "elephant", "monkey", "snake",
      "insect", "bee", "fly", "spider", "pet", "wild", "wildlife", "tail",
      "fur", "feather", "wing", "claw", "cage", "zoo", "creature", "beast",
    ],
  },
  {
    slug: "money",
    name: "Money & Finance",
    emoji: "💰",
    blurb: "Cash, costs, banks, and budgets.",
    accent: "text-cefr-b1",
    keywords: [
      "money", "cash", "coin", "note", "bank", "account", "card", "credit",
      "debit", "loan", "debt", "budget", "spend", "spent", "save", "saving",
      "cost", "price", "pay", "paid", "payment", "fee", "tax", "bill",
      "receipt", "rich", "wealthy", "poor", "poverty", "income", "salary",
      "wage", "expensive", "afford", "econom", "finance", "financial",
      "invest", "investment", "profit", "loss", "currency", "exchange",
      "value", "worth",
    ],
  },
  {
    slug: "city",
    name: "City & Places",
    emoji: "🏙️",
    blurb: "Streets, buildings, and public spaces.",
    accent: "text-cefr-b2",
    keywords: [
      "city", "town", "village", "capital", "centre", "center", "downtown",
      "suburb", "district", "neighbourhood", "neighborhood", "street", "road",
      "avenue", "square", "block", "corner", "crossroads", "bridge",
      "building", "skyscraper", "office", "shop", "bank", "museum",
      "gallery", "library", "church", "temple", "mosque", "castle", "palace",
      "monument", "statue", "fountain", "park", "plaza", "market", "mall",
      "station", "stadium", "university", "school", "hospital", "pharmacy",
      "restaurant", "cafe", "bar", "hotel", "landmark", "location",
    ],
  },
  {
    slug: "communication",
    name: "Communication",
    emoji: "💬",
    blurb: "Speaking, listening, and exchanging ideas.",
    accent: "text-cefr-a2",
    keywords: [
      "speak", "talk", "conversation", "chat", "discuss", "discussion",
      "explain", "describe", "announce", "argue", "debate", "language",
      "sentence", "voice", "speech", "listen", "communicate", "communication",
      "express", "expression", "message", "letter", "gesture", "translate",
      "translator", "interpreter", "accent", "dialect", "greeting", "greet",
      "apolog", "complain", "comment", "remark", "statement", "speech",
      "whisper", "shout", "yell", "pronunciation", "grammar", "vocabulary",
      "conversation", "dialogue", "interview",
    ],
  },
  {
    slug: "mind",
    name: "Mind & Thinking",
    emoji: "🧠",
    blurb: "Thoughts, memory, and decisions.",
    accent: "text-ember",
    keywords: [
      "thought", "belief", "understand", "understanding", "remember",
      "forget", "memory", "imagine", "imagination", "idea", "decide",
      "decision", "choose", "choice", "consider", "realize", "recognise",
      "recognize", "suppose", "guess", "wonder", "discover", "solve",
      "logic", "logical", "clever", "intelligent", "intellige", "wisdom",
      "confuse", "confused", "confusion", "concentrate", "concentration",
      "focus", "brain", "puzzle", "riddle", "theory", "hypothesis",
      "analyse", "analyze", "analysis", "conclude", "conclusion", "assume",
      "assumption", "predict", "prediction", "calculate", "estimate",
    ],
  },
  {
    slug: "time",
    name: "Time & Dates",
    emoji: "⏰",
    blurb: "Hours, days, seasons, and the clock.",
    accent: "text-cefr-a1",
    keywords: [
      "clock", "watch", "hour", "minute", "second", "moment", "midnight",
      "noon", "morning", "afternoon", "evening", "weekend", "month", "yearly",
      "decade", "century", "today", "tomorrow", "yesterday", "calendar",
      "schedule", "monday", "tuesday", "wednesday", "thursday", "friday",
      "saturday", "sunday", "january", "february", "march", "april",
      "season", "spring", "summer", "autumn", "winter", "deadline",
      "timetable", "appointment", "anniversary", "century", "millennium",
      "o'clock", "midday", "dawn", "dusk", "sunset", "sunrise", "time zone",
    ],
  },
];

// Build matcher: for each topic, a single regex of all keywords with boundaries.
const topicMatchers = TOPICS.map((t) => ({
  slug: t.slug,
  re: new RegExp(`\\b(${t.keywords.join("|")})`, "i"),
}));

export function assignTopics(input: {
  word: string;
  definitionEn?: string | null;
  example?: string | null;
  synonyms?: string[];
}): string[] {
  const haystack = `${input.word} ${input.definitionEn ?? ""} ${input.example ?? ""} ${
    (input.synonyms ?? []).join(" ")
  }`;
  const matched: string[] = [];
  for (const m of topicMatchers) {
    if (m.re.test(haystack)) matched.push(m.slug);
  }
  return matched;
}

export function topicBySlug(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
