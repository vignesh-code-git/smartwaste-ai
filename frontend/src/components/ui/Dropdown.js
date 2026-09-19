"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import Icon from "../Icons/Icons";
import styles from "./Dropdown.module.css";

const SEARCH_THRESHOLD = 8;
const MENU_MAX_HEIGHT = 300;
const GAP = 6;

// Styled replacement for <select>. `options` are [value, label] pairs or
// { value, label, hint, color } objects. The menu is positioned with
// `position: fixed` so dialogs and scroll areas never clip it, and it stays
// inside its parent so it also works in fullscreen.
export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
  id,
  required = false,
  disabled = false,
  searchable,
  size = "md",
  variant = "light",
  icon,
  className = "",
}) {
  const generatedId = useId();
  const buttonId = id || generatedId;
  const listId = `${buttonId}-list`;

  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const typeaheadRef = useRef({ text: "", timer: null });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);

  const items = useMemo(
    () =>
      options.map((option) =>
        Array.isArray(option) ? { value: option[0], label: option[1] } : option
      ),
    [options]
  );

  const showSearch = searchable ?? items.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? items.filter((item) => `${item.label} ${item.hint || ""}`.toLowerCase().includes(term))
      : items;
  }, [items, query]);

  const selected = items.find((item) => String(item.value) === String(value));

  // --------------------------------------------------
  // Open / close
  // --------------------------------------------------

  const openMenu = () => {
    if (disabled) return;
    const index = items.findIndex((item) => String(item.value) === String(value));
    setQuery("");
    setActive(Math.max(0, index));
    setOpen(true);
  };

  const closeMenu = (focusButton = true) => {
    setOpen(false);
    setPosition(null);
    if (focusButton) buttonRef.current?.focus();
  };

  const choose = (item) => {
    if (!item || item.disabled) return;
    onChange(item.value);
    closeMenu();
  };

  // Place the menu below the button, or above it when there is no room
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP;
      const above = rect.top - GAP;
      const upward = below < Math.min(MENU_MAX_HEIGHT, 220) && above > below;

      setPosition({
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8),
        width: Math.max(rect.width, 180),
        top: upward ? undefined : rect.bottom + GAP,
        bottom: upward ? window.innerHeight - rect.top + GAP : undefined,
        maxHeight: Math.min(MENU_MAX_HEIGHT, (upward ? above : below) - 8),
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // The menu renders once it has been positioned; focus search then
  const ready = Boolean(position);

  useEffect(() => {
    if (open && ready && showSearch) searchRef.current?.focus();
  }, [open, ready, showSearch]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
        closeMenu(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option in view
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // --------------------------------------------------
  // Keyboard
  // --------------------------------------------------

  const onKeyDown = (event) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    const last = visible.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(last, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(0, index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
        event.preventDefault();
        choose(visible[active]);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        break;
      case "Tab":
        closeMenu(false);
        break;
      default:
        if (!showSearch && event.key.length === 1) typeahead(event.key);
    }
  };

  // Jump to the first option starting with the typed letters
  const typeahead = (key) => {
    const state = typeaheadRef.current;
    clearTimeout(state.timer);
    state.text += key.toLowerCase();
    state.timer = setTimeout(() => (state.text = ""), 600);

    const index = visible.findIndex((item) => String(item.label).toLowerCase().startsWith(state.text));
    if (index >= 0) setActive(index);
  };

  return (
    <div className={`${styles.wrap} ${styles[variant]} ${styles[size]} ${className}`}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={`${styles.button} ${open ? styles.open : ""}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label && !selected ? label : undefined}
        title={label}
      >
        {icon && <Icon name={icon} size={15} className={styles.leadIcon} />}
        {selected?.color && <i className={styles.dot} style={{ background: selected.color }} />}
        <span className={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevronDown" size={15} className={styles.chevron} />
      </button>

      {required && (
        <input
          className={styles.validator}
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value ?? ""}
          onChange={() => {}}
          onFocus={() => buttonRef.current?.focus()}
        />
      )}

      {open && position && (
        <div
          ref={menuRef}
          className={styles.menu}
          style={{
            left: position.left,
            width: position.width,
            top: position.top,
            bottom: position.bottom,
          }}
        >
          {showSearch && (
            <div className={styles.search}>
              <Icon name="search" size={14} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search"
                aria-label="Search options"
                aria-controls={listId}
                aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined}
              />
            </div>
          )}

          <ul
            id={listId}
            role="listbox"
            aria-labelledby={buttonId}
            className={styles.list}
            style={{ maxHeight: position.maxHeight - (showSearch ? 48 : 0) }}
          >
            {visible.map((item, index) => {
              const isSelected = String(item.value) === String(value);
              return (
                <li
                  key={`${item.value}`}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${index === active ? styles.active : ""} ${isSelected ? styles.selected : ""}`}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  {item.color && <i className={styles.dot} style={{ background: item.color }} />}
                  <span className={styles.optionText}>
                    {item.label}
                    {item.hint && <small>{item.hint}</small>}
                  </span>
                  {isSelected && <Icon name="check" size={15} strokeWidth={2.4} className={styles.check} />}
                </li>
              );
            })}
            {visible.length === 0 && <li className={styles.none}>No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
