import styles from "./DesktopBackground.module.css";

export default function DesktopBackground() {
  return <div aria-hidden="true" className={`absolute inset-0 ${styles.background}`} />;
}
