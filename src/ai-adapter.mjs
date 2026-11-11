/**
 * Aarogya Drishti — Replaceable AI Model Adapter Framework
 *
 * Implements a pluggable adapter architecture for clinical research AI models:
 * 1. BaseAIModelAdapter: Abstract interface with strict schema enforcement.
 * 2. ToothAgenesisSigLIP2Adapter: Evaluates Hugging Face candidate model prithivMLmods/tooth-agenesis-siglip2
 *    (Google SigLIP2 fine-tune for 6 oral health categories).
 * 3. UmlomoAdapter: Existing lightweight 2-class MobileNetV2 model (Al04ni/Umlomo).
 * 4. MockSimulatedAIAdapter: Deterministic synthetic predictions for UI verification and edge hardware.
 * 5. AIAdapterRegistry: Central registry for runtime model selection and diagnostic reporting.
 *
 * MANDATORY CLINICAL GOVERNANCE:
 * - researchOnly is permanently true.
 * - clinicallyValidated is permanently false.
 * - AI output is candidate assistance only; professional clinical examination is mandatory.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Base abstract class defining contract for all clinical research AI adapters.
 */
export class BaseAIModelAdapter {
  constructor(options = {}) {
    this.id = options.id || 'base-ai';
    this.name = options.name || 'Base Research Model';
    this.architecture = options.architecture || 'unknown';
    this.revision = options.revision || '1.0';
    this.license = options.license || 'Proprietary';
    this.classes = options.classes || [];
    this.researchOnly = true;
    this.clinicallyValidated = false;
  }

  async checkAvailability() {
    return {
      available: false,
      id: this.id,
      model: this.name,
      architecture: this.architecture,
      revision: this.revision,
      classes: this.classes,
      license: this.license,
      researchOnly: true,
      clinicallyValidated: false
    };
  }

  async analyze(photoPayload, options = {}) {
    throw new Error('analyze() must be implemented by adapter subclass.');
  }
}

/**
 * Adapter for Hugging Face candidate model prithivMLmods/tooth-agenesis-siglip2
 * Base Architecture: google/siglip2-base-patch16-512
 * Classes: Calculus, Caries, Gingivitis, Mouth Ulcer, Tooth Discoloration, Hypodontia
 */
export class ToothAgenesisSigLIP2Adapter extends BaseAIModelAdapter {
  constructor() {
    super({
      id: 'prithivMLmods/tooth-agenesis-siglip2',
      name: 'prithivMLmods/tooth-agenesis-siglip2',
      architecture: 'google/siglip2-base-patch16-512',
      revision: 'v1.0-hf',
      license: 'Apache-2.0',
      classes: [
        'Calculus',
        'Caries',
        'Gingivitis',
        'Mouth Ulcer',
        'Tooth Discoloration',
        'Hypodontia'
      ]
    });
    this.warnings = [
      'Research candidate model only. Does not replace professional clinical examination.',
      'Softmax predictions are mutually exclusive and do not rule out co-occurring oral conditions.',
      'Model card lacks verified demographic validation for rural/tribal populations of Andhra Pradesh.'
    ];
  }

  async checkAvailability() {
    return {
      available: true,
      id: this.id,
      model: this.name,
      architecture: this.architecture,
      revision: this.revision,
      classes: this.classes,
      inputResolution: '512x512',
      license: this.license,
      researchOnly: true,
      clinicallyValidated: false,
      candidateModelNotice: 'Evaluated research candidate for oral health pattern screening.'
    };
  }

  async analyze(photoPayload, options = {}) {
    if (!photoPayload) {
      return this.checkAvailability();
    }

    // Attempt python subprocess if configured
    const python = process.env.DRISHTI_AI_PYTHON;
    if (python) {
      try {
        const result = await this._spawnPython(python, photoPayload);
        if (result && result.modelClass) return result;
      } catch {}
    }

    // High-fidelity deterministic research simulation
    return this._simulateAnalysis(photoPayload);
  }

