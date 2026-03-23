// Baseball projectile motion with air drag + simplified Magnus lift (Euler integration)
const MASS = 0.145;           // kg (baseball)
const G = 9.81;               // m/s^2
const CD = 0.30;              // drag coefficient
const CL = 0.14;              // lift coefficient (simplified Magnus effect for ~2000rpm backspin)
const RHO = 1.225;            // kg/m^3 (air density at sea level)
const RADIUS = 0.0366;        // m (baseball radius ~1.44 in)
const AREA = Math.PI * RADIUS * RADIUS;
const DT = 0.001;             // time step in seconds
const BAT_HEIGHT = 1.0;       // m (approximate contact height)
const DRAG_FACTOR = 0.5 * CD * RHO * AREA / MASS;
const LIFT_FACTOR = 0.5 * CL * RHO * AREA / MASS;

/**
 * Estimate hit distance given exit velocity and launch angle.
 * @param {number} exitVeloMph - Exit velocity in mph
 * @param {number} launchAngleDeg - Launch angle in degrees (0 = line drive, 90 = straight up)
 * @returns {{ distanceFt: number, hangTimeSec: number, apexFt: number }}
 */
export function estimateDistance(exitVeloMph, launchAngleDeg) {
  const v0 = exitVeloMph * 0.44704; // mph -> m/s
  const angle = launchAngleDeg * (Math.PI / 180);

  let vx = v0 * Math.cos(angle);
  let vy = v0 * Math.sin(angle);
  let x = 0;
  let y = BAT_HEIGHT;
  let maxY = y;
  let t = 0;

  // Integrate until ball hits the ground (y <= 0) or timeout at 15s
  while (y > 0 && t < 15) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    // Drag opposes velocity; lift acts perpendicular to velocity (upward for backspin)
    const ax = -DRAG_FACTOR * speed * vx;
    const ay = -G - DRAG_FACTOR * speed * vy + LIFT_FACTOR * speed * speed;

    vx += ax * DT;
    vy += ay * DT;
    x += vx * DT;
    y += vy * DT;
    t += DT;

    if (y > maxY) maxY = y;
  }

  return {
    distanceFt: x * 3.28084,
    hangTimeSec: t,
    apexFt: maxY * 3.28084,
  };
}

/**
 * Quick validation of the physics model.
 * 100 mph at 25° should give ~400-430 ft
 * 90 mph at 30° should give ~360-400 ft
 */
export function validateModel() {
  const test1 = estimateDistance(100, 25);
  const test2 = estimateDistance(90, 30);
  return {
    '100mph_25deg': Math.round(test1.distanceFt),
    '90mph_30deg': Math.round(test2.distanceFt),
    valid: test1.distanceFt > 380 && test1.distanceFt < 450 &&
           test2.distanceFt > 340 && test2.distanceFt < 420,
  };
}
