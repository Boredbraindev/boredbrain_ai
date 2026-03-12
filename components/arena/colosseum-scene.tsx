'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Text, Environment } from '@react-three/drei';
import * as THREE from 'three';

// ─── Fire Particles System ───────────────────────────────────────────────────

function FireParticles({ count = 80, color, position, spread = 1 }: {
  count?: number; color: string; position: [number, number, number]; spread?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * spread,
      y: Math.random() * 2,
      z: (Math.random() - 0.5) * spread * 0.5,
      speed: 0.3 + Math.random() * 0.8,
      offset: Math.random() * Math.PI * 2,
      scale: 0.02 + Math.random() * 0.06,
    }));
  }, [count, spread]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      const y = (p.y + t * p.speed) % 3;
      dummy.position.set(
        position[0] + p.x + Math.sin(t * 2 + p.offset) * 0.1,
        position[1] + y,
        position[2] + p.z,
      );
      const life = 1 - y / 3;
      dummy.scale.setScalar(p.scale * life * 2);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </instancedMesh>
  );
}

// ─── Burst Particles (triggered on message) ─────────────────────────────────

function BurstParticles({ side, trigger }: { side: 'left' | 'right'; trigger: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 50;
  const startTimeRef = useRef(0);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      return {
        vx: Math.cos(angle) * speed * (side === 'left' ? 1 : -1) * 0.3,
        vy: Math.sin(angle) * speed * 0.5 + Math.random() * 2,
        vz: (Math.random() - 0.5) * speed * 0.3,
        scale: 0.02 + Math.random() * 0.05,
      };
    });
  }, [side, trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    startTimeRef.current = performance.now() / 1000;
  }, [trigger]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const elapsed = clock.getElapsedTime() - startTimeRef.current;
    if (elapsed > 2) {
      // Hide all
      particles.forEach((_, i) => {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      return;
    }

    const cx = side === 'left' ? -1.5 : 1.5;
    particles.forEach((p, i) => {
      const life = Math.max(0, 1 - elapsed / 1.5);
      dummy.position.set(
        cx + p.vx * elapsed,
        0.5 + p.vy * elapsed - 4.9 * elapsed * elapsed * 0.5,
        p.vz * elapsed,
      );
      dummy.scale.setScalar(p.scale * life * 3);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const burstColor = side === 'left' ? '#f59e0b' : '#a855f7';

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={burstColor} transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ─── Colosseum Pillar ────────────────────────────────────────────────────────

function Pillar({ position, height = 3.5 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      {/* Column */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.15, height, 8]} />
        <meshStandardMaterial color="#4a3728" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Capital (top) */}
      <mesh position={[0, height + 0.1, 0]}>
        <cylinderGeometry args={[0.22, 0.14, 0.2, 8]} />
        <meshStandardMaterial color="#5a4738" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.2, 8]} />
        <meshStandardMaterial color="#5a4738" roughness={0.7} metalness={0.15} />
      </mesh>
    </group>
  );
}

// ─── Arch between pillars ────────────────────────────────────────────────────

function Arch({ from, to, height = 3.5 }: { from: [number, number, number]; to: [number, number, number]; height?: number }) {
  const curve = useMemo(() => {
    const mid = [(from[0] + to[0]) / 2, height + 0.8, (from[2] + to[2]) / 2] as [number, number, number];
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from[0], height, from[2]),
      new THREE.Vector3(mid[0], mid[1], mid[2]),
      new THREE.Vector3(to[0], height, to[2]),
    );
  }, [from, to, height]);

  const geometry = useMemo(() => {
    const points = curve.getPoints(20);
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      20, 0.06, 6, false,
    );
  }, [curve]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#4a3728" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

// ─── Arena Floor ─────────────────────────────────────────────────────────────

function ArenaFloor() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#2a1f15" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Inner ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[2.8, 3, 48]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[3.8, 4, 48]} />
        <meshStandardMaterial color="#1a120a" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Center mark */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.3, 0.35, 24]} />
        <meshStandardMaterial color="#ef4444" roughness={0.5} emissive="#ef4444" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// ─── Torch (fire light) ──────────────────────────────────────────────────────

function Torch({ position, color = '#f59e0b' }: { position: [number, number, number]; color?: string }) {
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.sin(clock.getElapsedTime() * 8 + position[0]) * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Torch holder */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.6, 6]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.9} />
      </mesh>
      {/* Flame glow */}
      <pointLight ref={lightRef} color={color} intensity={1.5} distance={4} decay={2} />
      {/* Flame mesh */}
      <Float speed={5} rotationIntensity={0} floatIntensity={0.2}>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      </Float>
    </group>
  );
}

// ─── Fighter Ape (billboard image) ───────────────────────────────────────────

