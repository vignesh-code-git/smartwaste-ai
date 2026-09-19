"use client";

import { useState } from "react";

import { api, useApi } from "../../lib/api";
import { PRIORITY_OPTIONS, siteOptions, teamOptions } from "../../lib/options";
import { Button, Dropdown, ErrorNote, Field, Modal } from "../ui/UI";
import styles from "./TaskForm.module.css";

// Creates a cleanup task. `initial` pre-fills the form, e.g. from a report
// or a recommendation; `onSaved` receives the created task.
export default function TaskForm({ initial = {}, onClose, onSaved }) {
  const sites = useApi("sites/");
  const teams = useApi("teams/");

  const [form, setForm] = useState({
    site: initial.site ? String(initial.site) : "",
    report: initial.report ?? null,
    title: initial.title ?? "",
    description: initial.description ?? "",
    team: initial.team ? String(initial.team) : "",
    priority: initial.priority ?? "medium",
    due_date: initial.due_date ?? inDays(3),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  const choose = (key) => (value) => setForm((previous) => ({ ...previous, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const task = await api("tasks/", {
        method: "POST",
        body: { ...form, site: Number(form.site), team: form.team ? Number(form.team) : null, due_date: form.due_date || null },
      });
      onSaved(task);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New cleanup task"
      subtitle="Assign a field team to clear litter at a site"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" icon="check" disabled={saving}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" className={styles.form} onSubmit={submit}>
        {error && <ErrorNote message={error} />}

        <Field label="Title" required>
          <input value={form.title} onChange={set("title")} required maxLength={200} placeholder="Clear roadside litter at…" />
        </Field>

        <div className={styles.row}>
          <Field label="Site" required>
            <Dropdown
              value={form.site}
              onChange={choose("site")}
              options={siteOptions(sites.data)}
              placeholder={sites.loading ? "Loading sites…" : "Select a site"}
              required
            />
          </Field>

          <Field label="Priority" required>
            <Dropdown value={form.priority} onChange={choose("priority")} options={PRIORITY_OPTIONS} />
          </Field>
        </div>

        <div className={styles.row}>
          <Field label="Assigned team" required>
            <Dropdown
              value={form.team}
              onChange={choose("team")}
              options={teamOptions(teams.data)}
              placeholder={teams.loading ? "Loading teams…" : "Select a team"}
              required
            />
          </Field>

          <Field label="Due date">
            <input type="date" value={form.due_date} onChange={set("due_date")} />
          </Field>
        </div>

        <Field label="Instructions">
          <textarea
            value={form.description}
            onChange={set("description")}
            placeholder="What needs to be collected, and any access notes"
          />
        </Field>
      </form>
    </Modal>
  );
}

function inDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
