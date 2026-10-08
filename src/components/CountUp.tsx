'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

export function CountUp({ to, duration = 1.4, className }: { to: number; duration?: number; className?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const c = animate(from.current, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (x) => { from.current = x; setV(Math.round(x)); },
    });
    return () => c.stop();
  }, [to, duration]);
  return <span className={className}>{v.toLocaleString('en-US')}</span>;
}
