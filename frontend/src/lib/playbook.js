// Interventions matched to the dominant waste type at a site. Each one is a
// short, phased plan with an owner, the rule it rests on and how to tell
// whether it worked. Costs are relative bands, not estimates.

const PLAYS = {
  carryBags: {
    trigger: "Plastic Bag",
    title: "Enforce the carry-bag ban",
    category: "Enforcement",
    icon: "flag",
    summary:
      "Loose carry bags point to shops still handing out banned bags. Inspect the shops and markets that feed the stretch, seize stock and offer a reusable alternative at the hotspot.",
    lead: "Local body health & sanitation wing",
    support: "State Pollution Control Board",
    timeline: "4 weeks",
    effort: "Medium",
    cost: "Low",
    steps: [
      ["Week 1", "Joint inspection of shops and markets within 500 m of the site"],
      ["Week 1", "Seize banned carry bags and issue notices under local bye-laws"],
      ["Week 2", "Cloth-bag distribution at the hotspot and the busiest shops"],
      ["Weeks 2–4", "Signage on the ban and the penalty at the collection point"],
      ["Ongoing", "Monthly re-inspection of the shops found in breach"],
    ],
    kpis: [
      "Plastic bags per detection report halve within 8 weeks",
      "No repeat violations at inspected shops",
    ],
    regulation:
      "Plastic Waste Management Rules, 2016 (as amended): carry bags thinner than 120 microns are banned from 31 December 2022.",
    impact: "Cuts new bag litter at the source",
  },
  bottles: {
    trigger: "Bottle / Can",
    title: "Set up bottle and can recovery",
    category: "Infrastructure",
    icon: "recycle",
    summary:
      "Bottles and cans are the easiest litter to recover and have resale value. Put segregated collection points where the footage shows them building up and route them to a recycler.",
    lead: "Local body sanitation wing",
    support: "Authorised recycler or waste-picker collective",
    timeline: "3 weeks",
    effort: "Medium",
    cost: "Medium",
    steps: [
      ["Week 1", "Find the busiest stretch from the detection timeline"],
      ["Weeks 1–2", "Install two segregated bins: PET bottles and metal cans"],
      ["Week 2", "Agree a weekly pickup with an authorised recycler"],
      ["Week 3", "Awareness boards at bus stops and shops"],
      ["Ongoing", "Record the weight collected at each pickup"],
    ],
    kpis: [
      "Bottles and cans per detection report fall week on week",
      "Kilograms of PET and cans recovered each week",
    ],
    regulation:
      "Solid Waste Management Rules, 2016: dry waste is to be segregated and handed to authorised recyclers.",
    impact: "Recovers high-value recyclables before they are dumped",
  },
  snackPackets: {
    trigger: "Chips / Snack Packet",
    title: "Take back multi-layer snack packaging",
    category: "Producer responsibility",
    icon: "users",
    summary:
      "Snack packets are multi-layer plastic that local recyclers rarely accept. Capture them at the point of sale and push the brands responsible to collect them.",
    lead: "Local body sanitation wing",
    support: "State Pollution Control Board and brand owners",
    timeline: "6 weeks",
    effort: "High",
    cost: "Low",
    steps: [
      ["Week 1", "Meet the snack vendors along the site"],
      ["Week 1", "A lidded bin beside every snack stall"],
      ["Weeks 2–4", "Notify the brand owners of their collection obligation"],
      ["Weeks 4–6", "Send collected packets to co-processing or a take-back scheme"],
      ["Ongoing", "Monthly vendor check and pickup"],
    ],
    kpis: [
      "Snack packets per detection report fall within 6 weeks",
      "Multi-layer plastic sent to co-processing each month",
    ],
    regulation:
      "Guidelines on Extended Producer Responsibility for Plastic Packaging, 2022: brand owners must collect multi-layered plastic packaging (Category III).",
    impact: "Reduces the hardest plastic to recover",
  },
  dumping: {
    trigger: "Garbage Bag",
    title: "Stop household dumping",
    category: "Collection service",
    icon: "camera",
    summary:
      "Bagged household waste on the roadside signals a gap in door-to-door collection. Close the gap first, then make the spot a place people do not dump.",
    lead: "Local body sanitation wing",
    support: "Ward councillor and local police",
    timeline: "4 weeks",
    effort: "Medium",
    cost: "Medium",
    steps: [
      ["Week 1", "Audit door-to-door collection for the surrounding households"],
      ["Weeks 1–2", "Fix missed routes and collection timings"],
      ["Week 2", "Warning boards with the penalty for dumping"],
      ["Weeks 2–4", "Camera watch or night patrol at the spot"],
      ["Ongoing", "Clean and green the spot so it stops attracting waste"],
    ],
    kpis: [
      "Garbage bags per detection report fall to zero",
      "Fewer citizen complaints from the ward",
    ],
    regulation:
      "Solid Waste Management Rules, 2016: segregated door-to-door collection, and no throwing or burning of waste in public places.",
    impact: "Closes the collection gap behind repeat dumping",
  },
  cups: {
    trigger: "Plastic Cup",
    title: "Replace plastic cups at tea and juice stalls",
    category: "Enforcement",
    icon: "bulb",
    summary:
      "Plastic cups and glasses are banned single-use items. Stalls near the site are the likely source; help them switch and give customers somewhere to put what they finish.",
    lead: "Local body health wing",
    support: "Traders' association",
    timeline: "3 weeks",
    effort: "Low",
    cost: "Low",
    steps: [
      ["Week 1", "Visit each tea and juice stall near the site"],
      ["Week 1", "Notice on the ban with a date to switch"],
      ["Week 2", "Help stalls move to washable or paper cups"],
      ["Week 2", "A bin beside every stall"],
      ["Week 3", "Recheck and recognise stalls that switched"],
    ],
    kpis: ["Plastic cups per detection report fall to zero", "Every stall compliant at the recheck"],
    regulation:
      "Plastic Waste Management (Amendment) Rules, 2021: plastic cups and glasses are banned from 1 July 2022.",
    impact: "Removes a daily source of cup litter",
  },
  paper: {
    trigger: "Paper Litter",
    title: "Add bins and raise sweeping frequency",
    category: "Street cleaning",
    icon: "tasks",
    summary:
      "Loose paper means too few bins or too little sweeping. It is cheap to fix and keeps light litter from spreading along the road.",
    lead: "Local body sanitation wing",
    support: "Street sweeping contractor",
    timeline: "2 weeks",
    effort: "Low",
    cost: "Low",
    steps: [
      ["Week 1", "Bins every 100 m along the stretch"],
      ["Week 1", "Sweeping twice a day at the hotspot"],
      ["Week 2", "Check bin fill levels and move bins that overflow"],
      ["Ongoing", "Monthly review of bin placement"],
    ],
    kpis: ["Paper litter per detection report halves", "No overflowing bins at spot checks"],
    regulation: "Solid Waste Management Rules, 2016: local bodies provide street sweeping and litter bins.",
    impact: "Keeps light litter off the road",
  },
  cartons: {
    trigger: "Carton / Tetra Pack",
    title: "Collect cartons as dry waste",
    category: "Recycling",
    icon: "recycle",
    summary:
      "Cartons and tetra packs are recyclable when kept dry and separate. Give shops a place to put them and a fixed day they are collected.",
    lead: "Local body sanitation wing",
    support: "Carton recycler",
    timeline: "3 weeks",
    effort: "Low",
    cost: "Low",
    steps: [
      ["Week 1", "Dry-waste bins at shops selling packaged drinks"],
      ["Week 2", "Link with a carton recycler"],
      ["Week 3", "Collection on a fixed weekday"],
      ["Ongoing", "Record the cartons sent for recycling"],
    ],
    kpis: ["Cartons per detection report fall", "Cartons diverted from landfill each month"],
    regulation: "Solid Waste Management Rules, 2016: dry waste is to be segregated and handed to authorised recyclers.",
    impact: "Diverts cartons from landfill",
  },
};

