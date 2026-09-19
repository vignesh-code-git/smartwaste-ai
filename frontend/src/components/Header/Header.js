import styles from "./Header.module.css";

export default function Header({ onUpload }) {
  return (
    <header className={styles.header}>
      <div className={styles.title}>
        Live Camera
      </div>

      <div className={styles.actions}>
        <div className={styles.status}>
          <span>●</span>
          SYSTEM ACTIVE
        </div>

        <button
          className={styles.uploadButton}
          onClick={onUpload}
        >
          ↑ Upload Video
        </button>

        <button className={styles.settings}>
          ⚙
        </button>
      </div>
    </header>
  );
}