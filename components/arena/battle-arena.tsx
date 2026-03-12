'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Float, Text, Environment, useTexture, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any3D = any;

// ─── Custom Shader: Fire Pillar ─────────────────────────────────────────────

const fireVertexShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Turbulent displacement
    float noise = sin(pos.y * 3.0 + uTime * 2.0) * cos(pos.x * 5.0 + uTime * 1.5) * 0.15;
    noise += sin(pos.y * 8.0 + uTime * 4.0) * 0.05;
    pos.x += noise * (1.0 - uv.y);
    pos.z += cos(pos.y * 4.0 + uTime * 3.0) * 0.08 * (1.0 - uv.y);

    vElevation = pos.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fireFragmentShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uColor2;

  // Simplex noise approximation
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // Fire shape mask
    float dist = length(vUv - vec2(0.5, 0.0));
    float fireMask = smoothstep(0.6, 0.0, dist);
    fireMask *= smoothstep(0.0, 0.2, vUv.y);
    fireMask *= smoothstep(1.0, 0.3, vUv.y);

    // Animated noise for fire turbulence
    float n1 = noise2d(vUv * vec2(3.0, 5.0) + vec2(0.0, -uTime * 2.0));
    float n2 = noise2d(vUv * vec2(6.0, 10.0) + vec2(0.0, -uTime * 3.0));
    float fireNoise = n1 * 0.7 + n2 * 0.3;

    fireMask *= fireNoise;
    fireMask = pow(fireMask, 0.8);

    // Color gradient: white core → main color → tips
    vec3 color = mix(uColor2, uColor, vUv.y);
    color = mix(vec3(1.0, 0.95, 0.8), color, smoothstep(0.0, 0.4, vUv.y));

    // Emissive glow
    float glow = fireMask * 2.0;

    gl_FragColor = vec4(color * glow, fireMask * 1.2);
  }
`;

// ─── Volumetric Light Shaft ─────────────────────────────────────────────────

const godRayVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const godRayFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;

  void main() {
    // Light shaft — fade from center
    float shaft = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
    shaft *= smoothstep(0.0, 0.3, vUv.y);
    shaft *= smoothstep(1.0, 0.5, vUv.y);

    // Animate
    shaft *= 0.5 + 0.5 * sin(uTime * 0.5 + vUv.y * 3.0);
    shaft *= 0.15;

    gl_FragColor = vec4(uColor, shaft);
  }
`;

// ─── Animated Fire Pillar Component ─────────────────────────────────────────