export const COMMUNITY = {
  trigger: "Community concern",
  title: "Run a community clean-up and awareness drive",
  category: "Behaviour change",
  icon: "users",
  summary:
    "Repeated complaints show residents care about the site. Turn that into ownership: a clean-up day, school sessions and a visible record of progress.",
  lead: "Ward councillor and residents' associations",
  support: "Schools, NGOs and the local body",
  timeline: "4 weeks",
  effort: "Medium",
  cost: "Low",
  steps: [
    ["Week 1", "Meet the residents' association and the complainants"],
    ["Week 2", "Clean-up day with residents and volunteers"],
    ["Week 3", "Awareness session at nearby schools"],
    ["Week 4", "Publish before and after results for the site"],
    ["Ongoing", "Residents report new dumping through Report an Issue"],
  ],
  kpis: ["Open complaints for the site fall", "Volunteers taking part in each drive"],
  regulation: "Swachh Bharat Mission (Urban) 2.0: citizen participation in keeping public spaces clean.",
  impact: "Builds local ownership of the site",
};

// Every intervention, in the order the playbook shows them
export const INTERVENTIONS = [...Object.values(PLAYS), COMMUNITY];

// Detector labels that share a play with another label
const ALIASES = {
  "Beverage Can": "Bottle / Can",
  Carton: "Carton / Tetra Pack",
};

const BY_TRIGGER = Object.fromEntries(Object.values(PLAYS).map((play) => [play.trigger, play]));

export function playFor(wasteType) {
  return BY_TRIGGER[ALIASES[wasteType] || wasteType] || null;
}

// A site with this many open complaints gets the community drive
const COMMUNITY_THRESHOLD = 2;

// One recommendation per site that needs attention, highest priority first
export function recommend(sites) {
  return sites
    .filter((site) => site.stats.priority_level !== "low")
    .map((site) => {
      const [dominant, count] = Object.entries(site.stats.top_categories)[0] || [];
      const play =
        site.stats.open_issues >= COMMUNITY_THRESHOLD || !dominant ? COMMUNITY : playFor(dominant) || COMMUNITY;

      return {
        id: `${site.id}-${play.trigger}`,
        site,
        dominant,
        dominantCount: count || 0,
        reason:
          play === COMMUNITY
            ? `residents have raised ${site.stats.open_issues} open complaint${site.stats.open_issues === 1 ? "" : "s"}`
            : `“${dominant}” is the leading uncleared waste type`,
        ...play,
      };
    })
    .sort((a, b) => b.site.stats.priority_score - a.site.stats.priority_score);
}

// Cleanup-task text for a recommendation
export function taskDescription(item) {
  return [
    item.summary,
    "",
    "Plan:",
    ...item.steps.map(([phase, text]) => `• ${phase}: ${text}`),
    "",
    "Measure success:",
    ...item.kpis.map((kpi) => `• ${kpi}`),
    "",
    `Lead: ${item.lead}`,
  ].join("\n");
}
