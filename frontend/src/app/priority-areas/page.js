"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../../components/Icons/Icons";
import TaskForm from "../../components/TaskForm/TaskForm";
import {
  Badge,
  Button,
  Card,
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
import { PRIORITY_META, formatDate } from "../../lib/format";
import ops from "../ops.module.css";
import styles from "./page.module.css";

export default function PriorityAreas() {
  const sites = useApi("sites/");
  const [state, setState] = useState("");
  const [level, setLevel] = useState("");
  const [taskFor, setTaskFor] = useState(null);

  const all = useMemo(() => sites.data || [], [sites.data]);

  const ranked = useMemo(
    () =>
      all
        .filter((site) => (!state || site.state === state) && (!level || site.stats.priority_level === level))
        .sort((a, b) => b.stats.priority_score - a.stats.priority_score),
    [all, state, level]
  );

  const states = [...new Set(all.map((site) => site.state))].sort();
  const critical = all.filter((site) => site.stats.priority_level === "critical");
  const topScore = Math.max(1, ...all.map((site) => site.stats.priority_score));

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Area Analytics"
        title="Priority Areas"
        description="Sites ranked by uncleared litter, open citizen complaints and the severity of their latest report."
        actions={<DemoNote />}
      />

      {critical.length > 0 && (
        <div className={styles.alert}>
          <span className={styles.alertIcon}>
            <Icon name="alert" size={20} />
          </span>
          <div>
            <strong>
              {critical.length} area{critical.length === 1 ? "" : "s"} need immediate cleanup
            </strong>
            <p>{critical.map((site) => site.name).join(", ")}</p>
          </div>
        </div>
      )}

      <StatGrid>
        {["critical", "high", "medium", "low"].map((key) => (
          <StatCard
            key={key}
            icon={key === "low" ? "check" : "alert"}
            label={`${PRIORITY_META[key].label} priority`}
            value={all.filter((site) => site.stats.priority_level === key).length}
            note={{ critical: "Act today", high: "Act this week", medium: "Monitor closely", low: "Routine checks" }[key]}
            tone={{ critical: "danger", high: "warn", medium: "info", low: "ok" }[key]}
          />
        ))}
      </StatGrid>

      <Card
        title="Ranking"
        subtitle="Score = uncleared items + 5 × open complaints + latest severity weight"
        padded={false}
        actions={
          <div className={ops.filters}>
            <Select label="State" value={state} onChange={setState} options={[["", "All states"], ...states.map((name) => [name, name])]} />
            <Select
              label="Priority"
              value={level}
              onChange={setLevel}
              options={[["", "All priorities"], ...Object.entries(PRIORITY_META).map(([key, meta]) => [key, meta.label])]}
            />
          </div>
        }
      >
        {sites.error && (
          <div style={{ padding: 16 }}>
            <ErrorNote message={sites.error} onRetry={sites.reload} />
          </div>
        )}

        {sites.loading ? (
          <Loading rows={6} />
        ) : ranked.length === 0 ? (
          <EmptyState icon="alert" title="No areas match these filters" />
        ) : (
          <ol className={styles.ranking}>
            {ranked.map((site, index) => {
              const { stats } = site;
              return (
                <li key={site.id} className={styles.area}>
                  <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>

                  <div className={styles.areaMain}>
                    <div className={styles.areaTitle}>
                      <strong>{site.name}</strong>
                      <Badge tone={PRIORITY_META[stats.priority_level].tone}>{PRIORITY_META[stats.priority_level].label}</Badge>
                    </div>
                    <span className={ops.secondary}>
                      {site.district}, {site.state} · last report {formatDate(stats.last_report_at)}
                    </span>
                    <div className={styles.score}>
                      <span className={styles.scoreTrack}>
                        <span
                          style={{
                            width: `${(stats.priority_score / topScore) * 100}%`,
                          }}
                          className={styles[`fill_${stats.priority_level}`]}
                        />
                      </span>
                      <b>{stats.priority_score}</b>
                    </div>
                  </div>

                  <dl className={styles.figures}>
                    <div>
                      <dt>Uncleared</dt>
                      <dd>{stats.unresolved_items}</dd>
                    </div>
                    <div>
                      <dt>Plastic</dt>
                      <dd>{stats.plastic_items}</dd>
                    </div>
                    <div>
                      <dt>Complaints</dt>
                      <dd>{stats.open_issues}</dd>
                    </div>
                    <div>
                      <dt>Open tasks</dt>
                      <dd>{stats.open_tasks}</dd>
                    </div>
                  </dl>

                  <div className={styles.actions}>
                    <Link href={`/waste-map?site=${site.id}`} className={styles.mapLink}>
                      <Icon name="map" size={14} />
                      Map
                    </Link>
                    <Button variant="secondary" icon="tasks" onClick={() => setTaskFor(site)}>
                      Assign
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {taskFor && (
        <TaskForm
          initial={{
            site: taskFor.id,
            title: `Priority cleanup at ${taskFor.name}`,
            description: `${taskFor.stats.unresolved_items} uncleared items, ${taskFor.stats.open_issues} open complaints.`,
            priority: taskFor.stats.priority_level,
          }}
          onClose={() => setTaskFor(null)}
          onSaved={() => {
            setTaskFor(null);
            sites.reload();
          }}
        />
      )}
    </main>
  );
}
