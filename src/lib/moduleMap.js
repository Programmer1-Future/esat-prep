// Canonical two-level syllabus map: module → topics. Transcribed verbatim from
// E:\brain\ESAT\Module & Topic Map.md (5 modules, 50 topics). This is an explicit
// dictionary, NEVER substring matching — the TMUA engine learned that lesson the
// hard way ('log' matched every logic_* question). Questions already carry their
// own `module` and `topic` ids from the extraction pipeline; this map is the
// source of truth used to group, name, colour, and VALIDATE them.

export const MODULES = [
  {
    id: 'maths1',
    name: 'Mathematics 1',
    short: 'Maths 1',
    color: 'var(--accent)',
    topics: [
      { id: 'm1-units', name: 'Units, dimensions, estimation' },
      { id: 'm1-number', name: 'Number, indices, surds, standard form' },
      { id: 'm1-ratio', name: 'Ratio, proportion, percentages' },
      { id: 'm1-algebra', name: 'Algebra, equations, inequalities' },
      { id: 'm1-geometry', name: 'Geometry, trigonometry, coordinates' },
      { id: 'm1-stats', name: 'Statistics, data interpretation' },
      { id: 'm1-probability', name: 'Probability, basic combinatorics' },
    ],
  },
  {
    id: 'maths2',
    name: 'Mathematics 2',
    short: 'Maths 2',
    color: 'var(--info)',
    topics: [
      { id: 'm2-algebra', name: 'Algebra & functions, polynomials' },
      { id: 'm2-sequences', name: 'Sequences and series' },
      { id: 'm2-coord-geom', name: 'Coordinate geometry, circles' },
      { id: 'm2-trig', name: 'Trigonometry (A-level)' },
      { id: 'm2-exp-log', name: 'Exponentials and logarithms' },
      { id: 'm2-differentiation', name: 'Differentiation' },
      { id: 'm2-integration', name: 'Integration' },
      { id: 'm2-graphs', name: 'Graph sketching, transformations' },
    ],
  },
  {
    id: 'physics',
    name: 'Physics',
    short: 'Physics',
    color: 'var(--warning)',
    topics: [
      { id: 'phy-electricity', name: 'Electricity, circuits' },
      { id: 'phy-magnetism', name: 'Magnetism, induction' },
      { id: 'phy-mechanics', name: 'Mechanics, forces, energy' },
      { id: 'phy-thermal', name: 'Thermal physics' },
      { id: 'phy-matter', name: 'Properties of matter' },
      { id: 'phy-waves', name: 'Waves, optics' },
      { id: 'phy-radioactivity', name: 'Radioactivity, nuclear' },
    ],
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    short: 'Chemistry',
    color: 'var(--danger)',
    topics: [
      { id: 'chem-atomic', name: 'Atomic structure' },
      { id: 'chem-periodic', name: 'Periodic table, trends' },
      { id: 'chem-reactions', name: 'Reactions, equations, balancing' },
      { id: 'chem-quant', name: 'Quantitative chemistry, moles' },
      { id: 'chem-redox', name: 'Redox reactions' },
      { id: 'chem-bonding', name: 'Chemical bonding' },
      { id: 'chem-groups', name: 'Group chemistry' },
      { id: 'chem-separation', name: 'Separation techniques' },
      { id: 'chem-acids', name: 'Acids, bases, pH' },
      { id: 'chem-rates', name: 'Reaction rates' },
      { id: 'chem-energetics', name: 'Energetics, enthalpy' },
      { id: 'chem-electrolysis', name: 'Electrolysis' },
      { id: 'chem-organic', name: 'Organic chemistry' },
      { id: 'chem-metals', name: 'Metals, reactivity' },
      { id: 'chem-kinetic', name: 'Kinetic theory, states' },
      { id: 'chem-tests', name: 'Chemical tests' },
      { id: 'chem-air-water', name: 'Air, water, pollution' },
    ],
  },
  {
    id: 'biology',
    name: 'Biology',
    short: 'Biology',
    color: 'var(--success)',
    topics: [
      { id: 'bio-cells', name: 'Cell structure' },
      { id: 'bio-membranes', name: 'Membranes, transport' },
      { id: 'bio-cell-division', name: 'Cell division' },
      { id: 'bio-inheritance', name: 'Genetics, inheritance' },
      { id: 'bio-dna', name: 'DNA, transcription, translation' },
      { id: 'bio-gene-tech', name: 'Gene technology' },
      { id: 'bio-variation', name: 'Variation, evolution' },
      { id: 'bio-enzymes', name: 'Enzymes' },
      { id: 'bio-animal-physiology', name: 'Animal physiology' },
      { id: 'bio-ecosystems', name: 'Ecosystems, ecology' },
      { id: 'bio-plant-physiology', name: 'Plant physiology' },
    ],
  },
]

// ── Derived lookup tables (built once at module load) ──────────────────────────
const MODULE_BY_ID = new Map(MODULES.map(m => [m.id, m]))
const TOPIC_BY_ID = new Map()
const MODULE_ID_BY_TOPIC = new Map()
for (const m of MODULES) {
  for (const t of m.topics) {
    TOPIC_BY_ID.set(t.id, t)
    MODULE_ID_BY_TOPIC.set(t.id, m.id)
  }
}

export const MODULE_IDS = MODULES.map(m => m.id)
export const VALID_TOPIC_IDS = new Set(TOPIC_BY_ID.keys())

export function getModule(moduleId) {
  return MODULE_BY_ID.get(moduleId) || null
}

export function getModuleName(moduleId) {
  return MODULE_BY_ID.get(moduleId)?.name || moduleId
}

export function getModuleColor(moduleId) {
  return MODULE_BY_ID.get(moduleId)?.color || 'var(--muted)'
}

export function getTopicName(topicId) {
  return TOPIC_BY_ID.get(topicId)?.name || topicId
}

export function moduleForTopic(topicId) {
  return MODULE_ID_BY_TOPIC.get(topicId) || null
}

// A question's topic id, validated against the canonical map. Returns null for a
// topic the map doesn't know — callers treat that as "uncategorised" rather than
// guessing, so bad data surfaces instead of silently miscounting.
export function topicIdForQuestion(q) {
  return q && VALID_TOPIC_IDS.has(q.topic) ? q.topic : null
}

export function questionsForTopics(questions, topicIds) {
  const ids = new Set(topicIds)
  return questions.filter(q => ids.has(topicIdForQuestion(q)))
}

export function questionsForModules(questions, moduleIds) {
  const ids = new Set(moduleIds)
  return questions.filter(q => ids.has(q.module) && topicIdForQuestion(q))
}

export function countByTopic(questions) {
  const counts = {}
  for (const q of questions) {
    const id = topicIdForQuestion(q)
    if (id) counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

export function countByModule(questions) {
  const counts = {}
  for (const q of questions) {
    if (topicIdForQuestion(q)) counts[q.module] = (counts[q.module] || 0) + 1
  }
  return counts
}
