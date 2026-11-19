// Visualizzatore 3D della lettera: legge il 3MF a colori prodotto da /api/lettera
// e lo mostra con three.js. Si ruota trascinando e si avvicina con rotella o due dita.

import * as THREE from "../vendor/three/three.module.min.js";

// ---------------------------------------------------------------- Lettura del 3MF

async function readModelXml(buffer) {
  const view = new DataView(buffer);
  const u64 = (offset) => Number(view.getBigUint64(offset, true));
  let end = -1;
  for (let index = buffer.byteLength - 22; index >= Math.max(0, buffer.byteLength - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("File 3MF non valido.");

  let entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);

  // ZIP64 (lib3mf lo usa sempre): i valori veri stanno nel record esteso.
  if ((offset === 0xffffffff || entries === 0xffff) && end >= 20 && view.getUint32(end - 20, true) === 0x07064b50) {
    const record = u64(end - 12);
    entries = u64(record + 32);
    offset = u64(record + 48);
  }

  const decoder = new TextDecoder();

  for (let entry = 0; entry < entries; entry += 1) {
    const method = view.getUint16(offset + 10, true);
    let compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    let localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));

    // Campo extra ZIP64: contiene solo i valori marcati 0xffffffff, in quest'ordine.
    let extra = offset + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = view.getUint16(extra, true);
      const size = view.getUint16(extra + 2, true);
      if (id === 0x0001) {
        let field = extra + 4;
        if (uncompressedSize === 0xffffffff) field += 8;
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(field);
          field += 8;
        }
        if (localOffset === 0xffffffff) localOffset = u64(field);
      }
      extra += 4 + size;
    }

    if (name.toLowerCase().endsWith(".model")) {
      const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const data = new Uint8Array(buffer, start, compressedSize);
      if (method === 0) return decoder.decode(data);
      if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Response(stream).text();
      }
      throw new Error("Compressione 3MF non supportata.");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("Il 3MF non contiene un modello.");
}

// Restituisce { colore: [x, y, z, ...] } con i triangoli raggruppati per colore.
function parseModel(xml) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  const materials = new Map();
  for (const group of documentXml.getElementsByTagName("basematerials")) {
    const colors = [...group.getElementsByTagName("base")].map((base) => (base.getAttribute("displaycolor") || "#cccccc").slice(0, 7));
    materials.set(group.getAttribute("id"), colors);
  }

  const byColor = new Map();
  const colorOf = (pid, index, fallback) => {
    const list = materials.get(pid);
    return list && list[index] ? list[index] : fallback;
  };

  for (const object of documentXml.getElementsByTagName("object")) {
    const mesh = object.getElementsByTagName("mesh")[0];
    if (!mesh) continue;
    const objectColor = colorOf(object.getAttribute("pid"), Number(object.getAttribute("pindex") || 0), "#cccccc");
    const vertices = [...mesh.getElementsByTagName("vertex")].map((vertex) => [
      Number(vertex.getAttribute("x")),
      Number(vertex.getAttribute("y")),
      Number(vertex.getAttribute("z"))
    ]);

    for (const triangle of mesh.getElementsByTagName("triangle")) {
      const pid = triangle.getAttribute("pid");
      const color = pid !== null
        ? colorOf(pid, Number(triangle.getAttribute("p1") || 0), objectColor)
        : objectColor;
      if (!byColor.has(color)) byColor.set(color, []);
      const target = byColor.get(color);
      for (const key of ["v1", "v2", "v3"]) target.push(...vertices[Number(triangle.getAttribute(key))]);
    }
  }
  return byColor;
}

// Normali smussate solo tra facce quasi complanari: sfere morbide, spigoli netti.
function creasedGeometry(positions, creaseAngle = 40) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const count = positions.length / 9;
  const faceNormals = new Float32Array(count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const keyOf = (index) => `${positions[index].toFixed(3)},${positions[index + 1].toFixed(3)},${positions[index + 2].toFixed(3)}`;
  const shared = new Map();

  for (let face = 0; face < count; face += 1) {
    const base = face * 9;
    a.fromArray(positions, base);
    b.fromArray(positions, base + 3);
    c.fromArray(positions, base + 6);
    b.sub(a);
    c.sub(a);
    b.cross(c).normalize();
    faceNormals.set([b.x, b.y, b.z], face * 3);
    for (let corner = 0; corner < 3; corner += 1) {
      const key = keyOf(base + corner * 3);
      if (!shared.has(key)) shared.set(key, []);
      shared.get(key).push(face);
    }
  }

  const limit = Math.cos((creaseAngle * Math.PI) / 180);
  const normals = new Float32Array(positions.length);
  const sum = new THREE.Vector3();
  const own = new THREE.Vector3();
  const other = new THREE.Vector3();

  for (let face = 0; face < count; face += 1) {
    own.fromArray(faceNormals, face * 3);
    for (let corner = 0; corner < 3; corner += 1) {
      const index = face * 9 + corner * 3;
      sum.set(0, 0, 0);
      for (const neighbour of shared.get(keyOf(index))) {
        other.fromArray(faceNormals, neighbour * 3);
        if (own.dot(other) >= limit) sum.add(other);
      }
      sum.normalize();
      normals.set([sum.x, sum.y, sum.z], index);
    }
  }

  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geometry;
}

