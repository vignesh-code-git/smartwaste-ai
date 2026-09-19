"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import Icon from "../../components/Icons/Icons";
import IndiaMap, { PRIORITY_COLORS } from "../../components/IndiaMap/IndiaMap";
import TaskForm from "../../components/TaskForm/TaskForm";
import {
  Badge,
  Button,
  DemoNote,
  Dropdown,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  StatGrid,
} from "../../components/ui/UI";
import { api, useApi } from "../../lib/api";
import { PRIORITY_META, SEVERITY_META, formatDate } from "../../lib/format";
import { INDIAN_STATES } from "../../lib/india";
import ops from "../ops.module.css";
import styles from "./page.module.css";

export default function WasteMapPage() {
  return (
    <Suspense>
      <WasteMap />
    </Suspense>
  );
}

function WasteMap() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = Number(params.get("site")) || null;

  const sites = useApi("sites/");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [picking, setPicking] = useState(null);
  const [taskFor, setTaskFor] = useState(null);

  const all = useMemo(() => sites.data || [], [sites.data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all
      .filter(
        (site) =>
          (!state || site.state === state) &&
          (!term || `${site.name} ${site.locality} ${site.district} ${site.state}`.toLowerCase().includes(term))
      )
      .sort((a, b) => b.stats.priority_score - a.stats.priority_score);
  }, [all, query, state]);

  const selected = all.find((site) => site.id === selectedId) || null;
  const states = [...new Set(all.map((site) => site.state))].sort();

  const focus = useMemo(
    () => (selected ? { type: "site", latitude: selected.latitude, longitude: selected.longitude } : { type: "india" }),
    [selected]
  );

  const select = (id) => router.replace(id ? `/waste-map?site=${id}` : "/waste-map", { scroll: false });

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Location Intelligence"
        title="Waste Map"
        description="Monitoring sites across India, coloured by cleanup priority and sized by litter still on the ground."
        actions={
          <>
            <DemoNote />
            <Button
              variant={picking ? "secondary" : "primary"}
              icon={picking ? "close" : "plus"}
              onClick={() => setPicking(picking ? null : {})}
            >
              {picking ? "Cancel" : "Add site"}
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard icon="pin" label="Monitoring Sites" value={all.length} note={`${states.length} states and territories`} />
        <StatCard
          icon="alert"
          label="Critical Sites"
          value={all.filter((site) => site.stats.priority_level === "critical").length}
          note="Need immediate cleanup"
          tone="danger"
        />
        <StatCard
          icon="layers"
          label="Uncleared Items"
          value={all.reduce((sum, site) => sum + site.stats.unresolved_items, 0)}
          note="In unresolved reports"
          tone="warn"
        />
        <StatCard
          icon="flag"
          label="Citizen Complaints"
          value={all.reduce((sum, site) => sum + site.stats.open_issues, 0)}
          note="Open issues at sites"
          tone="info"
        />
      </StatGrid>

      {sites.error && <ErrorNote message={sites.error} onRetry={sites.reload} />}

      <div className={styles.layout}>
        <section className={styles.mapCard}>
          <div className={styles.mapToolbar}>
            <div className={styles.legend}>
              {Object.entries(PRIORITY_COLORS).map(([level, color]) => (
                <span key={level}>
                  <i style={{ background: color }} />
                  {PRIORITY_META[level].label}
                </span>
              ))}
            </div>
            <Button variant="ghost" icon="globe" onClick={() => select(null)}>
              All India
            </Button>
          </div>

          {picking && (
            <div className={styles.pickBanner}>
              <Icon name="locate" size={16} />
              Click on the map to place the new monitoring site
            </div>
          )}

          <div className={styles.mapArea}>
            <IndiaMap
              sites={visible}
              selectedId={selectedId}
              onSelect={select}
              focus={focus}
              picking={picking}
              onPick={(point) => setPicking(point)}
            />
          </div>
        </section>

        <aside className={styles.panel}>
          {selected ? (
            <SiteDetail
              site={selected}
              onBack={() => select(null)}
              onAssign={() => setTaskFor(selected)}
            />
          ) : (
            <>
              <div className={styles.panelFilters}>
                <SearchInput value={query} onChange={setQuery} placeholder="Search sites" />
                <Select
                  label="State"
                  value={state}
                  onChange={setState}
                  options={[["", "All states"], ...states.map((name) => [name, name])]}
                />
              </div>

              <div className={styles.list}>
                {sites.loading ? (
                  <Loading rows={6} />
                ) : visible.length === 0 ? (
                  <EmptyState icon="pin" title="No sites found" text="Try another search or state." />
                ) : (
                  visible.map((site) => (
                    <button key={site.id} className={styles.siteRow} onClick={() => select(site.id)}>
                      <i style={{ background: PRIORITY_COLORS[site.stats.priority_level] }} />
                      <span>
                        <strong>{site.name}</strong>
                        <small>
                          {site.district}, {site.state}
                        </small>
                      </span>
                      <b>{site.stats.unresolved_items}</b>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {picking?.latitude && (
        <SiteForm
          point={picking}
          onClose={() => setPicking(null)}
          onSaved={(site) => {
            setPicking(null);
            sites.setData((previous) => [...(previous || []), site]);
            select(site.id);
          }}
        />
      )}

      {taskFor && (
        <TaskForm
          initial={{ site: taskFor.id, title: `Clear roadside litter at ${taskFor.name}`, priority: taskFor.stats.priority_level }}
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

function SiteDetail({ site, onBack, onAssign }) {
  const { stats } = site;
  const categories = Object.entries(stats.top_categories);
  const categoryTotal = categories.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className={styles.detail}>
      <button className={styles.back} onClick={onBack}>
        <Icon name="chevron" size={14} />
        All sites
      </button>

      <div className={styles.detailHead}>
        <div>
          <h2>{site.name}</h2>
          <p>
            {site.locality && `${site.locality}, `}
            {site.district}, {site.state}
          </p>
        </div>
        <Badge tone={PRIORITY_META[stats.priority_level].tone}>{PRIORITY_META[stats.priority_level].label} priority</Badge>
      </div>

      <div className={ops.detailGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <span>Uncleared items</span>
          <strong>{stats.unresolved_items}</strong>
        </div>
        <div>
          <span>Plastic</span>
          <strong>{stats.plastic_items}</strong>
        </div>
        <div>
          <span>Open tasks</span>
          <strong>{stats.open_tasks}</strong>
        </div>
        <div>
          <span>Complaints</span>
          <strong>{stats.open_issues}</strong>
        </div>
      </div>

      <div className={ops.meta}>
        <span>
          <Icon name="camera" size={13} />
          {site.camera_id || "No camera"}
        </span>
        <span>
          <Icon name="reports" size={13} />
          {stats.report_count} reports
        </span>
        <span>
          <Icon name="clock" size={13} />
          Last report {formatDate(stats.last_report_at)}
        </span>
        {stats.latest_severity && (
          <span>
            <Icon name="alert" size={13} />
            Latest severity {SEVERITY_META[stats.latest_severity].label}
          </span>
        )}
      </div>

      {categories.length > 0 && (
        <div>
          <h3 className={ops.sectionTitle}>Main waste types</h3>
          <ul className={ops.bars}>
            {categories.map(([label, count]) => (
              <li key={label}>
                <div>
                  <span>{label}</span>
                  <b>{count}</b>
                </div>
                <span className={ops.bar}>
                  <span style={{ width: `${(count / categoryTotal) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.detailActions}>
        <Button icon="tasks" onClick={onAssign}>
          Assign cleanup
        </Button>
        <Link href={`/reports?site=${site.id}`} className={styles.linkButton}>
          View reports
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

function SiteForm({ point, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", locality: "", district: "", state: "Kerala", camera_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(await api("sites/", { method: "POST", body: { ...form, ...point } }));
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add monitoring site"
      subtitle={`Location ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="site-form" icon="check" disabled={saving}>
            {saving ? "Saving…" : "Add site"}
          </Button>
        </>
      }
    >
      <form id="site-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <ErrorNote message={error} />}
        <Field label="Site name" required>
          <input value={form.name} onChange={set("name")} required placeholder="e.g. Kumily Bypass Road" />
        </Field>
        <Field label="Locality">
          <input value={form.locality} onChange={set("locality")} placeholder="Town or ward" />
        </Field>
        <Field label="District" required>
          <input value={form.district} onChange={set("district")} required />
        </Field>
        <Field label="State / UT" required>
          <Dropdown
            value={form.state}
            onChange={(state) => setForm((previous) => ({ ...previous, state }))}
            options={INDIAN_STATES.map((name) => [name, name])}
          />
        </Field>
        <Field label="Camera ID" hint="Leave blank for sites monitored by citizen reports only">
          <input value={form.camera_id} onChange={set("camera_id")} placeholder="CAM-20" />
        </Field>
      </form>
    </Modal>
  );
}
