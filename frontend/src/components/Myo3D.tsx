import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type MyoMood = "tired" | "warming" | "energetic";

const TARGET: Record<MyoMood, number> = { tired: 0, warming: 0.5, energetic: 1 };

const c = (hex: string) => new THREE.Color(hex);
const lerpColor = (out: THREE.Color, a: string, b: string, t: number) =>
  out.copy(c(a)).lerp(c(b), t);

/**
 * Procedural 3D Myo built from primitives. A single "energy" value (0 tired .. 1 energetic)
 * drives posture, eyes, mouth, colour and motion, so mood changes animate smoothly.
 */
export default function Myo3D({ mood }: { mood: MyoMood }) {
  const host = useRef<HTMLDivElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 0.1, 7.7);
    camera.lookAt(0, -0.2, 0);

    // ---- lights ----
    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x203040, 1);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.5, 3, 4);
    const rim = new THREE.DirectionalLight(0x35d6c0, 1.6);
    rim.position.set(-3, 2, -3);
    scene.add(hemi, key, rim);

    // ---- materials ----
    const std = (color: string, rough = 0.55, metal = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const suit = std("#ffffff", 0.5);
    const teal = std("#38b6c9", 0.45);
    const orange = std("#f08a4b", 0.5);
    const fur = std("#eeb07a", 0.8);
    const cream = std("#f8dcb8", 0.8);
    const dark = std("#1b2433", 0.3);
    const grey = std("#c9d1dc", 0.6, 0.2);
    const pink = new THREE.MeshStandardMaterial({
      color: "#f08a8a",
      roughness: 0.9,
      transparent: true,
      opacity: 0.55,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#cfeeff",
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const screen = new THREE.MeshStandardMaterial({
      color: "#0e1c2b",
      emissive: new THREE.Color("#FFCC00"),
      emissiveIntensity: 0.7,
    });

    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);
    const sphere = (r: number, m: THREE.Material) => mesh(new THREE.SphereGeometry(r, 32, 24), m);

    // ---- character ----
    const myo = new THREE.Group();
    scene.add(myo);

    const body = mesh(new THREE.CapsuleGeometry(0.5, 0.45, 8, 20), suit);
    body.scale.set(1, 1, 0.85);
    myo.add(body);

    const belt = mesh(new THREE.TorusGeometry(0.5, 0.05, 12, 40), teal);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = -0.3;
    belt.scale.set(1, 0.85, 1);
    myo.add(belt);

    const pack = mesh(new THREE.BoxGeometry(0.8, 0.95, 0.38), grey);
    pack.position.set(0, 0.1, -0.5);
    myo.add(pack);

    const chest = mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), grey);
    chest.position.set(0, 0.28, 0.44);
    myo.add(chest);
    const chestScreen = mesh(new THREE.PlaneGeometry(0.28, 0.1), screen);
    chestScreen.position.set(0, 0.3, 0.486);
    myo.add(chestScreen);
    const badge = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), teal);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.16, -0.05, 0.43);
    myo.add(badge);
    const patch = mesh(new THREE.BoxGeometry(0.2, 0.09, 0.03), orange);
    patch.position.set(0.2, 0.0, 0.45);
    myo.add(patch);

    // head
    const head = new THREE.Group();
    head.position.y = 1.28;
    myo.add(head);
    const face = sphere(0.52, fur);
    face.scale.set(1.08, 1, 1);
    head.add(face);
    const snout = sphere(0.22, cream);
    snout.scale.set(1.15, 0.8, 0.85);
    snout.position.set(0, -0.14, 0.42);
    head.add(snout);
    const nose = sphere(0.06, dark);
    nose.scale.set(1.3, 0.9, 0.9);
    nose.position.set(0, -0.04, 0.6);
    head.add(nose);

    const mouth = new THREE.Group();
    mouth.position.set(0, -0.2, 0.58);
    const mouthArc = mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 24, Math.PI), dark);
    mouth.add(mouthArc);
    head.add(mouth);

    const eyes: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.2, 0.08, 0.46);
      const ball = sphere(0.085, dark);
      ball.scale.set(1, 1.15, 0.7);
      const glint = sphere(0.026, std("#ffffff", 0.2));
      glint.position.set(0.03, 0.04, 0.05);
      eye.add(ball, glint);
      head.add(eye);
      eyes.push(eye);

      const blush = sphere(0.085, pink);
      blush.scale.set(1.2, 0.8, 0.3);
      blush.position.set(sx * 0.34, -0.08, 0.4);
      blush.rotation.y = sx * 0.7;
      head.add(blush);

      const ear = sphere(0.17, fur);
      ear.position.set(sx * 0.34, 0.46, 0.0);
      const earIn = sphere(0.1, pink);
      earIn.position.set(sx * 0.34, 0.46, 0.08);
      earIn.scale.set(1, 1, 0.5);
      head.add(ear, earIn);

      const phone = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 24), suit);
      phone.rotation.z = Math.PI / 2;
      phone.position.set(sx * 0.84, 0, 0);
      head.add(phone);
    }
    const helmet = sphere(0.82, glass);
    head.add(helmet);
    const ring = mesh(new THREE.TorusGeometry(0.6, 0.09, 14, 40), suit);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.64;
    head.add(ring);
    const ringTeal = mesh(new THREE.TorusGeometry(0.62, 0.04, 10, 40), teal);
    ringTeal.rotation.x = Math.PI / 2;
    ringTeal.position.y = -0.74;
    head.add(ringTeal);
    const stripe = mesh(new THREE.TorusGeometry(0.82, 0.018, 8, 48, Math.PI * 0.8), orange);
    stripe.position.set(0, 0, 0);
    stripe.rotation.set(0, 0, Math.PI * 0.1);
    head.add(stripe);

    // arms
    const limb = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.6, 0.32, 0);
      const arm = mesh(new THREE.CapsuleGeometry(0.15, 0.4, 6, 16), suit);
      arm.position.y = -0.3;
      const cuff = mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 20), orange);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.55;
      const glove = sphere(0.17, teal);
      glove.position.y = -0.7;
      pivot.add(arm, cuff, glove);
      myo.add(pivot);
      return { pivot, glove };
    };
    const wave = limb(-1);
    const hold = limb(1);
    const tablet = mesh(new THREE.BoxGeometry(0.3, 0.4, 0.04), screen);
    tablet.position.set(0, -0.05, 0.2);
    tablet.rotation.x = -0.4;
    hold.glove.add(tablet);

    // legs
    const leg = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.26, -0.75, 0);
      const thigh = mesh(new THREE.CapsuleGeometry(0.18, 0.42, 6, 16), suit);
      thigh.position.y = -0.3;
      const knee = sphere(0.14, teal);
      knee.position.set(0, -0.4, 0.14);
      const boot = mesh(new THREE.CapsuleGeometry(0.17, 0.2, 6, 14), teal);
      boot.position.set(0, -0.72, 0.1);
      boot.rotation.x = Math.PI / 2.4;
      pivot.add(thigh, knee, boot);
      myo.add(pivot);
      return pivot;
    };
    const legL = leg(-1);
    const legR = leg(1);

    // ---- backdrop: planet + stars ----
    const planet = sphere(
      1.7,
      new THREE.MeshStandardMaterial({
        color: "#2a63c9",
        roughness: 0.7,
        emissive: new THREE.Color("#0b2a66"),
        emissiveIntensity: 0.6,
      }),
    );
    planet.position.set(-2.7, -0.9, -4);
    const atmo = sphere(
      1.82,
      new THREE.MeshBasicMaterial({
        color: "#6fb4ff",
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      }),
    );
    atmo.position.copy(planet.position);
    scene.add(planet, atmo);
    const starGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 160; i++) {
      const r = 8 + Math.random() * 4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pts.push(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph) * 0.8,
        -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 2,
      );
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.8 }),
    );
    scene.add(stars);

    // ---- sparkles that appear when energetic ----
    const sparkles: THREE.Mesh[] = [];
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0x35d6c0,
      transparent: true,
      opacity: 0,
    });
    for (let i = 0; i < 8; i++) {
      const s = mesh(new THREE.OctahedronGeometry(0.07), sparkMat.clone());
      s.userData.phase = (i / 8) * Math.PI * 2;
      scene.add(s);
      sparkles.push(s);
    }

    // ---- interaction: drag to spin, head follows pointer ----
    let yaw = 0;
    let yawVel = 0;
    let dragging = false;
    let lastX = 0;
    const look = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      look.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      look.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (dragging) {
        yawVel = (e.clientX - lastX) * 0.01;
        yaw += yawVel;
        lastX = e.clientX;
      }
    };
    const onUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
    };
    const onLeave = () => {
      look.x = 0;
      look.y = 0;
    };
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onLeave);

    // ---- sizing ----
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      dom.style.width = "100%";
      dom.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---- animation ----
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
    io.observe(el);

    const tmp = new THREE.Color();
    let e = TARGET[moodRef.current];
    let blink = 0;
    let nextBlink = 2;
    const clock = new THREE.Clock();
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      e += (TARGET[moodRef.current] - e) * Math.min(1, dt * 3);

      // colour: dull and grey when tired, vivid when energetic
      suit.color.set(lerpColor(tmp, "#aeb6c4", "#ffffff", e));
      teal.color.set(lerpColor(tmp, "#5d7580", "#38b6c9", e));
      orange.color.set(lerpColor(tmp, "#8b7468", "#f08a4b", e));
      fur.color.set(lerpColor(tmp, "#b79a86", "#eeb07a", e));
      cream.color.set(lerpColor(tmp, "#cdbfae", "#f8dcb8", e));
      screen.emissiveIntensity = 0.15 + e * 0.9;
      hemi.intensity = 0.45 + e * 0.75;
      key.intensity = 1.2 + e * 1.4;
      rim.intensity = 0.4 + e * 1.8;

      // body motion
      const speed = 0.8 + e * 3.2;
      const bob = Math.sin(t * speed) * (0.04 + e * 0.12);
      myo.position.y = -0.35 + bob - (1 - e) * 0.28 + Math.max(0, Math.sin(t * speed)) * e * 0.12;
      myo.rotation.z = Math.sin(t * speed * 0.5) * (0.03 + e * 0.06) + (1 - e) * 0.05;
      if (!dragging) {
        yawVel *= 0.92;
        yaw += yawVel;
        yaw += (0 - yaw) * 0.03;
      }
      myo.rotation.y = yaw + Math.sin(t * 0.7) * 0.12 * (0.4 + e);

      // head: droops when tired, follows the pointer
      head.rotation.x = (1 - e) * 0.42 + look.y * 0.18 + Math.sin(t * speed * 0.6) * 0.03;
      head.rotation.y = look.x * 0.45;
      head.rotation.z = (1 - e) * -0.1;
      head.position.y = 1.28 - (1 - e) * 0.1;

      // mouth: frown -> flat -> smile
      const smile = (e - 0.35) / 0.65;
      mouth.rotation.z = smile >= 0 ? Math.PI : 0;
      mouthArc.scale.set(1, 0.25 + Math.abs(smile) * 1.1, 1);
      mouth.position.y = -0.2 - (smile >= 0 ? 0 : -0.02);

      // eyes: heavy-lidded when tired, wide when happy, with blinks
      nextBlink -= dt;
      if (nextBlink <= 0) {
        blink = 0.16;
        nextBlink = 2 + Math.random() * 3;
      }
      blink = Math.max(0, blink - dt);
      const open = (blink > 0 ? 0.1 : 0.2 + e * 0.8) + (e > 0.8 ? 0.1 : 0);
      for (const eye of eyes) eye.scale.set(1, open, 1);

      // arms
      const w = Math.sin(t * (4 + e * 6));
      wave.pivot.rotation.z = -(0.18 + e * 2.2 + (e > 0.3 ? w * 0.28 * e : 0));
      wave.pivot.rotation.x = e * 0.15;
      hold.pivot.rotation.z = 0.15 + e * 0.35;
      hold.pivot.rotation.x = 0.2 + e * 0.5;

      // legs: limp and straight when tired, pedalling when energetic
      legL.rotation.x = -0.15 - e * 0.5 + Math.sin(t * speed * 1.1) * 0.1 * (0.3 + e) * 1.2;
      legR.rotation.x = -0.15 - e * 0.5 - Math.sin(t * speed * 1.1) * 0.1 * (0.3 + e) * 1.2;
      legL.rotation.z = -0.05;
      legR.rotation.z = 0.05;

      // sparkles orbit when energetic
      sparkles.forEach((s) => {
        const p = s.userData.phase as number;
        const a = t * 1.2 + p;
        s.position.set(
          Math.cos(a) * 1.7,
          0.3 + Math.sin(t * 2 + p * 3) * 0.9,
          Math.sin(a) * 0.8 + 0.4,
        );
        s.rotation.y = t * 3;
        const m = s.material as THREE.MeshBasicMaterial;
        m.opacity = Math.max(0, (e - 0.6) / 0.4) * (0.5 + 0.5 * Math.sin(t * 4 + p));
      });

      planet.rotation.y = t * 0.05;
      stars.rotation.y = t * 0.01;
      renderer.render(scene, camera);
    };
    if (reduce) {
      // Still render once per mood change instead of a continuous loop.
      frame();
      cancelAnimationFrame(raf);
      const id = window.setInterval(() => {
        frame();
        cancelAnimationFrame(raf);
      }, 500);
      raf = id as unknown as number;
    } else frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed)
    return (
      <div
        className="absolute inset-0 bg-no-repeat"
        style={{
          backgroundImage: "url(/assets/mascot.jpg)",
          backgroundSize: "190%",
          backgroundPosition: "55% 100%",
        }}
      />
    );
  return <div ref={host} className="absolute inset-0" />;
}
