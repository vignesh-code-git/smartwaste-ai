// Interventions matched to the dominant waste type at a site.

export const PLAYBOOK = {
  "Plastic Bag": {
    title: "Enforce the carry-bag restrictions",
    summary:
      "Inspect nearby shops and markets for banned single-use carry bags under the Plastic Waste Management Rules, and hand out cloth bags at hotspots.",
    actions: ["Joint inspection of shops within 500 m", "Cloth-bag distribution drive", "Signage at the collection point"],
    impact: "Cuts new bag litter at the source",
    icon: "flag",
  },
  "Bottle / Can": {
    title: "Install bottle and can collection points",
    summary:
      "Place clearly marked collection bins or a reverse vending point near bus stops and shops, and route the collected material to recyclers.",
    actions: ["Two collection bins at the busiest stretch", "Weekly pickup by the recycling partner", "Awareness boards on deposit returns"],
    impact: "Recovers high-value recyclables before they are dumped",
    icon: "recycle",
  },
  "Chips / Snack Packet": {
    title: "Engage snack vendors on packaging waste",
    summary:
      "Multi-layer snack packets are hard to recycle. Ask vendors and brand owners to take back packaging under extended producer responsibility, and add bins at the point of sale.",
    actions: ["Meet vendors within the site", "Bins at every snack stall", "Request brand take-back collection"],
    impact: "Reduces the hardest plastic to recover",
    icon: "users",
  },
  "Garbage Bag": {
    title: "Stop household dumping",
    summary:
      "Bagged household waste on the roadside signals gaps in door-to-door collection. Check coverage for the ward and put up warning boards with penalties.",
    actions: ["Audit door-to-door collection coverage", "Warning boards with the penalty for dumping", "Night patrol or camera watch"],
    impact: "Closes the collection gap behind repeat dumping",
    icon: "camera",
  },
  "Plastic Cup": {
    title: "Promote reusable cups at tea stalls",
    summary: "Work with tea and juice stalls to switch to washable cups, and place a bin beside each stall.",
    actions: ["Stall-by-stall visit", "Bin beside each stall", "Recognise stalls that switch"],
    impact: "Removes a daily source of cup litter",
    icon: "bulb",
  },
  "Paper Litter": {
    title: "Add litter bins and sweeping",
    summary: "Loose paper points to too few bins. Add bins at regular intervals and increase the sweeping frequency.",
    actions: ["Bins every 100 m along the stretch", "Sweeping twice daily", "Monthly review of bin fill levels"],
    impact: "Keeps light litter off the road",
    icon: "tasks",
  },
  "Carton / Tetra Pack": {
    title: "Set up dry-waste collection for cartons",
    summary: "Collect cartons and tetra packs separately as dry waste and send them to a carton recycler.",
    actions: ["Dry-waste bin at shops", "Link with a carton recycler", "Collection on a fixed weekday"],
    impact: "Diverts cartons from landfill",
    icon: "recycle",
  },
};

export const COMMUNITY = {
  title: "Run a community awareness drive",
  summary:
    "Repeated complaints from residents show local concern. Partner with residents' associations and schools for a clean-up day and awareness session.",
  actions: ["Clean-up day with residents", "School awareness session", "Publish the site's progress"],
  impact: "Builds local ownership of the site",
  icon: "users",
};

// One recommendation per site that needs attention.
export function recommend(sites) {
  return sites
    .filter((site) => site.stats.priority_level !== "low")
    .map((site) => {
      const [dominant, count] = Object.entries(site.stats.top_categories)[0] || [];
      const play = site.stats.open_issues >= 2 || !dominant ? COMMUNITY : PLAYBOOK[dominant] || COMMUNITY;

      return {
        id: `${site.id}-${play.title}`,
        site,
        dominant,
        dominantCount: count || 0,
        ...play,
      };
    })
    .sort((a, b) => b.site.stats.priority_score - a.site.stats.priority_score);
}