function FighterApe({ side, imageUrl, supportPercent, name, isAttacking }: {
  side: 'left' | 'right';
  imageUrl: string;
  supportPercent: number;
  name: string;
  isAttacking: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const attackRef = useRef(false);
  const attackTimeRef = useRef(0);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    });
  }, [imageUrl]);

  useEffect(() => {
    if (isAttacking) {
      attackRef.current = true;
      attackTimeRef.current = performance.now();
    }
  }, [isAttacking]);

  const x = side === 'left' ? -1.8 : 1.8;
  const flipX = side === 'left' ? -1 : 1;
  const tintColor = side === 'left' ? '#f59e0b' : '#a855f7';

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Idle breathing
    const t = clock.getElapsedTime();
    groupRef.current.position.y = 0.8 + Math.sin(t * 1.5) * 0.05;

    // Attack lunge
    if (attackRef.current) {
      const elapsed = (performance.now() - attackTimeRef.current) / 1000;
      if (elapsed < 0.3) {
        // Lunge forward
        const lunge = Math.sin(elapsed / 0.3 * Math.PI) * 0.5;
        groupRef.current.position.x = x + lunge * (side === 'left' ? 1 : -1);
        groupRef.current.rotation.z = lunge * 0.15 * (side === 'left' ? -1 : 1);
      } else if (elapsed < 0.6) {
        // Return
        const ret = 1 - (elapsed - 0.3) / 0.3;
        groupRef.current.position.x = x + ret * 0.2 * (side === 'left' ? 1 : -1);
        groupRef.current.rotation.z = ret * 0.05 * (side === 'left' ? -1 : 1);
      } else {
        groupRef.current.position.x = x;
        groupRef.current.rotation.z = 0;
        attackRef.current = false;
      }
    } else {
      groupRef.current.position.x = x;
    }
  });

  return (
    <group ref={groupRef} position={[x, 0.8, 0]}>
      {/* Aura glow */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[2.2, 2.6]} />
        <meshBasicMaterial color={tintColor} transparent opacity={0.08} />
      </mesh>

      {/* Ape image */}
      {texture && (
        <mesh scale={[1.5 * flipX, 1.8, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={texture} transparent alphaTest={0.01} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Tint overlay */}
      {texture && (
        <mesh scale={[1.5 * flipX, 1.8, 1]} position={[0, 0, 0.01]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={tintColor} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {/* HP Bar background */}
      <mesh position={[0, -1.1, 0]}>
        <planeGeometry args={[1.2, 0.08]} />
        <meshBasicMaterial color="#111" transparent opacity={0.8} />
      </mesh>
      {/* HP Bar fill */}
      <mesh position={[(supportPercent / 100 - 1) * 0.6, -1.1, 0.01]}>
        <planeGeometry args={[1.2 * supportPercent / 100, 0.06]} />
        <meshBasicMaterial color={tintColor} />
      </mesh>

      {/* Name */}
      <Text
        position={[0, -1.3, 0]}
        fontSize={0.14}
        color={tintColor}
        anchorX="center"
        anchorY="middle"
                outlineColor="black"
        outlineWidth={0.02}
      >
        {name}
      </Text>
    </group>
  );
}

// ─── VS Clash Effect ─────────────────────────────────────────────────────────

function VSClash() {
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.5;
      ringRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.1);
    }
  });

  return (
    <group position={[0, 1, 0.5]}>
      {/* Glow */}
      <mesh>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.1} />
      </mesh>
      {/* Ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.3, 0.02, 8, 24]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.4} />
      </mesh>
      {/* VS text */}
      <Text
        fontSize={0.3}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
        outlineColor="black"
        outlineWidth={0.03}
      >
        VS
      </Text>
      <pointLight color="#ef4444" intensity={2} distance={3} decay={2} />
    </group>
  );
}

// ─── Camera Animation ────────────────────────────────────────────────────────

function CameraController({ shaking }: { shaking: boolean }) {
  const { camera } = useThree();
  const shakeStartRef = useRef(0);

  useEffect(() => {
    if (shaking) shakeStartRef.current = performance.now();
  }, [shaking]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Gentle idle sway
    camera.position.x = Math.sin(t * 0.15) * 0.2;
    camera.position.y = 3 + Math.sin(t * 0.2) * 0.1;
    camera.position.z = 5.5;
    camera.lookAt(0, 0.8, 0);

    // Shake on hit
    if (shaking) {
      const elapsed = (performance.now() - shakeStartRef.current) / 1000;
      if (elapsed < 0.4) {
        const intensity = (1 - elapsed / 0.4) * 0.15;
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity * 0.5;
      }
    }
  });

  return null;
}

// ─── Main Colosseum Scene ────────────────────────────────────────────────────

