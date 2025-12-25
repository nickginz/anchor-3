import Tesseract from 'tesseract.js';

export interface DetectedLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export class WallDetector {
    private get cv(): any {
        // @ts-ignore
        return (typeof window !== 'undefined' && window.cv) ? window.cv : null;
    }

    isReady(): boolean {
        return !!this.cv;
    }

    // Async detection wrapper
    async detectAsync(imgElement: HTMLImageElement | HTMLCanvasElement, options: {
        threshold1: number,
        threshold2: number,
        apertureSize: number,
        minLineLength: number,
        maxLineGap: number,
        minWallThickness?: number,
        minNoiseSize?: number,
        useSkeleton?: boolean,
        orthoOnly?: boolean,
        removeText?: boolean,
        snapDistance?: number,
        isBinary?: boolean // New option
    }): Promise<{ lines: DetectedLine[], debugData: ImageData | null }> {
        let processImg: HTMLImageElement | HTMLCanvasElement = imgElement;

        // OCR is the only truly async part (skip if already binary)
        if (options.removeText && !options.isBinary && imgElement instanceof HTMLImageElement) {
            try {
                processImg = await this.removeTextOCR(imgElement);
            } catch (e) {
                console.error("OCR Failed", e);
            }
        }

        return this.detect(processImg, options);
    }

    // Public Preprocessing: Returns a Binary Mask (ImageData) for valid feedback loop
    getBinaryMask(imgElement: HTMLImageElement | HTMLCanvasElement, options: {
        minWallThickness?: number,
        minNoiseSize?: number,
        removeText?: boolean
    }): ImageData | null {
        if (!this.cv) return null;
        const src = this.cv.imread(imgElement);
        const gray = new this.cv.Mat();
        const binary = new this.cv.Mat();

        // 1. Grayscale
        this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY, 0);

        // 2. Binary Threshold (Inverted: White Walls, Black Bg)
        this.cv.threshold(gray, binary, 200, 255, this.cv.THRESH_BINARY_INV);

        // 3. Noise Removal
        if (options.minNoiseSize && options.minNoiseSize > 0) {
            this.removeNoise(binary, options.minNoiseSize);
        }

