// @ts-nocheck
export type AtlasFrame = {
    frame: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    sourceSize: {
        w: number;
        h: number;
    };
    pivot: {
        x: number;
        y: number;
    };
};

export type Atlas = {
    frames: {
        [id: string]: AtlasFrame;
    },
    meta: {
        app: string;
        version: string;
        image: string;
        format: string;
        size: {
            w: number;
            h: number;
        };
        scale: number;
    };
};

export const extractImage = (atlas: Atlas, image: HTMLImageElement, sourceName: string) => {
    const currentImageData = atlas.frames[sourceName];
    const { x, y, w, h } = currentImageData.frame;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (ctx != null) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(image, x, y, w, h, 0, 0, w, h);

        const subsprite = new Image();
        subsprite.src = canvas.toDataURL();
        return subsprite;
    }
    return null;
};
