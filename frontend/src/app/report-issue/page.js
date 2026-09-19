"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import Icon from "../../components/Icons/Icons";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  Select,
} from "../../components/ui/UI";
import { api, useApi } from "../../lib/api";
import { ISSUE_STATUS, formatDate } from "../../lib/format";
import { siteOptions } from "../../lib/options";
import ops from "../ops.module.css";
import styles from "./page.module.css";

const WASTE_TYPES = ["Plastic bags", "Plastic bottles", "Snack packets / wrappers", "Mixed waste", "Household garbage", "Construction debris", "Other"];

const MAX_PHOTO_MB = 5;

const STATUS_COLORS = { warn: "#eab308", info: "#2563eb", ok: "#16a34a" };

const CATEGORY_LABEL = { litter: "Litter report", callback: "Callback", support: "Support" };

export default function ReportIssue() {
  const issues = useApi("issues/");

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Citizen Services"
        title="Report an Issue"
        description="Tell the sanitation team about roadside litter. You will get a reference number to track the response."
      />

      <div className={ops.split}>
        <IssueForm onCreated={(issue) => issues.setData((list) => [issue, ...(list || [])])} />
        <Suspense>
          <TrackIssue />
        </Suspense>
      </div>

      <div style={{ marginTop: 20 }}>
        <IssueDesk issues={issues} />
      </div>
    </main>
  );
}

// ==================================================
// SUBMISSION
// ==================================================

