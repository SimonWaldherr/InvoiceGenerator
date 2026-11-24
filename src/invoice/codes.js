// Code values used by EN 16931 validation artefacts 1.3.16,
// BR-CL-14 (address country), BR-CO-09 (VAT prefix), BR-CL-25 (EAS).
// https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/tag/validation-1.3.16
export const commonCountries = new Set(
  `
  1A AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH
  BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO
  CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM
  FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR
  HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW
  KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO
  MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA
  PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG
  SH SI SJ SK SL SM SN SO SR ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO
  TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XI YE YT ZA ZM ZW
`
    .trim()
    .split(/\s+/),
);

export function isCountryCode(code, syntax) {
  return (
    commonCountries.has(code) ||
    (syntax === "CII" && code === "AN") ||
    (syntax === "UBL" && code === "SS")
  );
}

export function isVatCountryCode(code, syntax) {
  return code === "EL" || isCountryCode(code, syntax);
}

export const endpointSchemes = new Set(
  `
  0002 0007 0009 0037 0060 0088 0096 0097 0106 0130 0135 0142 0147 0151 0154
  0158 0170 0177 0183 0184 0188 0190 0191 0192 0193 0194 0195 0196 0198 0199
  0200 0201 0202 0203 0204 0205 0208 0209 0210 0211 0212 0213 0215 0216 0217
  0218 0219 0220 0221 0225 0230 0235 0240 0242 0244 0245 0246 0248 9910 9913
  9914 9915 9918 9919 9920 9922 9923 9924 9925 9926 9927 9928 9929 9930 9931
  9932 9933 9934 9935 9936 9937 9938 9939 9940 9941 9942 9943 9944 9945 9946
  9947 9948 9949 9950 9951 9952 9953 9957 9959 AN AQ AS AU EM
`
    .trim()
    .split(/\s+/),
);
