"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../../components/Icons/Icons";
import TaskForm from "../../components/TaskForm/TaskForm";
import {
  Badge,
  Button,
  DemoNote,
  EmptyState,
  ErrorNote,
  Loading,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  StatGrid,
} from "../../components/ui/UI";
import { useApi } from "../../lib/api";
import { PRIORITY_META, SEVERITY_META, timeAgo } from "../../lib/format";
import { INTERVENTIONS, recommend, taskDescription } from "../../lib/playbook";
import ops from "../ops.module.css";
import styles from "./page.module.css";

const TABS = [
  ["plans", "Site action plans", "tasks"],
  ["playbook", "Intervention playbook", "layers"],
];

const LEVELS = { Low: 1, Medium: 2, High: 3 };

export default function Solutions() {
  const sites = useApi("sites/");
  const [tab, setTab] = useState("plans");
  const [level, setLevel] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [taskFor, setTaskFor] = useState(null);

  const recommendations = useMemo(() => recommend(sites.data || []), [sites.data]);

  const term = query.trim().toLowerCase();
  const visible = recommendations.filter(
    (item) =>
      (!level || item.site.stats.priority_level === level) &&
      (!term || `${item.title} ${item.site.name} ${item.site.district} ${item.site.state} ${item.dominant || ""}`.toLowerCase().includes(term))
  );

  const selected = visible.find((item) => item.id === selectedId) || visible[0] || null;

  // How many sites each intervention is currently recommended for
  const usage = useMemo(() => {
    const counts = {};
    recommendations.forEach((item) => {
      counts[item.trigger] = (counts[item.trigger] || 0) + 1;
    });
    return counts;
  }, [recommendations]);

  const urgent = recommendations.filter((item) => ["critical", "high"].includes(item.site.stats.priority_level));
  const uncleared = recommendations.reduce((sum, item) => sum + item.site.stats.unresolved_items, 0);
  const complaints = recommendations.reduce((sum, item) => sum + item.site.stats.open_issues, 0);

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Waste Management"
        title="Solutions"
        description="Site action plans built from detection evidence, each with an owner, a phased timeline, its legal basis and how to measure success."
        actions={<DemoNote />}
      />

      <StatGrid>
        <StatCard icon="tasks" label="Action plans" value={recommendations.length} note="Sites above low priority" />
        <StatCard icon="alert" label="Act this week" value={urgent.length} note="Critical and high priority" tone="danger" />
        <StatCard icon="layers" label="Uncleared items" value={uncleared} note="At sites with a plan" tone="warn" />
        <StatCard icon="flag" label="Open complaints" value={complaints} note="From citizens at these sites" tone="info" />
      </StatGrid>

      <div className={styles.tabs} role="tablist">
        {TABS.map(([value, label, icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? styles.tabActive : styles.tab}
            onClick={() => setTab(value)}
          >
            <Icon name={icon} size={15} />
            {label}
            <span className={styles.tabCount}>{value === "plans" ? recommendations.length : INTERVENTIONS.length}</span>
          </button>
        ))}
      </div>

      {sites.error && <ErrorNote message={sites.error} onRetry={sites.reload} />}

      {tab === "plans" ? (
        sites.loading ? (
          <Loading rows={4} />
        ) : recommendations.length === 0 ? (
          <EmptyState icon="check" title="No sites need intervention" text="Every monitored site is at low priority." />
        ) : (
          <div className={styles.planLayout}>
            <aside className={styles.planList} aria-label="Sites needing intervention">
              <div className={styles.listTools}>
                <SearchInput value={query} onChange={setQuery} placeholder="Search sites or plans" />
                <Select
                  label="Priority"
                  value={level}
                  onChange={setLevel}
                  options={[["", "All priorities"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"]]}
                />
              </div>

              {visible.length === 0 ? (
                <p className={styles.noMatch}>No plans match these filters.</p>
              ) : (
                <ol className={styles.list}>
                  {visible.map((item) => {
                    const priority = PRIORITY_META[item.site.stats.priority_level];
                    const rank = recommendations.indexOf(item) + 1;
                    return (
                      <li key={item.id}>
                        <button
                          className={`${styles.listItem} ${selected?.id === item.id ? styles.listActive : ""}`}
                          onClick={() => setSelectedId(item.id)}
                          aria-current={selected?.id === item.id}
                        >
                          <span className={styles.rank}>{rank}</span>
                          <span className={styles.listText}>
                            <strong>{item.site.name}</strong>
                            <small>{item.title}</small>
                            <span className={styles.listMeta}>
                              <Badge tone={priority.tone}>{priority.label}</Badge>
                              <span>
                                {item.site.district}, {item.site.state}
                              </span>
                            </span>
                          </span>
                          <Icon name="chevron" size={15} className={styles.listChevron} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </aside>

            {selected && (
              <PlanDetail
                key={selected.id}
                item={selected}
                rank={recommendations.indexOf(selected) + 1}
                total={recommendations.length}
                onCreateTask={() => setTaskFor(selected)}
              />
            )}
          </div>
        )
      ) : (
        <div className={styles.playbook}>
          {INTERVENTIONS.map((play) => (
            <PlayCard key={play.trigger} play={play} sites={usage[play.trigger] || 0} />
          ))}
        </div>
      )}

      {taskFor && (
        <TaskForm
          initial={{
            site: taskFor.site.id,
            title: `${taskFor.title} · ${taskFor.site.name}`.slice(0, 200),
            description: taskDescription(taskFor),
            priority: taskFor.site.stats.priority_level,
          }}
          onClose={() => setTaskFor(null)}
          onSaved={() => setTaskFor(null)}
        />
      )}
    </main>
  );
}

// ==================================================
// SITE ACTION PLAN
// ==================================================

function PlanDetail({ item, rank, total, onCreateTask }) {
  const { site } = item;
  const stats = site.stats;
  const priority = PRIORITY_META[stats.priority_level];
  const severity = stats.latest_severity ? SEVERITY_META[stats.latest_severity] : null;
  const categories = Object.entries(stats.top_categories);
  const peak = Math.max(1, ...categories.map(([, count]) => count));

  return (
    <article className={styles.detail}>
      <header className={styles.detailHead}>
        <div className={styles.detailTags}>
          <Badge tone={priority.tone} dot>
            {priority.label} priority
          </Badge>
          <span className={styles.category}>
            <Icon name={item.icon} size={13} />
            {item.category}
          </span>
          <span className={styles.rankText}>
            Rank {rank} of {total}
          </span>
        </div>

        <h2>{item.title}</h2>
        <p className={styles.location}>
          <Icon name="pin" size={14} />
          {site.name}, {site.district}, {site.state}
          {site.camera_id && <span className={styles.camera}>{site.camera_id}</span>}
        </p>

        <div className={styles.detailActions}>
          <Link href={`/waste-map?site=${site.id}`} className={styles.linkButton}>
            <Icon name="map" size={15} />
            View on map
          </Link>
          <Link href={`/reports?site=${site.id}`} className={styles.linkButton}>
            <Icon name="reports" size={15} />
            Reports
          </Link>
          <Button icon="tasks" onClick={onCreateTask}>
            Create cleanup task
          </Button>
        </div>
      </header>

      <p className={styles.summary}>{item.summary}</p>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Why this site</h3>

        <div className={styles.evidence}>
          <Figure label="Priority score" value={stats.priority_score} tone={priority.tone} />
          <Figure label="Uncleared items" value={stats.unresolved_items} note={`${stats.plastic_items} plastic`} />
          <Figure label="Open complaints" value={stats.open_issues} />
          <Figure label="Open tasks" value={stats.open_tasks} />
        </div>

        <p className={styles.reason}>
          <Icon name="info" size={14} />
          <span>
            Recommended because {item.reason}.
            {stats.last_report_at && (
              <>
                {" "}
                Latest report {timeAgo(stats.last_report_at)}
                {severity && <> rated {severity.label.toLowerCase()}</>}.
              </>
            )}
          </span>
        </p>

        {categories.length > 0 && (
          <ul className={styles.mix} aria-label="Uncleared waste by type">
            {categories.map(([label, count]) => (
              <li key={label} className={label === item.dominant ? styles.mixLead : ""}>
                <span>{label}</span>
                <span className={styles.mixBar}>
                  <span style={{ width: `${(count / peak) * 100}%` }} />
                </span>
                <b>{count}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Action plan <span>{item.timeline}</span>
        </h3>
        <ol className={styles.timeline}>
          {item.steps.map(([phase, text], index) => (
            <li key={text}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <div>
                <span className={styles.phase}>{phase}</span>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.columns}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Responsibility and resources</h3>
          <dl className={styles.facts}>
            <div>
              <dt>Lead</dt>
              <dd>{item.lead}</dd>
            </div>
            <div>
              <dt>Supporting</dt>
              <dd>{item.support}</dd>
            </div>
            <div>
              <dt>Timeline</dt>
              <dd>{item.timeline}</dd>
            </div>
            <div>
              <dt>Effort</dt>
              <dd>
                <Level value={item.effort} />
              </dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>
                <Level value={item.cost} />
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Measure success</h3>
          <ul className={styles.kpis}>
            {item.kpis.map((kpi) => (
              <li key={kpi}>
                <Icon name="target" size={14} />
                {kpi}
              </li>
            ))}
          </ul>
          <p className={styles.impact}>
            <Icon name="bulb" size={14} />
            {item.impact}
          </p>
        </section>
      </div>

      <section className={styles.legal}>
        <Icon name="shieldCheck" size={18} />
        <div>
          <strong>Legal basis</strong>
          <p>{item.regulation}</p>
        </div>
      </section>
    </article>
  );
}

function Figure({ label, value, note, tone }) {
  return (
    <div className={styles.figure}>
      <span>{label}</span>
      <strong className={tone ? styles[`figure_${tone}`] : ""}>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

// Low / Medium / High as a three-step meter
function Level({ value }) {
  const filled = LEVELS[value] || 0;
  return (
    <span className={styles.level} title={`${value} (relative)`}>
      <span className={styles.levelBars} aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <i key={step} className={step <= filled ? styles[`level_${filled}`] : ""} />
        ))}
      </span>
      {value}
    </span>
  );
}

// ==================================================
// PLAYBOOK
// ==================================================

function PlayCard({ play, sites }) {
  return (
    <article className={styles.play}>
      <header className={styles.playHead}>
        <span className={styles.playIcon}>
          <Icon name={play.icon} size={19} />
        </span>
        <div>
          <span className={styles.category}>{play.category}</span>
          <h2>{play.title}</h2>
        </div>
        <span className={`${styles.usage} ${sites ? styles.usageActive : ""}`}>
          {sites ? `${sites} site${sites === 1 ? "" : "s"}` : "Not in use"}
        </span>
      </header>

      <p className={styles.trigger}>
        <Icon name="target" size={13} />
        Used when: <b>{play.trigger === "Community concern" ? "a site has repeated citizen complaints" : `${play.trigger} leads the uncleared waste`}</b>
      </p>

      <p className={styles.playSummary}>{play.summary}</p>

      <dl className={styles.playFacts}>
        <div>
          <dt>Lead</dt>
          <dd>{play.lead}</dd>
        </div>
        <div>
          <dt>Timeline</dt>
          <dd>{play.timeline}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>
            <Level value={play.effort} />
          </dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>
            <Level value={play.cost} />
          </dd>
        </div>
      </dl>

      <ol className={styles.playSteps}>
        {play.steps.map(([phase, text]) => (
          <li key={text}>
            <span>{phase}</span>
            {text}
          </li>
        ))}
      </ol>

      <div className={styles.playKpis}>
        <span>Success measures</span>
        <ul>
          {play.kpis.map((kpi) => (
            <li key={kpi}>{kpi}</li>
          ))}
        </ul>
      </div>

      <p className={styles.playLegal}>
        <Icon name="shieldCheck" size={13} />
        {play.regulation}
      </p>
    </article>
  );
}
