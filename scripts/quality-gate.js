#!/usr/bin/env node
/**
 * quality-gate.js — Full quality check for Udemy Learner
 * Usage: node scripts/quality-gate.js
 * Exit code 0 = all passed, 1 = one or more failed
 */

const { execSync } = require('child_process')

const steps = [
  { label: 'Lint', cmd: 'npm run lint' },
  { label: 'Type check', cmd: 'npx tsc --noEmit' },
  { label: 'Unit tests', cmd: 'npm run test:run' },
  { label: 'Build', cmd: 'npm run build' },
]

let failed = 0

console.log('='.repeat(50))
console.log('  QUALITY GATE')
console.log('='.repeat(50))

for (const step of steps) {
  process.stdout.write(`\n▶ ${step.label}... `)
  try {
    execSync(step.cmd, { stdio: 'pipe' })
    console.log('✅ PASSED')
  } catch (err) {
    console.log('❌ FAILED')
    const output = err.stdout?.toString() || err.stderr?.toString() || ''
    if (output) {
      console.log(output.slice(0, 2000))
    }
    failed++
  }
}

console.log('\n' + '='.repeat(50))
if (failed === 0) {
  console.log(`  ✅ ALL ${steps.length} CHECKS PASSED`)
} else {
  console.log(`  ❌ ${failed}/${steps.length} CHECKS FAILED`)
}
console.log('='.repeat(50))

process.exit(failed > 0 ? 1 : 0)
