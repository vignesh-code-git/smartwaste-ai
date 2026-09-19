import styles from "./DetectionStats.module.css";

export default function DetectionStats() {
  const stats = [
    {
      label: "OBJECTS DETECTED",
      value: "12",
    },
    {
      label: "PLASTIC WASTE",
      value: "9",
    },
    {
      label: "AVG. CONFIDENCE",
      value: "92%",
    },
    {
      label: "SEVERITY",
      value: "HIGH",
    },
  ];

  return (
    <div className={styles.stats}>
      {stats.map((stat) => (
        <div className={styles.card} key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </div>
      ))}
    </div>
  );
}