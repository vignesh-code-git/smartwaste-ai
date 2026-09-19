"use client";

import { Children, cloneElement, isValidElement, useEffect, useId } from "react";

import Icon from "../Icons/Icons";
import Dropdown from "./Dropdown";
import styles from "./UI.module.css";

// Shared building blocks for the operations pages.

export { Dropdown };

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

export function StatGrid({ children }) {
  return <section className={styles.statGrid}>{children}</section>;
}

export function StatCard({ icon, label, value, note, tone = "accent" }) {
  return (
    <div className={styles.stat}>
      <span className={`${styles.statIcon} ${styles[`tone_${tone}`]}`}>
        <Icon name={icon} size={19} />
      </span>
      <div>
        <span className={styles.statLabel}>{label}</span>
        <strong className={styles.statValue}>{value}</strong>
        {note && <small className={styles.statNote}>{note}</small>}
      </div>
    </div>
  );
}

export function Card({ title, subtitle, actions, children, padded = true, className = "" }) {
  return (
    <section className={`${styles.card} ${className}`}>
      {(title || actions) && (
        <div className={styles.cardHeader}>
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className={styles.cardActions}>{actions}</div>}
        </div>
      )}
      <div className={padded ? styles.cardBody : ""}>{children}</div>
    </section>
  );
}

export function Badge({ tone = "neutral", children, dot = false }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>
      {dot && <i />}
      {children}
    </span>
  );
}

export function Button({ variant = "primary", icon, children, className = "", ...props }) {
  return (
    <button className={`${styles.button} ${styles[`button_${variant}`]} ${className}`} {...props}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

// On/off switch. With a `label`, the text and switch form one control.
export function Switch({ checked, onChange, label, icon, title, className = "" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      className={`${label ? styles.switchField : styles.switchButton} ${checked ? styles.switchOn : ""} ${className}`}
      onClick={() => onChange(!checked)}
    >
      {label && (
        <span className={styles.switchLabel}>
          {icon && <Icon name={icon} size={14} />}
          {label}
        </span>
      )}
      <span className={styles.switch}>
        <span>{checked && <Icon name="check" size={10} strokeWidth={3} />}</span>
      </span>
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search" }) {
  return (
    <label className={styles.search}>
      <Icon name="search" size={15} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

// Filter-style dropdown; `options` are [value, label] pairs
export function Select({ value, onChange, options, label, className = "" }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      className={`${styles.select} ${className}`}
    />
  );
}

// A labelled form control. The label targets the control through an id,
// so custom controls such as Dropdown are labelled like native inputs.
export function Field({ label, hint, required, children }) {
  const id = useId();
  const single = Children.count(children) === 1 && isValidElement(children);
  const controlId = single ? children.props.id || id : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={controlId}>
        {label}
        {required && <b> *</b>}
      </label>
      {single ? cloneElement(children, { id: controlId }) : children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`${styles.modal} ${wide ? styles.modalWide : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.modalHeader}>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className={styles.iconButton} onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "shieldCheck", title, text, action }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name={icon} size={20} />
      </div>
      <strong>{title}</strong>
      {text && <span>{text}</span>}
      {action}
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  return (
    <div className={styles.errorNote} role="alert">
      <Icon name="alert" size={16} />
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className={styles.linkButton}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Loading({ rows = 4 }) {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

export function DemoNote() {
  return (
    <span className={styles.demoNote} title="Sites, reports, tasks and issues include generated demonstration data">
      <Icon name="help" size={13} />
      Includes demo data
    </span>
  );
}
