"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
import { api, useApi } from "../../lib/api";
import { PRIORITY_META, TASK_STATUS, formatDate, reportCode } from "../../lib/format";
import ops from "../ops.module.css";
import styles from "./page.module.css";

const COLUMNS = ["open", "in_progress", "completed"];

const NEXT = { open: "in_progress", in_progress: "completed" };
const PREVIOUS = { in_progress: "open", completed: "in_progress" };

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export default function CleanupTasksPage() {
  return (
    <Suspense>
      <CleanupTasks />
    </Suspense>
  );
}

function CleanupTasks() {
  // Set when arriving from search: the task to bring into view
  const focusId = Number(useSearchParams().get("task")) || null;
  const tasks = useApi("tasks/");
  const teams = useApi("teams/");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [priority, setPriority] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const all = useMemo(() => tasks.data || [], [tasks.data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all
      .filter(
        (task) =>
          (!team || String(task.team) === team) &&
          (!priority || task.priority === priority) &&
          (!term || `${task.title} ${task.site_name} ${task.team_name || ""}`.toLowerCase().includes(term))
      )
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date || "").localeCompare(b.due_date || ""));
  }, [all, query, team, priority]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = all.filter((task) => task.status !== "completed" && task.due_date && task.due_date < today);

  const move = async (task, status) => {
    setError("");
    const previous = task.status;
    tasks.setData((list) => list.map((item) => (item.id === task.id ? { ...item, status } : item)));

    try {
      const updated = await api(`tasks/${task.id}/`, { method: "PATCH", body: { status } });
      tasks.setData((list) => list.map((item) => (item.id === task.id ? updated : item)));
    } catch (moveError) {
      setError(moveError.message);
      tasks.setData((list) => list.map((item) => (item.id === task.id ? { ...item, status: previous } : item)));
    }
  };

  const remove = async (task) => {
    if (!window.confirm(`Delete the task "${task.title}"?`)) return;
    try {
      await api(`tasks/${task.id}/`, { method: "DELETE" });
      tasks.setData((list) => list.filter((item) => item.id !== task.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Field Operations"
        title="Cleanup Tasks"
        description="Assign field teams to clear detected litter and track the work through to completion."
        actions={
          <>
            <DemoNote />
            <Button icon="plus" onClick={() => setCreating(true)}>
              New task
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard icon="tasks" label="Open" value={all.filter((task) => task.status === "open").length} note="Not yet started" tone="warn" />
        <StatCard
          icon="users"
          label="In Progress"
          value={all.filter((task) => task.status === "in_progress").length}
          note="Teams on site"
          tone="info"
        />
        <StatCard icon="check" label="Completed" value={all.filter((task) => task.status === "completed").length} note="Litter cleared" />
        <StatCard icon="calendar" label="Overdue" value={overdue.length} note="Past their due date" tone="danger" />
      </StatGrid>

      <div className={styles.toolbar}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search tasks, sites or teams" />
        <Select label="Team" value={team} onChange={setTeam} options={[["", "All teams"], ...(teams.data || []).map((item) => [String(item.id), item.name])]} />
        <Select
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[["", "All priorities"], ...Object.entries(PRIORITY_META).map(([key, meta]) => [key, meta.label])]}
        />
      </div>

      {(error || tasks.error) && <ErrorNote message={error || tasks.error} onRetry={tasks.error ? tasks.reload : undefined} />}

      {tasks.loading ? (
        <Loading rows={5} />
      ) : (
        <div className={styles.board}>
          {COLUMNS.map((column) => {
            const items = visible.filter((task) => task.status === column);
            return (
              <section key={column} className={styles.column}>
                <header>
                  <Badge tone={TASK_STATUS[column].tone} dot>
                    {TASK_STATUS[column].label}
                  </Badge>
                  <span>{items.length}</span>
                </header>

                <div className={styles.cards}>
                  {items.length === 0 ? (
                    <EmptyState icon="tasks" title="Nothing here" />
                  ) : (
                    items.map((task) => (
                      <article
                        key={task.id}
                        className={`${styles.card} ${task.id === focusId ? styles.focused : ""}`}
                        ref={task.id === focusId ? (node) => node?.scrollIntoView({ block: "center" }) : undefined}
                      >
                        <div className={styles.cardTop}>
                          <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>
                          <button className={styles.delete} onClick={() => remove(task)} aria-label="Delete task">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>

                        <h3>{task.title}</h3>
                        {task.description && <p>{task.description}</p>}

                        <div className={ops.meta}>
                          <span>
                            <Icon name="pin" size={13} />
                            {task.site_name}
                          </span>
                          <span>
                            <Icon name="users" size={13} />
                            {task.team_name || "Unassigned"}
                          </span>
                          <span className={task.status !== "completed" && task.due_date && task.due_date < today ? styles.late : ""}>
                            <Icon name="calendar" size={13} />
                            {task.status === "completed" ? `Done ${formatDate(task.completed_at)}` : `Due ${formatDate(task.due_date)}`}
                          </span>
                          {task.report && (
                            <span>
                              <Icon name="reports" size={13} />
                              {reportCode(task.report)}
                            </span>
                          )}
                        </div>

                        <div className={styles.moves}>
                          {PREVIOUS[task.status] && (
                            <Button variant="ghost" onClick={() => move(task, PREVIOUS[task.status])}>
                              Move back
                            </Button>
                          )}
                          {NEXT[task.status] && (
                            <Button variant="secondary" onClick={() => move(task, NEXT[task.status])}>
                              {task.status === "open" ? "Start work" : "Mark complete"}
                              <Icon name="arrowRight" size={14} />
                            </Button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {creating && (
        <TaskForm
          onClose={() => setCreating(false)}
          onSaved={(task) => {
            setCreating(false);
            tasks.setData((list) => [task, ...(list || [])]);
          }}
        />
      )}
    </main>
  );
}
