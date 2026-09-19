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
  Select,
  StatCard,
  StatGrid,
} from "../../components/ui/UI";
import { useApi } from "../../lib/api";
import { PRIORITY_META } from "../../lib/format";
import { COMMUNITY, PLAYBOOK, recommend } from "../../lib/playbook";
import ops from "../ops.module.css";
import styles from "./page.module.css";

const TABS = [
  ["recommended", "Recommended actions"],
  ["playbook", "Interventions"],
];

export default function Solutions() {
  const sites = useApi("sites/");
  const [tab, setTab] = useState("recommended");
  const [level, setLevel] = useState("");
  const [taskFor, setTaskFor] = useState(null);

  const recommendations = useMemo(() => recommend(sites.data || []), [sites.data]);
  const visible = recommendations.filter((item) => !level || item.site.stats.priority_level === level);

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Waste Management"
        title="Solutions"
        description="Interventions matched to each site's dominant waste type, ready to turn into cleanup work."
        actions={<DemoNote />}
      />

      <StatGrid>
        <StatCard icon="bulb" label="Recommendations" value={recommendations.length} note="For sites needing attention" />
        <StatCard
          icon="alert"
          label="Critical / High"
          value={recommendations.filter((item) => ["critical", "high"].includes(item.site.stats.priority_level)).length}
          note="Act this week"
          tone="danger"
        />
        <StatCard
          icon="layers"
          label="Plastic Focus"
          value={recommendations.filter((item) => item.dominant && item.dominant !== "Paper Litter" && item.dominant !== "Carton / Tetra Pack").length}
          note="Sites led by plastic waste"
          tone="info"
        />
        <StatCard icon="recycle" label="Playbook Measures" value={Object.keys(PLAYBOOK).length + 1} note="Standard interventions" tone="ok" />
      </StatGrid>

      <div className={styles.tabs} role="tablist">
        {TABS.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? styles.tabActive : styles.tab} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
        {tab === "recommended" && (
          <div className={styles.tabFilter}>
            <Select
              label="Priority"
              value={level}
              onChange={setLevel}
              options={[["", "All priorities"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"]]}
            />
          </div>
        )}
      </div>

      {sites.error && <ErrorNote message={sites.error} onRetry={sites.reload} />}

      {tab === "recommended" ? (
        sites.loading ? (
          <Loading rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState icon="check" title="No sites need intervention" text="Every site is at low priority." />
        ) : (
          <div className={styles.grid}>
            {visible.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.icon}>
                    <Icon name={item.icon} size={20} />
                  </span>
                  <Badge tone={PRIORITY_META[item.site.stats.priority_level].tone}>
                    {PRIORITY_META[item.site.stats.priority_level].label}
                  </Badge>
                </div>

                <h2>{item.title}</h2>
                <span className={styles.site}>
                  <Icon name="pin" size={13} />
                  {item.site.name}, {item.site.district}
                </span>
                <p>{item.summary}</p>

                {item.dominant && (
                  <div className={styles.evidence}>
                    <span>Evidence</span>
                    {item.dominantCount} × {item.dominant} · {item.site.stats.unresolved_items} uncleared items ·{" "}
                    {item.site.stats.open_issues} complaints
                  </div>
                )}

                <ul className={styles.steps}>
                  {item.actions.map((action) => (
                    <li key={action}>
                      <Icon name="check" size={14} />
                      {action}
                    </li>
                  ))}
                </ul>

                <div className={styles.cardFoot}>
                  <Link href={`/waste-map?site=${item.site.id}`} className={styles.link}>
                    View site
                  </Link>
                  <Button icon="tasks" onClick={() => setTaskFor(item)}>
                    Create task
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : (
        <div className={styles.grid}>
          {[...Object.entries(PLAYBOOK), ["Community concern", COMMUNITY]].map(([trigger, play]) => (
            <article key={trigger} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.icon}>
                  <Icon name={play.icon} size={20} />
                </span>
                <Badge tone="neutral">When: {trigger}</Badge>
              </div>
              <h2>{play.title}</h2>
              <p>{play.summary}</p>
              <ul className={styles.steps}>
                {play.actions.map((action) => (
                  <li key={action}>
                    <Icon name="check" size={14} />
                    {action}
                  </li>
                ))}
              </ul>
              <div className={styles.impact}>
                <Icon name="bulb" size={14} />
                {play.impact}
              </div>
            </article>
          ))}
        </div>
      )}

      {taskFor && (
        <TaskForm
          initial={{
            site: taskFor.site.id,
            title: `${taskFor.title} · ${taskFor.site.name}`,
            description: taskFor.actions.map((action) => `• ${action}`).join("\n"),
            priority: taskFor.site.stats.priority_level,
          }}
          onClose={() => setTaskFor(null)}
          onSaved={() => setTaskFor(null)}
        />
      )}
    </main>
  );
}