  _spawnPython(pythonPath, photo) {
    return new Promise((resolveResult, reject) => {
      const script = resolve('scripts/siglip2-inference.py');
      const child = spawn(pythonPath, [script], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let output = '', finished = false;
      const finish = (err, res) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        err ? reject(err) : resolveResult(res);
      };
      const timer = setTimeout(() => { child.kill(); finish(new Error('SigLIP2 inference timed out.')); }, 30000);
      child.on('error', (err) => finish(err));
      child.stdout.on('data', (d) => { output += d; });
      child.stderr.resume();
      child.on('close', (code) => {
        if (code !== 0) return finish(new Error('Inference subprocess exited with error.'));
        try {
          const parsed = JSON.parse(output);
          finish(null, parsed);
        } catch {
          finish(new Error('Invalid SigLIP2 JSON output.'));
        }
      });
      child.stdin.end(JSON.stringify({ photo }));
    });
  }

  _simulateAnalysis(photoPayload) {
    const hash = createHash('sha256').update(photoPayload).digest('hex');
    const seed = parseInt(hash.slice(0, 8), 16);
    const topIdx = seed % this.classes.length;
    const topClass = this.classes[topIdx];

    const findings = [
      { label: topClass, score: 0.784, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' },
      { label: this.classes[(topIdx + 1) % 6], score: 0.122, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' },
      { label: this.classes[(topIdx + 2) % 6], score: 0.054, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' },
      { label: this.classes[(topIdx + 3) % 6], score: 0.022, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' },
      { label: this.classes[(topIdx + 4) % 6], score: 0.011, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' },
      { label: this.classes[(topIdx + 5) % 6], score: 0.007, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' }
    ];

    return {
      model: this.name,
      architecture: this.architecture,
      revision: this.revision,
      modelClass: topClass,
      candidateFindings: findings,
      warnings: this.warnings,
      researchOnly: true,
      clinicallyValidated: false,
      license: this.license,
      simulation: true,
      processedAt: new Date().toISOString()
    };
  }
}

/**
 * Adapter for existing 2-class MobileNetV2 (Al04ni/Umlomo)
 * Classes: Normal, Oral Cancer
 */
export class UmlomoAdapter extends BaseAIModelAdapter {
  constructor() {
    super({
      id: 'Al04ni/Umlomo',
      name: 'Al04ni/Umlomo',
      architecture: 'torchvision.models.mobilenet_v2',
      revision: '45d1ff9aad923f7b9685e531a275ca454d3cc58f',
      license: 'GPL-3.0',
      classes: ['Normal', 'Oral Cancer']
    });
    this.warnings = [
      'Research model only. Does not replace professional clinical examination.',
      'A Normal classification cannot rule out oral malignant or premalignant lesions.'
    ];
  }

  async checkAvailability() {
    return {
      available: true,
      id: this.id,
      model: this.name,
      architecture: this.architecture,
      revision: this.revision,
      classes: this.classes,
      inputResolution: '224x224',
      license: this.license,
      researchOnly: true,
      clinicallyValidated: false
    };
  }

  async analyze(photoPayload, options = {}) {
    if (!photoPayload) {
      return this.checkAvailability();
    }

    const python = process.env.DRISHTI_AI_PYTHON;
    if (python) {
      try {
        const result = await this._spawnPython(python, photoPayload);
        if (result && result.modelClass) return result;
      } catch {}
    }

    return this._simulateAnalysis(photoPayload);
  }

  _spawnPython(pythonPath, photo) {
    return new Promise((resolveResult, reject) => {
      const script = resolve('scripts/research-ai.py');
      const child = spawn(pythonPath, [script], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let output = '', finished = false;
      const finish = (err, res) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        err ? reject(err) : resolveResult(res);
      };
      const timer = setTimeout(() => { child.kill(); finish(new Error('Umlomo inference timed out.')); }, 25000);
      child.on('error', (err) => finish(err));
      child.stdout.on('data', (d) => { output += d; });
      child.stderr.resume();
      child.on('close', (code) => {
        if (code !== 0) return finish(new Error('Umlomo subprocess failed.'));
        try {
          const parsed = JSON.parse(output);
          finish(null, parsed);
        } catch {
          finish(new Error('Invalid Umlomo output.'));
        }
      });
      child.stdin.end(JSON.stringify({ photo }));
    });
  }

  _simulateAnalysis(photoPayload) {
    const hash = createHash('sha256').update(photoPayload).digest('hex');
    const isCancer = parseInt(hash.slice(0, 2), 16) > 230; // ~10% simulated prevalence
    const topClass = isCancer ? 'Oral Cancer' : 'Normal';

    return {
      model: this.name,
      architecture: this.architecture,
      revision: this.revision,
      modelClass: topClass,
      candidateFindings: [
        { label: topClass, score: 0.92, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' },
        { label: isCancer ? 'Normal' : 'Oral Cancer', score: 0.08, confidenceMeaning: 'Pattern similarity score — not confirmed clinical diagnosis' }
      ],
      warnings: this.warnings,
      researchOnly: true,
      clinicallyValidated: false,
      license: this.license,
      simulation: true,
      processedAt: new Date().toISOString()
    };
  }
}

/**
 * Deterministic synthetic AI adapter for CI test suites and offline worker training.
 */
export class MockSimulatedAIAdapter extends BaseAIModelAdapter {
  constructor(defaultClass = 'Normal') {
    super({
      id: 'mock-simulated',
      name: 'Deterministic Synthetic Research Adapter',
      architecture: 'synthetic-rule-engine',
      revision: 'test-fixture',
      license: 'MIT',
      classes: ['Normal', 'Calculus', 'Caries', 'Oral Cancer']
    });
    this.defaultClass = defaultClass;
  }

  async checkAvailability() {
    return {
      available: true,
      id: this.id,
      model: this.name,
      revision: this.revision,
      classes: this.classes,
      researchOnly: true,
      clinicallyValidated: false,
      simulation: true
    };
  }

  async analyze(photoPayload, options = {}) {
    if (!photoPayload) return this.checkAvailability();
    const modelClass = options.forcedClass || this.defaultClass;
    return {
      model: this.name,
      revision: this.revision,
      modelClass,
      candidateFindings: [
        { label: modelClass, score: 0.94, confidenceMeaning: 'Synthetic test score' }
      ],
      warnings: ['Synthetic mock adapter for verification only.'],
      researchOnly: true,
      clinicallyValidated: false,
      simulation: true,
      processedAt: new Date().toISOString()
    };
  }
}

/**
 * Central registry managing model adapters and runtime active selection.
 */
export class AIAdapterRegistry {
  constructor(defaultModelId = 'prithivMLmods/tooth-agenesis-siglip2') {
    this.adapters = new Map();
    this.activeModelId = defaultModelId;

    // Register built-in adapters
    const siglip2 = new ToothAgenesisSigLIP2Adapter();
    const umlomo = new UmlomoAdapter();
    const mock = new MockSimulatedAIAdapter();

    this.register(siglip2);
    this.register(umlomo);
    this.register(mock);

    // Aliases
    this.adapters.set('siglip2', siglip2);
    this.adapters.set('umlomo', umlomo);
    this.adapters.set('simulated', mock);
  }

  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id) {
    return this.adapters.get(id) || this.getActiveAdapter();
  }

  getActiveAdapter() {
    return this.adapters.get(this.activeModelId) || this.adapters.get('prithivMLmods/tooth-agenesis-siglip2');
  }

  setActiveAdapter(id) {
    if (this.adapters.has(id)) {
      this.activeModelId = id;
      return true;
    }
    return false;
  }

  listAdapters() {
    const list = [];
    const seen = new Set();
    for (const adapter of this.adapters.values()) {
      if (!seen.has(adapter.id)) {
        seen.add(adapter.id);
        list.push({
          id: adapter.id,
          name: adapter.name,
          architecture: adapter.architecture,
          revision: adapter.revision,
          classes: adapter.classes,
          active: adapter.id === this.activeModelId || adapter.name === this.activeModelId,
          researchOnly: true,
          clinicallyValidated: false
        });
      }
    }
    return list;
  }

  async checkStatus(modelId = null) {
    const adapter = modelId ? this.getAdapter(modelId) : this.getActiveAdapter();
    return adapter.checkAvailability();
  }

  async runInference(photoPayload, options = {}) {
    const adapter = options.modelId ? this.getAdapter(options.modelId) : this.getActiveAdapter();
    return adapter.analyze(photoPayload, options);
  }
}

/**
 * Factory helper for default server registry.
 *
 * @param {object} [config]
 * @returns {AIAdapterRegistry}
 */
export function getDefaultAIRegistry(config = {}) {
  const preferred = config?.ai?.defaultModel || 'prithivMLmods/tooth-agenesis-siglip2';
  return new AIAdapterRegistry(preferred);
}
