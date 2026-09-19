import styles from "./LiveCamera.module.css";

export default function LiveCamera({ videoUrl }) {
  return (
    <div className={styles.camera}>
      {videoUrl ? (
        <video
          className={styles.video}
          src={videoUrl}
          controls
          autoPlay
          muted
        />
      ) : (
        <>
          <div className={`${styles.tree} ${styles.treeLeft}`} />
          <div className={`${styles.tree} ${styles.treeRight}`} />

          <div className={styles.ground} />

          <div className={styles.road} />

          <div className={styles.cameraHeader}>
            <span>CAMERA 01</span>
            <span>● LIVE · 1080p</span>
          </div>

          <div className={`${styles.detectionBox} ${styles.boxOne}`}>
            PLASTIC BAG · 94%
          </div>

          <div className={`${styles.detectionBox} ${styles.boxTwo}`}>
            PLASTIC BOTTLE · 91%
          </div>

          <div className={`${styles.detectionBox} ${styles.boxThree}`}>
            WRAPPER · 87%
          </div>

          <div className={styles.liveLabel}>
            ● LIVE
          </div>
        </>
      )}
    </div>
  );
}