function FirePillar({ position, color, color2, scale = 1 }: {
  position: [number, number, number];
  color: string;
  color2: string;
  scale?: number;
}) {
  const matRef = useRef<Any3D>(null!);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uColor2: { value: new THREE.Color(color2) },
  }), [color, color2]);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh position={position} scale={[0.6 * scale, 2.0 * scale, 0.6 * scale]}>
      <planeGeometry args={[1, 2, 16, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={fireVertexShader}
        fragmentShader={fireFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ─── God Ray Component ──────────────────────────────────────────────────────

function GodRay({ position, color, rotation = [0, 0, 0], scale = [2, 8, 1] }: {
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) {
  const matRef = useRef<Any3D>(null!);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
  }), [color]);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <planeGeometry args={[1, 1, 1, 16]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={godRayVertexShader}
        fragmentShader={godRayFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ─── Advanced Fire Particles (GPU Instanced) ────────────────────────────────

function AdvancedFireParticles({ count = 200, color, position, spread = 2 }: {
  count?: number; color: string; position: [number, number, number]; spread?: number;
}) {
  const meshRef = useRef<Any3D>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * spread,
      y: Math.random() * 4,
      z: (Math.random() - 0.5) * spread * 0.6,
      speed: 0.5 + Math.random() * 1.5,
      offset: Math.random() * Math.PI * 2,
      scale: 0.01 + Math.random() * 0.04,
      wobble: 0.5 + Math.random() * 1.5,
    }));
  }, [count, spread]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      const y = (p.y + t * p.speed) % 5;
      const life = 1 - y / 5;
      dummy.position.set(
        position[0] + p.x + Math.sin(t * p.wobble + p.offset) * 0.15,
        position[1] + y,
        position[2] + p.z + Math.cos(t * p.wobble * 0.7 + p.offset) * 0.1,
      );
      dummy.scale.setScalar(p.scale * life * 3 * (0.5 + Math.sin(t * 3 + p.offset) * 0.5));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ─── Impact Burst (triggered on attack) ─────────────────────────────────────

function ImpactBurst({ side, trigger }: { side: 'left' | 'right'; trigger: number }) {
  const meshRef = useRef<Any3D>(null!);
  const shockRef = useRef<Any3D>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 80;
  const startTimeRef = useRef(0);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 + Math.random() * 3,
        vz: (Math.random() - 0.5) * speed * 0.4,
        scale: 0.02 + Math.random() * 0.06,
        trail: Math.random(),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useEffect(() => {
    startTimeRef.current = performance.now() / 1000;
  }, [trigger]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const elapsed = clock.getElapsedTime() - startTimeRef.current;

    // Shockwave ring
    if (shockRef.current) {
      if (elapsed < 1.0) {
        const s = elapsed * 5;
        shockRef.current.scale.set(s, s, s);
        (shockRef.current.material as Any3D).opacity = Math.max(0, 0.6 - elapsed * 0.8);
        shockRef.current.visible = true;
      } else {
        shockRef.current.visible = false;
      }
    }

    if (elapsed > 2.5) {
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
      const life = Math.max(0, 1 - elapsed / 2.0);
      const gravity = 4.9;
      dummy.position.set(
        cx + p.vx * elapsed * 0.3,
        0.8 + p.vy * elapsed * 0.3 - gravity * elapsed * elapsed * 0.15,
        p.vz * elapsed * 0.3,
      );
      dummy.scale.setScalar(p.scale * life * 2);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const burstColor = side === 'left' ? '#ffa500' : '#c060ff';

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color={burstColor}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      {/* Shockwave ring */}
      <mesh
        ref={shockRef}
        position={[side === 'left' ? -1.5 : 1.5, 0.8, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial
          color={burstColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── Detailed Colosseum Pillar ──────────────────────────────────────────────

function DetailedPillar({ position, height = 4 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      {/* Column with fluting effect (multiple thin cylinders) */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, height, 12]} />
        <meshStandardMaterial
          color="#5a4030"
          roughness={0.75}
          metalness={0.15}
          envMapIntensity={0.3}
        />
      </mesh>
      {/* Decorative grooves */}
      {[0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 0.16,
            height / 2,
            Math.sin(angle) * 0.16,
          ]}
        >
          <cylinderGeometry args={[0.02, 0.02, height, 4]} />
          <meshStandardMaterial color="#3a2818" roughness={0.9} />
        </mesh>
      ))}
      {/* Ornate capital */}
      <mesh position={[0, height + 0.15, 0]}>
        <cylinderGeometry args={[0.28, 0.16, 0.3, 8]} />
        <meshStandardMaterial color="#6a5040" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, height + 0.35, 0]}>
        <boxGeometry args={[0.45, 0.1, 0.45]} />
        <meshStandardMaterial color="#6a5040" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 0.2, 8]} />
        <meshStandardMaterial color="#6a5040" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.45, 0.05, 0.45]} />
        <meshStandardMaterial color="#4a3020" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Arch with Keystone ─────────────────────────────────────────────────────

function DetailedArch({ from, to, height = 4 }: {
  from: [number, number, number]; to: [number, number, number]; height?: number;
}) {
  const geometry = useMemo(() => {
    const mid: [number, number, number] = [
      (from[0] + to[0]) / 2,
      height + 1.2,
      (from[2] + to[2]) / 2,
    ];
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from[0], height, from[2]),
      new THREE.Vector3(mid[0], mid[1], mid[2]),
      new THREE.Vector3(to[0], height, to[2]),
    );
    const points = curve.getPoints(24);
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      24, 0.07, 8, false,
    );
  }, [from, to, height]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#5a4030" roughness={0.75} metalness={0.15} />
    </mesh>
  );
}

// ─── Arena Floor with Detail ────────────────────────────────────────────────