// ---------------------------------------------------------------- Scena

export function createViewer(container, options = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "viewer-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 4000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b8, 0.85));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.4);
  key.position.set(-220, 420, 380);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -300;
  key.shadow.camera.right = 300;
  key.shadow.camera.top = 300;
  key.shadow.camera.bottom = -300;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
  rim.position.set(320, 200, -300);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShadowMaterial({ opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const turntable = new THREE.Group();
  scene.add(turntable);
  let model = null;

  const view = { yaw: -0.38, pitch: 0.2, distance: 620, target: new THREE.Vector3(0, 100, 0) };
  const initialView = { ...view, target: view.target.clone() };
  let frame = 0;
  let idle = !options.static && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let idleTime = 0;
  let lastTime = 0;
  let idleRunning = false;

  function render() {
    frame = 0;
    camera.position.set(
      view.target.x + view.distance * Math.cos(view.pitch) * Math.sin(view.yaw),
      view.target.y + view.distance * Math.sin(view.pitch),
      view.target.z + view.distance * Math.cos(view.pitch) * Math.cos(view.yaw)
    );
    camera.lookAt(view.target);
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  // Leggera oscillazione finché nessuno tocca il modello.
  function idleLoop(time) {
    if (!idle) {
      idleRunning = false;
      return;
    }
    const delta = lastTime ? Math.min(time - lastTime, 50) : 16;
    lastTime = time;
    idleTime += delta / 1000;
    view.yaw = initialView.yaw + Math.sin(idleTime * 0.45) * 0.32;
    render();
    requestAnimationFrame(idleLoop);
  }

  function stopIdle() {
    idle = false;
  }

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  // ---- Controlli: trascina per ruotare, rotella o due dita per avvicinare
  const pointers = new Map();
  let pinchDistance = 0;

  renderer.domElement.style.touchAction = "none";
  renderer.domElement.addEventListener("pointerdown", (event) => {
    stopIdle();
    renderer.domElement.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, current);

    if (pointers.size === 1) {
      view.yaw -= (current.x - previous.x) * 0.008;
      view.pitch = THREE.MathUtils.clamp(view.pitch + (current.y - previous.y) * 0.006, -0.05, 1.1);
    } else if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (pinchDistance) view.distance = THREE.MathUtils.clamp(view.distance * (pinchDistance / distance), 280, 1100);
      pinchDistance = distance;
    }
    requestRender();
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
  };
  renderer.domElement.addEventListener("pointerup", release);
  renderer.domElement.addEventListener("pointercancel", release);
  renderer.domElement.addEventListener("wheel", (event) => {
    event.preventDefault();
    stopIdle();
    view.distance = THREE.MathUtils.clamp(view.distance * Math.exp(event.deltaY * 0.001), 280, 1100);
    requestRender();
  }, { passive: false });
  renderer.domElement.addEventListener("dblclick", () => {
    Object.assign(view, { ...initialView, target: initialView.target.clone() });
    requestRender();
  });

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  async function show(buffer) {
    const groups = parseModel(await readModelXml(buffer));
    const next = new THREE.Group();

    for (const [color, positions] of groups) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.48,
        metalness: 0.02
      });
      const mesh = new THREE.Mesh(creasedGeometry(positions), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      next.add(mesh);
    }

    // OpenSCAD ha z verso l'alto e il fronte verso -y; three.js ha y verso l'alto.
    next.rotation.x = -Math.PI / 2;
    const box = new THREE.Box3().setFromObject(next);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    next.position.set(-center.x, -box.min.y, -center.z);

    if (model) {
      turntable.remove(model);
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
    }
    model = next;
    turntable.add(model);

    // Distanza che fa stare tutto il modello nel riquadro, in larghezza e in altezza.
    const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
    const fitWidth = (Math.hypot(size.x, size.z) / 2) / Math.tan(halfHorizontal);
    const fitHeight = (size.y / 2) / Math.tan(halfVertical) + size.z / 2;
    const fit = Math.max(fitWidth, fitHeight) * 1.08;
    view.target.set(0, size.y * 0.46, 0);
    initialView.target.copy(view.target);
    if (Math.abs(initialView.distance - fit) > 30) {
      view.distance = fit;
      initialView.distance = fit;
    }

    if (idle && !idleRunning) {
      idleRunning = true;
      requestAnimationFrame(idleLoop);
    } else {
      requestRender();
    }
  }

  function dispose() {
    stopIdle();
    observer.disconnect();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { show, dispose, render: requestRender };
}
