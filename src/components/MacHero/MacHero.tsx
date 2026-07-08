import styles from "./MacHero.module.css";

export default function MacHero() {
  return (
    <div className={styles.stage}>
      <div className={styles.rig}>
        <div className={styles.shell}>
          <div className={styles.front}>
            <div className={styles.grain} />
            <div className={styles.screenCavity}>
              <div className={styles.screen}>
                <div className={styles.screenBloom} />
                <div className={styles.screenHighlight} />
                <div className={styles.screenHighlightThin} />
                <div className={styles.screenVignette} />
              </div>
            </div>
            <div className={styles.seam} />
            <div className={styles.ventBand} />
            <div className={styles.slot} />
            <div className={styles.slotHighlight} />
            <div className={styles.slotDot} style={{ left: 80 }} />
            <div className={styles.slotDot} style={{ right: 80 }} />
            <div className={styles.led} />
            <div className={styles.badge} />
            <div className={styles.nameplate} />
            <div className={styles.chinShadow} />
            <div className={styles.footSeam} />
            <div className={styles.footFlare} />
          </div>
        </div>

        <div className={styles.contactShadow} />
      </div>
    </div>
  );
}
