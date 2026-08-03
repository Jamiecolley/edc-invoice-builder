import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const requiredMarkup = [
  '<th className="org-actions"><span>Action</span></th>',
  '<td className="org-actions">',
  'onClick={() => startEditOrg(o)}',
  'onClick={cancelEditOrg}',
  'onClick={() => saveOrg(o)}',
];

const missing = requiredMarkup.filter(markup => !source.includes(markup));

if (missing.length) {
  console.error('Organisation action controls are incomplete:');
  missing.forEach(markup => console.error(`- Missing ${markup}`));
  process.exit(1);
}

console.log('Organisation action controls verified.');
