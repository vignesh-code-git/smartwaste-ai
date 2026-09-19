"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Icon from "../../components/Icons/Icons";
import TaskForm from "../../components/TaskForm/TaskForm";
import {
  Badge,
  Button,
  Card,
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
import { MATERIALS } from "../../lib/detection/overlay";
import { downloadBlob } from "../../lib/detection/report";
import { REPORT_STATUS, SEVERITY_META, formatDate, reportCode } from "../../lib/format";
import styles from "../ops.module.css";

const SORTS = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["items", "Most items"],
  ["plastic", "Most plastic"],
];

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = Number(params.get("report")) || null;
  const siteId = Number(params.get("site")) || null;

  const reports = useApi("reports/");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [sort, setSort] = useState("newest");

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();

    const filtered = (reports.data || []).filter(
      (report) =>
        (!siteId || report.site === siteId) &&
        (!status || report.status === status) &&
        (!severity || report.severity === severity) &&
        (!term ||
          [reportCode(report.id), report.site_name, report.site_district, report.site_state, report.source_name]
            .join(" ")
            .toLowerCase()
            .includes(term))
    );

    const by = {
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      items: (a, b) => b.total_items - a.total_items,
      plastic: (a, b) => b.plastic_items - a.plastic_items,
    }[sort];

    return filtered.sort(by);
  }, [reports.data, siteId, query, status, severity, sort]);

  const all = reports.data || [];
  const selected = all.find((report) => report.id === openId) || null;

  const siteName = siteId ? all.find((report) => report.site === siteId)?.site_name : null;

  const openReport = (id) => {
    const next = new URLSearchParams();
    if (siteId) next.set("site", siteId);
    if (id) next.set("report", id);
    router.replace(`/reports${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const updateReport = (updated) =>
    reports.setData((previous) => previous.map((report) => (report.id === updated.id ? updated : report)));

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Operations · Records"
        title="Detection Reports"
        description="Every analysed piece of footage, with its litter count, severity and review status."
        actions={
          <>
            <DemoNote />
            <Button variant="secondary" icon="download" onClick={() => exportCsv(rows)} disabled={!rows.length}>
              Export CSV
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard icon="reports" label="Total Reports" value={all.length} note="Across all sites" />
        <StatCard
          icon="clock"
          label="Pending Review"
          value={all.filter((report) => report.status === "pending").length}
          note="Awaiting an officer"
          tone="warn"
        />
        <StatCard
          icon="alert"
          label="High / Critical"
          value={all.filter((report) => ["high", "critical"].includes(report.severity)).length}
          note="Reports needing cleanup"
          tone="danger"
        />
        <StatCard
          icon="layers"
          label="Plastic Items"
          value={all.reduce((sum, report) => sum + report.plastic_items, 0)}
          note="Recorded in all reports"
        />
      </StatGrid>

      <Card
        title="Report register"
        subtitle="Select a report to review it, change its status or assign cleanup"
        padded={false}
        actions={
          <div className={styles.filters}>
            {siteId && (
              <button className={styles.filterChip} onClick={() => router.replace("/reports", { scroll: false })}>
                Site: {siteName || `#${siteId}`}
                <Icon name="close" size={13} />
              </button>
            )}
            <SearchInput value={query} onChange={setQuery} placeholder="Search site, district or code" />
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[["", "All statuses"], ...Object.entries(REPORT_STATUS).map(([key, meta]) => [key, meta.label])]}
            />
            <Select
              label="Severity"
              value={severity}
              onChange={setSeverity}
              options={[["", "All severities"], ...Object.entries(SEVERITY_META).map(([key, meta]) => [key, meta.label])]}
            />
            <Select label="Sort" value={sort} onChange={setSort} options={SORTS} />
          </div>
        }
      >
        {reports.error && (
          <div style={{ padding: 16 }}>
            <ErrorNote message={reports.error} onRetry={reports.reload} />
          </div>
        )}

        {reports.loading ? (
          <Loading rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="reports"
            title="No reports match"
            text="Save an analysis from Live Detection, or clear the filters."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Site</th>
                  <th>Recorded</th>
                  <th>Items</th>
                  <th>Plastic</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((report) => (
                  <tr key={report.id} onClick={() => openReport(report.id)}>
                    <td>
                      <span className={styles.code}>{reportCode(report.id)}</span>
                    </td>
                    <td>
                      <span className={styles.primary}>{report.site_name}</span>
                      <span className={styles.secondary}>
                        {report.site_district}, {report.site_state}
                      </span>
                    </td>
                    <td>{formatDate(report.created_at, true)}</td>
                    <td className={styles.num}>{report.total_items}</td>
                    <td className={styles.num}>{report.plastic_items}</td>
                    <td>
                      <Badge tone={SEVERITY_META[report.severity]?.tone}>
                        {SEVERITY_META[report.severity]?.label}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={REPORT_STATUS[report.status]?.tone} dot>
                        {REPORT_STATUS[report.status]?.label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <ReportDetail
          key={selected.id}
          report={selected}
          onClose={() => openReport(null)}
          onUpdated={updateReport}
          onDeleted={() => {
            reports.setData((previous) => previous.filter((report) => report.id !== selected.id));
            openReport(null);
          }}
        />
      )}
    </main>
  );
}

function ReportDetail({ report, onClose, onUpdated, onDeleted }) {
  const [status, setStatus] = useState(report.status);
  const [notes, setNotes] = useState(report.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);

  const categories = Object.entries(report.categories || {}).sort((a, b) => b[1] - a[1]);
  const dirty = status !== report.status || notes !== report.notes;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onUpdated(await api(`reports/${report.id}/`, { method: "PATCH", body: { status, notes } }));
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${reportCode(report.id)}? This cannot be undone.`)) return;
    try {
      await api(`reports/${report.id}/`, { method: "DELETE" });
      onDeleted();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  if (taskOpen) {
    return (
      <TaskForm
        initial={{
          site: report.site,
          report: report.id,
          title: `Clear roadside litter at ${report.site_name}`,
          description: `${report.total_items} items detected (${report.plastic_items} plastic) in ${reportCode(report.id)}.`,
          priority: report.severity === "critical" ? "critical" : report.severity === "high" ? "high" : "medium",
        }}
        onClose={() => setTaskOpen(false)}
        onSaved={() => {
          setTaskOpen(false);
          setStatus("actioned");
          onUpdated({ ...report, status: "actioned", task_count: report.task_count + 1 });
        }}
      />
    );
  }

  return (
    <Modal
      wide
      title={`${reportCode(report.id)} · ${report.site_name}`}
      subtitle={`${report.site_district}, ${report.site_state} · recorded ${formatDate(report.created_at, true)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" icon="trash" onClick={remove} style={{ marginRight: "auto" }}>
            Delete
          </Button>
          <Button variant="secondary" icon="tasks" onClick={() => setTaskOpen(true)}>
            Assign cleanup
          </Button>
          <Button icon="check" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}

      <div className={styles.detailGrid}>
        <div>
          <span>Items</span>
          <strong>{report.total_items}</strong>
        </div>
        <div>
          <span>Plastic</span>
          <strong>{report.plastic_items}</strong>
        </div>
        <div>
          <span>Severity</span>
          <strong>{SEVERITY_META[report.severity]?.label}</strong>
        </div>
        <div>
          <span>Cleanup tasks</span>
          <strong>{report.task_count}</strong>
        </div>
      </div>

      <div>
        <h3 className={styles.sectionTitle}>Waste composition</h3>
        {categories.length === 0 ? (
          <p className={styles.secondary}>No litter was recorded.</p>
        ) : (
          <ul className={styles.bars}>
            {categories.map(([label, count]) => (
              <li key={label}>
                <div>
                  <span>{label}</span>
                  <b>{count}</b>
                </div>
                <span className={styles.bar}>
                  <span style={{ width: `${(count / report.total_items) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {report.items?.length > 0 && (
        <div>
          <h3 className={styles.sectionTitle}>Detected items ({report.items.length})</h3>
          <div className={styles.meta}>
            {report.items.slice(0, 40).map((item) => (
              <span key={item.id}>
                <i
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: MATERIALS[item.material]?.color,
                  }}
                />
                {item.track ? `#${item.track} ` : ""}
                {item.type}
                {item.peakConfidence != null && ` · ${Math.round(item.peakConfidence * 100)}%`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.inline}>
        <Field label="Review status">
          <Dropdown
            value={status}
            onChange={setStatus}
            options={Object.entries(REPORT_STATUS).map(([key, meta]) => [key, meta.label])}
          />
        </Field>
        <Field label="Source">
          <input value={report.source_name || report.source} readOnly />
        </Field>
      </div>

      <Field label="Officer notes">
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observations, follow-up actions…" />
      </Field>
    </Modal>
  );
}

function exportCsv(rows) {
  const lines = [
    ["Report", "Site", "District", "State", "Recorded", "Items", "Plastic", "Severity", "Status"],
    ...rows.map((report) => [
      reportCode(report.id),
      report.site_name,
      report.site_district,
      report.site_state,
      formatDate(report.created_at, true),
      report.total_items,
      report.plastic_items,
      SEVERITY_META[report.severity]?.label,
      REPORT_STATUS[report.status]?.label,
    ]),
  ];

  const csv = lines
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  downloadBlob(new Blob([csv], { type: "text/csv" }), `smartwaste-reports-${new Date().toISOString().slice(0, 10)}.csv`);
}
