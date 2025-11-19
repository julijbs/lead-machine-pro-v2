import { describe, it, expect } from 'vitest';

// Test utilities for lead analysis scoring
describe('ICP Scoring', () => {
  const calculateICPScore = (lead: {
    website?: string;
    raw_description?: string;
  }): number => {
    let score = 0;

    // +1 for professional website
    if (lead.website && lead.website.length > 0) {
      score += 1;
    }

    // +1 for structured clinic indicators
    const structuredIndicators = ['clínica', 'centro', 'instituto', 'equipe', 'profissionais'];
    if (lead.raw_description && structuredIndicators.some(i => lead.raw_description!.toLowerCase().includes(i))) {
      score += 1;
    }

    // +1 for marketing/tech signals
    const marketingIndicators = ['instagram', 'facebook', 'blog', 'marketing', 'ads', 'digital'];
    if (lead.raw_description && marketingIndicators.some(i => lead.raw_description!.toLowerCase().includes(i))) {
      score += 1;
    }

    return score;
  };

  const getICPLevel = (score: number): string => {
    if (score === 0) return 'descartar';
    if (score === 1) return 'N3';
    if (score === 2) return 'N2';
    return 'N1';
  };

  it('should return 0 for lead without website or indicators', () => {
    const lead = { website: '', raw_description: 'consultório individual' };
    expect(calculateICPScore(lead)).toBe(0);
    expect(getICPLevel(0)).toBe('descartar');
  });

  it('should return 1 for lead with website only', () => {
    const lead = { website: 'https://example.com', raw_description: 'consultório' };
    expect(calculateICPScore(lead)).toBe(1);
    expect(getICPLevel(1)).toBe('N3');
  });

  it('should return 2 for lead with website and structured clinic', () => {
    const lead = { website: 'https://example.com', raw_description: 'clínica de estética' };
    expect(calculateICPScore(lead)).toBe(2);
    expect(getICPLevel(2)).toBe('N2');
  });

  it('should return 3 for lead with all indicators', () => {
    const lead = { website: 'https://example.com', raw_description: 'clínica com instagram ativo' };
    expect(calculateICPScore(lead)).toBe(3);
    expect(getICPLevel(3)).toBe('N1');
  });
});

describe('Revenue Estimation', () => {
  const classifyRevenue = (score: number): { estimado: string; nivel: string } => {
    if (score >= 8) return { estimado: '>500k', nivel: 'premium' };
    if (score >= 6) return { estimado: '300k-500k', nivel: 'alto' };
    if (score >= 3) return { estimado: '100k-300k', nivel: 'médio' };
    return { estimado: '<100k', nivel: 'baixo' };
  };

  it('should classify score 0-2 as baixo', () => {
    expect(classifyRevenue(0)).toEqual({ estimado: '<100k', nivel: 'baixo' });
    expect(classifyRevenue(2)).toEqual({ estimado: '<100k', nivel: 'baixo' });
  });

  it('should classify score 3-5 as médio', () => {
    expect(classifyRevenue(3)).toEqual({ estimado: '100k-300k', nivel: 'médio' });
    expect(classifyRevenue(5)).toEqual({ estimado: '100k-300k', nivel: 'médio' });
  });

  it('should classify score 6-7 as alto', () => {
    expect(classifyRevenue(6)).toEqual({ estimado: '300k-500k', nivel: 'alto' });
    expect(classifyRevenue(7)).toEqual({ estimado: '300k-500k', nivel: 'alto' });
  });

  it('should classify score 8-10 as premium', () => {
    expect(classifyRevenue(8)).toEqual({ estimado: '>500k', nivel: 'premium' });
    expect(classifyRevenue(10)).toEqual({ estimado: '>500k', nivel: 'premium' });
  });
});

describe('Lead Validation', () => {
  const validateLead = (lead: {
    business_name?: string;
    city?: string;
    uf?: string;
  }): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!lead.business_name || lead.business_name.trim() === '') {
      errors.push('business_name is required');
    }

    if (!lead.city || lead.city.trim() === '') {
      errors.push('city is required');
    }

    if (!lead.uf || lead.uf.length !== 2) {
      errors.push('uf must be 2 characters');
    }

    return { valid: errors.length === 0, errors };
  };

  it('should validate a complete lead', () => {
    const lead = { business_name: 'Test', city: 'Rio', uf: 'RJ' };
    const result = validateLead(lead);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject lead without business_name', () => {
    const lead = { business_name: '', city: 'Rio', uf: 'RJ' };
    const result = validateLead(lead);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('business_name is required');
  });

  it('should reject lead with invalid uf', () => {
    const lead = { business_name: 'Test', city: 'Rio', uf: 'RJX' };
    const result = validateLead(lead);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('uf must be 2 characters');
  });
});

describe('Batch Processing', () => {
  const splitIntoBatches = <T>(items: T[], batchSize: number): T[][] => {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  };

  it('should split 100 items into 2 batches of 50', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const batches = splitIntoBatches(items, 50);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(50);
  });

  it('should handle items not divisible by batch size', () => {
    const items = Array.from({ length: 75 }, (_, i) => i);
    const batches = splitIntoBatches(items, 50);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(25);
  });

  it('should handle empty array', () => {
    const batches = splitIntoBatches([], 50);
    expect(batches).toHaveLength(0);
  });

  it('should handle array smaller than batch size', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const batches = splitIntoBatches(items, 50);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(10);
  });
});

describe('CSV Export', () => {
  const escapeCSV = (value: string): string => {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  it('should escape quotes in CSV', () => {
    expect(escapeCSV('Test "quoted" value')).toBe('"Test ""quoted"" value"');
  });

  it('should escape commas in CSV', () => {
    expect(escapeCSV('Test, with comma')).toBe('"Test, with comma"');
  });

  it('should escape newlines in CSV', () => {
    expect(escapeCSV('Test\nwith newline')).toBe('"Test\nwith newline"');
  });

  it('should not escape simple values', () => {
    expect(escapeCSV('Simple value')).toBe('Simple value');
  });
});
