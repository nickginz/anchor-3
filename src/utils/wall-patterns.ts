
export const createBrickPattern = (theme: 'light' | 'dark') => {
    const canvas = document.createElement('canvas');
    const size = 20;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Colors
    const brickColor = theme === 'light' ? '#ef4444' : '#b91c1c'; // Red-500 / Red-700
    const mortarColor = theme === 'light' ? '#d1d5db' : '#7f1d1d'; // Gray-300 / Red-900 (Darker)

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
    const baseColor = theme === 'light' ? '#9ca3af' : '#52525b'; // Gray-400 / Zinc-600
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Noise/Speckles
    const grainColor = theme === 'light' ? '#6b7280' : '#3f3f46'; // Gray-500 / Zinc-700
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
