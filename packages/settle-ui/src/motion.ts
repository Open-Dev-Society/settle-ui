export type RunningMotion = {
  cancel: () => void;
  finished: Promise<void>;
};

export function runMotion(element: HTMLElement, keyframes: Keyframe[], duration: number): RunningMotion {
  if (typeof element.animate === 'function') {
    const animation = element.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(0.22, 0.7, 0.2, 1)',
      fill: 'forwards',
    });
    return {
      cancel: () => animation.cancel(),
      finished: animation.finished.then(
        () => undefined,
        () => undefined,
      ),
    };
  }

  let timer = 0;
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
    timer = window.setTimeout(resolve, duration);
  });
  return {
    cancel: () => {
      window.clearTimeout(timer);
      finish();
    },
    finished,
  };
}

export function playSweep(element: HTMLElement, duration: number): RunningMotion {
  return runMotion(
    element,
    [
      { transform: 'translateX(-120%) skewX(-12deg)', opacity: 0 },
      { transform: 'translateX(80%) skewX(-12deg)', opacity: 0.9, offset: 0.42 },
      { transform: 'translateX(380%) skewX(-12deg)', opacity: 0 },
    ],
    duration,
  );
}
