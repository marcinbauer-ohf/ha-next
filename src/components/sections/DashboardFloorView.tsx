'use client';

import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, RoundedBox, OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { isOn } from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

interface Section {
  key: string;
  title: string;
  devices: HassDevice[];
}

interface DashboardFloorViewProps {
  sections: Section[];
  onRoomClick: (areaId: string) => void;
}

const ROOM_W = 2.0;
const ROOM_D = 2.0;
const ROOM_H = 0.38;
const GAP = 0.65;
const STEP = ROOM_W + GAP;

const C_ACTIVE = new THREE.Color('#1d4ed8');
const C_IDLE = new THREE.Color('#1e293b');
const C_HOVER = new THREE.Color('#3b82f6');
const C_EMISSIVE_ACTIVE = new THREE.Color('#1d3a8a');
const C_EMISSIVE_OFF = new THREE.Color(0, 0, 0);

function RoomBox({
  section,
  col,
  row,
  cols,
  rows,
  onSelect,
}: {
  section: Section;
  col: number;
  row: number;
  cols: number;
  rows: number;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const activeCount = useMemo(
    () => section.devices.filter(d => d.primaryEntity && isOn(d.primaryEntity)).length,
    [section.devices],
  );
  const isActive = activeCount > 0;

  const x = (col - (cols - 1) / 2) * STEP;
  const z = (row - (rows - 1) / 2) * STEP;

  useFrame((_, delta) => {
    if (!groupRef.current || !matRef.current) return;
    const targetY = hovered ? 0.14 : 0;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 12 * delta;

    const targetColor = hovered ? C_HOVER : isActive ? C_ACTIVE : C_IDLE;
    matRef.current.color.lerp(targetColor, 1 - Math.pow(0.001, delta));
    const targetEmissive = isActive ? C_EMISSIVE_ACTIVE : C_EMISSIVE_OFF;
    matRef.current.emissive.lerp(targetEmissive, 1 - Math.pow(0.001, delta));
  });

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {/* Room slab */}
      <RoundedBox
        args={[ROOM_W, ROOM_H, ROOM_D]}
        radius={0.14}
        smoothness={4}
        position={[0, ROOM_H / 2, 0]}
        castShadow
        receiveShadow
        onPointerEnter={e => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerLeave={e => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
        onClick={e => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial
          ref={matRef}
          color={isActive ? C_ACTIVE : C_IDLE}
          emissive={isActive ? C_EMISSIVE_ACTIVE : C_EMISSIVE_OFF}
          roughness={0.45}
          metalness={0.2}
        />
      </RoundedBox>

      {/* Active glow ring on the floor */}
      {isActive && (
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ROOM_W * 0.38, ROOM_W * 0.52, 48]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.28} />
        </mesh>
      )}

      {/* Floating label */}
      <Html
        position={[0, ROOM_H + 0.62, 0]}
        center
        occlude={false}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            background: 'rgba(2, 8, 24, 0.9)',
            borderRadius: '8px',
            padding: '3px 10px',
            whiteSpace: 'nowrap',
            color: isActive ? '#e2e8f0' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 600,
            border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
            lineHeight: '1.6',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {section.title}
          {activeCount > 0 && (
            <span
              style={{
                background: '#1e40af',
                color: '#93c5fd',
                borderRadius: '4px',
                padding: '0 5px',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {activeCount}
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

function Scene({ sections, onRoomClick }: { sections: Section[]; onRoomClick: (key: string) => void }) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(sections.length)));
  const rows = Math.ceil(sections.length / cols);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 14, 8]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 8, -4]} intensity={0.35} color="#818cf8" />
      <pointLight position={[0, 5, 0]} intensity={0.25} color="#60a5fa" distance={18} decay={2} />

      <Grid
        position={[0, -0.012, 0]}
        args={[80, 80]}
        cellSize={STEP}
        cellThickness={0.4}
        cellColor="#1e293b"
        sectionSize={0}
        sectionThickness={0}
        sectionColor="#1e293b"
        fadeDistance={28}
        fadeStrength={2.5}
        infiniteGrid
      />

      {sections.map((section, i) => (
        <RoomBox
          key={section.key}
          section={section}
          col={i % cols}
          row={Math.floor(i / cols)}
          cols={cols}
          rows={rows}
          onSelect={() => onRoomClick(section.key)}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2.6}
        minZoom={22}
        maxZoom={105}
      />
    </>
  );
}

export default function DashboardFloorView({ sections, onRoomClick }: DashboardFloorViewProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [10, 14, 10], zoom: 58, near: -200, far: 500 }}
      style={{ background: 'transparent' }}
      shadows
      dpr={[1, 2]}
    >
      <Scene sections={sections} onRoomClick={onRoomClick} />
    </Canvas>
  );
}