function DetailedArenaFloor() {
  return (
    <group>
      {/* Main stone floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[5, 64]} />
        <meshStandardMaterial
          color="#2a1f15"
          roughness={0.92}
          metalness={0.05}
          envMapIntensity={0.2}
        />
      </mesh>
      {/* Sand/dirt center */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[3.5, 48]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.95} />
      </mesh>
      {/* Inner combat ring — glowing */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.5, 2.6, 48]} />
        <meshStandardMaterial
          color="#ef4444"
          roughness={0.5}
          emissive="#ef4444"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Outer decorative ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.5, 4.7, 48]} />
        <meshStandardMaterial color="#1a120a" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Center sigil — glowing */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.2, 0.3, 6]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </mesh>
      {/* Radial lines on floor */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, angle]}
            position={[0, 0.015, 0]}
          >
            <planeGeometry args={[0.03, 2.2]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={0.2}
              transparent
              opacity={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Fighter (3D Billboard with Depth) ──────────────────────────────────────

function Fighter3D({ side, supportPercent, name, isAttacking }: {
  side: 'left' | 'right';
  supportPercent: number;
  name: string;
  isAttacking: boolean;
}) {
  const groupRef = useRef<Any3D>(null!);
  const glowRef = useRef<Any3D>(null!);
  const texture = useTexture('/ape-hero.png');
  const attackRef = useRef(false);
  const attackTimeRef = useRef(0);

  const x = side === 'left' ? -2.0 : 2.0;
  const flipX = side === 'left' ? -1 : 1;
  const mainColor = side === 'left' ? '#f59e0b' : '#a855f7';
  const emissiveColor = side === 'left' ? '#ff8c00' : '#9333ea';

  useEffect(() => {
    if (isAttacking) {
      attackRef.current = true;
      attackTimeRef.current = performance.now();
    }
  }, [isAttacking]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Breathing idle animation
    groupRef.current.position.y = 0.9 + Math.sin(t * 1.2) * 0.06;
    groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.02;

    // Aura pulse
    if (glowRef.current) {
      const pulse = 1 + Math.sin(t * 2) * 0.15;
      glowRef.current.scale.set(pulse, pulse, 1);
      (glowRef.current.material as Any3D).opacity = 0.08 + Math.sin(t * 3) * 0.04;
    }

    // Attack animation — aggressive lunge
    if (attackRef.current) {
      const elapsed = (performance.now() - attackTimeRef.current) / 1000;
      if (elapsed < 0.15) {
        // Wind up
        const t2 = elapsed / 0.15;
        groupRef.current.position.x = x - t2 * 0.3 * (side === 'left' ? -1 : 1);
        groupRef.current.rotation.z = t2 * 0.1 * (side === 'left' ? 1 : -1);
      } else if (elapsed < 0.35) {
        // Lunge forward
        const t2 = (elapsed - 0.15) / 0.2;
        const lunge = Math.sin(t2 * Math.PI) * 0.8;
        groupRef.current.position.x = x + lunge * (side === 'left' ? 1 : -1);
        groupRef.current.rotation.z = lunge * 0.2 * (side === 'left' ? -1 : 1);
        groupRef.current.scale.set(1 + lunge * 0.1, 1 + lunge * 0.1, 1);
      } else if (elapsed < 0.6) {
        // Return with bounce
        const t2 = (elapsed - 0.35) / 0.25;
        const ret = (1 - t2) * 0.2;
        groupRef.current.position.x = x + ret * (side === 'left' ? 1 : -1);
        groupRef.current.rotation.z = ret * 0.05 * (side === 'left' ? -1 : 1);
        groupRef.current.scale.set(1 + ret * 0.05, 1 + ret * 0.05, 1);
      } else {
        groupRef.current.position.x = x;
        groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.02;
        groupRef.current.scale.set(1, 1, 1);
        attackRef.current = false;
      }
    } else {
      groupRef.current.position.x = x;
      groupRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group ref={groupRef} position={[x, 0.9, 0]}>
      {/* Volumetric aura glow behind fighter */}
      <mesh ref={glowRef} position={[0, 0, -0.3]}>
        <planeGeometry args={[3.0, 3.5]} />
        <meshBasicMaterial
          color={mainColor}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ground shadow/reflection */}
      <mesh position={[0, -0.88, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 16]} />
        <meshBasicMaterial
          color={mainColor}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ape image — main billboard */}
      <mesh scale={[1.8 * flipX, 2.1, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.05}
          side={THREE.DoubleSide}
          emissive={emissiveColor}
          emissiveIntensity={0.15}
          roughness={0.4}
          metalness={0.1}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Color tint overlay */}
      <mesh scale={[1.8 * flipX, 2.1, 1]} position={[0, 0, 0.01]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={mainColor}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Rim light glow edge */}
      <mesh scale={[1.85 * flipX, 2.15, 1]} position={[0, 0, -0.02]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={mainColor}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Name */}
      <Text
        position={[0, -1.25, 0]}
        fontSize={0.16}
        color={mainColor}
        anchorX="center"
        anchorY="middle"
        outlineColor="black"
        outlineWidth={0.025}
        font="/kiwi.woff2"
      >
        {name}
      </Text>

      {/* HP Bar — 3D */}
      <group position={[0, -1.45, 0]}>
        {/* Background */}
        <mesh>
          <planeGeometry args={[1.3, 0.1]} />
          <meshBasicMaterial color="#111111" transparent opacity={0.85} />
        </mesh>
        {/* Fill */}
        <mesh position={[(supportPercent / 100 - 1) * 0.63, 0, 0.005]}>
          <planeGeometry args={[1.26 * supportPercent / 100, 0.07]} />
          <meshBasicMaterial color={mainColor} />
        </mesh>
        {/* Glow on fill */}
        <mesh position={[(supportPercent / 100 - 1) * 0.63, 0, 0.01]}>
          <planeGeometry args={[1.26 * supportPercent / 100, 0.12]} />
          <meshBasicMaterial
            color={mainColor}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* Border */}
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[1.32, 0.12]} />
          <meshBasicMaterial color="#333" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Spotlight on fighter */}
      <spotLight
        position={[0, 4, 2]}
        target-position={[0, 0, 0]}
        angle={0.4}
        penumbra={0.8}
        intensity={3}
        color={mainColor}
        distance={8}
        decay={2}
      />
    </group>
  );
}

