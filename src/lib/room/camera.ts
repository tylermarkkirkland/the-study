// The 3D room's locked camera, chosen by hand during Blender iteration. Shared
// so both the scene and the dev draw-tool (which unprojects screen points onto
// the desk) work from the exact same camera.
export const CAMERA_POSITION: [number, number, number] = [-0.01, 1.02, 0.77];
export const CAMERA_TARGET: [number, number, number] = [0, 1, 0];
export const FOV = 45;

type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Cast a ray from the locked camera through a screen point (CSS px, origin
 * top-left) and return where it hits the horizontal plane y = planeY, in world
 * coordinates. Used by the draw-tool to turn a rectangle drawn over the desk
 * into a world-space box. Returns null if the ray runs parallel to the plane.
 */
export function unprojectToPlane(
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  planeY: number,
): Vec3 | null {
  const fovY = (FOV * Math.PI) / 180;
  const aspect = vw / vh;
  const tanHalf = Math.tan(fovY / 2);

  // Camera basis (matches the forward projection used elsewhere): z points from
  // target back to the eye, x is right, y is up.
  const z = norm(sub(CAMERA_POSITION, CAMERA_TARGET));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);

  const ndcx = (sx / vw) * 2 - 1;
  const ndcy = 1 - (sy / vh) * 2;

  // View-space ray direction (forward is -z), rotated into world space.
  const vx = ndcx * aspect * tanHalf;
  const vy = ndcy * tanHalf;
  const dir: Vec3 = [
    vx * x[0] + vy * y[0] - z[0],
    vx * x[1] + vy * y[1] - z[1],
    vx * x[2] + vy * y[2] - z[2],
  ];

  if (Math.abs(dir[1]) < 1e-6) return null;
  const t = (planeY - CAMERA_POSITION[1]) / dir[1];
  if (t <= 0) return null;
  return [
    CAMERA_POSITION[0] + t * dir[0],
    planeY,
    CAMERA_POSITION[2] + t * dir[2],
  ];
}