function ColosseumInner({ leftName, rightName, leftPercent, rightPercent, attackSide, shaking }: {
  leftName: string;
  rightName: string;
  leftPercent: number;
  rightPercent: number;
  attackSide: 'left' | 'right' | null;
  shaking: boolean;
}) {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (attackSide) setBurstKey((k) => k + 1);
  }, [attackSide]);

  // Pillar positions in a semicircle behind the arena
  const pillars = useMemo(() => {
    const result: [number, number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 0.15) + (i / 9) * (Math.PI * 0.7);
      const r = 4.5;
      result.push([Math.cos(angle) * r, 0, -Math.sin(angle) * r + 1]);
    }
    return result;
  }, []);

  return (
    <>
      <CameraController shaking={shaking} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 5]} intensity={0.3} color="#ffeedd" />
      <fog attach="fog" args={['#0a0604', 6, 14]} />

      {/* Arena floor */}
      <ArenaFloor />

      {/* Colosseum pillars + arches */}
      {pillars.map((pos, i) => (
        <Pillar key={i} position={pos} height={3 + (i % 2) * 0.5} />
      ))}
      {pillars.slice(0, -1).map((pos, i) => (
        <Arch
          key={`arch-${i}`}
          from={pos}
          to={pillars[i + 1]}
          height={3 + (i % 2) * 0.5}
        />
      ))}

      {/* Second row of pillars (higher, further back) */}
      {pillars.filter((_, i) => i % 2 === 0).map((pos, i) => {
        const higher: [number, number, number] = [pos[0] * 1.15, 3.5, pos[2] * 1.15];
        return <Pillar key={`upper-${i}`} position={higher} height={2} />;
      })}

      {/* Torches */}
      <Torch position={[-3, 3.2, -2]} color="#f59e0b" />
      <Torch position={[3, 3.2, -2]} color="#a855f7" />
      <Torch position={[-4.2, 2.5, 0.5]} color="#f97316" />
      <Torch position={[4.2, 2.5, 0.5]} color="#c084fc" />
      <Torch position={[-1.5, 3.8, -3]} color="#fbbf24" />
      <Torch position={[1.5, 3.8, -3]} color="#e879f9" />

      {/* Fire particle systems */}
      <FireParticles count={60} color="#f59e0b" position={[-3, 3, -2]} spread={0.5} />
      <FireParticles count={60} color="#a855f7" position={[3, 3, -2]} spread={0.5} />
      <FireParticles count={30} color="#ef4444" position={[0, 0.1, 0]} spread={3} />

      {/* Fighters */}
      <FighterApe
        side="left"
        imageUrl="/ape-hero.png"
        supportPercent={leftPercent}
        name={leftName}
        isAttacking={attackSide === 'left'}
      />
      <FighterApe
        side="right"
        imageUrl="/ape-hero.png"
        supportPercent={rightPercent}
        name={rightName}
        isAttacking={attackSide === 'right'}
      />

      {/* VS clash center */}
      <VSClash />

      {/* Burst particles on attack */}
      {attackSide && (
        <BurstParticles key={burstKey} side={attackSide} trigger={burstKey} />
      )}

      {/* Ground fog/dust */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial color="#1a0f08" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────

export default function ColosseumScene({ leftName, rightName, leftPercent, rightPercent, attackSide, shaking }: {
  leftName: string;
  rightName: string;
  leftPercent: number;
  rightPercent: number;
  attackSide: 'left' | 'right' | null;
  shaking: boolean;
}) {
  return (
    <div className="w-full h-[320px] sm:h-[400px] rounded-xl overflow-hidden relative">
      {/* Gradient overlay for blending */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />

      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 3, 5.5], fov: 45 }}
        style={{ background: 'linear-gradient(180deg, #0a0604 0%, #1a0f08 40%, #0d0806 100%)' }}
      >
        <ColosseumInner
          leftName={leftName}
          rightName={rightName}
          leftPercent={leftPercent}
          rightPercent={rightPercent}
          attackSide={attackSide}
          shaking={shaking}
        />
      </Canvas>

      {/* Score overlay */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-between px-6 sm:px-10">
        <div className="text-center">
          <span className={`text-3xl sm:text-4xl font-black font-mono tabular-nums ${leftPercent > rightPercent ? 'text-amber-400 drop-shadow-[0_0_16px_rgba(245,158,11,0.6)]' : 'text-white/40'}`}>
            {leftPercent}%
          </span>
        </div>
        <div className="flex-1 mx-4 sm:mx-8">
          <div className="h-2.5 rounded-full bg-black/60 overflow-hidden border border-white/[0.08]">
            <div className="h-full flex">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-400 transition-all duration-700 rounded-l-full shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                style={{ width: `${leftPercent}%` }}
              />
              <div className="w-px bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <div
                className="h-full bg-gradient-to-l from-purple-600 via-purple-400 to-fuchsia-400 transition-all duration-700 rounded-r-full shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                style={{ width: `${rightPercent}%` }}
              />
            </div>
          </div>
          <div className="flex justify-center mt-1">
            <span className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-mono">POWER CLASH</span>
          </div>
        </div>
        <div className="text-center">
          <span className={`text-3xl sm:text-4xl font-black font-mono tabular-nums ${rightPercent > leftPercent ? 'text-purple-400 drop-shadow-[0_0_16px_rgba(168,85,247,0.6)]' : 'text-white/40'}`}>
            {rightPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}
