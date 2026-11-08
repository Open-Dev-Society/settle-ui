import { runMotion, type RunningMotion } from './motion';

// ponytail: fixed rim flakes, raise only if the dissolve reads as a plain fade
export const PARTICLE_COUNT = 20;

function rimPoint(along: number): [number, number] {
  if (along < 0.25) return [(along / 0.25) * 100, 0];
  if (along < 0.5) return [100, ((along - 0.25) / 0.25) * 100];
  if (along < 0.75) return [(1 - (along - 0.5) / 0.25) * 100, 100];
  return [0, (1 - (along - 0.75) / 0.25) * 100];
}

export function spawnParticles(layer: HTMLElement): () => void {
  layer.replaceChildren();
  const motions: RunningMotion[] = [];
  const nodes: HTMLElement[] = [];

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const node = document.createElement('span');
    node.className = 'settle-particle';
    const along = (index + 0.5) / PARTICLE_COUNT;
    const [x, y] = rimPoint(along);
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    const angle = along * Math.PI * 2;
    const distance = 26 + (index % 4) * 9;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    layer.appendChild(node);
    nodes.push(node);
    motions.push(
      runMotion(
        node,
        [
          { opacity: 0.95, transform: 'translate(-50%, -50%) scale(1)' },
          {
            opacity: 0,
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
          },
        ],
        600,
      ),
    );
  }

  return () => {
    motions.forEach((motion) => motion.cancel());
    nodes.forEach((node) => node.remove());
    layer.replaceChildren();
  };
}