        // 4. Thickness/Text Filter
        if (options.minWallThickness && options.minWallThickness > 1) {
            const kSize = options.minWallThickness;
            const kernel = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(kSize, kSize));
            this.cv.morphologyEx(binary, binary, this.cv.MORPH_OPEN, kernel);
            kernel.delete();
        } else if (options.removeText) {
            const kSize = 3;
            const kernel = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(kSize, kSize));
            this.cv.morphologyEx(binary, binary, this.cv.MORPH_OPEN, kernel);
            kernel.delete();
        }

        let result: ImageData | null = null;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = binary.cols;
        tempCanvas.height = binary.rows;
        try {
            this.cv.imshow(tempCanvas, binary);
            const ctx = tempCanvas.getContext('2d');
            if (ctx) result = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        } catch (e) { console.warn("Failed mask export", e); }

        src.delete();
        gray.delete();
        binary.delete();

        return result;
    }

    // OCR Helper: Returns a Canvas with text painted white
    private async removeTextOCR(image: HTMLImageElement): Promise<HTMLCanvasElement> {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(image, 0, 0);

        const result = await Tesseract.recognize(image, 'eng', {
            // logger: m => console.log(m)
        });

        ctx.fillStyle = '#ffffff';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result.data as any).words.forEach((word: any) => {
            const { x0, y0, x1, y1 } = word.bbox;
            const padding = 2;
            ctx.fillRect(x0 - padding, y0 - padding, (x1 - x0) + padding * 2, (y1 - y0) + padding * 2);
        });

        return canvas;
    }

    // Noise Removal: Find contours properly and fill small ones
    private removeNoise(mat: any, minSize: number) {
        if (minSize <= 0) return;

        const contours = new this.cv.MatVector();
        const hierarchy = new this.cv.Mat();

        // Find contours on binary image (RETR_LIST is enough)
        this.cv.findContours(mat, contours, hierarchy, this.cv.RETR_LIST, this.cv.CHAIN_APPROX_SIMPLE);

        for (let i = 0; i < contours.size(); ++i) {
            const contour = contours.get(i);
            const area = this.cv.contourArea(contour, false);

            if (area < minSize) {
                // Assuming 'mat' is inverted (Walls = White, Background = Black).
                // Turn small White blobs to Black.
                this.cv.drawContours(mat, contours, i, new this.cv.Scalar(0, 0, 0, 0), -1); // -1 = fill
            }
            contour.delete();
        }

        contours.delete();
        hierarchy.delete();
    }

    // Skeletonization (Thinning)
    private skeletonize(mat: any) {
        const skeleton = new this.cv.Mat(mat.rows, mat.cols, this.cv.CV_8UC1, new this.cv.Scalar(0));
        const eroded = new this.cv.Mat();
        const temp = new this.cv.Mat();
        const element = this.cv.getStructuringElement(this.cv.MORPH_CROSS, new this.cv.Size(3, 3));

        let maxIter = 100; // Safety break

        while (maxIter-- > 0) {
            this.cv.erode(mat, eroded, element);
            this.cv.dilate(eroded, temp, element);
            this.cv.subtract(mat, temp, temp);
            this.cv.bitwise_or(skeleton, temp, skeleton);
            eroded.copyTo(mat);
            if (this.cv.countNonZero(mat) === 0) break;
        }

        skeleton.copyTo(mat);
        skeleton.delete();
        eroded.delete();
        temp.delete();
        element.delete();
    }

    // Main Detect Function
    detect(imgElement: HTMLImageElement | HTMLCanvasElement, options: {
        threshold1: number,
        threshold2: number,
        apertureSize: number,
        minLineLength: number,
        maxLineGap: number,
        minWallThickness?: number,
        minNoiseSize?: number,
        useSkeleton?: boolean,
        orthoOnly?: boolean,
        removeText?: boolean,
        snapDistance?: number,
        isBinary?: boolean
    }): { lines: DetectedLine[], debugData: ImageData | null } {
        if (!this.cv) return { lines: [], debugData: null };

        const src = this.cv.imread(imgElement);
        const gray = new this.cv.Mat();
        const binary = new this.cv.Mat();
        const lines = new this.cv.Mat();

        let debugData: ImageData | null = null;

        if (options.isBinary) {
            this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY, 0);
            this.cv.threshold(gray, binary, 127, 255, this.cv.THRESH_BINARY);
        } else {
            // 1. Grayscale
            this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY, 0);

            // 2. Binary Threshold (Inverted: White Walls, Black Bg)
            this.cv.threshold(gray, binary, 200, 255, this.cv.THRESH_BINARY_INV);

            // 3. Noise Removal (Contours)
            if (options.minNoiseSize && options.minNoiseSize > 0) {
                this.removeNoise(binary, options.minNoiseSize);
            }

            // 4. Thickness Filter (Morphological Opening)
            if (options.minWallThickness && options.minWallThickness > 1) {
                const kSize = options.minWallThickness;
                const kernel = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(kSize, kSize));
                this.cv.morphologyEx(binary, binary, this.cv.MORPH_OPEN, kernel);
                kernel.delete();
            } else if (options.removeText) {
                // Use default small kernel if no thickness but text removal requested
                const kSize = 3;
                const kernel = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(kSize, kSize));
                this.cv.morphologyEx(binary, binary, this.cv.MORPH_OPEN, kernel);
                kernel.delete();
            }
        }

        // 5. Skeletonization OR Canny
        if (options.useSkeleton) {
            this.skeletonize(binary);
            // Result is 1px lines.
        } else {
            // Fallback: Canny on binary (Edge detection on solid shapes)
            this.cv.Canny(binary, binary, 50, 150, 3);
        }

        // Capture Debug Image
        if (typeof document !== 'undefined') {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = binary.cols;
            tempCanvas.height = binary.rows;
            try {
                this.cv.imshow(tempCanvas, binary);
                const ctx = tempCanvas.getContext('2d');
                if (ctx) debugData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            } catch (e) {
                console.warn("Failed to generate debug image", e);
            }
        }

        // 6. Probabilistic Hough Line Transform
        this.cv.HoughLinesP(binary, lines, 1, Math.PI / 180, 50, options.minLineLength, options.maxLineGap);

        const detected: DetectedLine[] = [];

        for (let i = 0; i < lines.rows; ++i) {
            const startPoint = lines.data32S.slice(i * 4, i * 4 + 2);
            const endPoint = lines.data32S.slice(i * 4 + 2, i * 4 + 4);

            let x1 = startPoint[0];
            let y1 = startPoint[1];
            let x2 = endPoint[0];
            let y2 = endPoint[1];

            if (options.orthoOnly) {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const absAngle = Math.abs(angle);
                const isHoriz = absAngle < 10 || absAngle > 170;
                const isVert = Math.abs(absAngle - 90) < 10;

                if (!isHoriz && !isVert) continue;

                if (isHoriz) {
                    const avgY = Math.round((y1 + y2) / 2);
                    y1 = avgY; y2 = avgY;
                } else if (isVert) {
                    const avgX = Math.round((x1 + x2) / 2);
                    x1 = avgX; x2 = avgX;
                }
            }

            detected.push({ x1, y1, x2, y2 });
        }

        src.delete();
        gray.delete();
        binary.delete();
        lines.delete();

        // MERGE STEPS
        // 1. Merge Parallel (Double lines -> Single Centerline)
        let merged = this.mergeParallelLines(detected, 10, 25);

        // 2. Merge Collinear (Fragmented lines -> Solid lines)
        let prevCount = -1;
        while (merged.length !== prevCount) {
            prevCount = merged.length;
            merged = this.mergeCollinearLines(merged, 5, 50); // Increased gap jump
        }

        // 3. Trim/Extend Corners (Connect T-junctions)
        const snapDist = options.snapDistance || 30;
        merged = this.trimCorners(merged, snapDist);

        return {
            lines: merged,
            debugData
        };
    }

    private trimCorners(lines: DetectedLine[], snapDist: number): DetectedLine[] {
        for (let i = 0; i < lines.length; i++) {
            for (let j = 0; j < lines.length; j++) {
                if (i === j) continue;
                const l1 = lines[i];
                const l2 = lines[j];
                const det = (l1.x2 - l1.x1) * (l2.y2 - l2.y1) - (l2.x2 - l2.x1) * (l1.y2 - l1.y1);
                if (det === 0) continue; // Parallel

                const lambda = ((l2.y2 - l2.y1) * (l2.x1 - l1.x1) + (l2.x1 - l2.x2) * (l2.y1 - l1.y1)) / det;
                // const gamma = ((l1.y1 - l1.y2) * (l2.x1 - l1.x1) + (l1.x2 - l1.x1) * (l2.y1 - l1.y1)) / det; // Unused

                const intX = l1.x1 + lambda * (l1.x2 - l1.x1);
                const intY = l1.y1 + lambda * (l1.y2 - l1.y1);

                // Check bounds with buffer to support T-junctions
                const buffer = snapDist;

                // Is int point "on" L2?
                const inL2 = (
                    intX >= Math.min(l2.x1, l2.x2) - buffer &&
                    intX <= Math.max(l2.x1, l2.x2) + buffer &&
                    intY >= Math.min(l2.y1, l2.y2) - buffer &&
                    intY <= Math.max(l2.y1, l2.y2) + buffer
                );

                // Is int point "on" L1?
                const inL1 = (
                    intX >= Math.min(l1.x1, l1.x2) - buffer &&
                    intX <= Math.max(l1.x1, l1.x2) + buffer &&
                    intY >= Math.min(l1.y1, l1.y2) - buffer &&
                    intY <= Math.max(l1.y1, l1.y2) + buffer
                );

                const d1_start = Math.hypot(l1.x1 - intX, l1.y1 - intY);
                const d1_end = Math.hypot(l1.x2 - intX, l1.y2 - intY);
                const d2_start = Math.hypot(l2.x1 - intX, l2.y1 - intY);
                const d2_end = Math.hypot(l2.x2 - intX, l2.y2 - intY);

                if (inL2) {
                    if (d1_start < snapDist) { l1.x1 = intX; l1.y1 = intY; }
                    else if (d1_end < snapDist) { l1.x2 = intX; l1.y2 = intY; }
                }
                if (inL1) {
                    if (d2_start < snapDist) { l2.x1 = intX; l2.y1 = intY; }
                    else if (d2_end < snapDist) { l2.x2 = intX; l2.y2 = intY; }
                }
            }
        }
        return lines;
    }

    private mergeLines(lines: DetectedLine[], angleThresh: number, distThresh: number): DetectedLine[] {
        // Legacy wrapper if needed, but logic is moved to detect()
        return lines;
    }

    private mergeParallelLines(lines: DetectedLine[], angleThreshDeg: number, distThresh: number): DetectedLine[] {
        const merged: DetectedLine[] = [];
        const used = new Set<number>();
        const angleThresh = angleThreshDeg * Math.PI / 180;
        const sorted = lines.slice().sort((a, b) => {
            return Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
        });

        for (let i = 0; i < sorted.length; i++) {
            if (used.has(i)) continue;
            let current = sorted[i];
            const bundle = [current];
            used.add(i);

            for (let j = i + 1; j < sorted.length; j++) {
                if (used.has(j)) continue;
                const next = sorted[j];
                const angle1 = Math.atan2(current.y2 - current.y1, current.x2 - current.x1);
                const angle2 = Math.atan2(next.y2 - next.y1, next.x2 - next.x1);
                let diff = Math.abs(angle1 - angle2);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                const isParallel = (diff < angleThresh) || (Math.abs(diff - Math.PI) < angleThresh);
                if (!isParallel) continue;

                const midX = (next.x1 + next.x2) / 2;
                const midY = (next.y1 + next.y2) / 2;
                const A = current.y1 - current.y2;
                const B = current.x2 - current.x1;
                const C = current.x1 * current.y2 - current.x2 * current.y1;
                const dist = Math.abs(A * midX + B * midY + C) / Math.sqrt(A * A + B * B);

                if (dist > distThresh) continue;

                const len = Math.sqrt(B * B + A * A);
                const ux = (current.x2 - current.x1) / len;
                const uy = (current.y2 - current.y1) / len;
                const p3 = (next.x1 - current.x1) * ux + (next.y1 - current.y1) * uy;
                const p4 = (next.x2 - current.x1) * ux + (next.y2 - current.y1) * uy;
                const minNext = Math.min(p3, p4);
                const maxNext = Math.max(p3, p4);
                const overlapStart = Math.max(0, minNext);
                const overlapEnd = Math.min(len, maxNext);

                if (overlapStart < overlapEnd) {
                    bundle.push(next);
                    used.add(j);
                }
            }

            if (bundle.length > 1) {
                let sumDX = 0, sumDY = 0;
                let centerX = 0, centerY = 0;
                const baseAngle = Math.atan2(current.y2 - current.y1, current.x2 - current.x1);
                bundle.forEach(l => {
                    let dx = l.x2 - l.x1;
                    let dy = l.y2 - l.y1;
                    const ang = Math.atan2(dy, dx);
                    if (Math.abs(ang - baseAngle) > Math.PI / 2) { dx = -dx; dy = -dy; }
                    sumDX += dx; sumDY += dy;
                    centerX += (l.x1 + l.x2) / 2; centerY += (l.y1 + l.y2) / 2;
                });
                const avgAngle = Math.atan2(sumDY, sumDX);
                const avgCenterX = centerX / bundle.length;
                const avgCenterY = centerY / bundle.length;
                const ax = Math.cos(avgAngle);
                const ay = Math.sin(avgAngle);
                let minProj = Infinity;
                let maxProj = -Infinity;
                bundle.forEach(l => {
                    const proj1 = (l.x1 - avgCenterX) * ax + (l.y1 - avgCenterY) * ay;
                    const proj2 = (l.x2 - avgCenterX) * ax + (l.y2 - avgCenterY) * ay;
                    minProj = Math.min(minProj, proj1, proj2);
                    maxProj = Math.max(maxProj, proj1, proj2);
                });
                merged.push({
                    x1: avgCenterX + minProj * ax,
                    y1: avgCenterY + minProj * ay,
                    x2: avgCenterX + maxProj * ax,
                    y2: avgCenterY + maxProj * ay
                });
            } else {
                merged.push(current);
            }
        }
        return merged;
    }

    private mergeCollinearLines(lines: DetectedLine[], angleThresh: number, distThresh: number): DetectedLine[] {
        if (lines.length < 2) return lines;
        const merged: DetectedLine[] = [];
        const used = new Set<number>();
        const sorted = lines.map(l => {
            if (l.x1 > l.x2 || (l.x1 === l.x2 && l.y1 > l.y2)) {
                return { x1: l.x2, y1: l.y2, x2: l.x1, y2: l.y1 };
            }
            return l;
        });

        for (let i = 0; i < sorted.length; i++) {
            if (used.has(i)) continue;
            let current = sorted[i];
            used.add(i);
            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < sorted.length; j++) {
                    if (used.has(j)) continue;
                    const next = sorted[j];
                    const angle1 = Math.atan2(current.y2 - current.y1, current.x2 - current.x1);
                    const angle2 = Math.atan2(next.y2 - next.y1, next.x2 - next.x1);
                    const diff = Math.abs(angle1 - angle2);
                    const angleDiff = Math.min(diff, Math.PI - diff);
                    if (angleDiff > (angleThresh * Math.PI / 180)) continue;

                    const num = Math.abs((current.y2 - current.y1) * next.x1 - (current.x2 - current.x1) * next.y1 + current.x2 * current.y1 - current.y2 * current.x1);
                    const den = Math.sqrt(Math.pow(current.y2 - current.y1, 2) + Math.pow(current.x2 - current.x1, 2));
                    const distToLine = num / den;
                    if (distToLine > distThresh) continue;

                    const d1 = Math.hypot(current.x1 - next.x1, current.y1 - next.y1);
                    const d2 = Math.hypot(current.x1 - next.x2, current.y1 - next.y2);
                    const d3 = Math.hypot(current.x2 - next.x1, current.y2 - next.y1);
                    const d4 = Math.hypot(current.x2 - next.x2, current.y2 - next.y2);

                    if (Math.min(d1, d2, d3, d4) < distThresh) {
                        const allPoints = [
                            { x: current.x1, y: current.y1 }, { x: current.x2, y: current.y2 },
                            { x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }
                        ];
                        allPoints.sort((a, b) => (a.x - b.x) || (a.y - b.y));
                        current = { x1: allPoints[0].x, y1: allPoints[0].y, x2: allPoints[3].x, y2: allPoints[3].y };
                        used.add(j);
                        changed = true;
                    }
                }
            }
            merged.push(current);
        }
        return merged;
    }
}
