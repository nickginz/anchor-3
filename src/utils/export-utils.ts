import Konva from 'konva';
import jsPDF from 'jspdf'; // Keep jsPDF for types, although we use pdf-lib for advanced export

interface ExportOptions {
    format: 'png' | 'pdf';
    pdfSize?: 'a4' | 'a3' | 'a2' | 'a1' | 'a0';
    orientation?: 'portrait' | 'landscape';
    quality?: number; // Pixel Ratio
    region?: { x: number; y: number; width: number; height: number } | null;
    fileHandle?: any; // FileSystemFileHandle
}

export const exportCanvas = async (stage: Konva.Stage, options: ExportOptions) => {
    if (!stage) return;

    const { format, pdfSize = 'a4', orientation = 'landscape', quality = 2, region, fileHandle } = options;

    // -------------------------------------------------------------
    // 1. Calculate Export Area (Bounding Box)
    // -------------------------------------------------------------
    const gridLinesNode = stage.findOne('.grid-lines');
    const exportVisuals = stage.find('.export-region-visual');

    if (gridLinesNode) gridLinesNode.hide();
    exportVisuals.forEach(n => n.hide());

    let exportRect = { x: 0, y: 0, width: stage.width(), height: stage.height() };

    if (region) {
        if (Array.isArray(region)) {
            const xs = region.map((p: any) => p.x);
            const ys = region.map((p: any) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            exportRect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        } else {
            exportRect = {
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height
            };
        }
    } else {
        const box = stage.getClientRect({ skipTransform: true });
        const padding = 50;
        exportRect = {
            x: box.x - padding,
            y: box.y - padding,
            width: box.width + padding * 2,
            height: box.height + padding * 2
        };
        // Safety check
        if (exportRect.width <= padding * 2 || exportRect.height <= padding * 2) {
            exportRect = { x: 0, y: 0, width: stage.width(), height: stage.height() };
        }
    }

    if (gridLinesNode) gridLinesNode.show();
    exportVisuals.forEach(n => n.show());

    // DEBUG: Abort if huge
    if (exportRect.width > 15000 || exportRect.height > 15000) {
        alert(`Export Aborted: Calculated region is excessively large (${Math.round(exportRect.width)}x${Math.round(exportRect.height)}). This usually means a Grid line or stray object is visible.`);
        return;
    }

    // -------------------------------------------------------------
    // 2. Create Ghost Stage (Clone)
    // -------------------------------------------------------------
    const ghostContainer = document.createElement('div');
    const ghostStage = new Konva.Stage({
        container: ghostContainer,
        width: exportRect.width,
        height: exportRect.height
    });

    const layers = stage.getLayers();
    layers.forEach(layer => {
        const cloned = layer.clone();
        ghostStage.add(cloned);
    });

    // -------------------------------------------------------------
    // 3. Prepare Ghost Stage (Styles & Transforms)
    // -------------------------------------------------------------
    ghostStage.scale({ x: 1, y: 1 });
    ghostStage.position({ x: -exportRect.x, y: -exportRect.y });

    const ghostGridLines = ghostStage.findOne('.grid-lines');
    if (ghostGridLines) ghostGridLines.hide();

    const ghostVisuals = ghostStage.find('.export-region-visual');
    ghostVisuals.forEach(n => n.destroy());

    const ghostWallFills = ghostStage.find('.wall-fill');
    ghostWallFills.forEach(n => n.hide());

    const ghostWallBoundary = ghostStage.findOne('.wall-boundary');
    if (ghostWallBoundary) {
        (ghostWallBoundary as any).stroke('#000000');
        (ghostWallBoundary as any).strokeWidth(1);
    }

    const ghostBackgroundLayer = ghostStage.findOne('.background-layer');
    const dimGroup = ghostStage.findOne('.dimensions-group');
    const anchorRadiusGroups = ghostStage.find('.anchor-radius');
    const anchorCoreGroups = ghostStage.find('.anchor-core');

    ghostStage.draw();

    // Verify Dimensions
    if (format === 'pdf') {
        alert(`Debug Export:
         Region: ${Math.round(exportRect.width)} x ${Math.round(exportRect.height)}
         Grid Hidden: ${!!gridLinesNode}
         Dimensions Layer Found: ${!!dimGroup}
         Visible: ${dimGroup ? dimGroup.isVisible() : 'N/A'}
         `);
    }

    try {
        const defaultName = `project-${new Date().toISOString().slice(0, 10)}`;
        const ext = format === 'png' ? 'png' : 'pdf';
        const mime = format === 'pdf' ? 'application/pdf' : 'image/png'; // Corrected mime for PDF

        const saveFile = async (blob: Blob, defaultName: string) => {
            if (fileHandle) {
                // Use the handle acquired in Sidebar (User Gesture context)
                try {
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err) {
                    console.error('Failed to write to file handle:', err);
                    alert('Failed to save file: ' + err);
                }
            } else {
                // Legacy Fallback (or if user cancelled picker in Sidebar)
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${defaultName}.${ext}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };

        if (format === 'pdf') {
            // -- FLATTENED PDF EXPORT (Robust & High Quality) --
            let pdfLib;
            try {
                pdfLib = await import('pdf-lib');
            } catch (err) {
                alert('Failed to load pdf-lib: ' + err);
                console.error(err);
                throw err;
            }
            const { PDFDocument } = pdfLib;
            const pdfDoc = await PDFDocument.create();

            const sizes: Record<string, [number, number]> = {
                'a4': [595.28, 841.89],
                'a3': [841.89, 1190.55],
                'a2': [1190.55, 1683.78],
                'a1': [1683.78, 2383.94],
                'a0': [2383.94, 3370.39]
            };

            let [pageW, pageH] = sizes[pdfSize as string] || sizes['a4'];
            if (orientation === 'landscape') {
                [pageW, pageH] = [pageH, pageW];
            }

            const page = pdfDoc.addPage([pageW, pageH]);

            // Show ALL elements for flattened export
            if (ghostBackgroundLayer) ghostBackgroundLayer.show();
            if (ghostWallBoundary) ghostWallBoundary.show();
            ghostWallFills.forEach(n => n.show());
            if (dimGroup) dimGroup.show();
            anchorCoreGroups.forEach(n => n.show());
            anchorRadiusGroups.forEach(n => n.show());

            ghostStage.draw();

            // Use higher pixel ratio for sharp print result (High Quality)
            const pixelRatio = Math.max(quality * 2, 3); // e.g. 4–6 for A3/A2
            const canvas = ghostStage.toCanvas({ pixelRatio });

            // Composite with white bg + optional antialiasing
            const composite = document.createElement('canvas');
            composite.width = canvas.width;
            composite.height = canvas.height;
            const ctx = composite.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, composite.width, composite.height);
                ctx.imageSmoothingEnabled = true; // smooth scaling
                ctx.drawImage(canvas as any, 0, 0); // Explicit cast as standard canvas
            }

            // JPEG with high quality (smaller than PNG, good for drawings)
            const dataUrl = composite.toDataURL('image/jpeg', 0.94);
            const res = await fetch(dataUrl);
            const bytes = await res.arrayBuffer();
            const img = await pdfDoc.embedJpg(bytes);

            // Fit calculation (with padding)
            const rawW = ghostStage.width();
            const rawH = ghostStage.height();
            const ratio = Math.min(pageW / rawW, pageH / rawH) * 0.98; // slight shrink to avoid edge clipping
            const scaledW = rawW * ratio;
            const scaledH = rawH * ratio;
            const centerX = (pageW - scaledW) / 2;
            const centerY = (pageH - scaledH) / 2;

            page.drawImage(img, {
                x: centerX,
                y: centerY,
                width: scaledW,
                height: scaledH,
            });

            // Metadata
            pdfDoc.setTitle('Anchor Planner Export');
            pdfDoc.setProducer('Anchor Planner Pro');

            const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            await saveFile(blob, defaultName);

        } else {
            // -- PNG EXPORT (Flat) --
            // Show all for flat export
            if (ghostBackgroundLayer) ghostBackgroundLayer.show();
            if (ghostWallBoundary) ghostWallBoundary.show();
            if (dimGroup) dimGroup.show();
            anchorRadiusGroups.forEach(n => n.show());
            anchorCoreGroups.forEach(n => n.show());

            ghostStage.draw();
            const canvas = ghostStage.toCanvas({ pixelRatio: quality });

            // Composite White Background
            const c = document.createElement('canvas');
            c.width = canvas.width;
            c.height = canvas.height;
            const ctx = c.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(canvas as any, 0, 0);
            }
            const data = c.toDataURL(mime, 1.0);
            const res = await fetch(data);
            const blob = await res.blob();
            await saveFile(blob, defaultName);
        }

    } finally {
        ghostStage.destroy();
        ghostContainer.remove();
    }
};
