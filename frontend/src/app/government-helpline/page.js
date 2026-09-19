"use client";

import { useState } from "react";
import Link from "next/link";

import Icon from "../../components/Icons/Icons";
import { Badge, Button, Card, ErrorNote, Field, Loading, Modal, PageHeader, SearchInput } from "../../components/ui/UI";
import { api, useApi } from "../../lib/api";
import ops from "../ops.module.css";
import styles from "./page.module.css";

// Contacts are managed in the database (HelplineContact, via Django admin)
export default function GovernmentHelpline() {
  const contacts = useApi("helplines/");
  const [query, setQuery] = useState("");
  const [callbackFor, setCallbackFor] = useState(null);
  const [requested, setRequested] = useState(null);
  const [copied, setCopied] = useState("");

  const term = query.trim().toLowerCase();
  const all = contacts.data || [];
  const emergency = all.filter((contact) => contact.kind === "emergency");
  const departments = all
    .filter((contact) => contact.kind === "department")
    .filter((dept) => !term || `${dept.name} ${dept.description}`.toLowerCase().includes(term));

  const copy = (number) => {
    navigator.clipboard?.writeText(number);
    setCopied(number);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Citizen Services"
        title="Government Helpline"
        description="Emergency numbers, and callback requests to the departments that handle roadside waste."
        actions={<SearchInput value={query} onChange={setQuery} placeholder="Search departments" />}
      />

      <section className={styles.emergency}>
        <div className={styles.emergencyHead}>
          <span className={styles.sos}>
            <Icon name="phone" size={20} />
          </span>
          <div>
            <h2>Emergency numbers</h2>
            <p>For immediate danger to people or property. Free from any phone.</p>
          </div>
        </div>
        <div className={styles.numbers}>
          {contacts.loading && <span className={styles.loadingNote}>Loading numbers…</span>}
          {emergency.map((item) => (
            <div key={item.number} className={styles.number}>
              <strong>{item.number}</strong>
              <span>{item.name}</span>
              <small>{item.description}</small>
              <div className={styles.numberActions}>
                <a href={`tel:${item.number}`} className={styles.call}>
                  <Icon name="phone" size={13} />
                  Call
                </a>
                <button onClick={() => copy(item.number)} className={styles.copy} aria-label={`Copy ${item.number}`}>
                  <Icon name={copied === item.number ? "check" : "copy"} size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {requested && (
        <div className={styles.confirm}>
          <Icon name="check" size={18} />
          <span>
            Callback requested from <b>{requested.department}</b>. Reference <b>{requested.reference}</b> — track it on{" "}
            <Link href="/report-issue">Report an Issue</Link>.
          </span>
          <button onClick={() => setRequested(null)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {contacts.error && <ErrorNote message={contacts.error} onRetry={contacts.reload} />}

      <Card title="Departments" subtitle="Request a callback and the department will contact you" padded={false}>
        {contacts.loading && <Loading rows={4} />}
        <ul className={styles.departments}>
          {departments.map((dept) => (
            <li key={dept.name}>
              <span className={styles.deptIcon}>
                <Icon name={dept.icon} size={19} />
              </span>
              <div className={styles.deptMain}>
                <strong>{dept.name}</strong>
                <span>{dept.description}</span>
              </div>
              {dept.number && (
                <a href={`tel:${dept.number}`} className={styles.deptNumber}>
                  <Icon name="phone" size={13} />
                  {dept.number}
                </a>
              )}
              {dept.hours && (
                <Badge tone="neutral">
                  <Icon name="clock" size={12} />
                  {dept.hours}
                </Badge>
              )}
              <Button variant="secondary" icon="phone" onClick={() => setCallbackFor(dept)}>
                Request callback
              </Button>
            </li>
          ))}
          {!contacts.loading && departments.length === 0 && (
            <li className={styles.none}>{query ? `No department matches “${query}”.` : "No departments configured."}</li>
          )}
        </ul>
      </Card>

      {callbackFor && (
        <CallbackForm
          department={callbackFor}
          onClose={() => setCallbackFor(null)}
          onSaved={(issue) => {
            setCallbackFor(null);
            setRequested({ department: callbackFor.name, reference: issue.reference });
          }}
        />
      )}
    </main>
  );
}

function CallbackForm({ department, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", contact: "", location: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(
        await api("issues/", {
          method: "POST",
          body: {
            ...form,
            category: "callback",
            waste_type: department.name,
            description: `Callback requested from ${department.name}. ${form.description}`.trim(),
          },
        })
      );
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Request a callback"
      subtitle={department.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="callback-form" icon="send" disabled={saving}>
            {saving ? "Sending…" : "Request callback"}
          </Button>
        </>
      }
    >
      <form id="callback-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <ErrorNote message={error} />}
        <Field label="Your name" required>
          <input value={form.name} onChange={set("name")} required />
        </Field>
        <Field label="Phone number" required hint="The department will call this number">
          <input value={form.contact} onChange={set("contact")} required inputMode="tel" pattern="[0-9+\-\s]{7,15}" placeholder="+91 98xxxxxx10" />
        </Field>
        <Field label="Location">
          <input value={form.location} onChange={set("location")} placeholder="Road, ward or landmark" />
        </Field>
        <Field label="What do you need help with?">
          <textarea value={form.description} onChange={set("description")} />
        </Field>
      </form>
    </Modal>
  );
}
