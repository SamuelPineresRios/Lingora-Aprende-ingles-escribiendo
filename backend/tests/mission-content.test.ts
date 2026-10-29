/**
 * Guardarraíl de contenido: las misiones de caso deben dar todos los datos
 * necesarios para responder. El alumno no puede tener que inventarse riesgos,
 * archivos, cifras, decisiones ni opciones que la misión no le da.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface MissionFixture {
  id: string
  title: string
  objective: string | null
  scene_context: string | null
}

const missions = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '../scripts/fixtures/missions.json'), 'utf-8'),
) as MissionFixture[]

const CASE_MISSION_IDS = [
  'm-031',
  'm-049',
  'm-107',
  'm-111',
  'm-121',
  'm-125',
  ...Array.from({ length: 45 }, (_, index) => `m-${126 + index}`),
]

describe('contenido de misiones de caso', () => {
  it('todas las misiones tienen objetivo', () => {
    for (const mission of missions) {
      expect(mission.objective?.trim(), mission.id).toBeTruthy()
    }
  })

  it('ninguna misión pide al alumno inventar datos', () => {
    for (const mission of missions) {
      expect(mission.objective ?? '', mission.id).not.toMatch(
        /\b(inventa|inventar|imagina|imaginar|invéntate|imaginártelo)\b/i,
      )
    }
  })

  it('las misiones de caso incluyen datos concretos y contexto sin lista de pasos', () => {
    for (const id of CASE_MISSION_IDS) {
      const mission = missions.find(candidate => candidate.id === id)
      expect(mission, id).toBeDefined()
      const objective = mission?.objective ?? ''
      const scene = mission?.scene_context ?? ''

      expect(objective.length, `${id} debe tener un caso desarrollado`).toBeGreaterThan(80)
      expect(objective, `${id} debe incluir algún dato concreto`).toMatch(
        /\d|[A-Z][a-z]+|src\/|npm |github|PR |VS Code/,
      )
      expect(scene, `${id} no debe exponer la lista interna de pasos`).not.toMatch(
        /Completa \d+ pasos/i,
      )
    }
  })
})
