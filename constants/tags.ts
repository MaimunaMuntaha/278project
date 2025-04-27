export const COMMON_TAGS = [
  'AI/ML',
  'Robotics',
  'UX Design',
  'Full-Stack',
  'Quant',
  'AR/VR',
  'Music Tech',
  'Earth System',
  'Biomedical',
  'Sustainability',
  'Entrepreneurship',
  'Social Impact',
  'Blockchain',
  'Hardware',
  'Embedded',
  'Freelance',
  'Photography',
  'Game Dev',
  'iOS',
  'Android',
  'Web3',
  'Cloud',
  'Security',
  'Product',
  'Ed-Tech',
  'Data Viz',
  'Graphics',
  'ML Ops',
  'Miscellaneous',
  'HCI',
];

/* simple in-memory helpers -------------*/
let globalTags = [...COMMON_TAGS];

export async function fetchAllTags(): Promise<string[]> {
  return globalTags;
}

export async function addGlobalTag(tag: string, _uid: string) {
  if (!globalTags.includes(tag)) globalTags.push(tag);
}
