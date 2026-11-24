import regularDeflate from "../../../assets/fonts/NotoSans-Regular.ttf.deflate";
import boldDeflate from "../../../assets/fonts/NotoSans-Bold.ttf.deflate";
import icc from "../../../assets/sRGB2014.icc";
import { inflateFont } from "./inflate-font.js";

let assets;

export function getPdfAssets() {
  assets ??= {
    regularFont: inflateFont(regularDeflate),
    boldFont: inflateFont(boldDeflate),
    icc,
  };
  return assets;
}
