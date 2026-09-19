"use client";

import { useState } from "react";
import Link from "next/link";

import Icon from "../../components/Icons/Icons";
import { Badge, Button, Card, ErrorNote, Field, PageHeader, SearchInput } from "../../components/ui/UI";
import { api, useApi } from "../../lib/api";
import ops from "../ops.module.css";
import styles from "./page.module.css";

const GUIDES = [
  {
    icon: "live",
    title: "Analyse footage",
    href: "/",
    steps: ["Open Live Detection", "Choose demo, upload or camera", "Review items, then Save report"],
  },
  {
    icon: "reports",
    title: "Review a report",
    href: "/reports",
    steps: ["Open Detection Reports", "Select a report", "Set its status or assign cleanup"],
  },
  {
    icon: "tasks",
    title: "Run a cleanup",
    href: "/cleanup-tasks",
    steps: ["Create or open a task", "Start work when the team is on site", "Mark complete to resolve the report"],
  },
  {
    icon: "map",
    title: "Add a site",
    href: "/waste-map",
    steps: ["Open Waste Map", "Choose Add site", "Click the location and fill in details"],
  },
];

const SHORTCUTS = [
  ["Space / K", "Play or pause"],
  ["F", "Fullscreen with results panel"],
  ["← / →", "Seek 2 seconds"],
  ["S", "Save an evidence snapshot"],
  ["O", "Toggle outlines"],
  ["L", "Toggle labels"],
  ["B", "Toggle boxes"],
];

export default function HelpSupport() {
  const health = useApi("health/");
  const overview = useApi("overview/");
  const faqList = useApi("faqs/");
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const faqs = (faqList.data || []).filter((faq) => !term || `${faq.question} ${faq.answer}`.toLowerCase().includes(term));

  const online = health.data?.success && !health.error;

  return (
    <main className={ops.page}>
      <PageHeader
        eyebrow="Support Centre"
        title="Help & Support"
        description="Guides, answers and system status for SmartWaste AI operators."
      />

      <section className={styles.status}>
        <div className={styles.statusMain}>
          <span className={`${styles.pulse} ${online ? styles.up : styles.down}`} />
          <div>
            <strong>{health.loading ? "Checking systems…" : online ? "All systems operational" : "Detection server unreachable"}</strong>
            <span>
              {online ? "Detection engine YOLOE-26L · API and database responding" : "Start the Django backend to restore detection and data."}
            </span>
          </div>
        </div>
        <dl className={styles.statusFigures}>
          {[
            ["Sites", overview.data?.sites],
            ["Reports", overview.data?.reports],
            ["Open tasks", overview.data?.open_tasks],
            ["Open issues", overview.data?.open_issues],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <h2 className={styles.heading}>Quick start</h2>
      <div className={styles.guides}>
        {GUIDES.map((guide) => (
          <Link key={guide.title} href={guide.href} className={styles.guide}>
            <span className={styles.guideIcon}>
              <Icon name={guide.icon} size={19} />
            </span>
            <strong>{guide.title}</strong>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <span className={styles.guideLink}>
              Open
              <Icon name="arrowRight" size={14} />
            </span>
          </Link>
        ))}
      </div>

      <div className={ops.split} style={{ marginTop: 20 }}>
        <Card title="Frequently asked questions" actions={<SearchInput value={query} onChange={setQuery} placeholder="Search answers" />}>
          <div className={styles.faq}>
            {faqs.map((faq) => (
              <details key={faq.id}>
                <summary>
                  {faq.question}
                  <Icon name="chevron" size={16} />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
            {faqList.loading && <p className={ops.secondary}>Loading answers…</p>}
            {faqList.error && <p className={ops.secondary}>{faqList.error}</p>}
            {!faqList.loading && faqs.length === 0 && (
              <p className={ops.secondary}>{query ? `No answers match “${query}”.` : "No questions have been added yet."}</p>
            )}
          </div>
        </Card>

        <div className={styles.side}>
          <Card title="Keyboard shortcuts" subtitle="On the Live Detection player">
            <dl className={styles.shortcuts}>
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys}>
                  <dt>
                    {keys.split(" / ").map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <ContactSupport />
        </div>
      </div>
    </main>
  );
}

function ContactSupport() {
  const [form, setForm] = useState({ name: "", contact: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const issue = await api("issues/", { method: "POST", body: { ...form, category: "support" } });
      setReference(issue.reference);
      setForm({ name: "", contact: "", description: "" });
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
  };

  return (
    <Card title="Contact support" subtitle="Raise a ticket with the platform team">
      {reference ? (
        <div className={styles.sent}>
          <Badge tone="ok" dot>
            Ticket {reference} raised
          </Badge>
          <p>We will reply to the contact you provided.</p>
          <Button variant="secondary" onClick={() => setReference("")}>
            Raise another
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className={styles.contactForm}>
          {error && <ErrorNote message={error} />}
          <Field label="Name" required>
            <input value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Email or phone" required>
            <input value={form.contact} onChange={set("contact")} required />
          </Field>
          <Field label="How can we help?" required>
            <textarea value={form.description} onChange={set("description")} required />
          </Field>
          <Button type="submit" icon="send" disabled={saving}>
            {saving ? "Sending…" : "Send"}
          </Button>
        </form>
      )}
    </Card>
  );
}
