import Screen from "./Screen";
import styles from "./Monitor.module.css";

export default function Monitor() {
  return (
    <div className={styles.frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/laptop.png" alt="" className={styles.laptopImage} aria-hidden="true" />
      <div className={styles.screenArea}>
        <Screen />
      </div>
    </div>
  );
}