function IssueForm({ onCreated }) {
  const sites = useApi("sites/");
  const empty = { name: "", contact: "", site: "", location: "", waste_type: WASTE_TYPES[0], description: "" };

  const [form, setForm] = useState(empty);
  const [coords, setCoords] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  const choose = (key) => (value) => setForm((previous) => ({ ...previous, [key]: value }));

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) return setError("The photo must be an image.");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setError(`The photo must be under ${MAX_PHOTO_MB} MB.`);

    if (photo) URL.revokeObjectURL(photo.preview);
    setError("");
    setPhoto({ file, preview: URL.createObjectURL(file) });
  };

  const locate = () => {
    if (!navigator.geolocation) return setError("Location is not available in this browser.");

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Could not get your location. Describe the place instead.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const body = new FormData();
    body.append("category", "litter");
    for (const [key, value] of Object.entries(form)) if (value) body.append(key, value);
    if (coords) {
      body.append("latitude", coords.latitude.toFixed(6));
      body.append("longitude", coords.longitude.toFixed(6));
    }
    if (photo) body.append("photo", photo.file);

    try {
      const issue = await api("issues/", { method: "POST", body });
      onCreated(issue);
      setCreated(issue);
      setForm(empty);
      setCoords(null);
      setPhoto(null);
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
  };

  if (created) {
    return (
      <Card>
        <div className={styles.success}>
          <span className={styles.successIcon}>
            <Icon name="check" size={26} strokeWidth={2.4} />
          </span>
          <h2>Issue submitted</h2>
          <p>Keep this reference number to track the response.</p>
          <div className={styles.reference}>
            <strong>{created.reference}</strong>
            <Button variant="secondary" icon="copy" onClick={() => navigator.clipboard?.writeText(created.reference)}>
              Copy
            </Button>
          </div>
          <Button onClick={() => setCreated(null)} icon="plus">
            Report another issue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Issue details" subtitle="Fields marked * are required">
      <form className={styles.form} onSubmit={submit}>
        {error && <ErrorNote message={error} />}

        <div className={styles.row}>
          <Field label="Nearest monitoring site">
            <Dropdown
              value={form.site}
              onChange={choose("site")}
              options={[{ value: "", label: "Not listed / not sure" }, ...siteOptions(sites.data)]}
            />
          </Field>
          <Field label="Type of waste" required>
            <Dropdown value={form.waste_type} onChange={choose("waste_type")} options={WASTE_TYPES.map((type) => [type, type])} />
          </Field>
        </div>

        <Field label="Location" required hint="Landmark, road name or ward">
          <div className={styles.locationRow}>
            <input value={form.location} onChange={set("location")} required placeholder="e.g. Near the bus stop, Kumily Road" />
            <Button type="button" variant="secondary" icon="locate" onClick={locate} disabled={locating}>
              {locating ? "Locating…" : coords ? "Location added" : "Use my location"}
            </Button>
          </div>
        </Field>

        <Field label="Description">
          <textarea value={form.description} onChange={set("description")} placeholder="How much waste, how long it has been there…" />
        </Field>

        <Field label="Photo" hint={`Optional · JPG or PNG under ${MAX_PHOTO_MB} MB`}>
          {photo ? (
            <div className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen file */}
              <img src={photo.preview} alt="Selected evidence" />
              <Button type="button" variant="ghost" icon="trash" onClick={() => setPhoto(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <span className={styles.photoPick}>
              <Icon name="image" size={18} />
              Choose a photo
              <input type="file" accept="image/*" onChange={choosePhoto} />
            </span>
          )}
        </Field>

        <div className={styles.row}>
          <Field label="Your name">
            <input value={form.name} onChange={set("name")} placeholder="Optional" />
          </Field>
          <Field label="Phone or email" hint="Only used to update you about this issue">
            <input value={form.contact} onChange={set("contact")} placeholder="Optional" />
          </Field>
        </div>

        <Button type="submit" icon="send" disabled={saving}>
          {saving ? "Submitting…" : "Submit issue"}
        </Button>
      </form>
    </Card>
  );
}

// ==================================================
// TRACKING
// ==================================================

const STEPS = ["received", "assigned", "resolved"];

function TrackIssue() {
  // Links from search and notifications carry the reference, e.g. ?ref=SW-1A2B3C
  const linked = useSearchParams().get("ref") || "";
  const [reference, setReference] = useState(linked);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!linked) return;
    let cancelled = false;
    api(`issues/track/${encodeURIComponent(linked)}/`).then(
      (issue) => !cancelled && setResult(issue),
      () => !cancelled && setError("No issue was found with that reference number.")
    );
    return () => {
      cancelled = true;
    };
  }, [linked]);

  const track = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await api(`issues/track/${encodeURIComponent(reference.trim())}/`));
    } catch {
      setError("No issue was found with that reference number.");
    }
    setLoading(false);
  };

  const reached = result ? STEPS.indexOf(result.status) : -1;

  return (
    <Card title="Track an issue" subtitle="Enter the reference you received, e.g. SW-1A2B3C">
      <form className={styles.trackForm} onSubmit={track}>
        <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="SW-XXXXXX" required />
        <Button type="submit" icon="search" disabled={loading}>
          Track
        </Button>
      </form>

      {error && <p className={styles.trackError}>{error}</p>}

      {result && (
        <div className={styles.trackResult}>
          <div className={styles.trackHead}>
            <strong>{result.reference}</strong>
            <Badge tone={ISSUE_STATUS[result.status].tone} dot>
              {ISSUE_STATUS[result.status].label}
            </Badge>
          </div>
          <span className={ops.secondary}>
            {result.waste_type} · {result.location} · raised {formatDate(result.created_at)}
          </span>

          <ol className={styles.timeline}>
            {STEPS.map((step, index) => (
              <li key={step} className={index <= reached ? styles.done : ""}>
                <i>{index <= reached ? <Icon name="check" size={12} strokeWidth={3} /> : index + 1}</i>
                {ISSUE_STATUS[step].label}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!result && !error && (
        <div className={styles.helpBox}>
          <Icon name="info" size={16} />
          <span>
            Issues are reviewed by the local sanitation team. Litter reports are usually assigned within two working days.
          </span>
        </div>
      )}
    </Card>
  );
}

// ==================================================
// OFFICER DESK
// ==================================================

function IssueDesk({ issues }) {
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  const rows = (issues.data || []).filter((issue) => !category || issue.category === category);

  const setStatus = async (issue, status) => {
    setError("");
    try {
      const updated = await api(`issues/${issue.id}/`, { method: "PATCH", body: { status } });
      issues.setData((list) => list.map((item) => (item.id === issue.id ? updated : item)));
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  return (
    <Card
      title="Issue desk"
      subtitle="Citizen reports, callback requests and support queries"
      padded={false}
      actions={
        <Select
          label="Category"
          value={category}
          onChange={setCategory}
          options={[["", "All categories"], ["litter", "Litter reports"], ["callback", "Callback requests"], ["support", "Support requests"]]}
        />
      }
    >
      {(error || issues.error) && (
        <div style={{ padding: 16 }}>
          <ErrorNote message={error || issues.error} />
        </div>
      )}

      {issues.loading ? (
        <Loading rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="flag" title="No issues yet" />
      ) : (
        <div className={ops.tableWrap}>
          <table className={ops.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Location</th>
                <th>Details</th>
                <th>Raised</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((issue) => (
                <tr key={issue.id} style={{ cursor: "default" }}>
                  <td>
                    <span className={ops.code}>{issue.reference}</span>
                  </td>
                  <td>
                    <Badge tone="neutral">{CATEGORY_LABEL[issue.category]}</Badge>
                  </td>
                  <td>
                    <span className={ops.primary}>{issue.location || issue.site_name || "—"}</span>
                    {issue.latitude && (
                      <span className={ops.secondary}>
                        {issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <span className={ops.primary}>{issue.waste_type || issue.name || "—"}</span>
                    <span className={ops.secondary}>{issue.description}</span>
                    {issue.photo && (
                      <a href={issue.photo} target="_blank" rel="noreferrer" className={styles.photoLink}>
                        <Icon name="image" size={13} /> Photo
                      </a>
                    )}
                  </td>
                  <td>{formatDate(issue.created_at, true)}</td>
                  <td>
                    <Dropdown
                      size="sm"
                      label={`Status of ${issue.reference}`}
                      value={issue.status}
                      onChange={(status) => setStatus(issue, status)}
                      options={Object.entries(ISSUE_STATUS).map(([key, meta]) => ({ value: key, label: meta.label, color: STATUS_COLORS[meta.tone] }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
