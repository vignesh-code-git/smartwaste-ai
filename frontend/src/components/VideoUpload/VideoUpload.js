import { useRef } from "react";
import styles from "./VideoUpload.module.css";

export default function VideoUpload({ onVideoSelect }) {
  const inputRef = useRef(null);

  const handleChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    onVideoSelect(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={handleChange}
      />

      <button
        className={styles.hiddenTrigger}
        onClick={() => inputRef.current?.click()}
      >
        Upload Video
      </button>
    </>
  );
}