// ─── VS Emblem (center) ─────────────────────────────────────────────────────

function VSEmblem() {
  const ringRef = useRef<Any3D>(null!);
  const outerRingRef = useRef<Any3D>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      ringRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -t * 0.3;
      outerRingRef.current.scale.setScalar(1 + Math.sin(t * 1.5 + 1) * 0.05);
    }
  });

  return (
    <group position={[0, 1.0, 0.5]}>
      {/* Outer energy ring */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[0.5, 0.015, 8, 32]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Inner ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.35, 0.02, 8, 24]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Glow sphere */}
      <mesh>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* VS text */}
      <Text
        fontSize={0.25}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
        outlineColor="black"
        outlineWidth={0.03}
      >
        VS
      </Text>
      {/* Red point light */}
      <pointLight color="#ef4444" intensity={3} distance={4} decay={2} />
    </group>
  );
}

// ─── Cinematic Camera ───────────────────────────────────────────────────────

function CinematicCamera({ shaking, attackSide }: { shaking: boolean; attackSide: 'left' | 'right' | null }) {
  const { camera } = useThree();
  const shakeStartRef = useRef(0);
  const basePos = useRef(new THREE.Vector3(0, 2.5, 6));
  const targetPos = useRef(new THREE.Vector3(0, 2.5, 6));

  useEffect(() => {
    if (shaking) shakeStartRef.current = performance.now();
  }, [shaking]);

  useEffect(() => {
    if (attackSide === 'left') {
      targetPos.current.set(-0.5, 2.2, 5.5);
    } else if (attackSide === 'right') {
      targetPos.current.set(0.5, 2.2, 5.5);
    } else {
      targetPos.current.set(0, 2.5, 6);
    }
  }, [attackSide]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Smooth camera drift
    const driftX = Math.sin(t * 0.12) * 0.3;
    const driftY = 2.5 + Math.sin(t * 0.15) * 0.15;
    const goalX = targetPos.current.x + driftX;
    const goalY = targetPos.current.y + (driftY - 2.5);

    // Lerp to target
    basePos.current.x += (goalX - basePos.current.x) * 0.02;
    basePos.current.y += (goalY - basePos.current.y) * 0.02;
    basePos.current.z += (targetPos.current.z - basePos.current.z) * 0.02;

    camera.position.copy(basePos.current);

    // Camera shake on hit
    if (shaking) {
      const elapsed = (performance.now() - shakeStartRef.current) / 1000;
      if (elapsed < 0.5) {
        const intensity = (1 - elapsed / 0.5) * 0.2;
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity * 0.6;
        camera.position.z += (Math.random() - 0.5) * intensity * 0.3;
      }
    }

    camera.lookAt(0, 0.8, 0);
  });

  return null;
}

