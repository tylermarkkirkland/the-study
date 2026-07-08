import Monitor from "@/components/Monitor/Monitor";
import DeskProps from "@/components/DeskProps/DeskProps";
import StickerBoardFrame from "@/components/StickerBoardFrame/StickerBoardFrame";
import styles from "./RoomScene.module.css";

export default function RoomScene() {
  return (
    <main className={`relative h-screen w-screen overflow-hidden ${styles.room}`}>
      {/* Floor — decorative isometric-ish backdrop, purely atmospheric */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-[40%] ${styles.floorWrap}`}
      >
        <div className={`h-full w-full ${styles.floor}`} />
      </div>

      <StickerBoardFrame />

      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <Monitor />
      </div>

      <DeskProps />
    </main>
  );
}
