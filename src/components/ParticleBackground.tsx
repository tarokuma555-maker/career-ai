export default function ParticleBackground() {
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    size: 3 + (i % 4) * 1.5,
    left: (i * 7 + 3) % 97,
    top: (i * 13 + 8) % 95,
    color: i % 2 === 0 ? "var(--accent-blue)" : "var(--accent-cyan)",
    delay: i * 0.8,
    duration: 15 + (i % 5) * 2.5,
  }));

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle absolute rounded-full animate-float"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            "--float-duration": `${p.duration}s`,
            filter: "blur(1px)",
            opacity: 0,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