// ─── Scene Inner ────────────────────────────────────────────────────────────

function SceneInner({ leftName, rightName, leftPercent, rightPercent, attackSide, shaking }: {
  leftName: string; rightName: string;
  leftPercent: number; rightPercent: number;
  attackSide: 'left' | 'right' | null;
  shaking: boolean;
}) {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (attackSide) setBurstKey((k) => k + 1);
  }, [attackSide]);

  // Semicircle of pillars
  const pillars = useMemo(() => {
    const result: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 0.12) + (i / 11) * (Math.PI * 0.76);
      const r = 5.2;
      result.push([Math.cos(angle) * r, 0, -Math.sin(angle) * r + 1.5]);
    }
    return result;
  }, []);

  return (
    <>
      <CinematicCamera shaking={shaking} attackSide={attackSide} />

      {/* Ambient — very low for drama */}
      <ambientLight intensity={0.08} color="#332244" />

      {/* Main dramatic lights */}
      <directionalLight position={[3, 10, 5]} intensity={0.4} color="#ffeedd" castShadow />
      <directionalLight position={[-3, 8, 3]} intensity={0.2} color="#aabbff" />

      {/* Colored spotlights for cinematic feel */}
      <spotLight position={[-4, 6, 2]} angle={0.5} penumbra={1} intensity={4} color="#f59e0b" distance={12} />
      <spotLight position={[4, 6, 2]} angle={0.5} penumbra={1} intensity={4} color="#a855f7" distance={12} />
      <spotLight position={[0, 8, 0]} angle={0.6} penumbra={0.8} intensity={2} color="#ef4444" distance={15} />

      {/* Bottom fill — lava glow */}
      <pointLight position={[0, -1, 0]} intensity={1.5} color="#ff4400" distance={6} />
      <pointLight position={[-3, 0.5, 1]} intensity={1} color="#ff8800" distance={5} />
      <pointLight position={[3, 0.5, 1]} intensity={1} color="#8800ff" distance={5} />

      {/* Fog for depth */}
      <fog attach="fog" args={['#0a0604', 5, 16]} />

      {/* Environment for reflections */}
      <Environment preset="night" environmentIntensity={0.3} />

      {/* Floor */}
      <DetailedArenaFloor />

      {/* Colosseum pillars */}
      {pillars.map((pos, i) => (
        <DetailedPillar key={i} position={pos} height={3.5 + (i % 3) * 0.4} />
      ))}
      {/* Arches */}
      {pillars.slice(0, -1).map((pos, i) => (
        <DetailedArch
          key={`arch-${i}`}
          from={pos}
          to={pillars[i + 1]}
          height={3.5 + (i % 3) * 0.4}
        />
      ))}
      {/* Upper tier pillars */}
      {pillars.filter((_, i) => i % 2 === 0).map((pos, i) => {
        const upper: [number, number, number] = [pos[0] * 1.12, 4, pos[2] * 1.12];
        return <DetailedPillar key={`upper-${i}`} position={upper} height={2.5} />;
      })}

      {/* Fire pillars at pillar bases */}
      <FirePillar position={[-4.5, 3.5, -1]} color="#f59e0b" color2="#ff4400" scale={0.8} />
      <FirePillar position={[4.5, 3.5, -1]} color="#a855f7" color2="#ff00ff" scale={0.8} />
      <FirePillar position={[-3, 4, -3]} color="#fbbf24" color2="#ff6600" scale={0.6} />
      <FirePillar position={[3, 4, -3]} color="#c084fc" color2="#cc44ff" scale={0.6} />
      <FirePillar position={[-1, 4.5, -4]} color="#f97316" color2="#ff2200" scale={0.5} />
      <FirePillar position={[1, 4.5, -4]} color="#e879f9" color2="#aa00ff" scale={0.5} />

      {/* God rays from above */}
      <GodRay position={[-2, 4, -1]} color="#f59e0b" rotation={[0.3, 0, 0.2]} scale={[1.5, 6, 1]} />
      <GodRay position={[2, 4, -1]} color="#a855f7" rotation={[0.3, 0, -0.2]} scale={[1.5, 6, 1]} />
      <GodRay position={[0, 5, -2]} color="#ef4444" rotation={[0.2, 0, 0]} scale={[2, 8, 1]} />

      {/* Advanced fire particles */}
      <AdvancedFireParticles count={150} color="#f59e0b" position={[-3, 0, -1]} spread={2} />
      <AdvancedFireParticles count={150} color="#a855f7" position={[3, 0, -1]} spread={2} />
      <AdvancedFireParticles count={80} color="#ef4444" position={[0, 0, 0]} spread={4} />

      {/* Drei sparkles for magical dust */}
      <Sparkles count={100} size={3} scale={[10, 6, 6]} speed={0.3} color="#ff8844" opacity={0.4} />
      <Sparkles count={60} size={2} scale={[8, 4, 4]} speed={0.5} color="#aa66ff" opacity={0.3} />

      {/* Fighters */}
      <Fighter3D
        side="left"
        supportPercent={leftPercent}
        name={leftName}
        isAttacking={attackSide === 'left'}
      />
      <Fighter3D
        side="right"
        supportPercent={rightPercent}
        name={rightName}
        isAttacking={attackSide === 'right'}
      />

      {/* VS */}
      <VSEmblem />

      {/* Impact bursts */}
      {attackSide && (
        <ImpactBurst key={burstKey} side={attackSide} trigger={burstKey} />
      )}

      {/* Ground dust layer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 1]}>
        <circleGeometry args={[6, 32]} />
        <meshBasicMaterial color="#1a0f08" transparent opacity={0.4} />
      </mesh>

      {/* ─── POST PROCESSING — THE KEY TO CINEMATIC QUALITY ─── */}
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0008, 0.0008)}
          radialModulation={true}
          modulationOffset={0.5}
        />
        <Vignette darkness={0.7} offset={0.3} />
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.15} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

