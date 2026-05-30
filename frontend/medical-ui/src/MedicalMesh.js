import React, { memo, useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Ultra-optimized voxel budget for smooth 60fps
const MAX_VOXELS = 1800;
const QUALITY_THRESHOLD = 32;

function MedicalMesh({
  active,
  result,
  viewMode,
  focusMode,
  performanceProfile = 'balanced',
  cameraCommand = null,
  autoSpin = false,
  cinematicTour = false,
  severityTheme = 'normal',
}) {
  const groupRef = useRef();
  const cameraRef = useRef();
  const controlsRef = useRef();
  const rawVoxels = result?.voxels;
  const [dynamicQuality, setDynamicQuality] = useState('normal');
  const fpsProbeRef = useRef({ frameCount: 0, deltaSum: 0 });

  const qualityScale = useMemo(() => {
    if (performanceProfile === 'eco') return 0.6;
    if (performanceProfile === 'performance') return 0.8;
    return 1;
  }, [performanceProfile]);

  const voxelBudget = useMemo(() => {
    if (dynamicQuality === 'low') {
      return Math.max(900, Math.floor(MAX_VOXELS * 0.5 * qualityScale));
    }
    return Math.max(1400, Math.floor(MAX_VOXELS * qualityScale));
  }, [dynamicQuality, qualityScale]);

  const starsCount = useMemo(() => {
    return dynamicQuality === 'low' ? 60 : 100;
  }, [dynamicQuality]);

  const themePalette = useMemo(() => {
    if (severityTheme === 'critical') {
      return {
        organ: '#1565c0',
        tumor: '#d32f2f',
        ambient: '#ffebee',
        key: '#ef9a9a',
        fill: '#ffcdd2',
      };
    }
    if (severityTheme === 'moderate') {
      return {
        organ: '#1976d2',
        tumor: '#f57c00',
        ambient: '#fff3e0',
        key: '#ff9800',
        fill: '#ffe0b2',
      };
    }
    return {
      organ: '#0d47a1',
      tumor: '#ef5350',
      ambient: '#e3f2fd',
      key: '#42a5f5',
      fill: '#bbdefb',
    };
  }, [severityTheme]);

  useEffect(() => {
    if (!cameraCommand || !controlsRef.current || !cameraRef.current) return;

    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const rotateStep = Math.PI / 12;
    const EPS = 0.0001;

    const zoomByFactor = (factor) => {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(factor);
      camera.position.copy(controls.target.clone().add(offset));
      controls.update();
    };

    const setPresetView = (x, y, z) => {
      camera.position.set(x, y, z);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    const rotateCameraBy = (deltaTheta = 0, deltaPhi = 0) => {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += deltaTheta;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + deltaPhi, EPS, Math.PI - EPS);
      offset.setFromSpherical(spherical);
      camera.position.copy(controls.target.clone().add(offset));
      camera.lookAt(controls.target);
      controls.update();
    };

    switch (cameraCommand.type) {
      case 'zoom-in':
        zoomByFactor(0.86);
        break;
      case 'zoom-out':
        zoomByFactor(1.16);
        break;
      case 'rotate-left':
        rotateCameraBy(rotateStep, 0);
        break;
      case 'rotate-right':
        rotateCameraBy(-rotateStep, 0);
        break;
      case 'rotate-up':
        rotateCameraBy(0, -rotateStep * 0.7);
        break;
      case 'rotate-down':
        rotateCameraBy(0, rotateStep * 0.7);
        break;
      case 'reset-view':
        setPresetView(0, 0, 6);
        break;
      case 'preset-front':
        setPresetView(0, 0, 6);
        break;
      case 'preset-top':
        setPresetView(0.1, 6, 0.1);
        break;
      case 'preset-side':
        setPresetView(6, 0, 0);
        break;
      case 'preset-iso':
        setPresetView(4.4, 3.4, 4.8);
        break;
      default:
        break;
    }
  }, [cameraCommand]);

  // --- [1] VOXEL CLOUD GENERATION (with decimation) ---
  const voxelData = useMemo(() => {
    if (!active || !rawVoxels || rawVoxels.length === 0) return null;

    // Decimate: if too many voxels, sample every Nth to stay within budget
    const step = rawVoxels.length > voxelBudget
      ? Math.ceil(rawVoxels.length / voxelBudget)
      : 1;
    const count = Math.ceil(rawVoxels.length / step);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const organColor = new THREE.Color(themePalette.organ);
    const tumorColor = new THREE.Color(themePalette.tumor);

    let writeIndex = 0;
    for (let i = 0; i < rawVoxels.length; i += step) {
      const v = rawVoxels[i];
      positions[writeIndex * 3] = v[0];
      positions[writeIndex * 3 + 1] = v[1];
      positions[writeIndex * 3 + 2] = v[2];

      const baseColor = v[3] === 2 ? tumorColor : organColor;
      const shade = 0.72 + Math.random() * 0.28;
      colors[writeIndex * 3] = baseColor.r * shade;
      colors[writeIndex * 3 + 1] = baseColor.g * shade;
      colors[writeIndex * 3 + 2] = baseColor.b * shade;
      writeIndex += 1;
    }

    return { positions, colors, count: writeIndex };
  }, [active, rawVoxels, themePalette.organ, themePalette.tumor, voxelBudget]);

  // --- [2] MINIMAL ANIMATION LOOP ---
  // Only rotate; skip expensive scale.set() / Math.sin per frame
  useFrame((state) => {
    if (!groupRef.current) return;

    // Update quality every ~2 seconds based on measured FPS.
    fpsProbeRef.current.frameCount += 1;
    fpsProbeRef.current.deltaSum += state.clock.getDelta();
    if (fpsProbeRef.current.frameCount >= 60) {
      const avgDelta = fpsProbeRef.current.deltaSum / fpsProbeRef.current.frameCount;
      const approxFps = avgDelta > 0 ? 1 / avgDelta : 60;
      const nextQuality = approxFps < QUALITY_THRESHOLD ? 'low' : 'normal';
      if (nextQuality !== dynamicQuality) {
        setDynamicQuality(nextQuality);
      }
      fpsProbeRef.current.frameCount = 0;
      fpsProbeRef.current.deltaSum = 0;
    }

    if (autoSpin || cinematicTour) {
      groupRef.current.rotation.y += focusMode ? 0.005 : 0.0018;
    }
    if (focusMode && active && (autoSpin || cinematicTour)) {
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0, 6]} fov={40} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        enablePan
        autoRotate={cinematicTour}
        autoRotateSpeed={cinematicTour ? 1.35 : 0}
        zoomSpeed={0.9}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        maxDistance={focusMode ? 16 : 12}
        minDistance={focusMode ? 1.5 : 2}
      />

      {/* Minimal stars, zero motion */}
      <Stars radius={80} depth={30} count={starsCount} factor={2} saturation={0} speed={0} />

      {/* Single pass lighting */}
      <ambientLight intensity={0.72} color={themePalette.ambient} />
      <directionalLight position={[8, 8, 8]} intensity={1.0} color={themePalette.key} castShadow={false} />

      <group ref={groupRef}>

        {/* Ultra-light shell: 16 segments = 256 verts */}
        <mesh>
          <sphereGeometry args={[2.1, 16, 16]} />
          <meshPhongMaterial
            color="#e0e0e0"
            transparent
            opacity={viewMode === "WIRE" ? 0.25 : 0.05}
            wireframe={viewMode === "WIRE"}
            side={THREE.FrontSide}
            flatShading
          />
        </mesh>

        {/* Voxel point cloud – AdditiveBlending removed (expensive on large clouds) */}
        {voxelData && (
          <points>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={voxelData.count}
                array={voxelData.positions}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-color"
                count={voxelData.count}
                array={voxelData.colors}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial
              size={0.05}
              vertexColors
              transparent
              opacity={0.88}
              sizeAttenuation
              depthWrite={false}
            />
          </points>
        )}

        {/* Ultra-light marker: 1 mesh only */}
        {active && result?.coords && (
          <mesh position={[result.coords.x, result.coords.y, result.coords.z]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshBasicMaterial
              color={result.severity === 'CRITICAL' ? "#d32f2f" : "#f57c00"}
              transparent
              opacity={0.9}
            />
          </mesh>
        )}

      </group>
    </>
  );
}

export default memo(MedicalMesh);