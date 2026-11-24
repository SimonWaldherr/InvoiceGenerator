import { create } from "fontkit";

// pdf-lib 1.x reads a subset as a stream. Fontkit 2 encodes it as one byte array.
export const pdfFontEngine = {
  create(bytes) {
    const font = create(bytes);
    const createSubset = font.createSubset.bind(font);
    font.createSubset = () => {
      const subset = createSubset();
      return {
        cff: subset.cff,
        includeGlyph: (glyph) => subset.includeGlyph(glyph),
        encodeStream() {
          const listeners = {};
          queueMicrotask(() => {
            try {
              listeners.data(subset.encode());
              listeners.end();
            } catch (error) {
              listeners.error(error);
            }
          });
          return {
            on(event, listener) {
              listeners[event] = listener;
              return this;
            },
          };
        },
      };
    };
    return font;
  },
};
