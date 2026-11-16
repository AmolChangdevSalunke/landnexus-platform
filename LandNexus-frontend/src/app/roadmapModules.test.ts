import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROADMAP_KEY,
  IMPLEMENTED_MODULES,
  ROADMAP_MODULES,
} from './roadmapModules'

describe('platform module catalogue', () => {
  it('links implemented modules to real application routes', () => {
    expect(IMPLEMENTED_MODULES.length).toBeGreaterThan(0)

    for (const module of IMPLEMENTED_MODULES) {
      expect(module.to.startsWith('/')).toBe(true)
      expect(module.to.startsWith('/roadmap/')).toBe(false)
    }

    const routes = IMPLEMENTED_MODULES.map((module) => module.to)
    expect(routes).toContain('/proposals')
    expect(routes).toContain('/projects')
    expect(routes).toContain('/acquisition')
    expect(routes).toContain('/monitoring/compensation')
    expect(routes).toContain('/gis')
    expect(routes).toContain('/land/documents')
    expect(routes).toContain('/monitoring')
    expect(routes).toContain('/notifications')
    expect(routes).toContain('/admin/routing-rules')
  })

  it('keeps only genuinely missing capabilities on the roadmap', () => {
    expect(Object.keys(ROADMAP_MODULES)).toEqual([
      'notification-settings',
      'pfms-dbt',
      'isro-bhuvan',
      'bhunaksha',
      'external-land-records',
      'document-security',
    ])

    for (const module of Object.values(ROADMAP_MODULES)) {
      expect(module.title.length).toBeGreaterThan(0)
      expect(module.summary.length).toBeGreaterThan(0)
      expect(module.contents.length).toBeGreaterThan(0)
    }
  })

  it('does not duplicate implemented modules on the roadmap', () => {
    const roadmapTitles = Object.values(ROADMAP_MODULES).map((module) => module.title)
    for (const module of IMPLEMENTED_MODULES) {
      expect(roadmapTitles).not.toContain(module.title)
    }
  })

  it('provides a default roadmap entry for the legacy /roadmap redirect', () => {
    expect(DEFAULT_ROADMAP_KEY).toBe('notification-settings')
    expect(ROADMAP_MODULES[DEFAULT_ROADMAP_KEY]).toBeDefined()
  })
})
