import RoomScene3D from "@/components/RoomScene3D/RoomScene3D";

// Direct-mount entry point for the 3D room — bypasses the capability gating in
// RoomExperience (WebGL / reduced-motion detection). Handy for calibration and
// debugging the scene in isolation.
export default function RoomScene3DPage() {
  return <RoomScene3D />;
}