// ─── Exported Component ─────────────────────────────────────────────────────

export default function BattleArena({ leftName, rightName, leftPercent, rightPercent, attackSide, shaking }: {
  leftName: string; rightName: string;
  leftPercent: number; rightPercent: number;
  attackSide: 'left' | 'right' | null;
  shaking: boolean;
}) {
  const leftWinning = leftPercent > rightPercent;

  return (
    <div className="relative w-full overflow-hidden rounded-t-xl" style={{ height: 'clamp(360px, 50vw, 520px)' }}>
      {/* Three.js Canvas */}
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        camera={{ position: [0, 2.5, 6], fov: 42, near: 0.1, far: 50 }}
        shadows
        style={{ background: '#050302' }}
      >
        <SceneInner
          leftName={leftName}
          rightName={rightName}
          leftPercent={leftPercent}
          rightPercent={rightPercent}
          attackSide={attackSide}
          shaking={shaking}
        />
      </Canvas>

      {/* Gradient overlays for blending with UI */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />

      {/* Score bar overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-8 pb-3">
        <div className="relative h-3 rounded-full overflow-hidden bg-black/70 border border-white/[0.08] backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <div className="h-full flex">
            <div
              className="h-full transition-all duration-700 rounded-l-full"
              style={{
                width: `${leftPercent}%`,
                background: 'linear-gradient(90deg, #92400e, #f59e0b, #fbbf24)',
                boxShadow: '0 0 20px rgba(245,158,11,0.5)',
              }}
            />
            <div className="w-[3px] bg-white shadow-[0_0_15px_rgba(255,255,255,1)] relative z-10" />
            <div
              className="h-full transition-all duration-700 rounded-r-full"
              style={{
                width: `${rightPercent}%`,
                background: 'linear-gradient(90deg, #c084fc, #a855f7, #6b21a8)',
                boxShadow: '0 0 20px rgba(168,85,247,0.5)',
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-2xl sm:text-3xl font-black font-mono tabular-nums transition-all duration-500 ${leftWinning ? 'text-amber-400 scale-105' : 'text-white/25'}`}
            style={leftWinning ? { textShadow: '0 0 24px rgba(245,158,11,0.6), 0 0 48px rgba(245,158,11,0.2)' } : {}}>
            {leftPercent}%
          </span>
          <span className="text-[9px] text-white/15 uppercase tracking-[0.3em] font-mono">POWER CLASH</span>
          <span className={`text-2xl sm:text-3xl font-black font-mono tabular-nums transition-all duration-500 ${!leftWinning ? 'text-purple-400 scale-105' : 'text-white/25'}`}
            style={!leftWinning ? { textShadow: '0 0 24px rgba(168,85,247,0.6), 0 0 48px rgba(168,85,247,0.2)' } : {}}>
            {rightPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}
