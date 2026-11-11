// Corner icons that tell the reader what kind of element they are looking at.
// The set is closed: specs pick a key from ICON_KINDS, never supply markup.

const STROKE = "fill='none' stroke='#000' stroke-width='1.1'";

const SVG = {
  actor: `<circle cx='7' cy='3' r='2'/><path d='M7 5v4M3.5 6.5h7M7 9l-3 4M7 9l3 4'/>`,
  goal: `<circle cx='7' cy='7' r='6'/><circle cx='7' cy='7' r='3.5'/><circle cx='7' cy='7' r='1' fill='#000'/>`,
  capability: `<path d='M1 13h12V1H9v4H5v4H1z'/><path d='M9 5v8M5 9v4'/>`,
  service: `<rect x='1' y='4' width='12' height='6' rx='3'/>`,
  process: `<path d='M1 5h7V2l5 5-5 5V9H1z'/>`,
  function: `<path d='M1 3l3 4-3 4h9l3-4-3-4z'/>`,
  component: `<rect x='4' y='1' width='9' height='12'/><rect x='1.5' y='3.5' width='5' height='2.5' fill='#fff'/><rect x='1.5' y='8' width='5' height='2.5' fill='#fff'/>`,
  interface: `<circle cx='9' cy='7' r='3.5'/><path d='M1 7h4.5'/>`,
  data: `<rect x='1' y='2' width='12' height='10'/><path d='M1 5h12'/>`,
  node: `<path d='M1 4h9v9H1zM1 4l3-3h9v9l-3 3M10 4l3-3'/>`,
  device: `<rect x='2' y='1.5' width='10' height='7' rx='1'/><path d='M1 12.5h12l-1.5-4h-9z'/>`,
  principle: `<rect x='1' y='1' width='12' height='12'/><path d='M7 3v5M7 10v1'/>`,
  framework: `<path d='M1 3h5l1 2h6v7H1z'/>`,
  location: `<path d='M7 13S2.5 8 2.5 5a4.5 4.5 0 0 1 9 0C11.5 8 7 13 7 13z'/>`,
  value: `<ellipse cx='7' cy='7' rx='6' ry='4'/>`,
  chain: `<rect x='1' y='4.5' width='6' height='5' rx='2.5'/><rect x='7' y='4.5' width='6' height='5' rx='2.5'/>`,
  risk: `<path d='M7 1.5l6 11H1z'/><path d='M7 5.5v3.5M7 10.5v1'/>`,
};

export const ICON_KINDS = Object.keys(SVG);

function dataUri(kind) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' ${STROKE}>${SVG[kind]}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

/** CSS rules mapping .k-<kind> to its icon. */
export function iconCss() {
  return ICON_KINDS.map((k) => `.k-${k} > .ic { background-image: ${dataUri(k)}; }`).join('\n');
}
