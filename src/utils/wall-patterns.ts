
export const createBrickPattern = (theme: 'light' | 'dark') => {
    const canvas = document.createElement('canvas');
    const size = 20;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Colors
    const brickColor = theme === 'light' ? '#b91c1c' : '#b91c1c'; // Red-700 (Darker for Light Mode too)
    const mortarColor = theme === 'light' ? '#9ca3af' : '#7f1d1d'; // Gray-400 / Red-900

    // Background (Mortar)
    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, size, size);

    // Bricks
    ctx.fillStyle = brickColor;
    // Top brick
    ctx.fillRect(1, 1, size - 2, (size / 2) - 2);
    // Bottom Two Bricks (Offset)
    ctx.fillRect(-size / 2 + 1, size / 2 + 1, size - 2, (size / 2) - 2);
    ctx.fillRect(size / 2 + 1, size / 2 + 1, size - 2, (size / 2) - 2);

    return canvas;
};

export const createConcretePattern = (theme: 'light' | 'dark') => {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Base Color
    const baseColor = theme === 'light' ? '#6b7280' : '#52525b'; // Gray-500 / Zinc-600 (Darker)
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Noise/Speckles
    const grainColor = theme === 'light' ? '#4b5563' : '#3f3f46'; // Gray-600 / Zinc-700
    ctx.fillStyle = grainColor;
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvas;
};

// Drywall is smooth, so we can just return a color or a very subtle vertical line pattern? 
// User asked for "more visible difference". Smooth lighter color vs grainy dark concrete is a good diff.
// Let's create a stub for pattern caching.

const patternCache: Record<string, HTMLCanvasElement> = {};

export const getWallPattern = (material: string, theme: 'light' | 'dark'): HTMLCanvasElement | null => {
    const key = `${material}-${theme}`;
    if (patternCache[key]) return patternCache[key];

    let pattern: HTMLCanvasElement | null = null;
    if (material === 'brick') {
        pattern = createBrickPattern(theme);
    } else if (material === 'concrete') {
        pattern = createConcretePattern(theme);
    }

    if (pattern) {
        patternCache[key] = pattern;
    }
    return pattern;
};
