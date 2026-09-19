"use client";

import { useState } from "react";

import Icon from "../../components/Icons/Icons";
import { Badge, Button, Card, Dropdown, ErrorNote, PageHeader, Switch } from "../../components/ui/UI";
import { api, useApi } from "../../lib/api";
import { API_URL } from "../../lib/detection/scan";
import { siteOptions } from "../../lib/options";
import { resetSettings, updateSettings, useSettings } from "../../lib/settings";
import ops from "../ops.module.css";
import styles from "./page.module.css";

export default function Settings() {
  const settings = useSettings();
  const sites = useApi("sites/");
  const health = useApi("health/");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Every change is saved to the database straight away
  const save = async (patch) => {
    setError("");
    setStatus("saving");
    try {
      await (patch ? updateSettings(patch) : resetSettings());
      setStatus("saved");
      setTimeout(() => setStatus(""), 1400);
    } catch (saveError) {
      setError(saveError.message);
      setStatus("");
    }
  };

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="System Configuration"
        title="Settings"
        description="Command-centre preferences, stored in the SmartWaste database and shared by every operator."
        actions={
          <>
            {status === "saving" && <Badge tone="neutral">Saving…</Badge>}
            {status === "saved" && (
              <Badge tone="ok" dot>
                Saved
              </Badge>
            )}
            <Button variant="secondary" icon="refresh" onClick={() => save(null)}>
              Reset preferences
            </Button>
          </>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className={styles.grid}>
        <Card title="Organisation" subtitle="Shown in the portal header">
          <Row title="Programme name" text="Appears in the government strip at the top of every page.">
            <OrganisationInput key={settings.organisation} value={settings.organisation} onSave={(organisation) => save({ organisation })} />
          </Row>
          <Row title="Default monitoring site" text="The active jurisdiction; also pre-selected when saving reports.">
            <Dropdown
              className={styles.control}
              value={settings.defaultSite}
              onChange={(defaultSite) => save({ defaultSite })}
              options={siteOptions(sites.data)}
              placeholder={sites.loading ? "Loading sites…" : "Select a site"}
              label="Default monitoring site"
            />
          </Row>
        </Card>

        <Card title="Detection" subtitle="Defaults for the Live Detection player">
          <Row title="Minimum confidence" text="Hide items the detector is less sure about than this.">
            <ConfidenceSlider key={settings.minConfidence} value={settings.minConfidence} onSave={(minConfidence) => save({ minConfidence })} />
          </Row>
          <Row title="Item outlines" text="Trace the exact shape of each detected item.">
            <Switch checked={settings.showOutlines} onChange={(value) => save({ showOutlines: value })} />
          </Row>
          <Row title="Bounding boxes" text="Draw a rectangle around each item.">
            <Switch checked={settings.showBoxes} onChange={(value) => save({ showBoxes: value })} />
          </Row>
          <Row title="Labels" text="Show the waste type and confidence above each item.">
            <Switch checked={settings.showLabels} onChange={(value) => save({ showLabels: value })} />
          </Row>
        </Card>

        <Card title="Interface">
          <Row title="High-severity alerts" text="Show new high and critical reports in the notification bell.">
            <Switch checked={settings.alertsEnabled} onChange={(value) => save({ alertsEnabled: value })} />
          </Row>
        </Card>

        <Card title="System">
          <dl className={styles.info}>
            <div>
              <dt>Application</dt>
              <dd>SmartWaste AI · Command Centre</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>2.1.0</dd>
            </div>
            <div>
              <dt>Detection engine</dt>
              <dd>YOLOE-26L (open vocabulary, segmentation)</dd>
            </div>
            <div>
              <dt>API endpoint</dt>
              <dd className={styles.mono}>{API_URL}</dd>
            </div>
            <div>
              <dt>Server status</dt>
              <dd>
                {health.loading ? (
                  "Checking…"
                ) : health.data?.success ? (
                  <Badge tone="ok" dot>
                    Online
                  </Badge>
                ) : (
                  <Badge tone="danger" dot>
                    Offline
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <TeamManager />
      </div>
    </main>
  );
}

// ==================================================
// FIELD TEAMS
// ==================================================

function TeamManager() {
  const teams = useApi("teams/");
  const [form, setForm] = useState({ name: "", supervisor: "", phone: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const add = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const team = await api("teams/", { method: "POST", body: form });
      teams.setData((list) => [...(list || []), team].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: "", supervisor: "", phone: "" });
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
  };

  const toggle = async (team) => {
    setError("");
    try {
      const updated = await api(`teams/${team.id}/`, { method: "PATCH", body: { is_active: !team.is_active } });
      teams.setData((list) => list.map((item) => (item.id === team.id ? updated : item)));
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const remove = async (team) => {
    if (!window.confirm(`Remove ${team.name}? Existing tasks keep the team name.`)) return;
    setError("");
    try {
      await api(`teams/${team.id}/`, { method: "DELETE" });
      teams.setData((list) => list.filter((item) => item.id !== team.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <Card title="Field teams" subtitle="Crews that can be assigned cleanup tasks" padded={false}>
      <form className={styles.teamForm} onSubmit={add}>
        <input value={form.name} onChange={set("name")} placeholder="Team name" required maxLength={120} aria-label="Team name" />
        <input value={form.supervisor} onChange={set("supervisor")} placeholder="Supervisor" aria-label="Supervisor" />
        <input value={form.phone} onChange={set("phone")} placeholder="Phone" inputMode="tel" aria-label="Phone" />
        <Button type="submit" icon="plus" disabled={saving}>
          Add team
        </Button>
      </form>

      {error && (
        <div style={{ padding: "0 18px" }}>
          <ErrorNote message={error} />
        </div>
      )}

      <div className={ops.tableWrap}>
        <table className={ops.table} style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>Team</th>
              <th>Supervisor</th>
              <th>Phone</th>
              <th>Open tasks</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {(teams.data || []).map((team) => (
              <tr key={team.id} style={{ cursor: "default" }}>
                <td>
                  <span className={ops.primary}>{team.name}</span>
                </td>
                <td>{team.supervisor || "—"}</td>
                <td>{team.phone || "—"}</td>
                <td className={ops.num}>{team.open_tasks}</td>
                <td>
                  <button className={styles.statusToggle} onClick={() => toggle(team)} title="Change availability">
                    <Badge tone={team.is_active ? "ok" : "neutral"} dot>
                      {team.is_active ? "Available" : "Paused"}
                    </Badge>
                  </button>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className={styles.remove} onClick={() => remove(team)} aria-label={`Remove ${team.name}`}>
                    <Icon name="trash" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>Paused teams are hidden from the task assignment list.</p>
    </Card>
  );
}

// ==================================================
// CONTROLS
// ==================================================

function Row({ title, text, children }) {
  return (
    <div className={styles.row}>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      {children}
    </div>
  );
}

// Saves when the operator lets go of the slider, not on every step
function ConfidenceSlider({ value, onSave }) {
  const [draft, setDraft] = useState(value);

  return (
    <div className={styles.range}>
      <input
        type="range"
        min="0.25"
        max="0.9"
        step="0.05"
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={() => draft !== value && onSave(draft)}
        onKeyUp={() => draft !== value && onSave(draft)}
        aria-label="Minimum confidence"
      />
      <b>{Math.round(draft * 100)}%</b>
    </div>
  );
}

function OrganisationInput({ value, onSave }) {
  const [draft, setDraft] = useState(value);

  return (
    <input
      className={styles.text}
      value={draft}
      maxLength={160}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() && draft !== value && onSave(draft.trim())}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      aria-label="Programme name"
    />
  );
}
