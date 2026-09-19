import styles from "./LocationBar.module.css";

export default function LocationBar() {
  return (
    <div className={styles.location}>
      <div>
        📍 <strong>Kumily, Kerala</strong>
      </div>

      <div className={styles.gps}>
        GPS ● Connected
      </div>
    </div>
  );
}